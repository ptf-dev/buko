import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Loader2, Minus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { StoreStatus } from './types'

/* Buttons ----------------------------------------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet-danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark disabled:bg-line disabled:text-muted',
  secondary: 'bg-white text-ink ring-1 ring-line hover:ring-ink/25 hover:bg-cream disabled:text-muted',
  ghost: 'text-brand hover:bg-brand-light disabled:text-muted',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-line disabled:text-muted',
  'quiet-danger': 'text-red-700 hover:bg-red-50 disabled:text-muted',
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-[15px]'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/**
 * Two-step destructive action: the first click arms it, the second confirms.
 * Avoids a modal for decisions that only need a moment of friction.
 */
export function ConfirmBtn({
  label,
  confirmLabel,
  onConfirm,
  variant = 'quiet-danger',
  size = 'sm',
}: {
  label: string
  confirmLabel: string
  onConfirm: () => Promise<unknown> | void
  variant?: Variant
  size?: 'sm' | 'md'
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!armed)
    return (
      <Btn variant={variant} size={size} onClick={() => setArmed(true)}>
        {label}
      </Btn>
    )
  return (
    <span className="inline-flex items-center gap-1">
      <Btn
        variant="danger"
        size={size}
        loading={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
            setArmed(false)
          }
        }}
      >
        {confirmLabel}
      </Btn>
      <Btn variant="ghost" size={size} onClick={() => setArmed(false)} disabled={busy}>
        Cancel
      </Btn>
    </span>
  )
}

/* Form fields ------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id, hintId)}
      {(error || hint) && (
        <p id={hintId} className={`mt-1.5 text-[13px] ${error ? 'font-medium text-red-700' : 'text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

const INPUT =
  'block w-full rounded-xl border-0 bg-white px-3.5 text-[15px] text-ink ring-1 ring-line transition-shadow duration-150 placeholder:text-muted/80 hover:ring-ink/25 focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-cream disabled:text-muted aria-[invalid=true]:ring-red-500'

export function Input({ className = '', suffix, ...props }: InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  if (!suffix) return <input {...props} className={`${INPUT} h-11 ${className}`} />
  return (
    <div className="relative">
      <input {...props} className={`${INPUT} h-11 pr-10 tabular-nums ${className}`} />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{suffix}</span>
    </div>
  )
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} min-h-24 py-2.5 leading-relaxed ${className}`} />
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${INPUT} h-11 appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-[#d5dbd9]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}

/* Surfaces ---------------------------------------------------------------- */

export function Panel({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,40,38,0.06),0_8px_24px_-16px_rgba(16,40,38,0.18)] ${className}`}>
      {(title || action) && (
        <header className="flex min-h-14 items-center justify-between gap-3 px-5 pt-4 pb-1">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pt-2 pb-5' : ''}>{children}</div>
    </section>
  )
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* Data display ------------------------------------------------------------ */

const STATUS: Record<StoreStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-[#e1f3ec] text-[#0b6b4f]' },
  pending: { label: 'Pending review', cls: 'bg-[#fff1cc] text-[#7a5400]' },
  suspended: { label: 'Suspended', cls: 'bg-[#fde4e1] text-[#a1261a]' },
  rejected: { label: 'Rejected', cls: 'bg-[#eceeed] text-[#5b6765]' },
}

export function StatusBadge({ status }: { status: StoreStatus }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  )
}

const ORDER_STATUS = {
  reserved: { label: 'To collect', cls: 'bg-brand-light text-brand-dark' },
  collected: { label: 'Collected', cls: 'bg-[#e1f3ec] text-[#0b6b4f]' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#eceeed] text-[#5b6765]' },
  missed: { label: 'Missed', cls: 'bg-[#fde4e1] text-[#a1261a]' },
} as const

export function OrderBadge({ status }: { status: keyof typeof ORDER_STATUS }) {
  const s = ORDER_STATUS[status]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

/** Change vs previous period, with icon + sign so it never relies on colour alone. */
export function Delta({ current, previous, label = 'vs previous period' }: { current: number; previous: number; label?: string }) {
  if (previous === 0 && current === 0) return <p className="mt-1 text-[13px] text-muted">No activity yet</p>
  if (previous === 0) return <p className="mt-1 text-[13px] text-muted">New this period</p>
  const pct = Math.round(((current - previous) / previous) * 100)
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus
  const tone = pct > 0 ? 'text-[#0b6b4f]' : pct < 0 ? 'text-[#a1261a]' : 'text-muted'
  return (
    <p className="mt-1 flex items-center gap-1 text-[13px]">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {pct > 0 ? '+' : ''}
        {pct}%
      </span>
      <span className="text-muted">{label}</span>
    </p>
  )
}

export function Kpi({ label, value, children, emphasis }: { label: string; value: ReactNode; children?: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl p-5 ${emphasis ? 'bg-brand text-white' : 'bg-white shadow-[0_1px_2px_rgba(16,40,38,0.06),0_8px_24px_-16px_rgba(16,40,38,0.18)]'}`}>
      <p className={`text-sm font-medium ${emphasis ? 'text-mint' : 'text-muted'}`}>{label}</p>
      <p className="mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums">{value}</p>
      {children}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#ebe8e1] ${className}`} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800">
      <p className="font-semibold">Couldn’t load this page</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <Btn variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Btn>
      )}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">{icon}</span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* Table ------------------------------------------------------------------- */

