import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { t } from '../i18n'
import type { Order } from '../types'
import { customerApi } from './api'
import { isNative } from './native'

/**
 * Notifications about the customer's orders.
 *  - Web: Web Push through a small service worker; the server sends pickup reminders and store cancellations.
 *  - Phone apps: the pickup reminder is scheduled on the phone itself (local notification), so it arrives on
 *    time even offline. Store cancellations come as remote pushes: FCM on Android, APNs on iPhone. The phone
 *    registers its push token with the server when the switch is on and the server has the keys
 *    (see docs/production-setup.md); without them the local reminders still work.
 */

const REMINDER_LEAD_MS = 30 * 60_000
const ENABLED_KEY = 'ngopu:push'
/** The phone's push token, as last registered with the server. */
const TOKEN_KEY = 'ngopu:push-token'
/** Android notification channel used by the server for order pushes (notify.js sends channel_id 'orders'). */
const ANDROID_CHANNEL = 'orders'

export type PushState = 'unsupported' | 'off' | 'on' | 'blocked'

export function pushWanted(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function remember(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
  } catch {
    // Not remembered; fine.
  }
}

const savedToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Not remembered; the next registration sends it again.
    }
  },
}

export async function pushState(): Promise<PushState> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions().catch(() => null)
    if (!p) return 'unsupported'
    if (p.display === 'denied') return 'blocked'
    return p.display === 'granted' && pushWanted() ? 'on' : 'off'
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  // Hidden until the server has push keys (VAPID) configured.
  const cfg = await customerApi.pushConfig().catch(() => null)
  if (!cfg?.web) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Asks for permission and registers this device. Resolves to the resulting state. */
export async function enablePush(): Promise<PushState> {
  if (isNative) {
    const p = await LocalNotifications.requestPermissions()
    if (p.display !== 'granted') return 'blocked'
    remember(true)
    // Remote pushes are best effort: local reminders work without them.
    await registerRemote().catch(() => {})
    return 'on'
  }
  const cfg = await customerApi.pushConfig()
  if (!cfg.web || !cfg.vapidPublicKey) throw new Error(t('Notifications aren’t available yet. Try again later.'))
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.vapidPublicKey) }))
  const json = sub.toJSON()
  await customerApi.pushSubscribe({ kind: 'web', endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } })
  remember(true)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  remember(false)
  if (isNative) {
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }))
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
    await unregisterRemote().catch(() => {})
    return 'off'
  }
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await customerApi.pushUnsubscribe(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
  return 'off'
}

/* ------------------------------------------------------------------ remote push (phone apps) */

/** Which token kind this phone registers: Firebase on Android, Apple's APNs on iPhone. */
function tokenKind(): 'fcm' | 'apns' {
  return Capacitor.getPlatform() === 'ios' ? 'apns' : 'fcm'
}

/** Whether the server can push to this kind of phone right now. */
async function remoteAvailable(): Promise<boolean> {
  const cfg = await customerApi.pushConfig().catch(() => null)
  if (!cfg) return false
  return tokenKind() === 'apns' ? Boolean(cfg.ios) : Boolean(cfg.android)
}

/** Resolves with the phone's push token, or null when the OS refuses (no Google services, simulator, ...). */
function obtainToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const handles: Promise<{ remove: () => Promise<void> }>[] = []
    const done = (token: string | null) => {
      for (const h of handles) h.then((x) => x.remove()).catch(() => {})
      resolve(token)
    }
    handles.push(PushNotifications.addListener('registration', (r) => done(r.value)))
    handles.push(PushNotifications.addListener('registrationError', () => done(null)))
    PushNotifications.register().catch(() => done(null))
    setTimeout(() => done(null), 15_000)
  })
}

/**
 * Phone apps: asks the OS for a push token and saves it on the server for the signed-in customer. Does
 * nothing for guests (the server needs an account to know whose orders to talk about) or while the server
 * has no keys for this platform.
 */
export async function registerRemote(): Promise<void> {
  if (!isNative || !pushWanted()) return
  if (!(await remoteAvailable())) return
  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return
  if (Capacitor.getPlatform() === 'android') {
    await PushNotifications.createChannel({ id: ANDROID_CHANNEL, name: t('Order updates'), description: t('30 minutes before pickup, and if a store cancels'), importance: 4, visibility: 1 }).catch(() => {})
  }
  const token = await obtainToken()
  if (!token) return
  await customerApi.pushSubscribe({ kind: tokenKind(), endpoint: token })
  savedToken.set(token)
}

/** Removes this phone's token from the server and stops receiving remote pushes. */
export async function unregisterRemote(): Promise<void> {
  if (!isNative) return
  const token = savedToken.get()
  if (token) await customerApi.pushUnsubscribe(token).catch(() => {})
  savedToken.set(null)
  await PushNotifications.unregister().catch(() => {})
}

/**
 * Keeps the server's copy of this phone's token in step with the account: after login/signup the token is
 * registered to the new account; before logout it is removed. Never throws.
 */
export async function syncRemoteRegistration(signedIn: boolean): Promise<void> {
  if (!isNative) return
  try {
    if (signedIn) await registerRemote()
    else await unregisterRemote()
  } catch {
    // Push is a convenience; the account action itself must not fail because of it.
  }
}

/* ------------------------------------------------------------------ local reminders (phone apps) */

/** Stable numeric id for an order's local notification. */
function notificationId(orderId: string) {
  let h = 0
  for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h) % 2_000_000_000
}

/**
 * Phone apps: keeps one local reminder per upcoming paid order, 30 minutes before pickup, and removes
 * reminders for orders that were cancelled or collected. Called whenever the order list changes.
 */
export async function syncLocalReminders(orders: Order[], storeName: (id: string) => string | undefined) {
  if (!isNative || !pushWanted()) return
  const perm = await LocalNotifications.checkPermissions().catch(() => null)
  if (perm?.display !== 'granted') return
  const now = Date.now()
  const wanted = orders.filter((o) => o.status === 'reserved' && !o.paymentStatus && o.pickupStart - REMINDER_LEAD_MS > now)
  const pending = await LocalNotifications.getPending()
  const wantedIds = new Set(wanted.map((o) => notificationId(o.id)))
  const stale = pending.notifications.filter((n) => !wantedIds.has(n.id))
  if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) })
  const have = new Set(pending.notifications.map((n) => n.id))
  const fmt = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const add = wanted
    .filter((o) => !have.has(notificationId(o.id)))
    .map((o) => ({
      id: notificationId(o.id),
      title: t('Time to collect at {store}', { store: storeName(o.storeId) ?? 'Ngopu' }),
      body: t('Pickup {from}–{to} · code {code}', { from: fmt(o.pickupStart), to: fmt(o.pickupEnd), code: o.pickupCode }),
      schedule: { at: new Date(o.pickupStart - REMINDER_LEAD_MS), allowWhileIdle: true },
      extra: { url: `/orders/${o.id}` },
    }))
  if (add.length) await LocalNotifications.schedule({ notifications: add })
}
