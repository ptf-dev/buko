import { useEffect, useRef, useState } from 'react'

/** Chart mark colour: a brighter step of the brand teal that passes the chroma floor (validated). */
const SERIES = '#10957f'
const GRID = '#e9ecea'

export interface BarDatum {
  key: string
  label: string
  value: number
}

/** Rounded axis maximum; counts get at least 4 so the 5 ticks land on whole numbers. */
function niceMax(v: number) {
  if (v <= 4) return 4
  const mag = 10 ** Math.floor(Math.log10(v))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => v / s <= 4) ?? 10 * mag
  return Math.ceil(v / step) * step
}

/**
 * Single-series column chart: one baseline, rounded data-ends, recessive grid,
 * hover tooltip per column and a table view so values never depend on the graphic.
 */
export function BarChart({
  data,
  format,
  unit,
  height = 220,
}: {
  data: BarDatum[]
  format: (v: number) => string
  unit: string
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]
  const padL = 44
  const padB = 26
  const padT = 20
  const plotW = width - padL - 4
  const plotH = height - padB - padT
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(24, band * 0.62)
  const y = (v: number) => padT + plotH - (v / max) * plotH
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)))

  return (
    <div ref={wrapRef}>
      <div className="mb-2 flex justify-end">
        <button type="button" onClick={() => setAsTable(!asTable)} className="rounded-lg px-2 py-1 text-[13px] font-medium text-brand hover:bg-brand-light">
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted uppercase">
                <th className="py-2 font-semibold">Day</th>
                <th className="py-2 text-right font-semibold">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-b border-line/60">
                  <td className="py-1.5">{d.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg width={width} height={height} role="img" aria-label={`${unit} per day`} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width - 4} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {format(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + band * i + band / 2
              const h = Math.max(0, plotH - (y(d.value) - padT))
              const r = Math.min(4, h)
              const x0 = cx - barW / 2
              const top = y(d.value)
              // Rounded data-end, square at the baseline.
              const path =
                h > 0
                  ? `M${x0},${padT + plotH} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${padT + plotH} Z`
                  : ''
              return (
                <g key={d.key}>
                  {path && <path d={path} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.45} />}
                  {(i === peak || i === data.length - 1) && d.value > 0 && (
                    <text x={cx} y={top - 6} textAnchor="middle" className="fill-ink text-[11px] font-semibold tabular-nums">
                      {format(d.value)}
                    </text>
                  )}
                  {i % labelEvery === (data.length - 1) % labelEvery && (
                    <text x={cx} y={height - 6} textAnchor="middle" className="fill-muted text-[11px]">
                      {d.label}
                    </text>
                  )}
                  {/* Hit target spans the whole band, larger than the mark. */}
                  <rect
                    x={padL + band * i}
                    y={padT}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${d.label}: ${format(d.value)} ${unit}`}
                  />
                </g>
              )
            })}
            <line x1={padL} x2={width - 4} y1={padT + plotH} y2={padT + plotH} stroke="#cfd6d4" strokeWidth={1} />
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
              style={{ left: padL + band * hover + band / 2, top: y(data[hover].value) - 8 }}
            >
              <span className="block text-white/70">{data[hover].label}</span>
              <span className="font-semibold tabular-nums">
                {format(data[hover].value)} {unit.toLowerCase()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** "2026-09-27" → "27 Sep" */
export function shortDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
