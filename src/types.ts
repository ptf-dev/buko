export type Category = 'meals' | 'bakery' | 'groceries' | 'dessert' | 'drinks' | 'other'

export type Diet = 'vegetarian' | 'vegan'

export type PickupDay = 'today' | 'tomorrow'

export interface PickupWindow {
  day: PickupDay
  /** Minutes after midnight, e.g. 18 * 60 + 30 for 18:30 */
  start: number
  end: number
}

export interface Review {
  author: string
  rating: number
  text: string
}

export interface Store {
  id: string
  /** The store lets trusted customers pay cash at pickup. */
  acceptsCash?: boolean
  /** Cover photo uploaded by the store (relative /api/... URL). */
  photoUrl?: string
  name: string
  branch?: string
  category: Category
  address: string
  lat: number
  lng: number
  rating: number
  ratingCount: number
  /** Positive highlights shown on the store page, from past reviews. */
  highlights: string[]
  reviews: Review[]
  bag: SurpriseBag
}

export interface SurpriseBag {
  id: string
  title: string
  description: string
  price: number
  originalPrice: number
  /** Bags left today */
  quantity: number
  pickup: PickupWindow
  diet?: Diet
  allergensNote: string
  isNew?: boolean
}

export type OrderStatus = 'reserved' | 'collected' | 'cancelled'

export interface Order {
  id: string
  storeId: string
  bagId: string
  quantity: number
  unitPrice: number
  unitOriginalPrice: number
  /** Absolute pickup window (epoch ms), fixed at reservation time. */
  pickupStart: number
  pickupEnd: number
  pickupCode: string
  createdAt: number
  status: OrderStatus
  /** Set by the server when an order is cancelled. */
  cancelledBy?: 'customer' | 'store' | 'admin'
  /** Shown to the customer when the store cancelled. */
  cancelReason?: string
  /** pending: waiting for the card payment (bag held); failed: never paid, the bag went back on sale. */
  paymentStatus?: 'pending' | 'failed'
  /** A tester's order or sample data: no money moved, kept out of payouts and reports. */
  isDemo?: boolean
  /** A problem the customer reported after pickup. Amounts in qindarka (1 L = 100). */
  complaint?: { status: 'open' | 'refunded' | 'rejected'; refundAmount?: number }
  paymentMethod: PaymentMethod
  rating?: number
  ratingTags?: string[]
  collectedAt?: number
}

export type PaymentMethod = 'card' | 'apple-pay' | 'google-pay' | 'paypal' | 'cash'

export interface UserProfile {
  name: string
  email: string
  diets: Diet[]
  notifications: boolean
}

export interface Location {
  label: string
  lat: number
  lng: number
  radiusKm: number
}

export type SortBy = 'relevance' | 'distance' | 'price' | 'rating'

export interface Filters {
  query: string
  day: PickupDay | 'any'
  categories: Category[]
  diets: Diet[]
  hideSoldOut: boolean
  /** Only bags whose pickup window is open or opens within the hour. */
  availableNow?: boolean
  sortBy: SortBy
}
