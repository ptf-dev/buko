import { CATEGORIES, CATEGORY_ORDER, DIET_LABELS } from '../data/categories'
import { useAppState, useDispatch } from '../state/store'
import type { Category, Diet, Filters, SortBy } from '../types'
import { Button, Chip } from './Button'
import { Sheet } from './Sheet'

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
      title="Filters"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => dispatch({ type: 'resetFilters' })}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </Button>
        </div>
      }
    >
      <Section title="Sort by">
        {SORTS.map((s) => (
          <Chip key={s.value} active={filters.sortBy === s.value} onClick={() => set({ sortBy: s.value })}>
            {s.label}
          </Chip>
        ))}
      </Section>
      <Section title="Pick-up day">
        {(['any', 'today', 'tomorrow'] as const).map((d) => (
          <Chip key={d} active={filters.day === d} onClick={() => set({ day: d })}>
            {d === 'any' ? 'Any day' : d === 'today' ? 'Today' : 'Tomorrow'}
          </Chip>
        ))}
      </Section>
      <Section title="Food type">
        {CATEGORY_ORDER.map((c: Category) => {
          const Icon = CATEGORIES[c].icon
          return (
            <Chip
              key={c}
              active={filters.categories.includes(c)}
              onClick={() => set({ categories: toggle(filters.categories, c) })}
            >
              <Icon className="h-4 w-4" />
              {CATEGORIES[c].label}
            </Chip>
          )
        })}
      </Section>
      <Section title="Diet preferences">
        {(Object.keys(DIET_LABELS) as Diet[]).map((d) => (
          <Chip key={d} active={filters.diets.includes(d)} onClick={() => set({ diets: toggle(filters.diets, d) })}>
            {DIET_LABELS[d]}
          </Chip>
        ))}
      </Section>
      <label className="mt-5 flex items-center justify-between py-2">
        <span className="font-semibold">Hide sold-out</span>
        <Toggle checked={filters.hideSoldOut} onChange={(v) => set({ hideSoldOut: v })} label="Hide sold-out" />
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
