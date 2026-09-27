import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-line disabled:text-muted',
  secondary: 'bg-white text-brand ring-2 ring-brand hover:bg-brand-light',
  ghost: 'text-brand hover:bg-brand-light',
  danger: 'bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Chip({
  active,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition ${
        active ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-line hover:ring-brand'
      } ${className}`}
    />
  )
}
