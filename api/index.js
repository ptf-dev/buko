// @ts-check
// Single Vercel Function serving every /api/* route (vercel.json rewrites /api/:path* here).
import { databaseUrl, HttpError } from './_lib/db.js'
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  if (req.method !== 'GET' && req.method !== 'DELETE') {
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
    const result = await found.handler({ req, url, params: found.params, body, secure })
    return json(result.body ?? {}, result.status ?? 200, { ...cors, ...(result.headers ?? {}) })
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status, cors)
    console.error(err)
    return json({ error: 'Something went wrong. Please try again.' }, 500, cors)
  }
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const DELETE = handle
export const OPTIONS = handle
