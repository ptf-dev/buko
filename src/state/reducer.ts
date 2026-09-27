import { DEFAULT_LOCATION } from '../config'
import { SEED_STORES } from '../data/stores'
import type { Filters, Location, Order, PaymentMethod, Store, UserProfile } from '../types'
import { co2eKg, resolveWindow } from '../lib/format'
import { DEFAULT_FILTERS } from '../lib/search'

export interface AppState {
  version: number
  onboarded: boolean
  location: Location
  stores: Store[]
  favourites: string[]
  orders: Order[]
  profile: UserProfile
  filters: Filters
  paymentMethod: PaymentMethod
}

export const STATE_VERSION = 1

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    onboarded: false,
    location: DEFAULT_LOCATION,
    stores: SEED_STORES,
    favourites: [],
    orders: [],
    profile: { name: '', email: '', diets: [], notifications: true },
    filters: DEFAULT_FILTERS,
    paymentMethod: 'card',
  }
}

export type Action =
  | { type: 'completeOnboarding'; name: string; location: Location }
  | { type: 'setLocation'; location: Location }
  | { type: 'toggleFavourite'; storeId: string }
  | { type: 'setFilters'; filters: Partial<Filters> }
  | { type: 'resetFilters' }
  | {
      type: 'reserve'
      storeId: string
      quantity: number
      paymentMethod: PaymentMethod
      now: number
      orderId: string
      pickupCode: string
    }
  | { type: 'cancelOrder'; orderId: string }
  | { type: 'collectOrder'; orderId: string; now: number }
  | { type: 'rateOrder'; orderId: string; rating: number; tags: string[] }
  | { type: 'updateProfile'; profile: Partial<UserProfile> }
  | { type: 'setBagQuantity'; storeId: string; quantity: number }
  | { type: 'resetDemo' }

/** Max bags a single customer may reserve per order. */
export const MAX_PER_ORDER = 4

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'completeOnboarding':
      return {
        ...state,
        onboarded: true,
        location: action.location,
        profile: { ...state.profile, name: action.name.trim() },
      }
    case 'setLocation':
      return { ...state, location: action.location }
    case 'toggleFavourite': {
      const has = state.favourites.includes(action.storeId)
      return {
        ...state,
        favourites: has
          ? state.favourites.filter((id) => id !== action.storeId)
          : [...state.favourites, action.storeId],
      }
    }
    case 'setFilters':
      return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'resetFilters':
      return { ...state, filters: { ...DEFAULT_FILTERS, query: state.filters.query } }
    case 'reserve': {
      const store = state.stores.find((s) => s.id === action.storeId)
      if (!store) return state
      const quantity = Math.min(action.quantity, store.bag.quantity, MAX_PER_ORDER)
      if (quantity <= 0) return state
      const { start, end } = resolveWindow(store.bag.pickup, action.now)
      const order: Order = {
        id: action.orderId,
        storeId: store.id,
        bagId: store.bag.id,
        quantity,
        unitPrice: store.bag.price,
        unitOriginalPrice: store.bag.originalPrice,
        pickupStart: start,
        pickupEnd: end,
        pickupCode: action.pickupCode,
        createdAt: action.now,
        status: 'reserved',
        paymentMethod: action.paymentMethod,
      }
      return {
        ...state,
        paymentMethod: action.paymentMethod,
        orders: [order, ...state.orders],
        stores: updateQuantity(state.stores, store.id, store.bag.quantity - quantity),
      }
    }
    case 'cancelOrder': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'reserved') return state
      const store = state.stores.find((s) => s.id === order.storeId)
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)),
        stores: store ? updateQuantity(state.stores, store.id, store.bag.quantity + order.quantity) : state.stores,
      }
    }
    case 'collectOrder':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId && o.status === 'reserved'
            ? { ...o, status: 'collected', collectedAt: action.now }
            : o,
        ),
      }
    case 'rateOrder':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId ? { ...o, rating: action.rating, ratingTags: action.tags } : o,
        ),
      }
    case 'updateProfile':
      return { ...state, profile: { ...state.profile, ...action.profile } }
    case 'setBagQuantity':
      return { ...state, stores: updateQuantity(state.stores, action.storeId, action.quantity) }
    case 'resetDemo':
      return initialState()
  }
}

function updateQuantity(stores: Store[], storeId: string, quantity: number): Store[] {
  return stores.map((s) =>
    s.id === storeId ? { ...s, bag: { ...s.bag, quantity: Math.max(0, Math.min(99, quantity)) } } : s,
  )
}

export interface Impact {
  bagsSaved: number
  moneySaved: number
  co2eKg: number
}

export function computeImpact(orders: Order[]): Impact {
  const collected = orders.filter((o) => o.status === 'collected')
  const bagsSaved = collected.reduce((n, o) => n + o.quantity, 0)
  const moneySaved = collected.reduce((n, o) => n + (o.unitOriginalPrice - o.unitPrice) * o.quantity, 0)
  return { bagsSaved, moneySaved, co2eKg: co2eKg(bagsSaved) }
}

export function randomPickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10)
}
