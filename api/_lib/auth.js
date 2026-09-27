// @ts-check
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { HttpError, query } from './db.js'

const scrypt = /** @type {(pw: string, salt: string, len: number) => Promise<Buffer>} */ (promisify(scryptCb))

export const SESSION_COOKIE = 'buko_session'
const SESSION_DAYS = 30

/** @param {string} password */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${hash.toString('hex')}`
}

/** @param {string} password @param {string} stored */
export async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hex) return false
  const hash = await scrypt(password, salt, 64)
  const expected = Buffer.from(hex, 'hex')
  return expected.length === hash.length && timingSafeEqual(expected, hash)
}

/** @param {string} token */
const sha256 = (token) => createHash('sha256').update(token).digest('hex')

export function newId(prefix = '') {
  return prefix + randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 10).toLowerCase()
}

/**
 * Creates a session and returns the Set-Cookie header value.
 * @param {string} userId
 * @param {boolean} secure
 */
export async function createSession(userId, secure) {
  const token = randomBytes(32).toString('base64url')
  await query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    sha256(token),
    userId,
  ])
  await query('update users set last_login_at = now() where id = $1', [userId])
  return cookie(token, SESSION_DAYS * 86400, secure)
}

/** @param {string} value @param {number} maxAge @param {boolean} secure */
function cookie(value, maxAge, secure) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

/** @param {Request} req */
function readToken(req) {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === SESSION_COOKIE) return v.join('=')
  }
  return null
}

/** @param {Request} req @param {boolean} secure */
export async function destroySession(req, secure) {
  const token = readToken(req)
  if (token) await query('delete from sessions where token_hash = $1', [sha256(token)])
  return cookie('', 0, secure)
}

/**
 * @typedef {{ id: string, email: string, name: string, role: 'admin' | 'partner', storeId: string | null, storeStatus: string | null }} SessionUser
 */

/**
 * @param {Request} req
 * @returns {Promise<SessionUser | null>}
 */
export async function currentUser(req) {
  const token = readToken(req)
  if (!token) return null
  const { rows } = await query(
    `select u.id, u.email, u.name, u.role, u.store_id as "storeId", s.status as "storeStatus"
       from sessions se
       join users u on u.id = se.user_id
       left join stores s on s.id = u.store_id
      where se.token_hash = $1 and se.expires_at > now()`,
    [sha256(token)],
  )
  return rows[0] ?? null
}

/** @param {Request} req @param {'admin' | 'partner'} [role] */
export async function requireUser(req, role) {
  const user = await currentUser(req)
  if (!user) throw new HttpError(401, 'Please log in.')
  if (role && user.role !== role) throw new HttpError(403, 'You don’t have access to this.')
  return user
}
