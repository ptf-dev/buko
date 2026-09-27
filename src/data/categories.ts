import { Cake, Coffee, Croissant, Flower2, ShoppingBasket, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Category, Diet } from '../types'

export interface CategoryMeta {
  label: string
  icon: LucideIcon
  /** Tailwind gradient classes for the bag artwork. */
  gradient: string
  /** 3D illustration (Fluent Emoji, MIT) used on category tiles and as the card image when a store has no photo. */
  image: string
  /** Soft background behind the illustration. */
  tint: string
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  meals: { label: 'Meals', icon: UtensilsCrossed, gradient: 'from-orange-300 via-amber-200 to-rose-200', image: '/img/3d/meals.png', tint: '#e8f1e4' },
  bakery: { label: 'Bread & pastries', icon: Croissant, gradient: 'from-amber-300 via-yellow-200 to-orange-100', image: '/img/3d/bakery.png', tint: '#f7ecdc' },
  groceries: { label: 'Groceries', icon: ShoppingBasket, gradient: 'from-emerald-300 via-lime-200 to-green-100', image: '/img/3d/groceries.png', tint: '#e3f0e6' },
  dessert: { label: 'Desserts', icon: Cake, gradient: 'from-pink-300 via-rose-200 to-fuchsia-100', image: '/img/3d/dessert.png', tint: '#f8e6ea' },
  drinks: { label: 'Café & drinks', icon: Coffee, gradient: 'from-stone-300 via-amber-100 to-orange-100', image: '/img/3d/drinks.png', tint: '#efe7df' },
  other: { label: 'Other', icon: Flower2, gradient: 'from-violet-300 via-purple-200 to-pink-100', image: '/img/3d/other.png', tint: '#ece7f3' },
}

export const CATEGORY_ORDER: Category[] = ['meals', 'bakery', 'groceries', 'dessert', 'drinks', 'other']

export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
}

/** Store logo colour, derived from the store id so it is stable. */
export function logoColor(id: string): string {
  const palette = ['#00615f', '#c2410c', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a16207', '#0f766e']
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]!
}

export const RATING_TAGS = ['Great value', 'Great quantity', 'Great quality', 'Friendly staff', 'Easy pickup']
