// @ts-check

/** Stores and pickup windows are in Tirana local time, whatever timezone the server runs in. */
export const TIMEZONE = 'Europe/Tirane'

const DAY = 86_400_000

/**
 * Offset of `timeZone` from UTC at instant `ms`, in milliseconds.
 * @param {number} ms
 * @param {string} timeZone
 */
export function tzOffset(ms, timeZone = TIMEZONE) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  /** @type {Record<string, number>} */
  const p = {}
  for (const part of dtf.formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * Absolute timestamps for a store's daily pickup window. A "today" window that
 * has already ended rolls over to tomorrow, matching the customer app.
 * @param {{ day: 'today' | 'tomorrow', start: number, end: number }} window minutes after local midnight
 * @param {number} now
 */
export function resolveWindow(window, now) {
  const offset = tzOffset(now)
  const localMidnight = Math.floor((now + offset) / DAY) * DAY - offset
  const base = localMidnight + (window.day === 'tomorrow' ? DAY : 0)
  let start = base + window.start * 60_000
  let end = base + window.end * 60_000
  if (end <= now) {
    start += DAY
    end += DAY
  }
  return { start, end }
}
