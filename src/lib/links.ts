/**
 * Maps public Ngopu links to routes inside the customer app. Used when the phone apps are opened from a
 * universal link / app link (share links, email links) or from a push notification.
 *
 * Only the customer app's own pages map; the landing page, the dashboard and the legal pages return null so
 * they stay in the browser. No Capacitor or DOM imports: this runs in unit tests too.
 */

const HOSTS = new Set(['www.ngopu.app', 'ngopu.app'])

/** Path prefix of the customer app on the website. Inside the phone apps the router has no prefix. */
const WEB_APP_PREFIX = '/app'

/**
 * Returns the router path (with query string) for a link the app was opened with, or null when the link is
 * not a customer-app page. Accepts a full URL (`https://www.ngopu.app/app/store/x`) or a bare website path
 * (`/app/orders/x`, as sent in push payloads).
 */
export function appPathFromUrl(url: string): string | null {
  let pathname: string
  let search = ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (!HOSTS.has(parsed.hostname)) return null
    pathname = parsed.pathname
    search = parsed.search
  } else {
    if (!url.startsWith('/')) return null
    const q = url.indexOf('?')
    pathname = q === -1 ? url : url.slice(0, q)
    search = q === -1 ? '' : url.slice(q)
  }
  pathname = pathname.replace(/\/+$/, '') || '/'

  // Short store links: https://www.ngopu.app/store/:id (the website redirects them to /app/store/:id).
  if (/^\/store\/[^/]+$/.test(pathname)) return pathname + search

  if (pathname === WEB_APP_PREFIX) return '/' + search
  if (pathname.startsWith(WEB_APP_PREFIX + '/')) return pathname.slice(WEB_APP_PREFIX.length) + search
  return null
}
