import { describe, expect, it } from 'vitest'
import { SEED_STORES } from '../data/stores'
import { discountPercent, formatMinutes, isCollectSoon, resolveWindow } from '../lib/format'
import { applyFilters, DEFAULT_FILTERS, distanceKm, toListings } from '../lib/search'
import { computeImpact, initialState, MAX_PER_ORDER, reducer } from '../state/reducer'
import { DEFAULT_LOCATION } from '../config'

// 2026-09-27 17:00 local time
const NOW = new Date(2026, 8, 27, 17, 0).getTime()

describe('format', () => {
  it('formats minutes of day', () => {
    expect(formatMinutes(18 * 60 + 5)).toBe('18:05')
  })

  it('computes discount', () => {
    expect(discountPercent(350, 1050)).toBe(67)
  })

  it('keeps an upcoming window on today', () => {
    const { start } = resolveWindow({ day: 'today', start: 19 * 60, end: 19 * 60 + 30 }, NOW)
    expect(new Date(start).getDate()).toBe(27)
    expect(new Date(start).getHours()).toBe(19)
  })

  it('rolls an ended today window to tomorrow', () => {
    const { start } = resolveWindow({ day: 'today', start: 12 * 60, end: 12 * 60 + 30 }, NOW)
    expect(new Date(start).getDate()).toBe(28)
  })

  it('detects collect-soon windows', () => {
    const { start, end } = resolveWindow({ day: 'today', start: 17 * 60 + 30, end: 18 * 60 }, NOW)
    expect(isCollectSoon(start, end, NOW)).toBe(true)
    const later = resolveWindow({ day: 'today', start: 21 * 60, end: 22 * 60 }, NOW)
    expect(isCollectSoon(later.start, later.end, NOW)).toBe(false)
  })
})

describe('search', () => {
  const listings = toListings(SEED_STORES, DEFAULT_LOCATION, NOW)

  it('computes distances in km', () => {
    expect(distanceKm(41.3275, 19.8187, 41.3275, 19.8187)).toBe(0)
    expect(distanceKm(41.3275, 19.8187, 41.3375, 19.8187)).toBeCloseTo(1.11, 1)
  })

  it('filters by query and category', () => {
    const bakery = applyFilters(listings, { ...DEFAULT_FILTERS, categories: ['bakery'] }, 10, NOW)
    expect(bakery.length).toBeGreaterThan(0)
    expect(bakery.every((l) => l.store.category === 'bakery')).toBe(true)
    const sushi = applyFilters(listings, { ...DEFAULT_FILTERS, query: 'sushi' }, 10, NOW)
    expect(sushi.map((l) => l.store.id)).toEqual(['sushi-koi'])
  })

  it('treats vegan bags as vegetarian', () => {
    const veg = applyFilters(listings, { ...DEFAULT_FILTERS, diets: ['vegetarian'] }, 10, NOW)
    expect(veg.some((l) => l.store.bag.diet === 'vegan')).toBe(true)
  })

  it('hides sold out and sorts by price', () => {
    const res = applyFilters(listings, { ...DEFAULT_FILTERS, hideSoldOut: true, sortBy: 'price' }, 10, NOW)
    expect(res.every((l) => l.store.bag.quantity > 0)).toBe(true)
    const prices = res.map((l) => l.store.bag.price)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('respects the radius', () => {
    expect(applyFilters(listings, DEFAULT_FILTERS, 0.1, NOW).length).toBeLessThan(listings.length)
  })
})

describe('reducer', () => {
  const reserve = (state = initialState(), quantity = 1, storeId = 'furra-e-lagjes') =>
    reducer(state, {
      type: 'reserve',
      storeId,
      quantity,
      paymentMethod: 'card',
      now: NOW,
      orderId: 'o1',
      pickupCode: 'ABC123',
    })

  it('reserves a bag and decrements stock', () => {
    const before = initialState().stores.find((s) => s.id === 'furra-e-lagjes')!.bag.quantity
    const s = reserve()
    expect(s.orders).toHaveLength(1)
    expect(s.orders[0]!.status).toBe('reserved')
    expect(s.stores.find((x) => x.id === 'furra-e-lagjes')!.bag.quantity).toBe(before - 1)
  })

  it('caps quantity at stock and per-order max', () => {
    const s = reserve(initialState(), 50, 'market-fresku')
    expect(s.orders[0]!.quantity).toBe(MAX_PER_ORDER)
    const one = reserve(initialState(), 3, 'sushi-koi')
    expect(one.orders[0]!.quantity).toBe(1)
  })

  it('does not reserve a sold-out bag', () => {
    const s = reserve(initialState(), 1, 'kafe-flora')
    expect(s.orders).toHaveLength(0)
  })

  it('cancelling restocks the bag', () => {
    const s = reducer(reserve(), { type: 'cancelOrder', orderId: 'o1' })
    expect(s.orders[0]!.status).toBe('cancelled')
    expect(s.stores.find((x) => x.id === 'furra-e-lagjes')!.bag.quantity).toBe(
      initialState().stores.find((x) => x.id === 'furra-e-lagjes')!.bag.quantity,
    )
  })

  it('collecting counts toward impact', () => {
    const s = reducer(reserve(initialState(), 2), { type: 'collectOrder', orderId: 'o1', now: NOW })
    const impact = computeImpact(s.orders)
    expect(impact.bagsSaved).toBe(2)
    expect(impact.moneySaved).toBe((1050 - 350) * 2)
    expect(impact.co2eKg).toBe(5.4)
  })

  it('toggles favourites', () => {
    const s1 = reducer(initialState(), { type: 'toggleFavourite', storeId: 'x' })
    expect(s1.favourites).toEqual(['x'])
    expect(reducer(s1, { type: 'toggleFavourite', storeId: 'x' }).favourites).toEqual([])
  })
})
