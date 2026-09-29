import { LocalNotifications } from '@capacitor/local-notifications'
import { t } from '../i18n'
import type { Order } from '../types'
import { customerApi } from './api'
import { isNative } from './native'

/**
 * Notifications about the customer's orders.
 *  - Web: Web Push through a small service worker; the server sends pickup reminders and store cancellations.
 *  - Phone apps: the pickup reminder is scheduled on the phone itself (local notification), so it arrives on
 *    time even offline. Remote push for store cancellations needs Firebase in the native build (see README).
 */

const REMINDER_LEAD_MS = 30 * 60_000
const ENABLED_KEY = 'ngopu:push'

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

export async function pushState(): Promise<PushState> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions().catch(() => null)
    if (!p) return 'unsupported'
    if (p.display === 'denied') return 'blocked'
    return p.display === 'granted' && pushWanted() ? 'on' : 'off'
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
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
