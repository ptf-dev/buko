// @ts-check
import { createSession, currentUser, destroySession, hashPassword, newId, requireUser, verifyPassword } from './auth.js'
import { HttpError, query, tx } from './db.js'
import { resolveWindow, TIMEZONE } from './time.js'
import { deviceId, email, int, num, oneOf, optStr, password, str } from './validate.js'
import { COMPLAINT_REASONS, COMPLAINT_WINDOW_HOURS, recordCancellation, recordClose, recordSale } from './finance.js'
import { FINANCE_ROUTES } from './finance-routes.js'

/**
 * @typedef {{ req: Request, url: URL, params: Record<string, string>, body: any, secure: boolean }} Ctx
 * @typedef {{ status?: number, body?: unknown, text?: string, headers?: Record<string, string> }} Result
 * @typedef {(ctx: Ctx) => Promise<Result>} Handler
 */

const CATEGORIES = ['meals', 'bakery', 'groceries', 'dessert', 'drinks', 'other']
const PAYMENT_METHODS = ['card', 'apple-pay', 'google-pay', 'paypal']
const RATING_TAGS = ['Great value', 'Great quantity', 'Great quality', 'Friendly staff', 'Easy pickup']
const MAX_PER_ORDER = 4
const CANCEL_CUTOFF_MS = 2 * 60 * 60_000

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

const STORE_SELECT = `
  select s.*, b.id as bag_id, b.title, b.description, b.price, b.original_price, b.quantity,
         b.pickup_day, b.pickup_start, b.pickup_end, b.diet, b.allergens_note, b.is_new, b.paused, b.updated_at as bag_updated_at
    from stores s
    left join bags b on b.store_id = s.id`

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
    status: r.status === 'no_show' ? 'reserved' : r.status,
    cancelledBy: r.cancelled_by ?? undefined,
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
  const { rows } = await query(`${STORE_SELECT} where s.status = 'active' and b.id is not null order by s.name`)
  return { body: { stores: rows.map(toStore) }, headers: { 'Cache-Control': 'no-store' } }
}

/** @type {Handler} */
async function createOrder({ req, body }) {
  const storeId = str(body.storeId, 'Store', { max: 80 })
  const quantity = int(body.quantity, 'Quantity', 1, MAX_PER_ORDER)
  const payment = oneOf(body.paymentMethod, 'Payment method', PAYMENT_METHODS)
  const { device, userId } = await customerContext(req, body.deviceId)
  if (!userId) throw new HttpError(401, 'Log in or create an account to reserve.')
  const order = await tx(async (c) => {
    const { rows } = await c.query(
      `select b.*, s.status from bags b join stores s on s.id = b.store_id where b.store_id = $1 for update of b`,
      [storeId],
    )
    const bag = rows[0]
    if (!bag || bag.status !== 'active') throw new HttpError(404, 'This store isn’t available.')
    if (bag.paused || bag.quantity < quantity)
      throw new HttpError(409, bag.quantity > 0 && !bag.paused ? `Only ${bag.quantity} left.` : 'Sold out — someone got there first.')
    const now = Date.now()
    const { start, end } = resolveWindow({ day: bag.pickup_day, start: bag.pickup_start, end: bag.pickup_end }, now)
    await c.query('update bags set quantity = quantity - $1, updated_at = now() where store_id = $2', [quantity, storeId])
    const ins = await c.query(
      `insert into orders (id, store_id, bag_id, device_id, user_id, quantity, unit_price, unit_original_price, pickup_start, pickup_end, pickup_code, status, payment_method)
       values ($1,$2,$3,$4,$12,$5,$6,$7,to_timestamp($8/1000.0),to_timestamp($9/1000.0),$10,'reserved',$11) returning *`,
      [newId(), storeId, bag.id, device, quantity, bag.price, bag.original_price, start, end, pickupCode(), payment, userId],
    )
    // Payment is simulated for now; the sale is recorded as if the card was charged.
    await recordSale(c, ins.rows[0])
    return ins.rows[0]
  })
  return { status: 201, body: { order: toOrder(order) } }
}

