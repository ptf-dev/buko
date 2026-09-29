// @ts-check
/**
 * Messages to customers about their orders: email receipts, and push notifications for pickup reminders and
 * store cancellations.
 *
 * Push goes to the web app through Web Push (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) and to the Android/iOS
 * apps through Firebase Cloud Messaging (FCM_SERVICE_ACCOUNT, the service-account JSON). Either works alone;
 * without keys nothing is pushed. The phone apps also schedule their own local pickup reminder, so reminders
 * reach native users even before Firebase is set up.
 */
import { createSign } from 'node:crypto'
import webpush from 'web-push'
import { newId } from './auth.js'
import { query } from './db.js'
import { SITE } from './email-templates.js'
import { lang, orderReceipt, storeCancelled } from './mail.js'
import { TIMEZONE } from './time.js'

/** Reminder goes out this long before pickup starts. */
export const REMINDER_LEAD_MIN = 30

/* ------------------------------------------------------------------ email */

/**
 * The receipt for a confirmed order (card paid, or cash reserved). Sent once: the order is claimed first, so
 * a webhook and the app confirming the same payment never send two.
 * @param {string} orderId
 */
export async function sendReceipt(orderId) {
  const { rows } = await query(
    `update orders o set receipt_sent_at = now()
       from users u, stores s
      where o.id = $1 and o.receipt_sent_at is null and o.status = 'reserved' and not o.is_demo
        and u.id = o.user_id and s.id = o.store_id
      returning o.id, u.email, u.name as user_name, u.language`,
    [orderId],
  )
  if (!rows[0]) return false
  const o = await orderWithStore(orderId)
  await orderReceipt({ to: rows[0].email, name: rows[0].user_name, lang: lang(rows[0].language), order: o, store: storeInfo(o) })
  return true
}

/** An order with what the emails show about its store: photo, category, location and bag. @param {string} orderId */
async function orderWithStore(orderId) {
  const { rows } = await query(
    `select o.*, s.name as store_name, s.address as store_address, s.category, s.lat, s.lng, b.title as bag_title,
            extract(epoch from ph.updated_at)::bigint as photo_v
       from orders o join stores s on s.id = o.store_id left join bags b on b.store_id = o.store_id
       left join store_photos ph on ph.store_id = o.store_id
      where o.id = $1`,
    [orderId],
  )
  return rows[0]
}

/** @param {any} o @returns {import('./email-templates.js').StoreInfo} */
function storeInfo(o) {
  return {
    name: o.store_name,
    address: o.store_address,
    category: o.category,
    lat: o.lat,
    lng: o.lng,
    bagTitle: o.bag_title ?? undefined,
    photoUrl: o.photo_v ? `${SITE}/api/stores/${o.store_id}/photo?v=${o.photo_v}` : null,
  }
}

/** The store cancelled: email and push. @param {string} orderId */
export async function notifyStoreCancelled(orderId) {
  const { rows } = await query(
    `select o.id, u.email, u.name as user_name, u.language
       from orders o join users u on u.id = o.user_id where o.id = $1 and not o.is_demo`,
    [orderId],
  )
  if (!rows[0]) return
  const o = { ...(await orderWithStore(orderId)), ...rows[0] }
  const l = lang(o.language)
  await Promise.all([
    storeCancelled({ to: o.email, name: o.user_name, lang: l, order: o, store: storeInfo(o) }),
    pushToUser(o.user_id, {
      title: l === 'sq' ? `${o.store_name} anuloi porosinë` : `${o.store_name} cancelled your order`,
      body:
        o.payment_method === 'cash'
          ? l === 'sq'
            ? 'Na vjen keq. Nuk të tarifuam.'
            : 'Sorry about this. You weren’t charged.'
          : l === 'sq'
            ? 'Na vjen keq. Paratë po të kthehen në kartë.'
            : 'Sorry about this. Your money is on its way back to your card.',
      url: `/app/orders/${o.id}`,
      tag: `order-${o.id}`,
    }),
  ])
}

/* ------------------------------------------------------------------ reminders */

let lastReminderRun = 0

/**
 * Pushes a reminder for orders whose pickup starts within REMINDER_LEAD_MIN minutes. Runs lazily from busy
 * endpoints (at most once a minute per instance) and from the cron jobs; each order is claimed so it's
 * reminded once.
 * @param {boolean} [force]
 */
