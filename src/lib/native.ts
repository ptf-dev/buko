import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Share } from '@capacitor/share'
import { WEB_URL } from '../config'

export const isNative = Capacitor.isNativePlatform()

/**
 * On the website the app is served under /app (the landing page owns /).
 * The native apps and the dev server serve it from the root.
 */
export const ROUTER_BASENAME = !isNative && window.location.pathname.startsWith('/app') ? '/app' : ''

/**
 * Public link to a page. Inside the native app window.location is a local
 * origin, so links are only shareable when WEB_URL is configured.
 */
export function publicUrl(path: string): string | undefined {
  if (!isNative) return window.location.origin + ROUTER_BASENAME + path
  return WEB_URL ? WEB_URL.replace(/\/$/, '') + path : undefined
}

/** Opens the system share sheet, falling back to copying to the clipboard. */
export async function shareContent(opts: { title: string; text: string; url?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  try {
    if (isNative) {
      await Share.share({ title: opts.title, text: opts.text, url: opts.url, dialogTitle: opts.title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share(opts)
      return 'shared'
    }
    await navigator.clipboard.writeText(opts.url ? `${opts.text} ${opts.url}` : opts.text)
    return 'copied'
  } catch {
    return 'cancelled'
  }
}

export async function currentPosition(): Promise<{ lat: number; lng: number }> {
  if (isNative) {
    const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] })
    if (perm.location === 'denied' && perm.coarseLocation === 'denied') throw new Error('Location permission denied')
    const pos = await Geolocation.getCurrentPosition({ timeout: 10_000 })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  }
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation unavailable'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { timeout: 10_000 },
    )
  })
}
