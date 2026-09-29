// @ts-check
// Single Vercel Function serving every /api/* route (vercel.json rewrites /api/:path* here).
import { databaseUrl, HttpError } from './_lib/db.js'
import { recordError } from './_lib/monitoring.js'
import { match, PUBLIC_PREFIXES } from './_lib/routes.js'

/** Origins of the native apps (Capacitor) and local development. */
const NATIVE_ORIGINS = /^(capacitor:\/\/localhost|https?:\/\/localhost(:\d+)?|ionic:\/\/localhost)$/

/** @param {Request} req */
function routePath(req) {
  const url = new URL(req.url)
  const rewritten = url.searchParams.get('route')
  if (rewritten !== null) return rewritten
  return url.pathname.replace(/^\/api\/?/, '')
}

/**
 * @param {Request} req @param {string} path
 * @returns {Record<string, string>}
 */
function corsHeaders(req, path) {
  const origin = req.headers.get('origin')
  if (!origin || !NATIVE_ORIGINS.test(origin) || !PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/** @param {unknown} body @param {number} status @param {Record<string, string>} headers */
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

/** @param {Request} req */
export async function handle(req) {
  const path = routePath(req)
  const cors = corsHeaders(req, path)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  if (!databaseUrl()) {
    return json({ error: 'The database is not connected yet.', code: 'NO_DATABASE' }, 503, cors)
  }

  const found = match(req.method, path)
  if (!found) return json({ error: 'Not found.' }, 404, cors)

  const url = new URL(req.url)
  let body = {}
  let raw = ''
  // Payment provider webhooks: any content type, raw body kept for signature checks. No cookies are used there.
  if (req.method === 'POST' && path.startsWith('payments/webhook/')) {
    raw = await req.text()
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = {}
    }
  } else if (req.method !== 'GET' && req.method !== 'DELETE') {
    // JSON only: a cross-site HTML form can't send it, which (with SameSite cookies) blocks CSRF.
    if (!(req.headers.get('content-type') || '').includes('application/json'))
      return json({ error: 'Send the request body as JSON.' }, 415, cors)
    try {
      const text = await req.text()
      body = text ? JSON.parse(text) : {}
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400, cors)
    }
    if (typeof body !== 'object' || body === null) body = {}
  }

  try {
    const secure = url.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'
    const result = await found.handler({ req, url, params: found.params, body, raw, secure })
    // Images come back as bytes with their own content type and caching.
    if (result.bytes !== undefined)
      return new Response(/** @type {BodyInit} */ (/** @type {unknown} */ (result.bytes)), { status: result.status ?? 200, headers: { ...cors, ...(result.headers ?? {}) } })
    // Downloads (CSV exports, statements) come back as text with their own content type.
    if (result.text !== undefined)
      return new Response(result.text, { status: result.status ?? 200, headers: { 'Cache-Control': 'no-store', ...cors, ...(result.headers ?? {}) } })
    return json(result.body ?? {}, result.status ?? 200, { ...cors, ...(result.headers ?? {}) })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status, cors)
    console.error(err)
    await recordError({
      source: 'api',
      message: `${req.method} ${found.pattern ?? path}: ${err instanceof Error ? err.message : String(err)}`,
      stack: err instanceof Error ? err.stack : null,
      url: path,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    })
    return json({ error: 'Something went wrong. Please try again.' }, 500, cors)
  }
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
export const OPTIONS = handle
