import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module without type declarations
import { resolveWindow, tzOffset } from '../../api/_lib/time.js'
// @ts-expect-error plain JS module without type declarations
import { match } from '../../api/_lib/routes.js'
// @ts-expect-error plain JS module without type declarations
import { apnsPayload, fcmMessage } from '../../api/_lib/notify.js'

describe('api time', () => {
  it('knows Tirana is UTC+2 in summer and UTC+1 in winter', () => {
    expect(tzOffset(Date.UTC(2026, 6, 1, 12))).toBe(2 * 3_600_000)
    expect(tzOffset(Date.UTC(2026, 0, 15, 12))).toBe(3_600_000)
  })

  it('resolves a pickup window in Tirana wall-clock time', () => {
    // 27 Sep 2026 12:00 UTC = 14:00 in Tirana
    const now = Date.UTC(2026, 8, 27, 12)
    const { start, end } = resolveWindow({ day: 'today', start: 19 * 60, end: 19 * 60 + 45 }, now)
    expect(new Date(start).toISOString()).toBe('2026-09-27T17:00:00.000Z') // 19:00 Tirana
    expect(new Date(end).toISOString()).toBe('2026-09-27T17:45:00.000Z')
  })

  it('rolls an ended window to the next day', () => {
    const now = Date.UTC(2026, 8, 27, 20) // 22:00 Tirana
    const { start } = resolveWindow({ day: 'today', start: 12 * 60, end: 12 * 60 + 30 }, now)
    expect(new Date(start).toISOString()).toBe('2026-09-28T10:00:00.000Z')
  })

  it('handles "tomorrow" windows', () => {
    const now = Date.UTC(2026, 8, 27, 8)
    const { start } = resolveWindow({ day: 'tomorrow', start: 10 * 60, end: 11 * 60 }, now)
    expect(new Date(start).toISOString()).toBe('2026-09-28T08:00:00.000Z')
  })
})

describe('api router', () => {
  it('matches static and parameterised routes by method', () => {
    expect(match('GET', 'stores')).not.toBeNull()
    expect(match('POST', 'stores')).toBeNull()
    const m = match('POST', 'orders/abc123/cancel')
    expect(m?.params).toEqual({ id: 'abc123' })
    expect(match('PATCH', 'admin/stores/furra-e-lagjes')?.params).toEqual({ id: 'furra-e-lagjes' })
    expect(match('GET', 'admin/nope')).toBeNull()
  })
})

describe('push messages for the phone apps', () => {
  const msg = { title: 'Furra cancelled your order', body: 'Sorry about this.', url: '/app/orders/o_1', tag: 'order-o_1' }

  it('builds an FCM message the Android app can open', () => {
    const m = fcmMessage('device-token', msg).message
    expect(m.token).toBe('device-token')
    expect(m.notification).toEqual({ title: msg.title, body: msg.body })
    expect(m.data.url).toBe('/app/orders/o_1')
    expect(m.android.notification.channel_id).toBe('orders')
    expect(m.android.notification.tag).toBe('order-o_1')
  })

  it('builds an APNs payload the iPhone app can open', () => {
    const p = apnsPayload(msg)
    expect(p.aps.alert).toEqual({ title: msg.title, body: msg.body })
    expect(p.aps['thread-id']).toBe('order-o_1')
    expect(p.url).toBe('/app/orders/o_1')
    expect(apnsPayload({ ...msg, tag: undefined }).aps['thread-id']).toBeUndefined()
  })

  it('routes push registration', () => {
    expect(match('POST', 'push/subscribe')).not.toBeNull()
    expect(match('POST', 'push/unsubscribe')).not.toBeNull()
    expect(match('GET', 'push/config')).not.toBeNull()
  })
})