/** @type {Handler} */
async function deviceOrders({ req, url }) {
  const { device, userId } = await customerContext(req, url.searchParams.get('deviceId'))
  const { rows } = await query(
    `select o.*, k.status as complaint_status, k.refund_amount as complaint_refund
       from orders o left join complaints k on k.order_id = o.id
      where (o.user_id is null and o.device_id = $1) or ($2::text is not null and o.user_id = $2) order by o.created_at desc limit 100`,
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
    await recordCancellation(c, up.rows[0])
    return up.rows[0]
  })
  return { body: { order: toOrder(order) } }
}

/** @type {Handler} */
async function collectOrder({ req, params, body }) {
  const o = await ownOrder(params.id, await customerContext(req, body.deviceId))
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
    if (o.status === 'cancelled') throw new HttpError(409, 'This order was cancelled.')
    if (o.status === 'collected') return o
    const up = await c.query(
      `update orders set status = 'collected', collected_at = coalesce(collected_at, now()), closed_at = coalesce(closed_at, now()) where id = $1 returning *`,
      [id],
    )
    if (o.status === 'reserved') await recordClose(c, up.rows[0])
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
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, storeId: u.storeId ?? u.store_id ?? null, storeStatus: u.storeStatus ?? null })

/** @type {Handler} */
async function me({ req }) {
  const user = await currentUser(req)
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
    await c.query(`insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,'admin')`, [id, mail, name, hash])
  })
  const { cookie } = await createSession(id, secure)
  return { status: 201, body: { user: { id, email: mail, name, role: 'admin', storeId: null, storeStatus: null } }, headers: { 'Set-Cookie': cookie } }
}

/** @type {Handler} */
async function login({ body, secure }) {
  const mail = email(body.email)
  const pw = str(body.password, 'Password', { max: 200 })
  const { rows } = await query(
    `select u.*, s.status as "storeStatus" from users u left join stores s on s.id = u.store_id where u.email = $1`,
    [mail],
  )
  const user = rows[0]
  if (!user || !(await verifyPassword(pw, user.password_hash))) throw new HttpError(401, 'Wrong email or password.')
  // The customer app and the store dashboard have separate kinds of account.
  const fromApp = body.client === 'app'
  if (fromApp && user.role !== 'customer')
    throw new HttpError(403, 'This email belongs to a store or team account. Log in to the dashboard instead, or use another email for the app.')
  if (!fromApp && user.role === 'customer') throw new HttpError(403, 'This is a customer account. Log in in the Ngopu app.')
  const { cookie, token } = await createSession(user.id, secure, fromApp)
  if (fromApp) {
    if (body.deviceId) await claimDeviceOrders(user.id, deviceId(body.deviceId))
    return { body: { user: publicUser(user), token } }
  }
  return { body: { user: publicUser(user) }, headers: { 'Set-Cookie': cookie } }
}

/** Attaches orders placed on this device before signing in to the customer's account. */
/** @param {string} userId @param {string} device */
async function claimDeviceOrders(userId, device) {
  await query('update orders set user_id = $1 where device_id = $2 and user_id is null', [userId, device])
}

/** Customer sign-up from the app. Returns a bearer token (no cookie). */
/** @type {Handler} */
async function signup({ body, secure }) {
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const hash = await hashPassword(password(body.password))
  const id = newId('u_')
  const exists = await query('select 1 from users where email = $1', [mail])
  if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists. Log in instead.')
  await query(`insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,'customer')`, [id, mail, name, hash])
  if (body.deviceId) await claimDeviceOrders(id, deviceId(body.deviceId))
  const { token } = await createSession(id, secure, true)
  return { status: 201, body: { user: { id, email: mail, name, role: 'customer', storeId: null, storeStatus: null }, token } }
}

