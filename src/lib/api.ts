import { LANDING_URL } from '../config'
import type { Order, PaymentMethod, Store } from '../types'
import { isNative } from './native'

/** The native apps call the deployed API; the website uses the same origin. */
const API_BASE = isNative ? LANDING_URL : ''

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    throw new ApiError(0, 'You seem to be offline. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Please try again.', data.code)
  return data as T
}

const DEVICE_KEY = 'buko:device'

/** Anonymous customer identity: orders belong to the device that placed them. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'anonymous-device'
  }
}

const TOKEN_KEY = 'ngopu:token'

/** Customer app session token (sent as a Bearer header; cookies are unreliable inside the native apps). */
export const customerToken = {
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
      // Storage blocked: the session lasts until the page closes.
    }
  },
}

/** Only customer-app calls carry the customer token, never the dashboard's (they share an origin). */
function customer<T>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const token = customerToken.get()
  return api<T>(path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } })
}

export interface CustomerAccount {
  id: string
  name: string
  email: string
}

/** Whether the customer may pay cash at pickup, and why not. */
export interface CashEligibility {
  eligible: boolean
  reason: string | null
  collected: number
  needed: number
}

export const customerApi = {
  stores: () => api<{ stores: Store[] }>('stores').then((r) => r.stores),
  orders: () => customer<{ orders: Order[] }>(`orders?deviceId=${deviceId()}`).then((r) => r.orders),
  reserve: (storeId: string, quantity: number, paymentMethod: PaymentMethod) =>
    customer<{ order: Order }>('orders', { method: 'POST', json: { storeId, quantity, paymentMethod, deviceId: deviceId() } }).then(
      (r) => r.order,
    ),
  cancel: (id: string) => customer<{ order: Order }>(`orders/${id}/cancel`, { method: 'POST', json: { deviceId: deviceId() } }).then((r) => r.order),
  collect: (id: string) => customer<{ order: Order }>(`orders/${id}/collect`, { method: 'POST', json: { deviceId: deviceId() } }).then((r) => r.order),
  complain: (id: string, reason: string, details: string) =>
    customer<{ order: Order }>(`orders/${id}/complaint`, { method: 'POST', json: { deviceId: deviceId(), reason, details } }).then((r) => r.order),
  rate: (id: string, rating: number, tags: string[]) =>
    customer<{ order: Order }>(`orders/${id}/rate`, { method: 'POST', json: { deviceId: deviceId(), rating, tags } }).then((r) => r.order),

  signup: (name: string, email: string, password: string) =>
    api<{ user: CustomerAccount; token: string }>('auth/signup', { method: 'POST', json: { name, email, password, deviceId: deviceId() } }),
  login: (email: string, password: string) =>
    api<{ user: CustomerAccount; token: string }>('auth/login', { method: 'POST', json: { email, password, client: 'app', deviceId: deviceId() } }),
  me: () => customer<{ user: (CustomerAccount & { role: string; cash?: CashEligibility }) | null }>('auth/me').then((r) => r.user),
  logout: () => customer('auth/logout', { method: 'POST', json: {} }),
  rename: (name: string) => customer<{ user: CustomerAccount }>('auth/me', { method: 'PATCH', json: { name } }).then((r) => r.user),
  deleteAccount: () => customer('auth/me', { method: 'DELETE' }),
}
