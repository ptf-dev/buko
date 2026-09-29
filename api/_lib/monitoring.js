// @ts-check
/**
 * Error tracking and product analytics, kept in our own database (no third-party trackers, no cookies).
 * Errors are grouped by fingerprint (source + message + first stack frame) and counted. Analytics events are
 * anonymous: a random id per app launch, no user id, no IP.
 */
import { createHash } from 'node:crypto'
import { requireUser } from './auth.js'
import { HttpError, query } from './db.js'
import { mailConfigured, testEmail } from './mail.js'

/** Events the apps may send; anything else is dropped. */
export const EVENTS = [
  'app_open',
  'page_view',
  'store_view',
  'checkout_open',
  'order_placed',
  'payment_started',
  'payment_succeeded',
  'payment_failed',
  'order_cancelled',
  'order_collected',
  'signup',
  'login',
  'push_enabled',
  'language_changed',
]

/**
 * Records an error, grouped with earlier ones like it. Never throws.
 * @param {{ source: 'app' | 'dashboard' | 'api', message: string, stack?: string | null, url?: string | null, userAgent?: string | null, release?: string | null }} e
 */
export async function recordError(e) {
  try {
    const message = String(e.message || 'Unknown error').slice(0, 500)
    const stack = e.stack ? String(e.stack).slice(0, 4000) : null
    const frame = (stack ?? '').split('\n').find((l) => /\bat\b|@/.test(l))?.replace(/:\d+:\d+\)?$/, '') ?? ''
    const fingerprint = createHash('sha1').update(`${e.source}|${message.replace(/\d+/g, '#')}|${frame}`).digest('hex')
    await query(
      `insert into error_events (fingerprint, source, message, stack, url, user_agent, release) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (fingerprint) do update set count = error_events.count + 1, last_seen = now(), stack = excluded.stack,
         url = excluded.url, user_agent = excluded.user_agent, release = excluded.release, resolved_at = null`,
      [fingerprint, e.source, message, stack, e.url?.slice(0, 500) ?? null, e.userAgent?.slice(0, 300) ?? null, e.release?.slice(0, 40) ?? null],
    )
  } catch (err) {
    console.error('could not record error', err)
  }
}

/** @param {unknown} v @param {number} max */
const text = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : null)

/** An error from the app or dashboard. Public but size-limited. @type {import('./routes.js').Handler} */
export async function reportError({ req, body }) {
  const source = body.source === 'dashboard' ? 'dashboard' : 'app'
  const message = text(body.message, 500)
  if (!message) throw new HttpError(400, 'Message is required.')
  await recordError({ source, message, stack: text(body.stack, 4000), url: text(body.url, 500), userAgent: req.headers.get('user-agent'), release: text(body.release, 40) })
  return { status: 202, body: { ok: true } }
}

/** A batch of analytics events (the app sends them every few seconds). @type {import('./routes.js').Handler} */
export async function trackEvents({ body }) {
  const list = Array.isArray(body.events) ? body.events.slice(0, 50) : []
  const session = text(body.session, 40)
  const platform = ['web', 'android', 'ios'].includes(body.platform) ? body.platform : 'web'
  for (const e of list) {
    if (!e || !EVENTS.includes(e.name)) continue
    const props = e.props && typeof e.props === 'object' ? JSON.stringify(e.props).slice(0, 1000) : null
    await query('insert into analytics_events (name, path, props, session, platform) values ($1,$2,$3,$4,$5)', [e.name, text(e.path, 200), props, session, platform])
  }
  return { status: 202, body: { ok: true } }
}

/** Errors and usage for the admin Monitoring page. @type {import('./routes.js').Handler} */
export async function adminMonitoring({ req, url }) {
  await requireUser(req, 'admin')
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 14))
  const [errors, daily, funnel, platforms, pages, email] = await Promise.all([
    query(
      `select fingerprint, source, message, stack, url, user_agent as "userAgent", release, count, first_seen as "firstSeen", last_seen as "lastSeen",
              resolved_at as "resolvedAt"
         from error_events order by (resolved_at is null) desc, last_seen desc limit 100`,
    ),
    query(
      `select to_char(date_trunc('day', created_at at time zone 'Europe/Tirane'), 'YYYY-MM-DD') as day,
              count(distinct session) filter (where name = 'app_open')::int as sessions,
              count(*) filter (where name = 'store_view')::int as store_views,
              count(*) filter (where name = 'order_placed')::int as orders
         from analytics_events where created_at > now() - make_interval(days => $1) group by 1 order by 1`,
      [days],
    ),
    query(
      `select name, count(distinct session)::int as sessions from analytics_events
        where created_at > now() - make_interval(days => $1) and name in ('app_open','store_view','checkout_open','order_placed','payment_succeeded')
        group by name`,
      [days],
    ),
    query(`select platform, count(distinct session)::int as sessions from analytics_events where created_at > now() - make_interval(days => $1) group by platform`, [
      days,
    ]),
    query(
      `select path, count(*)::int as views from analytics_events where name = 'page_view' and created_at > now() - make_interval(days => $1)
        group by path order by views desc limit 10`,
      [days],
    ),
    query(
      `select kind, status, count(*)::int as n from email_log where created_at > now() - make_interval(days => $1) group by kind, status order by kind, status`,
      [days],
    ),
  ])
  const failures = await query(
    `select kind, to_email as "to", error, created_at as "at" from email_log where status = 'failed' order by created_at desc limit 5`,
  )
  return {
    body: {
      days,
      errors: errors.rows,
      daily: daily.rows,
      funnel: funnel.rows,
      platforms: platforms.rows,
      pages: pages.rows,
      email: email.rows,
      emailFailures: failures.rows,
      emailConfigured: mailConfigured(),
    },
  }
}

/** @type {import('./routes.js').Handler} */
export async function adminResolveError({ req, params }) {
  await requireUser(req, 'admin')
  await query('update error_events set resolved_at = now() where fingerprint = $1', [params.id])
  return { body: { ok: true } }
}

/** Sends a sample email to the admin, to check the SMTP settings. Returns the mail server's error if it fails. @type {import('./routes.js').Handler} */
export async function adminTestEmail({ req }) {
  const user = await requireUser(req, 'admin')
  const r = await testEmail({ to: user.email, name: user.name, lang: user.language === 'en' ? 'en' : 'sq' })
  return { body: { ...r, to: user.email } }
}