/** @type {Handler} */
async function updateMe({ req, body }) {
  const user = await requireUser(req, 'customer')
  const name = str(body.name, 'Name', { max: 80 })
  await query('update users set name = $2 where id = $1', [user.id, name])
  return { body: { user: publicUser({ ...user, name }) } }
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
            coalesce(sum(o.quantity) filter (where o.status <> 'cancelled'), 0)::int as bags,
            coalesce(sum(o.quantity * o.unit_price) filter (where o.status <> 'cancelled'), 0)::int as revenue,
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
     where status <> 'cancelled' and ($2::text is null or store_id = $2)`,
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
      `select * from orders where store_id = $1 and status <> 'cancelled' and pickup_end >= now() - interval '12 hours' order by pickup_start, created_at`,
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
      where o.store_id = $1 and ($2::text is null or o.status = $2 or ($2 = 'reserved' and o.status = 'no_show'))
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
  if (body.price !== undefined) u.price = int(body.price, 'Price', 0, 1_000_000)
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
  const { rows } = await query(`select * from orders where store_id = $1 and pickup_code = $2 order by created_at desc limit 1`, [
    user.storeId,
    code,
  ])
  const o = rows[0]
  if (!o) throw new HttpError(404, 'No order with that code at your store.')
  if (o.status === 'cancelled') throw new HttpError(409, 'That order was cancelled.')
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
             (select count(*)::int from orders where status = 'reserved' and pickup_end >= now()) as to_collect
           from stores`),
    query(
      `select s.id, s.name, s.branch, s.category, s.rating,
              coalesce(sum(o.quantity), 0)::int as bags, coalesce(sum(o.quantity * o.unit_price), 0)::int as revenue
         from stores s
         left join orders o on o.store_id = s.id and o.status <> 'cancelled' and o.created_at >= now() - make_interval(days => $1)
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
      `, (select coalesce(sum(o.quantity), 0)::int from orders o where o.store_id = s.id and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days') as bags_30d,
         (select coalesce(sum(o.quantity * o.unit_price), 0)::int from orders o where o.store_id = s.id and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days') as revenue_30d
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
    query(`select * from orders where store_id = $1 order by created_at desc limit 50`, [params.id]),
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
      where ($1::text is null or o.status = $1 or ($1 = 'reserved' and o.status = 'no_show')) order by o.created_at desc limit 500`,
    [status && ['reserved', 'collected', 'cancelled'].includes(status) ? status : null],
  )
  return { body: { orders: rows.map(toOrder) } }
}

/** @type {Handler} */
async function adminTeam({ req }) {
  await requireUser(req, 'admin')
  const { rows } = await query(
    `select id, name, email, created_at as "createdAt", last_login_at as "lastLoginAt" from users where role = 'admin' order by created_at`,
  )
  return { body: { admins: rows } }
}

/** @type {Handler} */
async function adminAddTeam({ req, body }) {
  await requireUser(req, 'admin')
  const name = str(body.name, 'Name', { max: 80 })
  const mail = email(body.email)
  const hash = await hashPassword(password(body.password))
  const exists = await query('select 1 from users where email = $1', [mail])
  if (exists.rows[0]) throw new HttpError(409, 'An account with this email already exists.')
  const id = newId('u_')
  await query(`insert into users (id, email, name, password_hash, role) values ($1,$2,$3,$4,'admin')`, [id, mail, name, hash])
  return { status: 201, body: { admin: { id, name, email: mail } } }
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
  ['POST', 'orders', createOrder],
  ['GET', 'orders', deviceOrders],
  ['POST', 'orders/:id/cancel', cancelOrder],
  ['POST', 'orders/:id/collect', collectOrder],
  ['POST', 'orders/:id/rate', rateOrder],
  ['POST', 'orders/:id/complaint', fileComplaint],
  ['GET', 'auth/me', me],
  ['POST', 'auth/setup', setup],
  ['POST', 'auth/login', login],
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
      return { handler, params }
  }
  return null
}

/** Endpoints the native apps call from another origin (no cookies involved). */
export const PUBLIC_PREFIXES = ['stores', 'orders', 'health', 'auth']
