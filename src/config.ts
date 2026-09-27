import type { Location } from './types'

/** App-wide settings. Change these to launch Ngopu in a different city. */
export const APP_NAME = 'Ngopu'

export const CURRENCY = {
  code: 'ALL',
  locale: 'sq-AL',
  symbol: 'L',
}

export const DEFAULT_LOCATION: Location = {
  label: 'Tirana, Qendër',
  lat: 41.3275,
  lng: 19.8187,
  radiusKm: 5,
}

/** Average CO2e avoided per rescued bag (kg), the figure used across the industry. */
export const CO2E_PER_BAG_KG = 2.7

/** Public address of the web app, used for share links from the native app. Leave empty to share text only. */
export const WEB_URL: string = 'https://www.ngopu.app/app'

/** Marketing site, linked from the invite-a-friend share. */
export const LANDING_URL = 'https://www.ngopu.app'

/** Partner & admin dashboard (web only). */
export const DASHBOARD_URL = `${LANDING_URL}/dashboard`

/** Privacy policy (web page, also linked from the app stores). */
export const PRIVACY_URL = `${LANDING_URL}/privacy`

/** Public contact for privacy and data requests (shown in the privacy policy). */
export const CONTACT_EMAIL = 'info@propfirmstech.com'

/** Legal entity named in the privacy policy. Replace with the registered company name and address once it exists. */
export const LEGAL_ENTITY = 'Ngopu'

/** App store listings. Leave empty until the apps are live; the landing page then shows "Coming soon". */
export const APP_STORE_URL: string = ''
export const PLAY_STORE_URL: string = ''

/** Direct Android download offered on the landing page while the Play Store listing is pending. */
export const ANDROID_APK_PATH = '/downloads/ngopu.apk'

/**
 * Map tiles. OpenStreetMap's public servers are fine for launch-scale traffic; for heavier use
 * switch to a keyed provider (e.g. MapTiler or Stadia) by changing this one value.
 */
export const MAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

/** Beyond this distance from every store, the app suggests switching to Tirana. */
export const SERVICE_AREA_KM = 30

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 20]
