import { CATEGORIES, CATEGORY_ORDER, DIET_LABELS } from '../data/categories'
import { useAppState, useDispatch } from '../state/store'
import type { Category, Diet, Filters, SortBy } from '../types'
import { Button, Chip } from './Button'
import { Sheet } from './Sheet'
import { t, tn } from '../i18n'

const SORTS: { value: SortBy; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'distance', label: 'Distance' },
  { value: 'price', label: 'Price' },
  { value: 'rating', label: 'Rating' },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FiltersSheet({ open, onClose, resultCount }: { open: boolean; onClose: () => void; resultCount: number }) {
  const { filters } = useAppState()
  const dispatch = useDispatch()
  const set = (f: Partial<Filters>) => dispatch({ type: 'setFilters', filters: f })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Filters')}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => dispatch({ type: 'resetFilters' })}>
            {t('Clear all')}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {tn(resultCount, 'Show {n} result', 'Show {n} results')}
          </Button>
        </div>
      }
    >
      <Section title={t('Sort by')}>
        {SORTS.map((s) => (
          <Chip key={s.value} active={filters.sortBy === s.value} onClick={() => set({ sortBy: s.value })}>
            {t(s.label)}
          </Chip>
        ))}
      </Section>
      <Section title={t('Pick-up day')}>
        {(['any', 'today', 'tomorrow'] as const).map((d) => (
          <Chip key={d} active={filters.day === d} onClick={() => set({ day: d })}>
            {d === 'any' ? t('Any day') : d === 'today' ? t('Today') : t('Tomorrow')}
          </Chip>
        ))}
      </Section>
      <Section title={t('Food type')}>
        {CATEGORY_ORDER.map((c: Category) => {
          const Icon = CATEGORIES[c].icon
          return (
            <Chip
              key={c}
              active={filters.categories.includes(c)}
              onClick={() => set({ categories: toggle(filters.categories, c) })}
            >
              <Icon className="h-4 w-4" />
              {t(CATEGORIES[c].label)}
            </Chip>
          )
        })}
      </Section>
      <Section title={t('Diet preferences')}>
        {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
          <Chip key={d} active={filters.diets.includes(d)} onClick={() => set({ diets: toggle(filters.diets, d) })}>
            {t(DIET_LABELS[d])}
          </Chip>
        ))}
      </Section>
      <label className="mt-5 flex items-center justify-between py-2">
        <span>
          <span className="block font-semibold">{t('Available now')}</span>
          <span className="block text-sm text-muted">{t('Pickup open now or within the hour')}</span>
        </span>
        <Toggle checked={!!filters.availableNow} onChange={(v) => set({ availableNow: v })} label={t('Available now')} />
      </label>
      <label className="flex items-center justify-between py-2">
        <span className="font-semibold">{t('Hide sold-out')}</span>
        <Toggle checked={filters.hideSoldOut} onChange={(v) => set({ hideSoldOut: v })} label={t('Hide sold-out')} />
      </label>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}
