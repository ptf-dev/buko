// @ts-check
/**
 * Account security: one-time email links (verify email, reset password), login rate limiting and
 * two-factor login (TOTP, RFC 6238) for the dashboard.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError, query, tx } from './db.js'
import { APP_URL, lang, resetPassword, verifyEmail } from './mail.js'

/** @param {string} s */
const sha256 = (s) => createHash('sha256').update(s).digest('hex')

/* ------------------------------------------------------------------ one-time tokens */

/** @typedef {'verify_email' | 'reset_password' | 'login_2fa'} Purpose */

/**
 * A single-use token for a link or a login step. Only its hash is stored.
 * @param {string} userId @param {Purpose} purpose @param {number} minutes
 */
export async function issueToken(userId, purpose, minutes) {
  const token = randomBytes(32).toString('base64url')
  // One live token per purpose: a new link replaces the old one.
  await query('delete from user_tokens where user_id = $1 and purpose = $2', [userId, purpose])
  await query(`insert into user_tokens (token_hash, user_id, purpose, expires_at) values ($1,$2,$3, now() + make_interval(mins => $4))`, [
    sha256(token),
    userId,
    purpose,
    minutes,
  ])
  return token
}

/**
 * Uses up a token and returns its user id. Throws 400 if it's unknown, used or expired.
 * @param {unknown} token @param {Purpose} purpose @param {{ keep?: boolean }} [o] keep: check without using it up
 */
export async function consumeToken(token, purpose, o = {}) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw new HttpError(400, 'This link isn’t valid.')
  const { rows } = await query(
    `${o.keep ? 'select user_id from user_tokens' : 'update user_tokens set used_at = now()'}
      where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
      ${o.keep ? '' : 'returning user_id'}`,
    [sha256(token), purpose],
  )
  if (!rows[0]) throw new HttpError(400, purpose === 'login_2fa' ? 'That sign-in expired. Log in again.' : 'This link has expired or was already used. Ask for a new one.')
  return /** @type {string} */ (rows[0].user_id)
}

/* ------------------------------------------------------------------ email verification */

/** @param {{ id: string, email: string, name: string, language?: string | null }} user */
export async function sendVerification(user) {
  const token = await issueToken(user.id, 'verify_email', 3 * 24 * 60)
  return verifyEmail({ to: user.email, name: user.name, lang: lang(user.language), link: `${APP_URL}/app/verify?token=${token}` })
}

/** @param {unknown} token */
export async function confirmEmail(token) {
  const userId = await consumeToken(token, 'verify_email')
  await query('update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1', [userId])
  return userId
}

/* ------------------------------------------------------------------ password reset */

/**
 * Emails a reset link if the address has an account. Always answers the same way, so the form can't be used
 * to find out who has an account.
 * @param {string} email @param {string} ip
 */
export async function requestPasswordReset(email, ip) {
  await limit([`forgot:${email}`, 3, 60], [`forgot-ip:${ip}`, 10, 60])
  await record([`forgot:${email}`, `forgot-ip:${ip}`], false)
  const { rows } = await query('select id, email, name, role, language from users where email = $1', [email])
  const u = rows[0]
  if (!u) return
  const token = await issueToken(u.id, 'reset_password', 60)
  // One reset page for everyone (it links on to the dashboard for store and team accounts).
  const path = '/app/reset'
  await resetPassword({ to: u.email, name: u.name, lang: lang(u.language), link: `${APP_URL}${path}?token=${token}` })
}

/**
 * Sets a new password from a reset link. Signs out every session (someone else may have had the old one) and
 * counts as proof the person owns the inbox.
 * @param {unknown} token @param {string} hash already hashed new password
 */
export async function completePasswordReset(token, hash) {
  const userId = await consumeToken(token, 'reset_password')
  await tx(async (c) => {
    await c.query('update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1', [userId, hash])
    await c.query('delete from sessions where user_id = $1', [userId])
  })
  const { rows } = await query('select role from users where id = $1', [userId])
  return { userId, role: /** @type {string} */ (rows[0]?.role) }
}

/* ------------------------------------------------------------------ rate limiting */