export async function sendDueReminders(force = false) {
  if (!pushConfigured()) return 0
  if (!force && Date.now() - lastReminderRun < 60_000) return 0
  lastReminderRun = Date.now()
  const { rows } = await query(
    `update orders o set reminded_at = now()
       from stores s
      where o.id in (select id from orders
                      where status = 'reserved' and reminded_at is null and user_id is not null and not is_demo
                        and pickup_start <= now() + make_interval(mins => $1) and pickup_end > now()
                      order by pickup_start limit 100 for update skip locked)
        and s.id = o.store_id
      returning o.id, o.user_id, o.pickup_start, o.pickup_end, o.pickup_code, s.name as store_name,
                (select language from users where id = o.user_id) as language`,
    [REMINDER_LEAD_MIN],
  )
  for (const o of rows) {
    const l = lang(o.language)
    const t = (/** @type {Date} */ d) => new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(d)
    await pushToUser(o.user_id, {
      title: l === 'sq' ? `Koha për të marrë çantën te ${o.store_name}` : `Time to collect at ${o.store_name}`,
      body: l === 'sq' ? `Marrja ${t(o.pickup_start)}–${t(o.pickup_end)} · kodi ${o.pickup_code}` : `Pickup ${t(o.pickup_start)}–${t(o.pickup_end)} · code ${o.pickup_code}`,
      url: `/app/orders/${o.id}`,
      tag: `order-${o.id}`,
    })
  }
  return rows.length
}

/* ------------------------------------------------------------------ push delivery */

export function webPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export function fcmConfigured() {
  return Boolean(process.env.FCM_SERVICE_ACCOUNT)
}

export function pushConfigured() {
  return webPushConfigured() || fcmConfigured()
}

/**
 * Saves a device for push. Web: the PushSubscription JSON. Native: the FCM registration token.
 * @param {string} userId @param {{ kind: 'web' | 'fcm', endpoint: string, keys?: unknown }} sub
 */
export async function saveSubscription(userId, sub) {
  await query(
    `insert into push_subscriptions (id, user_id, kind, endpoint, keys) values ($1,$2,$3,$4,$5)
     on conflict (endpoint) do update set user_id = excluded.user_id, keys = excluded.keys, last_used_at = null`,
    [newId('ps_'), userId, sub.kind, sub.endpoint, sub.keys ? JSON.stringify(sub.keys) : null],
  )
}

/** @param {string} userId @param {string} endpoint */
export async function removeSubscription(userId, endpoint) {
  await query('delete from push_subscriptions where user_id = $1 and endpoint = $2', [userId, endpoint])
}

/**
 * Sends to every device of a user. Dead subscriptions (uninstalled app, revoked permission) are removed.
 * Never throws.
 * @param {string} userId @param {{ title: string, body: string, url: string, tag?: string }} msg
 */
export async function pushToUser(userId, msg) {
  if (!pushConfigured()) return 0
  const { rows } = await query('select * from push_subscriptions where user_id = $1', [userId])
  let sent = 0
  for (const s of rows) {
    try {
      const ok = s.kind === 'web' ? await sendWeb(s, msg) : await sendFcm(s.endpoint, msg)
      if (ok === 'gone') await query('delete from push_subscriptions where id = $1', [s.id])
      else if (ok) {
        sent++
        await query('update push_subscriptions set last_used_at = now() where id = $1', [s.id])
      }
    } catch (err) {
      console.error('push failed', s.kind, err instanceof Error ? err.message : err)
    }
  }
  return sent
}

/** @param {any} s @param {{ title: string, body: string, url: string, tag?: string }} msg @returns {Promise<boolean | 'gone'>} */
async function sendWeb(s, msg) {
  if (!webPushConfigured()) return false
  webpush.setVapidDetails('mailto:hello@ngopu.app', /** @type {string} */ (process.env.VAPID_PUBLIC_KEY), /** @type {string} */ (process.env.VAPID_PRIVATE_KEY))
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 3600 })
    return true
  } catch (err) {
    const code = /** @type {any} */ (err)?.statusCode
    if (code === 404 || code === 410) return 'gone'
    throw err
  }
}

/** @type {{ token: string, expiresAt: number } | null} */
let fcmToken = null

/** OAuth token for FCM from the service account (a signed JWT exchanged at Google). */
async function fcmAccessToken() {
  const sa = JSON.parse(/** @type {string} */ (process.env.FCM_SERVICE_ACCOUNT))
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return { token: fcmToken.token, project: sa.project_id }
  const now = Math.floor(Date.now() / 1000)
  const b64 = (/** @type {object} */ o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) throw new Error(`FCM auth failed: ${res.status}`)
  fcmToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return { token: fcmToken.token, project: sa.project_id }
}

/** @param {string} deviceToken @param {{ title: string, body: string, url: string, tag?: string }} msg @returns {Promise<boolean | 'gone'>} */
async function sendFcm(deviceToken, msg) {
  if (!fcmConfigured()) return false
  const { token, project } = await fcmAccessToken()
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: msg.title, body: msg.body },
        data: { url: msg.url },
        android: { notification: { tag: msg.tag, channel_id: 'orders' } },
      },
    }),
  })
  if (res.ok) return true
  const body = await res.json().catch(() => null)
  if (res.status === 404 || body?.error?.details?.some?.((/** @type {any} */ d) => d.errorCode === 'UNREGISTERED')) return 'gone'
  throw new Error(`FCM send failed: ${res.status}`)
}