export interface Column<T> {
  key: string
  header: string
  sort?: (row: T) => string | number
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
  className?: string
}

/** Sortable table; scrolls horizontally on narrow screens. */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  initialSort,
  empty,
}: {
  rows: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  empty?: ReactNode
}) {
  const [sort, setSort] = useState(initialSort ?? null)
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!col?.sort) return rows
    const get = col.sort
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort!.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sort])

  if (!rows.length && empty) return <>{empty}</>

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`px-5 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? 'text-ink' : ''}`}
                      onClick={() => setSort(active ? { key: c.key, dir: sort!.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' })}
                    >
                      {c.header}
                      {active && (sort!.dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-line/70 last:border-0 ${onRowClick ? 'cursor-pointer transition-colors duration-150 hover:bg-cream' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-5 py-3 align-middle ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-[#ece9e2] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="text-xs text-muted tabular-nums">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* Money badges ------------------------------------------------------------ */

const TONES = {
  neutral: 'bg-[#eceeed] text-[#5b6765]',
  info: 'bg-brand-light text-brand-dark',
  good: 'bg-[#e1f3ec] text-[#0b6b4f]',
  warn: 'bg-[#fff1cc] text-[#7a5400]',
  bad: 'bg-[#fde4e1] text-[#a1261a]',
} as const

/** Small status pill with a text label (never colour alone). */
export function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}>{children}</span>
}

const PAYOUT_TONE = { draft: ['warn', 'Draft'], approved: ['info', 'Approved'], paid: ['good', 'Paid'], cancelled: ['neutral', 'Cancelled'] } as const
export function PayoutBadge({ status }: { status: keyof typeof PAYOUT_TONE }) {
  const [tone, label] = PAYOUT_TONE[status]
  return <Pill tone={tone}>{label}</Pill>
}

const COMPLAINT_TONE = { open: ['warn', 'Open'], refunded: ['good', 'Refunded'], rejected: ['neutral', 'Rejected'] } as const
export function ComplaintBadge({ status }: { status: keyof typeof COMPLAINT_TONE }) {
  const [tone, label] = COMPLAINT_TONE[status]
  return <Pill tone={tone}>{label}</Pill>
}

/* Dialog ------------------------------------------------------------------ */

/** Centred modal for short forms. Escape or the backdrop closes it. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-1 rounded-lg p-1 text-muted hover:bg-cream hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Label/value rows for summaries (e.g. an earnings breakdown). */
export function Breakdown({ rows }: { rows: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }[] }) {
  return (
    <dl className="divide-y divide-line/70 text-[15px]">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-baseline justify-between gap-4 py-2.5 ${r.strong ? 'font-bold' : ''}`}>
          <dt className={r.muted ? 'text-muted' : ''}>{r.label}</dt>
          <dd className={`shrink-0 text-right whitespace-nowrap tabular-nums ${r.muted ? 'text-muted' : ''}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}
