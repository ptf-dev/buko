import type { Order, Store, SurpriseBag } from '../types'

export type Role = 'admin' | 'partner'
export type StoreStatus = 'pending' | 'active' | 'suspended' | 'rejected'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  storeId: string | null
  storeStatus: StoreStatus | null
}

/** A store as its partner or an admin sees it: real stock, status and contact details. */
export interface ManagedStore extends Omit<Store, 'bag'> {
  bag: SurpriseBag & { paused: boolean; updatedAt: string }
  status: StoreStatus
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  note: string | null
  createdAt: string
  approvedAt: string | null
  bags30d?: number
  revenue30d?: number
}

export interface DayPoint {
  day: string
  bags: number
  revenue: number
  collected: number
}

export interface Totals {
  bags: number
  revenue: number
  saved: number
  customers: number
  prev_bags: number
  prev_revenue: number
}

export type DashOrder = Order & { storeName?: string; isDemo?: boolean }

export interface PartnerOverview {
  store: ManagedStore
  series: DayPoint[]
  totals: Totals
  upcoming: DashOrder[]
}

export interface AdminOverview {
  days: number
  series: DayPoint[]
  totals: Totals
  counts: { active: number; pending: number; suspended: number; bags_live: number; to_collect: number; open_complaints: number; pending_bank: number }
  topStores: { id: string; name: string; branch: string | null; category: string; rating: number; bags: number; revenue: number }[]
}

export interface AdminStoreDetail {
  store: ManagedStore
  series: DayPoint[]
  totals: Totals
  orders: DashOrder[]
  users: { id: string; name: string; email: string; lastLoginAt: string | null }[]
}

export interface AdminMember {
  id: string
  name: string
  email: string
  createdAt: string
  lastLoginAt: string | null
}
