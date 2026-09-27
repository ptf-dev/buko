// @ts-check
import { HttpError } from './db.js'

/* Request-body validation shared by all route modules. Each helper throws a 400 with a readable message. */

/**
 * Required text field.
 * @param {unknown} v @param {string} field @param {{ max?: number, min?: number }} [o]
 * @returns {string}
 */
export function str(v, field, o = {}) {
  if (v === undefined || v === null || v === '') throw new HttpError(400, `${field} is required.`)
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be text.`)
  const s = v.trim()
  if (s.length < (o.min ?? 1)) throw new HttpError(400, `${field} is too short.`)
  if (s.length > (o.max ?? 200)) throw new HttpError(400, `${field} is too long.`)
  return s
}

/**
 * Optional text field: empty values become null.
 * @param {unknown} v @param {string} field @param {{ max?: number }} [o]
 * @returns {string | null}
 */
export function optStr(v, field, o = {}) {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return null
  return str(v, field, o)
}

/** @param {unknown} v @param {string} field @param {number} min @param {number} max */
export function int(v, field, min, max) {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
    throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}.`)
  return n
}

/** @param {unknown} v @param {string} field @param {number} min @param {number} max */
export function num(v, field, min, max) {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} is out of range.`)
  return n
}

/** @template T @param {unknown} v @param {string} field @param {readonly T[]} options */
export function oneOf(v, field, options) {
  if (!options.includes(/** @type {T} */ (v))) throw new HttpError(400, `${field} is not valid.`)
  return /** @type {T} */ (v)
}

/** @param {unknown} v */
export function email(v) {
  const e = str(v, 'Email', { max: 200 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Enter a valid email address.')
  return e
}

/** @param {unknown} v */
export function password(v) {
  return str(v, 'Password', { min: 8, max: 200 })
}

/** @param {unknown} v */
export function deviceId(v) {
  const d = str(v, 'Device', { min: 8, max: 64 })
  if (!/^[A-Za-z0-9_-]+$/.test(d)) throw new HttpError(400, 'Device is not valid.')
  return d
}

/**
 * Amount in lek (may have up to 2 decimals) → integer qindarka.
 * @param {unknown} v @param {string} field @param {number} minLek @param {number} maxLek
 */
export function lekToQ(v, field, minLek, maxLek) {
  const n = num(v, field, minLek, maxLek)
  return Math.round(n * 100)
}

/** Albanian NIPT (tax number): a letter, 8 digits, a letter. @param {unknown} v */
export function nipt(v) {
  const s = str(v, 'NIPT', { max: 20 }).toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z]\d{8}[A-Z]$/.test(s)) throw new HttpError(400, 'NIPT should look like L12345678A.')
  return s
}

/** IBAN with a valid ISO 13616 checksum. Albanian IBANs are 28 characters and start with AL. @param {unknown} v */
export function iban(v) {
  const s = str(v, 'IBAN', { max: 50 }).toUpperCase().replace(/\s/g, '')
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) throw new HttpError(400, 'Enter a valid IBAN, e.g. AL47 2121 1009 0000 0002 3569 8741.')
  const rearranged = s.slice(4) + s.slice(0, 4)
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55))
  let rem = 0
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97
  if (rem !== 1) throw new HttpError(400, 'That IBAN doesn’t check out. Please check it against your bank statement.')
  if (s.startsWith('AL') && s.length !== 28) throw new HttpError(400, 'Albanian IBANs have 28 characters.')
  return s
}
