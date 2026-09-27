import { CO2E_PER_BAG_KG, CURRENCY } from '../config'
import type { PickupWindow } from '../types'

const priceFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatPrice(amount: number): string {
  return `${priceFormatter.format(Math.round(amount))} ${CURRENCY.symbol}`
}

export function discountPercent(price: number, originalPrice: number): number {
  if (originalPrice <= 0) return 0
  return Math.round((1 - price / originalPrice) * 100)
}

export function formatMinutes(minutes: number): string {
  const hh = Math.floor(minutes / 60) % 24
  const mm = minutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Resolves a recurring pickup window to absolute timestamps.
 * A "today" window that has already ended rolls over to tomorrow, just as a
 * store's daily listing would.
 */
export function resolveWindow(window: PickupWindow, now: number): { start: number; end: number } {
  const dayOffset = window.day === 'tomorrow' ? 1 : 0
  const base = startOfDay(now)
  let start = addDays(base, dayOffset) + window.start * 60_000
  let end = addDays(base, dayOffset) + window.end * 60_000
  if (end <= now) {
    start = addDays(start, 1)
    end = addDays(end, 1)
  }
  return { start, end }
}

function addDays(ms: number, days: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function dayLabel(ms: number, now: number): string {
  const diff = Math.round((startOfDay(ms) - startOfDay(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatRange(start: number, end: number, now: number): string {
  const fmt = (ms: number) => formatMinutes(minutesOfDay(new Date(ms)))
  return `${dayLabel(start, now)} ${fmt(start)} – ${fmt(end)}`
}

export function isPickupNow(start: number, end: number, now: number): boolean {
  return now >= start && now <= end
}

/** "Collect now" = window is open or opens within the next hour. */
export function isCollectSoon(start: number, end: number, now: number): boolean {
  return now <= end && start - now <= 60 * 60_000
}

export function timeUntil(ms: number, now: number): string {
  const diff = Math.max(0, ms - now)
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function co2eKg(bags: number): number {
  return Math.round(bags * CO2E_PER_BAG_KG * 10) / 10
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-zËëÇç]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}