/** The caller's IP as Vercel reports it. @param {Request} req */
export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Refuses with 429 when any key has too many failures in its window. Failures before the key's last success
 * don't count, so one good login clears a few typos.
 * @param {...[string, number, number]} rules [key, max failures, window minutes]
 */
export async function limit(...rules) {
  for (const [key, max, minutes] of rules) {
    const { rows } = await query(
      `select count(*)::int as n, min(created_at) as first from login_attempts
        where key = $1 and not ok and created_at > now() - make_interval(mins => $2)
          and created_at > coalesce((select max(created_at) from login_attempts where key = $1 and ok), '-infinity')`,
      [key, minutes],
    )
    if (rows[0].n >= max) {
      const wait = Math.max(1, Math.ceil((new Date(rows[0].first).getTime() + minutes * 60_000 - Date.now()) / 60_000))
      throw new HttpError(429, `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`)
    }
  }
}

/** @param {string[]} keys @param {boolean} ok */
export async function record(keys, ok) {
  for (const key of keys) await query('insert into login_attempts (key, ok) values ($1,$2)', [key, ok])
}

/** Login limits: 5 wrong passwords per account and 30 per IP in 15 minutes. @param {string} email @param {string} ip */
export function loginKeys(email, ip) {
  return /** @type {[string, number, number][]} */ ([
    [`login:${email}`, 5, 15],
    [`login-ip:${ip}`, 30, 15],
  ])
}

/* ------------------------------------------------------------------ TOTP (two-factor) */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** @param {Buffer} buf */
function base32(buf) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

/** @param {string} s */
function unbase32(s) {
  let bits = 0
  let value = 0
  const out = []
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch)
    if (i < 0) continue
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** @param {string} secret base32 @param {number} counter */
export function hotp(secret, counter) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

/** @param {string} secret @param {number} [at] */
export function totp(secret, at = Date.now()) {
  return hotp(secret, Math.floor(at / 30_000))
}

/** Accepts the current code and one step either side (phone clocks drift). @param {string} secret @param {unknown} code */
export function checkTotp(secret, code) {
  const c = typeof code === 'string' ? code.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(c)) return false
  const step = Math.floor(Date.now() / 30_000)
  for (const d of [-1, 0, 1]) {
    const a = Buffer.from(hotp(secret, step + d))
    if (timingSafeEqual(a, Buffer.from(c))) return true
  }
  return false
}

export function newTotpSecret() {
  return base32(randomBytes(20))
}

/** @param {string} secret @param {string} email */
export function otpauthUrl(secret, email) {
  return `otpauth://totp/Ngopu:${encodeURIComponent(email)}?secret=${secret}&issuer=Ngopu&algorithm=SHA1&digits=6&period=30`
}

/** Ten single-use recovery codes, for when the phone is lost. Returns the codes and their hashes. */
export function recoveryCodes() {
  const codes = Array.from({ length: 10 }, () => {
    const s = base32(randomBytes(6)).slice(0, 10).toLowerCase()
    return `${s.slice(0, 5)}-${s.slice(5)}`
  })
  return { codes, hashes: codes.map(sha256) }
}

/**
 * A second-step code: a TOTP code, or a recovery code (used up). Rate limited per user.
 * @param {string} userId @param {unknown} code
 */
export async function verifySecondFactor(userId, code) {
  await limit([`2fa:${userId}`, 5, 15])
  const { rows } = await query('select totp_secret, totp_recovery from users where id = $1', [userId])
  const u = rows[0]
  if (!u?.totp_secret) return true
  let ok = checkTotp(u.totp_secret, code)
  if (!ok && typeof code === 'string') {
    const h = sha256(code.trim().toLowerCase())
    const res = await query('update users set totp_recovery = array_remove(totp_recovery, $2) where id = $1 and $2 = any(totp_recovery)', [userId, h])
    ok = (res.rowCount ?? 0) > 0
  }
  await record([`2fa:${userId}`], ok)
  if (!ok) throw new HttpError(401, 'That code isn’t right. Check the time on your phone and try again.')
  return true
}
