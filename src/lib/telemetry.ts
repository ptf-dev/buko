import { Capacitor } from '@capacitor/core'
import { LANDING_URL } from '../config'
import { isNative } from './native'

const API_BASE_URL = isNative ? LANDING_URL : ''

/**
 * Anonymous usage events and error reports, sent to Ngopu's own API (no third-party trackers, no cookies).
 * A random id per app launch groups a visit; nothing identifies the person.
 */

type EventName =
  | 'app_open'
  | 'page_view'
  | 'store_view'
  | 'checkout_open'
  | 'order_placed'
  | 'payment_started'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'order_cancelled'
  | 'order_collected'
  | 'signup'
  | 'login'
  | 'push_enabled'
  | 'language_changed'

const session = Math.random().toString(36).slice(2, 12)
const platform = isNative ? Capacitor.getPlatform() : 'web'
let queue: { name: EventName; path?: string; props?: Record<string, unknown> }[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let source: 'app' | 'dashboard' = 'app'
const RELEASE = import.meta.env.VITE_RELEASE ?? ''

function post(path: string, body: unknown) {
  return fetch(`${API_BASE_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}

function flush() {
  timer = null
  if (!queue.length) return
  const events = queue.splice(0, 50)
  post('telemetry/events', { session, platform, events })
}

/** Records a product event (batched, sent within a few seconds). */
export function track(name: EventName, props?: Record<string, unknown>) {
  if (import.meta.env.DEV || source !== 'app') return
  queue.push({ name, path: location.pathname.replace(/^\/app/, '') || '/', props })
  if (!timer) timer = setTimeout(flush, 4000)
}

const reported = new Set<string>()

/** Sends an error once per launch (at most 10 different ones). */
export function reportError(err: unknown, extra?: string) {
  if (import.meta.env.DEV) return
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
  const key = e.message
  if (reported.has(key) || reported.size >= 10) return
  reported.add(key)
  post('telemetry/error', { source, message: extra ? `${extra}: ${e.message}` : e.message, stack: e.stack, url: location.pathname, release: RELEASE })
}

/** Installs global error handlers and the flush-on-hide. Call once at startup. */
export function initTelemetry(from: 'app' | 'dashboard') {
  source = from
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => {
    // Failed API calls are expected (offline, validation) and already shown to the person.
    if (e.reason && typeof e.reason === 'object' && 'status' in e.reason) return
    reportError(e.reason)
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
  if (from === 'app') track('app_open')
}
