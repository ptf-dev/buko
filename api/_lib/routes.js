// @ts-check
import { createSession, currentUser, destroySession, hashPassword, newId, requireFinance, requireUser, verifyPassword } from './auth.js'
import {
  checkTotp,
  clientIp,
  completePasswordReset,
  confirmEmail,
  consumeToken,
  issueToken,
  limit,
  loginKeys,
  newTotpSecret,
  otpauthUrl,
  record,
  recoveryCodes,
  requestPasswordReset,
  sendVerification,
  verifySecondFactor,
} from './accounts.js'
import { HttpError, query, tx } from './db.js'
import { resolveWindow, TIMEZONE } from './time.js'
import { deviceId, email, int, num, oneOf, optStr, password, str } from './validate.js'
import { cashEligibility, COMPLAINT_REASONS, COMPLAINT_WINDOW_HOURS, recordCancellation, recordCashCollected, recordClose, recordSale } from './finance.js'
import { queueRefund } from './payments/queue.js'
import { expirePendingPayments, failPayment, PAYMENT_HOLD_MINUTES, processRefunds, startPayment, verifyPayment } from './payments/service.js'
import { pokConfigured, pokEnv } from './payments/providers.js'
import { FINANCE_ROUTES } from './finance-routes.js'
import { adminMonitoring, adminResolveError, adminTestEmail, reportError, trackEvents } from './monitoring.js'
import { fcmConfigured, removeSubscription, saveSubscription, sendDueReminders, sendReceipt, webPushConfigured } from './notify.js'

/**
 * @typedef {{ req: Request, url: URL, params: Record<string, string>, body: any, raw?: string, secure: boolean }} Ctx
 * @typedef {{ status?: number, body?: unknown, text?: string, bytes?: Uint8Array, headers?: Record<string, string> }} Result
 * @typedef {(ctx: Ctx) => Promise<Result>} Handler
 */

const CATEGORIES = ['meals', 'bakery', 'groceries', 'dessert', 'drinks', 'other']
const PAYMENT_METHODS = ['card', 'apple-pay', 'google-pay', 'paypal', 'cash']
/** Orders a store should see and count: paid (or cash) reservations and their outcomes. */
const LIVE_ORDER = "status in ('reserved','collected','no_show')"
/** Accounts allowed to make test payments (TESTER_EMAILS, comma-separated). @param {string | undefined} email */
function isTester(email) {
  if (!email) return false
  return (process.env.TESTER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())
}

const RATING_TAGS = ['Great value', 'Great quantity', 'Great quality', 'Friendly staff', 'Easy pickup']
const MAX_PER_ORDER = 4
const CANCEL_CUTOFF_MS = 2 * 60 * 60_000
/** Customers can swipe to collect from this long before the pickup window opens (staff can hand over a little early). */
const EARLY_COLLECT_MS = 15 * 60_000

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

const STORE_SELECT = `
  select s.*, b.id as bag_id, b.title, b.description, b.price, b.original_price, b.quantity,
         b.pickup_day, b.pickup_start, b.pickup_end, b.diet, b.allergens_note, b.is_new, b.paused, b.updated_at as bag_updated_at,
         coalesce(bi.accepts_cash, false) as accepts_cash, ph.updated_at as photo_at
    from stores s
    left join bags b on b.store_id = s.id
    left join store_billing bi on bi.store_id = s.id
    left join store_photos ph on ph.store_id = s.id`

/** @param {any} r */
function toStore(r) {
  return {
    id: r.id,
    name: r.name,
    branch: r.branch ?? undefined,
    category: r.category,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    rating: Math.round(r.rating * 10) / 10,
    ratingCount: r.rating_count,
    highlights: r.highlights,
    reviews: r.reviews,
    acceptsCash: r.accepts_cash || undefined,
    // Versioned so a new upload is never served from cache.
    photoUrl: r.photo_at ? `/api/stores/${r.id}/photo?v=${new Date(r.photo_at).getTime()}` : undefined,
    bag: {
      id: r.bag_id,
      title: r.title,
      description: r.description,
      price: r.price,
      originalPrice: r.original_price,
      // A paused listing shows as sold out to customers.
      quantity: r.paused ? 0 : r.quantity,
      pickup: { day: r.pickup_day, start: r.pickup_start, end: r.pickup_end },
      diet: r.diet ?? undefined,
      allergensNote: r.allergens_note,
      isNew: r.is_new,
    },
  }
}

/** Store as seen by its partner or an admin: includes status, contact details and the real stock count. */
/** @param {any} r */
function toManagedStore(r) {
  const s = toStore(r)
  return {
    ...s,
    bag: { ...s.bag, quantity: r.quantity, paused: r.paused, updatedAt: r.bag_updated_at },
    status: r.status,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    note: r.note,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
  }
}

/** @param {any} r */
function toOrder(r) {
  return {
    id: r.id,
    storeId: r.store_id,
    bagId: r.bag_id,
    quantity: r.quantity,
    unitPrice: r.unit_price,
    unitOriginalPrice: r.unit_original_price,
    pickupStart: new Date(r.pickup_start).getTime(),
    pickupEnd: new Date(r.pickup_end).getTime(),
    pickupCode: r.pickup_code,
    createdAt: new Date(r.created_at).getTime(),
    // A no-show is closed on the server; the apps already show a reserved order past its window as "missed".
    status: r.status === 'no_show' || r.status === 'pending_payment' ? 'reserved' : r.status === 'expired' ? 'cancelled' : r.status,
    paymentStatus: r.status === 'pending_payment' ? 'pending' : r.status === 'expired' ? 'failed' : undefined,
    cancelledBy: r.cancelled_by ?? undefined,
    cancelReason: r.cancelled_by === 'store' ? (r.cancel_reason ?? undefined) : undefined,
    complaint: r.complaint_status ? { status: r.complaint_status, refundAmount: r.complaint_refund ?? undefined } : undefined,
    paymentMethod: r.payment_method,
    rating: r.rating ?? undefined,
    ratingTags: r.rating_tags ?? undefined,
    collectedAt: r.collected_at ? new Date(r.collected_at).getTime() : undefined,
    storeName: r.store_name ?? undefined,
    isDemo: r.is_demo || undefined,
  }
}

function pickupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** @param {string} name */
function slugify(name) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'store'}-${newId().slice(0, 4)}`
}

/**
 * Who is acting on customer orders: always the device, plus the signed-in customer account if any.
 * @param {Request} req @param {unknown} rawDevice
 */
async function customerContext(req, rawDevice) {
  const device = deviceId(rawDevice)
  const user = await currentUser(req)
  return { device, userId: user?.role === 'customer' ? user.id : null }
}

/** SQL condition: the order belongs to this device or this customer account. Uses params $2 (device) and $3 (user). */
/** Account orders belong to the account only; older device-only orders still belong to the device. */
const OWNS_ORDER = '((user_id is null and device_id = $2) or ($3::text is not null and user_id = $3))'

/* ------------------------------------------------------------------ */
/* Customer endpoints                                                  */
/* ------------------------------------------------------------------ */

/** @type {Handler} */
async function health() {
  const { rows } = await query(`select exists(select 1 from users where role = 'admin') as has_admin`)
  return { body: { ok: true, database: true, needsSetup: !rows[0].has_admin } }
}

/** @type {Handler} */
async function listStores() {
  // The app polls this every minute, so it doubles as the clock for pickup reminders.
  await sendDueReminders().catch((err) => console.error('reminders failed', err))
  const { rows } = await query(`${STORE_SELECT} where s.status = 'active' and b.id is not null order by s.name`)
  return { body: { stores: rows.map(toStore) }, headers: { 'Cache-Control': 'no-store' } }
}

/**
 * Reserves bags. Card orders wait in pending_payment (bag held) until the payment provider confirms; with the
 * simulated provider that happens at once. Cash orders are reserved straight away for trusted customers.
 * @type {Handler}
 */
async function createOrder({ req, body }) {
  const storeId = str(body.storeId, 'Store', { max: 80 })
  const quantity = int(body.quantity, 'Quantity', 1, MAX_PER_ORDER)
  const payment = oneOf(body.paymentMethod, 'Payment method', PAYMENT_METHODS)
  const { device, userId } = await customerContext(req, body.deviceId)
  if (!userId) throw new HttpError(401, 'Log in or create an account to reserve.')
  const cash = payment === 'cash'
  // Tester payments: no card charged, order marked as a test (kept out of payouts and money reports).
  const test = body.testPayment === true && !cash
  if (test) {
    const { rows: tu } = await query('select email from users where id = $1', [userId])
    if (!isTester(tu[0]?.email)) throw new HttpError(403, 'Test payments aren’t enabled for this account.')
  }
  if (cash) {
    const e = await cashEligibility(userId)
    if (!e.eligible) throw new HttpError(403, e.reason ?? 'Cash at pickup isn’t available for this order.')
  }
  await expirePendingPayments()
  const created = await tx(async (c) => {
    const { rows } = await c.query(
      `select b.*, s.status, coalesce(bi.accepts_cash, false) as accepts_cash
         from bags b join stores s on s.id = b.store_id left join store_billing bi on bi.store_id = b.store_id
        where b.store_id = $1 for update of b`,
      [storeId],
    )
    const bag = rows[0]
    if (!bag || bag.status !== 'active') throw new HttpError(404, 'This store isn’t available.')
    if (cash && !bag.accepts_cash) throw new HttpError(409, 'This store doesn’t take cash. Pay by card instead.')
    if (bag.paused || bag.quantity < quantity)
      throw new HttpError(409, bag.quantity > 0 && !bag.paused ? `Only ${bag.quantity} left.` : 'Sold out — someone got there first.')
    const now = Date.now()
    const { start, end } = resolveWindow({ day: bag.pickup_day, start: bag.pickup_start, end: bag.pickup_end }, now)
    await c.query('update bags set quantity = quantity - $1, updated_at = now() where store_id = $2', [quantity, storeId])
    const ins = await c.query(
      `insert into orders (id, store_id, bag_id, device_id, user_id, quantity, unit_price, unit_original_price, pickup_start, pickup_end, pickup_code, status, payment_method, is_demo)
       values ($1,$2,$3,$4,$12,$5,$6,$7,to_timestamp($8/1000.0),to_timestamp($9/1000.0),$10,$13,$11,$14) returning *`,
      [newId(), storeId, bag.id, device, quantity, bag.price, bag.original_price, start, end, pickupCode(), payment, userId, cash || test ? 'reserved' : 'pending_payment', test],
    )
    const order = ins.rows[0]
    let paymentId = null
    if (test) {
      await c.query(`insert into payments (id, order_id, provider, provider_ref, amount, status) values ($1,$2,'test',$3,$4,'succeeded')`, [
        newId('pay_'),
        order.id,
        `test_${order.id}`,
        quantity * bag.price * 100,
      ])
      await recordSale(c, order)
    } else if (!cash) {
      paymentId = newId('pay_')
      await c.query(`insert into payments (id, order_id, provider, amount, status) values ($1,$2,$3,$4,'pending')`, [
        paymentId,
        order.id,
        process.env.PAYMENT_PROVIDER ?? 'simulated',
        quantity * bag.price * 100,
      ])
    }
    return { order, paymentId }
  })
  if (!created.paymentId) {
    await sendReceipt(created.order.id)
    return { status: 201, body: { order: toOrder(created.order) } }
  }
  const { rows: u } = await query('select email from users where id = $1', [userId])
  const started = await startPayment(created.order, created.paymentId, u[0]?.email ?? null)
  // The app shows the provider's card form for clientRef (POK) or sends the customer to redirectUrl.
  return { status: 201, body: { order: toOrder(started.order), payment: paymentView(started) } }
}

/** @param {{ redirectUrl: string | null, clientRef: string | null }} started */
function paymentView(started) {
  const provider = process.env.PAYMENT_PROVIDER ?? 'simulated'
  return { provider, redirectUrl: started.redirectUrl, sdkOrderId: started.clientRef, env: provider === 'pok' ? pokEnv() : undefined }
}

/**
 * The customer's payment form reported success (or the app came back to a pending order): read the payment back
 * from the provider and confirm the reservation if it's paid. Also returns what's needed to show the form again.
 * @type {Handler}
 */
async function verifyOrderPayment({ req, params, body }) {
  const who = await customerContext(req, body.deviceId)
  const { rows: own } = await query(`select * from orders where id = $1 and ${OWNS_ORDER}`, [params.id, who.device, who.userId])
  const o = own[0]
  if (!o) throw new HttpError(404, 'Order not found.')
  if (o.status !== 'pending_payment' && o.status !== 'expired') return { body: { order: toOrder(o) } }
  const order = await verifyPayment(o.id)
  const { rows } = await query(`select provider_ref from payments where order_id = $1 and status = 'pending' order by created_at desc limit 1`, [o.id])
  const pending = order.status === 'pending_payment' && rows[0]?.provider_ref
  return { body: { order: toOrder(order), payment: pending ? paymentView({ redirectUrl: null, clientRef: rows[0].provider_ref }) : null } }
}

/** Where the app registers for push, and which kinds are switched on. Public. @type {Handler} */
async function pushConfig() {
  return { body: { vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null, web: webPushConfigured(), native: fcmConfigured() } }
}

/** @type {Handler} */
async function pushSubscribe({ req, body }) {
  const user = await requireUser(req, 'customer')
  const kind = /** @type {'web' | 'fcm'} */ (oneOf(body.kind, 'Kind', ['web', 'fcm']))
  const endpoint = str(body.endpoint, 'Endpoint', { max: 1000 })
  if (kind === 'web' && !/^https:\/\//.test(endpoint)) throw new HttpError(400, 'Bad push endpoint.')
  const keys = kind === 'web' ? body.keys : undefined
  if (kind === 'web' && (typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string')) throw new HttpError(400, 'Bad push keys.')
  await saveSubscription(user.id, { kind, endpoint, keys: keys && { p256dh: keys.p256dh, auth: keys.auth } })
  return { body: { ok: true } }
}

/** @type {Handler} */
async function pushUnsubscribe({ req, body }) {
  const user = await requireUser(req, 'customer')
  await removeSubscription(user.id, str(body.endpoint, 'Endpoint', { max: 1000 }))
  return { body: { ok: true } }
}

/** Which payment methods the app should offer. Public. @type {Handler} */
async function paymentConfig() {
  const provider = process.env.PAYMENT_PROVIDER ?? 'simulated'
  return {
    body: { provider, cardReady: provider === 'pok' ? pokConfigured() : true, env: provider === 'pok' ? pokEnv() : undefined, holdMinutes: PAYMENT_HOLD_MINUTES },
    headers: { 'Cache-Control': 'public, max-age=300' },
  }
}

/** A store's cover photo. Public and cached for a year (the URL changes with every upload). @type {Handler} */
async function storePhoto({ params }) {
  const { rows } = await query('select mime, data from store_photos where store_id = $1', [params.id])
  if (!rows[0]) throw new HttpError(404, 'No photo.')
  return { bytes: rows[0].data, headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable' } }
}

const MAX_PHOTO_BYTES = 1_500_000

/** @param {string} storeId @param {unknown} image data URL */
async function savePhoto(storeId, image) {
  const m = typeof image === 'string' ? /^data:(image\/(?:jpeg|webp|png));base64,([A-Za-z0-9+/=]+)$/.exec(image) : null
  if (!m) throw new HttpError(400, 'Send a JPEG, WebP or PNG image.')
  const data = Buffer.from(m[2], 'base64')
  if (data.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'That photo is too large. Try a smaller one.')
  await query(
    `insert into store_photos (store_id, mime, data) values ($1,$2,$3)
     on conflict (store_id) do update set mime = excluded.mime, data = excluded.data, updated_at = now()`,
    [storeId, m[1], data],
  )
}

/** @type {Handler} */
async function partnerPhoto({ req, body }) {
  const user = await requireUser(req, 'partner')
  await savePhoto(/** @type {string} */ (user.storeId), body.image)
  return { body: { store: toManagedStore(await partnerStore(user)) } }
}

/** @type {Handler} */
async function partnerDeletePhoto({ req }) {
  const user = await requireUser(req, 'partner')
  await query('delete from store_photos where store_id = $1', [user.storeId])
  return { body: { store: toManagedStore(await partnerStore(user)) } }
}

/** @type {Handler} */
async function adminPhoto({ req, params, body }) {
  await requireUser(req, 'admin')
  await savePhoto(params.id, body.image)
  const { rows } = await query(`${STORE_SELECT} where s.id = $1`, [params.id])
  return { body: { store: toManagedStore(rows[0]) } }
}

/** @type {Handler} */
async function adminDeletePhoto({ req, params }) {
  await requireUser(req, 'admin')
  await query('delete from store_photos where store_id = $1', [params.id])
  const { rows } = await query(`${STORE_SELECT} where s.id = $1`, [params.id])
  return { body: { store: toManagedStore(rows[0]) } }
}

/** @type {Handler} */
async function deviceOrders({ req, url }) {
  const { device, userId } = await customerContext(req, url.searchParams.get('deviceId'))
  const { rows } = await query(
    `select o.*, k.status as complaint_status, k.refund_amount as complaint_refund
       from orders o left join complaints k on k.order_id = o.id
      where ((o.user_id is null and o.device_id = $1) or ($2::text is not null and o.user_id = $2)) and o.status <> 'expired'
      order by o.created_at desc limit 100`,
    [device, userId],
  )
  return { body: { orders: rows.map(toOrder) } }
}

/** @param {string} id @param {{ device: string, userId: string | null }} who */
async function ownOrder(id, who) {
  const { rows } = await query(`select * from orders where id = $1 and ${OWNS_ORDER}`, [id, who.device, who.userId])
  if (!rows[0]) throw new HttpError(404, 'Order not found.')
  return rows[0]
}

/** @type {Handler} */
async function cancelOrder({ req, params, body }) {
  const who = await customerContext(req, body.deviceId)
  // Abandoning an unpaid order releases the bag at once instead of after the payment hold.
  const { rows: pend } = await query(`select id from orders where id = $1 and ${OWNS_ORDER} and status = 'pending_payment'`, [params.id, who.device, who.userId])
  if (pend[0]) {
    // The form may have taken the money a moment before the customer closed it: ask the provider first.
    const checked = await verifyPayment(params.id).catch(() => null)
    if (checked && checked.status !== 'pending_payment') return { body: { order: toOrder(checked) } }
    const { rows: pay } = await query(`select id, provider from payments where order_id = $1 and status = 'pending'`, [params.id])
    if (pay[0]) await failPayment(pay[0].provider, null, 'Abandoned by the customer', pay[0].id)
    const { rows } = await query('select * from orders where id = $1', [params.id])
    return { body: { order: toOrder(rows[0]) } }
  }
  const order = await tx(async (c) => {
    const { rows } = await c.query(`select * from orders where id = $1 and ${OWNS_ORDER} for update`, [params.id, who.device, who.userId])
    const o = rows[0]
    if (!o) throw new HttpError(404, 'Order not found.')
    if (o.status !== 'reserved') throw new HttpError(409, 'This order can no longer be cancelled.')
    if (new Date(o.pickup_start).getTime() - Date.now() <= CANCEL_CUTOFF_MS)
      throw new HttpError(409, 'Orders can be cancelled up to 2 hours before pickup starts.')
    await c.query('update bags set quantity = quantity + $1, updated_at = now() where store_id = $2', [o.quantity, o.store_id])
    const up = await c.query(
      `update orders set status = 'cancelled', cancelled_at = now(), closed_at = now(), cancelled_by = 'customer' where id = $1 returning *`,
      [o.id],
    )
    if (o.payment_method !== 'cash') {
      await recordCancellation(c, up.rows[0])
      await queueRefund(c, o.id, o.quantity * o.unit_price * 100, 'Cancelled by the customer')
    }
    return up.rows[0]
  })
  await processRefunds()
  return { body: { order: toOrder(order) } }
}

/** @type {Handler} */
async function collectOrder({ req, params, body }) {
  const o = await ownOrder(params.id, await customerContext(req, body.deviceId))
  const opensAt = new Date(o.pickup_start).getTime() - EARLY_COLLECT_MS
  if (o.status === 'reserved' && Date.now() < opensAt) {
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(opensAt)
    throw new HttpError(409, `Pickup hasn’t opened yet. You can collect from ${time}.`)
  }
  return { body: { order: toOrder(await markCollected(o.id)) } }
}

/**
 * Marks an order collected (customer swipe or store code check) and charges commission. An order already
 * closed as a no-show can still be collected late; its money was already settled then.
 * @param {string} id
 */
async function markCollected(id) {
  return tx(async (c) => {
    const { rows } = await c.query('select * from orders where id = $1 for update', [id])
    const o = rows[0]
    if (o.status === 'cancelled' || o.status === 'expired') throw new HttpError(409, 'This order was cancelled.')
    if (o.status === 'pending_payment') throw new HttpError(409, 'This order hasn’t been paid yet.')
    if (o.status === 'collected') return o
    const up = await c.query(
      `update orders set status = 'collected', collected_at = coalesce(collected_at, now()), closed_at = coalesce(closed_at, now()) where id = $1 returning *`,
      [id],
    )
    // Cash no-shows recorded nothing, so a late cash pickup is recorded now; card no-shows were settled already.
    if (o.payment_method === 'cash') await recordCashCollected(c, up.rows[0])
    else if (o.status === 'reserved') await recordClose(c, up.rows[0])
    return up.rows[0]
  })
}

/** The customer reports a problem with a collected bag. Support decides in the admin dashboard. */
/** @type {Handler} */
async function fileComplaint({ req, params, body }) {
  const who = await customerContext(req, body.deviceId)
  if (!who.userId) throw new HttpError(401, 'Log in to report a problem.')
  const reason = oneOf(body.reason, 'Reason', COMPLAINT_REASONS)
  const details = optStr(body.details, 'Details', { max: 1000 })
  const o = await ownOrder(params.id, who)
  if (o.status !== 'collected') throw new HttpError(409, 'You can report a problem after collecting your bag.')
  if (Date.now() - new Date(o.collected_at).getTime() > COMPLAINT_WINDOW_HOURS * 3_600_000)
    throw new HttpError(409, `Problems can be reported up to ${COMPLAINT_WINDOW_HOURS} hours after pickup.`)
  const exists = await query('select 1 from complaints where order_id = $1', [o.id])
  if (exists.rows[0]) throw new HttpError(409, 'You already reported a problem with this order.')
  await query(`insert into complaints (id, order_id, store_id, user_id, reason, details) values ($1,$2,$3,$4,$5,$6)`, [
    newId('c_'),
    o.id,
    o.store_id,
    who.userId,
    reason,
    details,
  ])
  const { rows } = await query(
    `select o.*, k.status as complaint_status, k.refund_amount as complaint_refund from orders o left join complaints k on k.order_id = o.id where o.id = $1`,
    [o.id],
  )
  return { status: 201, body: { order: toOrder(rows[0]) } }
}

/** @type {Handler} */
async function rateOrder({ req, params, body }) {
  const who = await customerContext(req, body.deviceId)
  const rating = int(body.rating, 'Rating', 1, 5)
  const tags = Array.isArray(body.tags) ? body.tags.filter((/** @type {unknown} */ t) => RATING_TAGS.includes(/** @type {string} */ (t))) : []
  const order = await tx(async (c) => {
    const { rows } = await c.query(`select * from orders where id = $1 and ${OWNS_ORDER} for update`, [params.id, who.device, who.userId])
    const o = rows[0]
    if (!o) throw new HttpError(404, 'Order not found.')
    if (o.status !== 'collected') throw new HttpError(409, 'You can rate an order after collecting it.')
    if (o.rating) throw new HttpError(409, 'You already rated this order.')
    await c.query(
      `update stores set rating = (rating * rating_count + $1) / (rating_count + 1), rating_count = rating_count + 1 where id = $2`,
      [rating, o.store_id],
    )
    const up = await c.query('update orders set rating = $1, rating_tags = $2 where id = $3 returning *', [rating, JSON.stringify(tags), o.id])
    return up.rows[0]
  })
  return { body: { order: toOrder(order) } }
}

/* ------------------------------------------------------------------ */
/* Auth & onboarding                                                   */
/* ------------------------------------------------------------------ */

/** @param {any} u */
const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  storeId: u.storeId ?? u.store_id ?? null,
  storeStatus: u.storeStatus ?? null,
  emailVerified: Boolean(u.emailVerifiedAt ?? u.email_verified_at),
  language: u.language ?? null,
  twoFactor: { enabled: Boolean(u.totpEnabledAt ?? u.totp_enabled_at), required: u.role === 'admin' },
  permissions: u.permissions ?? [],
})

/** @type {Handler} */
async function me({ req }) {
  const user = await currentUser(req)
  if (user?.role === 'customer') return { body: { user: { ...publicUser(user), cash: await cashEligibility(user.id), tester: isTester(user.email) || undefined } } }
  return { body: { user: user ? publicUser(user) : null } }
}

/** First admin account. Only possible while no admin exists. */
/** @type {Handler} */
async function setup({ body, secure }) {
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const pw = password(body.password)
  const hash = await hashPassword(pw)
  const id = newId('u_')
  await tx(async (c) => {
    await c.query('lock table users in exclusive mode')
    const { rows } = await c.query(`select 1 from users where role = 'admin' limit 1`)
    if (rows[0]) throw new HttpError(409, 'Ngopu is already set up. Log in instead.')
    await c.query(`insert into users (id, email, name, password_hash, role, permissions) values ($1,$2,$3,$4,'admin',array['finance'])`, [id, mail, name, hash])
  })
  const { cookie } = await createSession(id, secure)
  return { status: 201, body: { user: { id, email: mail, name, role: 'admin', storeId: null, storeStatus: null } }, headers: { 'Set-Cookie': cookie } }
}

/** @type {Handler} */
async function login({ req, body, secure }) {
  const mail = email(body.email)
  const pw = str(body.password, 'Password', { max: 200 })
  const ip = clientIp(req)
  const keys = loginKeys(mail, ip)
  await limit(...keys)
  const { rows } = await query(
    `select u.*, s.status as "storeStatus" from users u left join stores s on s.id = u.store_id where u.email = $1`,
    [mail],
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(pw, user.password_hash))) {
    await record(keys.map((k) => k[0]), false)
    throw new HttpError(401, 'Wrong email or password.')
  }
  await record(keys.map((k) => k[0]), true)
  // The customer app and the store dashboard have separate kinds of account.
  const fromApp = body.client === 'app'
  if (fromApp && user.role !== 'customer')
    throw new HttpError(403, 'This email belongs to a store or team account. Log in to the dashboard instead, or use another email for the app.')
  if (!fromApp && user.role === 'customer') throw new HttpError(403, 'This is a customer account. Log in in the Ngopu app.')
  if (fromApp && (body.language === 'sq' || body.language === 'en') && body.language !== user.language) {
    await query('update users set language = $2 where id = $1', [user.id, body.language])
    user.language = body.language
  }
  // Two-factor login: the password alone only earns a short-lived challenge for the code step.
  if (!fromApp && user.totp_enabled_at) {
    const challenge = await issueToken(user.id, 'login_2fa', 5)
    return { body: { twoFactor: { challenge } } }
  }
  const { cookie, token } = await createSession(user.id, secure, fromApp)
  if (fromApp) {
    if (body.deviceId) await claimDeviceOrders(user.id, deviceId(body.deviceId))
    return { body: { user: publicUser(user), token } }
  }
  return { body: { user: publicUser(user) }, headers: { 'Set-Cookie': cookie } }
}

/** Second login step for the dashboard: the code from the authenticator app (or a recovery code). @type {Handler} */
async function loginTwoFactor({ body, secure }) {
  const userId = await consumeToken(body.challenge, 'login_2fa', { keep: true })
  await verifySecondFactor(userId, body.code)
  await consumeToken(body.challenge, 'login_2fa')
  const { rows } = await query(`select u.*, s.status as "storeStatus" from users u left join stores s on s.id = u.store_id where u.id = $1`, [userId])
  const { cookie } = await createSession(userId, secure)
  return { body: { user: publicUser(rows[0]) }, headers: { 'Set-Cookie': cookie } }
}

/** Starts two-factor setup: a new secret to scan. Not active until confirmed with a code. @type {Handler} */
async function twoFactorSetup({ req }) {
  const user = await requireUser(req, undefined, { allowWithout2fa: true })
  if (user.role === 'customer') throw new HttpError(403, 'Two-factor login is for the dashboard.')
  if (user.totpEnabledAt) throw new HttpError(409, 'Two-factor login is already on.')
  const secret = newTotpSecret()
  await query('update users set totp_secret = $2 where id = $1', [user.id, secret])
  return { body: { secret, otpauthUrl: otpauthUrl(secret, user.email) } }
}

/** Confirms setup with a first code and hands out recovery codes (shown once). @type {Handler} */
async function twoFactorEnable({ req, body }) {
  const user = await requireUser(req, undefined, { allowWithout2fa: true })
  const { rows } = await query('select totp_secret, totp_enabled_at from users where id = $1', [user.id])
  if (!rows[0]?.totp_secret) throw new HttpError(409, 'Start the setup first.')
  if (rows[0].totp_enabled_at) throw new HttpError(409, 'Two-factor login is already on.')
  await limit([`2fa:${user.id}`, 5, 15])
  if (!checkTotp(rows[0].totp_secret, body.code)) {
    await record([`2fa:${user.id}`], false)
    throw new HttpError(400, 'That code isn’t right. Check the time on your phone and try again.')
  }
  await record([`2fa:${user.id}`], true)
  const { codes, hashes } = recoveryCodes()
  await query('update users set totp_enabled_at = now(), totp_recovery = $2 where id = $1', [user.id, hashes])
  return { body: { recoveryCodes: codes } }
}

/** Turns two-factor off (partners only; admins must keep it). Needs the password and a current code. @type {Handler} */
async function twoFactorDisable({ req, body }) {
  const user = await requireUser(req, 'partner')
  const { rows } = await query('select password_hash from users where id = $1', [user.id])
  if (!(await verifyPassword(str(body.password, 'Password', { max: 200 }), rows[0].password_hash))) throw new HttpError(401, 'Wrong password.')
  await verifySecondFactor(user.id, body.code)
  await query('update users set totp_secret = null, totp_enabled_at = null, totp_recovery = null where id = $1', [user.id])
  return { body: { ok: true } }
}

/** Lost phone: another admin resets a team member's two-factor login so they set it up again. @type {Handler} */
async function adminResetTwoFactor({ req, params }) {
  const user = await requireUser(req, 'admin')
  if (params.id === user.id) throw new HttpError(400, 'Ask another admin to reset your two-factor login.')
  const { rowCount } = await query(
    `update users set totp_secret = null, totp_enabled_at = null, totp_recovery = null where id = $1 and role in ('admin','partner')`,
    [params.id],
  )
  if (!rowCount) throw new HttpError(404, 'User not found.')
  await query('delete from sessions where user_id = $1', [params.id])
  await query('insert into audit_log (actor_id, action, target) values ($1,$2,$3)', [user.id, 'user.2fa_reset', params.id])
  return { body: { ok: true } }
}

/** Grants or removes the finance permission. Only admins who have it can change it. @type {Handler} */
async function adminSetPermissions({ req, params, body }) {
  const user = await requireFinance(req)
  const finance = !!body.finance
  if (params.id === user.id && !finance) throw new HttpError(400, 'You can’t remove your own finance permission.')
  const { rowCount } = await query(
    `update users set permissions = case when $2 then array(select distinct unnest(permissions || array['finance'])) else array_remove(permissions, 'finance') end
      where id = $1 and role = 'admin'`,
    [params.id, finance],
  )
  if (!rowCount) throw new HttpError(404, 'Admin not found.')
  await query('insert into audit_log (actor_id, action, target, details) values ($1,$2,$3,$4)', [user.id, 'user.permissions', params.id, JSON.stringify({ finance })])
  return { body: { ok: true } }
}

/** @type {Handler} */
async function forgotPassword({ req, body }) {
  await requestPasswordReset(email(body.email), clientIp(req))
  return { body: { ok: true } }
}

/** @type {Handler} */
async function resetPasswordHandler({ body }) {
  const hash = await hashPassword(password(body.password))
  const { role } = await completePasswordReset(body.token, hash)
  return { body: { ok: true, role } }
}

/** @type {Handler} */
async function verifyEmailHandler({ body }) {
  await confirmEmail(body.token)
  return { body: { ok: true } }
}

/** @type {Handler} */
async function resendVerification({ req }) {
  const user = await requireUser(req, 'customer')
  if (user.emailVerifiedAt) return { body: { ok: true, alreadyVerified: true } }
  await limit([`verify:${user.id}`, 3, 60])
  await record([`verify:${user.id}`], false)
  await sendVerification(user)
  return { body: { ok: true } }
}

/** Attaches orders placed on this device before signing in to the customer's account. */
/** @param {string} userId @param {string} device */
async function claimDeviceOrders(userId, device) {
  await query('update orders set user_id = $1 where device_id = $2 and user_id is null', [userId, device])
}

/** Customer sign-up from the app. Returns a bearer token (no cookie). */
/** @type {Handler} */
async function signup({ req, body, secure }) {
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const hash = await hashPassword(password(body.password))
  const id = newId('u_')
  const ip = clientIp(req)
  await limit([`signup-ip:${ip}`, 20, 60])
  await record([`signup-ip:${ip}`], false)
  const exists = await query('select 1 from users where email = $1', [mail])
  if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists. Log in instead.')
  const language = body.language === 'en' ? 'en' : 'sq'
  await query(`insert into users (id, email, name, password_hash, role, language) values ($1,$2,$3,$4,'customer',$5)`, [id, mail, name, hash, language])
  if (body.deviceId) await claimDeviceOrders(id, deviceId(body.deviceId))
  const { token } = await createSession(id, secure, true)
  await sendVerification({ id, email: mail, name, language })
  return { status: 201, body: { user: publicUser({ id, email: mail, name, role: 'customer', language }), token } }
}

/** @type {Handler} */
async function updateMe({ req, body }) {
  const user = await requireUser(req, 'customer')
  const name = body.name === undefined ? user.name : str(body.name, 'Name', { max: 80 })
  const language = body.language === 'sq' || body.language === 'en' ? body.language : user.language
  await query('update users set name = $2, language = $3 where id = $1', [user.id, name, language])
  return { body: { user: publicUser({ ...user, name, language }) } }
}

/** Deletes a customer account (required by the app stores). Past orders stay for the store's records, unlinked from the person. */
/** @type {Handler} */
async function deleteMe({ req }) {
  const user = await requireUser(req, 'customer')
  await tx(async (c) => {
    // Orders stay for the stores' records but are detached from both the person and the phone.
    await c.query(`update orders set device_id = 'deleted' where user_id = $1`, [user.id])
    await c.query('delete from users where id = $1', [user.id])
  })
  return { body: { ok: true } }
}

/** @type {Handler} */
async function logout({ req, secure }) {
  const cookie = await destroySession(req, secure)
  return { body: { ok: true }, headers: { 'Set-Cookie': cookie } }
}

/** A store applies to join. It gets a partner login right away and waits for an admin to approve it. */
/** @type {Handler} */
async function apply({ body, secure }) {
  const storeName = str(body.storeName, 'Store name', { max: 80 })
  const category = oneOf(body.category, 'Category', CATEGORIES)
  const address = str(body.address, 'Address', { max: 160 })
  const lat = num(body.lat ?? 41.3275, 'Latitude', -90, 90)
  const lng = num(body.lng ?? 19.8187, 'Longitude', -180, 180)
  const contactName = str(body.contactName, 'Your name', { max: 80 })
  const phone = optStr(body.phone, 'Phone', { max: 40 })
  const mail = email(body.email)
  const pw = password(body.password)
  const note = optStr(body.note, 'Message', { max: 1000 })
  const hash = await hashPassword(pw)
  const storeId = slugify(storeName)
  const userId = newId('u_')
  await tx(async (c) => {
    const exists = await c.query('select 1 from users where email = $1', [mail])
    if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists. Log in instead.')
    await c.query(
      `insert into stores (id, name, category, address, lat, lng, status, contact_name, contact_email, contact_phone, note)
       values ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10)`,
      [storeId, storeName, category, address, lat, lng, contactName, mail, phone, note],
    )
    await c.query(
      `insert into bags (store_id, id, title, description, price, original_price, quantity, pickup_start, pickup_end, allergens_note, is_new)
       values ($1,$2,'Surprise Bag','A surprise selection of today’s unsold food.',400,1200,0,1140,1170,
               'Contents change daily, so we cannot guarantee a bag is free of any allergen. Ask the store at pickup if you have questions.', true)`,
      [storeId, `bag-${storeId}`],
    )
    await c.query('insert into store_billing (store_id) values ($1)', [storeId])
    await c.query(`insert into users (id, email, name, password_hash, role, store_id) values ($1,$2,$3,$4,'partner',$5)`, [
      userId,
      mail,
      contactName,
      hash,
      storeId,
    ])
  })
  const { cookie } = await createSession(userId, secure)
  return {
    status: 201,
    body: { user: { id: userId, email: mail, name: contactName, role: 'partner', storeId, storeStatus: 'pending' } },
    headers: { 'Set-Cookie': cookie },
  }
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

/**
 * Daily bags sold and revenue for the last `days` days (Tirana days), oldest first.
 * @param {number} days
 * @param {string | null} storeId
 */
async function dailySeries(days, storeId) {
  const { rows } = await query(
    `with d as (
       select generate_series((now() at time zone $1)::date - ($2::int - 1), (now() at time zone $1)::date, interval '1 day')::date as day
     )
     select to_char(d.day, 'YYYY-MM-DD') as day,
            coalesce(sum(o.quantity) filter (where o.status in ('reserved','collected','no_show')), 0)::int as bags,
            coalesce(sum(o.quantity * o.unit_price) filter (where o.status in ('reserved','collected','no_show')), 0)::int as revenue,
            coalesce(sum(o.quantity) filter (where o.status = 'collected'), 0)::int as collected
       from d
       left join orders o on (o.created_at at time zone $1)::date = d.day and ($3::text is null or o.store_id = $3)
      group by d.day order by d.day`,
    [TIMEZONE, days, storeId],
  )
  return rows
}

/**
 * Totals for the current and previous period of `days` days.
 * @param {number} days
 * @param {string | null} storeId
 */
async function periodTotals(days, storeId) {
  const { rows } = await query(
    `select
       coalesce(sum(quantity) filter (where created_at >= now() - make_interval(days => $1)), 0)::int as bags,
       coalesce(sum(quantity * unit_price) filter (where created_at >= now() - make_interval(days => $1)), 0)::int as revenue,
       coalesce(sum(quantity * (unit_original_price - unit_price)) filter (where created_at >= now() - make_interval(days => $1)), 0)::int as saved,
       count(distinct device_id) filter (where created_at >= now() - make_interval(days => $1))::int as customers,
       coalesce(sum(quantity) filter (where created_at < now() - make_interval(days => $1) and created_at >= now() - make_interval(days => $1 * 2)), 0)::int as prev_bags,
       coalesce(sum(quantity * unit_price) filter (where created_at < now() - make_interval(days => $1) and created_at >= now() - make_interval(days => $1 * 2)), 0)::int as prev_revenue
     from orders
     where ${LIVE_ORDER} and ($2::text is null or store_id = $2)`,
    [days, storeId],
  )
  return rows[0]
}

/* ------------------------------------------------------------------ */
/* Partner endpoints                                                   */
/* ------------------------------------------------------------------ */

/** @param {import('./auth.js').SessionUser} user */
async function partnerStore(user) {
  if (!user.storeId) throw new HttpError(403, 'No store is linked to this account.')
  const { rows } = await query(`${STORE_SELECT} where s.id = $1`, [user.storeId])
  if (!rows[0]) throw new HttpError(404, 'Store not found.')
  return rows[0]
}

/** @param {import('./auth.js').SessionUser} user */
function requireActive(user) {
  if (user.storeStatus !== 'active')
    throw new HttpError(403, user.storeStatus === 'pending' ? 'Your store is still under review.' : 'Your store is not active. Contact the Ngopu team.')
}

/** @type {Handler} */
async function partnerOverview({ req }) {
  const user = await requireUser(req, 'partner')
  const store = await partnerStore(user)
  const [series, totals, todayOrders] = await Promise.all([
    dailySeries(14, store.id),
    periodTotals(7, store.id),
    query(
      `select * from orders where store_id = $1 and ${LIVE_ORDER} and pickup_end >= now() - interval '12 hours' order by pickup_start, created_at`,
      [store.id],
    ),
  ])
  return { body: { store: toManagedStore(store), series, totals, upcoming: todayOrders.rows.map(toOrder) } }
}

/** @type {Handler} */
async function partnerOrders({ req, url }) {
  const user = await requireUser(req, 'partner')
  const status = url.searchParams.get('status')
  const { rows } = await query(
    `select o.*, k.status as complaint_status, k.refund_amount as complaint_refund
       from orders o left join complaints k on k.order_id = o.id
      where o.store_id = $1 and o.status not in ('pending_payment','expired') and ($2::text is null or o.status = $2 or ($2 = 'reserved' and o.status = 'no_show'))
      order by o.created_at desc limit 300`,
    [user.storeId, status && ['reserved', 'collected', 'cancelled'].includes(status) ? status : null],
  )
  return { body: { orders: rows.map(toOrder) } }
}

/** Shared bag-field validation for partners and admins. */
/** @param {any} body */
function bagUpdates(body) {
  /** @type {Record<string, unknown>} */
  const u = {}
  if (body.title !== undefined) u.title = str(body.title, 'Title', { max: 60 })
  if (body.description !== undefined) u.description = str(body.description, 'Description', { max: 500 })
  if (body.price !== undefined) u.price = int(body.price, 'Price', 50, 1_000_000)
  if (body.originalPrice !== undefined) u.original_price = int(body.originalPrice, 'Original value', 0, 1_000_000)
  if (body.quantity !== undefined) u.quantity = int(body.quantity, 'Bags available', 0, 99)
  if (body.pickupDay !== undefined) u.pickup_day = oneOf(body.pickupDay, 'Pickup day', ['today', 'tomorrow'])
  if (body.pickupStart !== undefined) u.pickup_start = int(body.pickupStart, 'Pickup start', 0, 1439)
  if (body.pickupEnd !== undefined) u.pickup_end = int(body.pickupEnd, 'Pickup end', 1, 1440)
  if (body.diet !== undefined) u.diet = body.diet === null || body.diet === '' ? null : oneOf(body.diet, 'Diet', ['vegetarian', 'vegan'])
  if (body.allergensNote !== undefined) u.allergens_note = str(body.allergensNote, 'Allergen note', { max: 500 })
  if (body.paused !== undefined) u.paused = !!body.paused
  return u
}

/** @param {string} storeId @param {Record<string, unknown>} u */
async function applyBagUpdates(storeId, u) {
  const keys = Object.keys(u)
  if (!keys.length) throw new HttpError(400, 'Nothing to update.')
  const { rows: cur } = await query('select * from bags where store_id = $1', [storeId])
  const next = { ...cur[0], ...u }
  if (next.pickup_end <= next.pickup_start) throw new HttpError(400, 'Pickup must end after it starts.')
  if (next.price > next.original_price) throw new HttpError(400, 'The price should be lower than the original value.')
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
  await query(`update bags set ${sets}, updated_at = now() where store_id = $1`, [storeId, ...keys.map((k) => u[k])])
}

/** @type {Handler} */
async function partnerUpdateBag({ req, body }) {
  const user = await requireUser(req, 'partner')
  requireActive(user)
  await applyBagUpdates(/** @type {string} */ (user.storeId), bagUpdates(body))
  return { body: { store: toManagedStore(await partnerStore(user)) } }
}

/** @param {any} body @param {boolean} admin */
function storeUpdates(body, admin) {
  /** @type {Record<string, unknown>} */
  const u = {}
  if (body.name !== undefined) u.name = str(body.name, 'Store name', { max: 80 })
  if (body.branch !== undefined) u.branch = optStr(body.branch, 'Branch', { max: 60 })
  if (body.category !== undefined) u.category = oneOf(body.category, 'Category', CATEGORIES)
  if (body.address !== undefined) u.address = str(body.address, 'Address', { max: 160 })
  if (body.lat !== undefined) u.lat = num(body.lat, 'Latitude', -90, 90)
  if (body.lng !== undefined) u.lng = num(body.lng, 'Longitude', -180, 180)
  if (body.contactName !== undefined) u.contact_name = optStr(body.contactName, 'Contact name', { max: 80 })
  if (body.contactPhone !== undefined) u.contact_phone = optStr(body.contactPhone, 'Phone', { max: 40 })
  if (admin && body.status !== undefined) u.status = oneOf(body.status, 'Status', ['pending', 'active', 'suspended', 'rejected'])
  return u
}

/** @param {string} storeId @param {Record<string, unknown>} u */
async function applyStoreUpdates(storeId, u) {
  const keys = Object.keys(u)
  if (!keys.length) throw new HttpError(400, 'Nothing to update.')
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
  const approved = u.status === 'active' ? ', approved_at = coalesce(approved_at, now())' : ''
  const { rowCount } = await query(`update stores set ${sets}${approved} where id = $1`, [storeId, ...keys.map((k) => u[k])])
  if (!rowCount) throw new HttpError(404, 'Store not found.')
}

/** @type {Handler} */
async function partnerUpdateStore({ req, body }) {
  const user = await requireUser(req, 'partner')
  await applyStoreUpdates(/** @type {string} */ (user.storeId), storeUpdates(body, false))
  return { body: { store: toManagedStore(await partnerStore(user)) } }
}

/** @type {Handler} */
async function partnerValidate({ req, body }) {
  const user = await requireUser(req, 'partner')
  requireActive(user)
  const code = str(body.code, 'Pickup code', { min: 6, max: 6 }).toUpperCase()
  const { rows } = await query(`select * from orders where store_id = $1 and pickup_code = $2 and status <> 'expired' order by created_at desc limit 1`, [
    user.storeId,
    code,
  ])
  const o = rows[0]
  if (!o) throw new HttpError(404, 'No order with that code at your store.')
  if (o.status === 'cancelled' || o.status === 'expired') throw new HttpError(409, 'That order was cancelled.')
  if (o.status === 'pending_payment') throw new HttpError(409, 'That order hasn’t been paid yet. Don’t hand over the bag.')
  if (o.status === 'collected') return { body: { order: toOrder(o), alreadyCollected: true } }
  return { body: { order: toOrder(await markCollected(o.id)), alreadyCollected: false } }
}

/* ------------------------------------------------------------------ */
/* Admin endpoints                                                     */
/* ------------------------------------------------------------------ */

/** @type {Handler} */
async function adminOverview({ req, url }) {
  await requireUser(req, 'admin')
  const days = int(url.searchParams.get('days') ?? '14', 'Days', 7, 90)
  const [series, totals, counts, top] = await Promise.all([
    dailySeries(days, null),
    periodTotals(days, null),
    query(`select
             count(*) filter (where status = 'active')::int as active,
             count(*) filter (where status = 'pending')::int as pending,
             count(*) filter (where status = 'suspended')::int as suspended,
             (select coalesce(sum(b.quantity), 0)::int from bags b join stores s on s.id = b.store_id where s.status = 'active' and not b.paused) as bags_live,
             (select count(*)::int from orders where status = 'reserved' and pickup_end >= now()) as to_collect,
             (select count(*)::int from complaints where status = 'open') as open_complaints,
             (select count(*)::int from store_billing where pending_iban is not null) as pending_bank
           from stores`),
    query(
      `select s.id, s.name, s.branch, s.category, s.rating,
              coalesce(sum(o.quantity), 0)::int as bags, coalesce(sum(o.quantity * o.unit_price), 0)::int as revenue
         from stores s
         left join orders o on o.store_id = s.id and o.status in ('reserved','collected','no_show') and o.created_at >= now() - make_interval(days => $1)
        where s.status = 'active'
        group by s.id order by bags desc, s.rating desc limit 5`,
      [days],
    ),
  ])
  return { body: { days, series, totals, counts: counts.rows[0], topStores: top.rows } }
}

/** @type {Handler} */
async function adminStores({ req }) {
  await requireUser(req, 'admin')
  const { rows } = await query(
    `${STORE_SELECT.replace(
      'from stores s',
      `, (select coalesce(sum(o.quantity), 0)::int from orders o where o.store_id = s.id and o.status in ('reserved','collected','no_show') and o.created_at >= now() - interval '30 days') as bags_30d,
         (select coalesce(sum(o.quantity * o.unit_price), 0)::int from orders o where o.store_id = s.id and o.status in ('reserved','collected','no_show') and o.created_at >= now() - interval '30 days') as revenue_30d
       from stores s`,
    )} order by s.created_at desc`,
  )
  return { body: { stores: rows.map((r) => ({ ...toManagedStore(r), bags30d: r.bags_30d, revenue30d: r.revenue_30d })) } }
}

/** @type {Handler} */
async function adminStore({ req, params }) {
  await requireUser(req, 'admin')
  const { rows } = await query(`${STORE_SELECT} where s.id = $1`, [params.id])
  if (!rows[0]) throw new HttpError(404, 'Store not found.')
  const [series, totals, orders, users] = await Promise.all([
    dailySeries(14, params.id),
    periodTotals(30, params.id),
    query(`select * from orders where store_id = $1 and status not in ('pending_payment','expired') order by created_at desc limit 50`, [params.id]),
    query(`select id, name, email, last_login_at as "lastLoginAt" from users where store_id = $1`, [params.id]),
  ])
  return { body: { store: toManagedStore(rows[0]), series, totals, orders: orders.rows.map(toOrder), users: users.rows } }
}

/** @type {Handler} */
async function adminUpdateStore({ req, params, body }) {
  await requireUser(req, 'admin')
  const su = storeUpdates(body, true)
  if (Object.keys(su).length) await applyStoreUpdates(params.id, su)
  const bu = bagUpdates(body.bag ?? {})
  if (Object.keys(bu).length) await applyBagUpdates(params.id, bu)
  const { rows } = await query(`${STORE_SELECT} where s.id = $1`, [params.id])
  if (!rows[0]) throw new HttpError(404, 'Store not found.')
  return { body: { store: toManagedStore(rows[0]) } }
}

/** @type {Handler} */
async function adminOrders({ req, url }) {
  await requireUser(req, 'admin')
  const status = url.searchParams.get('status')
  const { rows } = await query(
    `select o.*, s.name as store_name from orders o join stores s on s.id = o.store_id
      where o.status not in ('pending_payment','expired') and ($1::text is null or o.status = $1 or ($1 = 'reserved' and o.status = 'no_show')) order by o.created_at desc limit 500`,
    [status && ['reserved', 'collected', 'cancelled'].includes(status) ? status : null],
  )
  return { body: { orders: rows.map(toOrder) } }
}

/** @type {Handler} */
async function adminTeam({ req }) {
  await requireUser(req, 'admin')
  const { rows } = await query(
    `select id, name, email, created_at as "createdAt", last_login_at as "lastLoginAt", 'finance' = any(permissions) as finance,
            totp_enabled_at is not null as "twoFactor"
       from users where role = 'admin' order by created_at`,
  )
  return { body: { admins: rows } }
}

/** @type {Handler} */
async function adminAddTeam({ req, body }) {
  const user = await requireUser(req, 'admin')
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const hash = await hashPassword(password(body.password))
  const exists = await query('select 1 from users where email = $1', [mail])
  if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists.')
  const id = newId('u_')
  // Only admins with the finance permission can hand it out.
  const finance = !!body.finance && user.permissions.includes('finance')
  await query(`insert into users (id, email, name, password_hash, role, permissions) values ($1,$2,$3,$4,'admin',$5)`, [id, mail, name, hash, finance ? ['finance'] : []])
  return { status: 201, body: { admin: { id, name, email: mail, finance } } }
}

/** @type {Handler} */
async function adminRemoveTeam({ req, params }) {
  const user = await requireUser(req, 'admin')
  if (params.id === user.id) throw new HttpError(400, 'You can’t remove yourself.')
  const { rowCount } = await query(`delete from users where id = $1 and role = 'admin'`, [params.id])
  if (!rowCount) throw new HttpError(404, 'Admin not found.')
  return { body: { ok: true } }
}

/**
 * Gives a store a partner login (e.g. a seeded demo store, or a store onboarded by phone).
 * The admin sets a temporary password and shares it with the store.
 */
/** @type {Handler} */
async function adminCreateStoreLogin({ req, params, body }) {
  await requireUser(req, 'admin')
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const hash = await hashPassword(password(body.password))
  const id = newId('u_')
  await tx(async (c) => {
    const store = await c.query('select 1 from stores where id = $1', [params.id])
    if (!store.rows[0]) throw new HttpError(404, 'Store not found.')
    const exists = await c.query('select 1 from users where email = $1', [mail])
    if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists.')
    await c.query(`insert into users (id, email, name, password_hash, role, store_id) values ($1,$2,$3,$4,'partner',$5)`, [
      id,
      mail,
      name,
      hash,
      params.id,
    ])
    // Fill in the store's contact details if it had none (seeded stores).
    await c.query('update stores set contact_name = coalesce(contact_name, $2), contact_email = coalesce(contact_email, $3) where id = $1', [
      params.id,
      name,
      mail,
    ])
  })
  return { status: 201, body: { user: { id, name, email: mail, lastLoginAt: null } } }
}

/** Sets a new password for a partner login and signs it out everywhere. */
/** @type {Handler} */
async function adminResetPassword({ req, params, body }) {
  await requireUser(req, 'admin')
  const hash = await hashPassword(password(body.password))
  const { rowCount } = await query(`update users set password_hash = $2 where id = $1 and role = 'partner'`, [params.id, hash])
  if (!rowCount) throw new HttpError(404, 'Partner login not found.')
  await query('delete from sessions where user_id = $1', [params.id])
  return { body: { ok: true } }
}

/** Sample orders over the last 30 days so a fresh install has something to look at. Marked is_demo and removable. */
/** @type {Handler} */
async function adminDemo({ req, body }) {
  await requireUser(req, 'admin')
  const action = oneOf(body.action, 'Action', ['load', 'clear'])
  if (action === 'clear') {
    const { rowCount } = await query('delete from orders where is_demo')
    return { body: { removed: rowCount } }
  }
  const { rows: bags } = await query(
    `select b.* from bags b join stores s on s.id = b.store_id where s.status = 'active'`,
  )
  let inserted = 0
  const now = Date.now()
  for (let day = 29; day >= 0; day--) {
    for (const bag of bags) {
      // Busier on recent days and at better-value stores; deterministic enough to look plausible.
      const n = Math.floor(Math.random() * (1.2 + (30 - day) / 20 + bag.original_price / bag.price / 3))
      for (let i = 0; i < n; i++) {
        const created = now - day * 86_400_000 - Math.floor(Math.random() * 8 * 3_600_000)
        const start = created + 2 * 3_600_000
        const status = Math.random() < 0.06 ? 'cancelled' : 'collected'
        const rating = status === 'collected' && Math.random() < 0.5 ? 4 + Math.round(Math.random()) : null
        await query(
          `insert into orders (id, store_id, bag_id, device_id, quantity, unit_price, unit_original_price, pickup_start, pickup_end, pickup_code, status, payment_method, rating, created_at, collected_at, is_demo,
                               cancelled_at, closed_at, cancelled_by)
           values ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8/1000.0),to_timestamp($9/1000.0),$10,$11,'card',$12,to_timestamp($13/1000.0),$14,true,
                   case when $11 = 'cancelled' then to_timestamp($13/1000.0) + interval '20 minutes' end,
                   case when $11 = 'cancelled' then to_timestamp($13/1000.0) + interval '20 minutes' else $14 end,
                   case when $11 = 'cancelled' then 'customer' end)`,
          [
            newId('d'),
            bag.store_id,
            bag.id,
            `demo-${Math.floor(Math.random() * 400)}`,
            Math.random() < 0.8 ? 1 : 2,
            bag.price,
            bag.original_price,
            start,
            start + 30 * 60_000,
            pickupCode(),
            status,
            rating,
            created,
            status === 'collected' ? new Date(start + 10 * 60_000) : null,
          ],
        )
        inserted++
      }
    }
  }
  await demoLedger()
  return { body: { inserted } }
}

/** Ledger entries for sample orders, back-dated to when each order happened. */
async function demoLedger() {
  await tx(async (c) => {
    const { rows } = await c.query(
      `select o.* from orders o where o.is_demo and not exists (select 1 from ledger_entries l where l.order_id = o.id) order by o.created_at`,
    )
    for (const o of rows) {
      await recordSale(c, o)
      if (o.status === 'cancelled') {
        await recordCancellation(c, o)
        await c.query(`update ledger_entries set created_at = $2, eligible_at = $2 where order_id = $1`, [o.id, o.closed_at])
        await c.query(`update ledger_entries set created_at = $2 where order_id = $1 and type = 'sale'`, [o.id, o.created_at])
      } else if (o.status === 'collected') {
        await recordClose(c, o)
        await c.query(`update ledger_entries set created_at = $2 where order_id = $1 and type = 'commission'`, [o.id, o.closed_at])
      }
    }
  })
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

/** @type {[string, string, Handler][]} */
const ROUTES = [
  ['GET', 'health', health],
  ['GET', 'stores', listStores],
  ['GET', 'stores/:id/photo', storePhoto],
  ['PUT', 'partner/photo', partnerPhoto],
  ['DELETE', 'partner/photo', partnerDeletePhoto],
  ['PUT', 'admin/stores/:id/photo', adminPhoto],
  ['DELETE', 'admin/stores/:id/photo', adminDeletePhoto],
  ['POST', 'orders', createOrder],
  ['GET', 'orders', deviceOrders],
  ['POST', 'orders/:id/payment', verifyOrderPayment],
  ['GET', 'payments/config', paymentConfig],
  ['GET', 'push/config', pushConfig],
  ['POST', 'telemetry/error', reportError],
  ['POST', 'telemetry/events', trackEvents],
  ['GET', 'admin/monitoring', adminMonitoring],
  ['POST', 'admin/monitoring/errors/:id/resolve', adminResolveError],
  ['POST', 'admin/monitoring/test-email', adminTestEmail],
  ['POST', 'push/subscribe', pushSubscribe],
  ['POST', 'push/unsubscribe', pushUnsubscribe],
  ['POST', 'orders/:id/cancel', cancelOrder],
  ['POST', 'orders/:id/collect', collectOrder],
  ['POST', 'orders/:id/rate', rateOrder],
  ['POST', 'orders/:id/complaint', fileComplaint],
  ['GET', 'auth/me', me],
  ['POST', 'auth/setup', setup],
  ['POST', 'auth/login', login],
  ['POST', 'auth/login/2fa', loginTwoFactor],
  ['POST', 'auth/2fa/setup', twoFactorSetup],
  ['POST', 'auth/2fa/enable', twoFactorEnable],
  ['POST', 'auth/2fa/disable', twoFactorDisable],
  ['POST', 'auth/forgot', forgotPassword],
  ['POST', 'auth/reset', resetPasswordHandler],
  ['POST', 'auth/verify-email', verifyEmailHandler],
  ['POST', 'auth/verify-email/resend', resendVerification],
  ['POST', 'admin/users/:id/2fa-reset', adminResetTwoFactor],
  ['PATCH', 'admin/team/:id', adminSetPermissions],
  ['POST', 'auth/logout', logout],
  ['POST', 'auth/signup', signup],
  ['PATCH', 'auth/me', updateMe],
  ['DELETE', 'auth/me', deleteMe],
  ['POST', 'apply', apply],
  ['GET', 'partner/overview', partnerOverview],
  ['GET', 'partner/orders', partnerOrders],
  ['PATCH', 'partner/bag', partnerUpdateBag],
  ['PATCH', 'partner/store', partnerUpdateStore],
  ['POST', 'partner/validate', partnerValidate],
  ['GET', 'admin/overview', adminOverview],
  ['GET', 'admin/stores', adminStores],
  ['GET', 'admin/stores/:id', adminStore],
  ['PATCH', 'admin/stores/:id', adminUpdateStore],
  ['GET', 'admin/orders', adminOrders],
  ['GET', 'admin/team', adminTeam],
  ['POST', 'admin/team', adminAddTeam],
  ['DELETE', 'admin/team/:id', adminRemoveTeam],
  ['POST', 'admin/stores/:id/users', adminCreateStoreLogin],
  ['POST', 'admin/users/:id/password', adminResetPassword],
  ['POST', 'admin/demo', adminDemo],
  ...FINANCE_ROUTES,
]

/** @param {string} method @param {string} path */
export function match(method, path) {
  const parts = path.split('/').filter(Boolean)
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue
    const pp = pattern.split('/')
    if (pp.length !== parts.length) continue
    /** @type {Record<string, string>} */
    const params = {}
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i])))
      return { handler, params, pattern }
  }
  return null
}

/** Endpoints the native apps call from another origin (no cookies involved). */
export const PUBLIC_PREFIXES = ['stores', 'orders', 'health', 'auth', 'payments/config', 'push', 'telemetry']
