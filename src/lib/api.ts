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

export const customerApi = {
  stores: () => api<{ stores: Store[] }>('stores').then((r) => r.stores),
  orders: () => api<{ orders: Order[] }>(`orders?deviceId=${deviceId()}`).then((r) => r.orders),
  reserve: (storeId: string, quantity: number, paymentMethod: PaymentMethod) =>
    api<{ order: Order }>('orders', { method: 'POST', json: { storeId, quantity, paymentMethod, deviceId: deviceId() } }).then(
      (r) => r.order,
    ),
  cancel: (id: string) => api<{ order: Order }>(`orders/${id}/cancel`, { method: 'POST', json: { deviceId: deviceId() } }).then((r) => r.order),
  collect: (id: string) => api<{ order: Order }>(`orders/${id}/collect`, { method: 'POST', json: { deviceId: deviceId() } }).then((r) => r.order),
  rate: (id: string, rating: number, tags: string[]) =>
    api<{ order: Order }>(`orders/${id}/rate`, { method: 'POST', json: { deviceId: deviceId(), rating, tags } }).then((r) => r.order),
}
