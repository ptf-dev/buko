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

/** Terms of service (web page): reservations, pickup, cancellations and refunds. */
export const TERMS_URL = `${LANDING_URL}/terms`

/** Public contact for support, privacy and data requests (privacy policy, terms and emails). */
export const CONTACT_EMAIL = 'info@propfirmstech.com'

/**
 * Operator named in the privacy policy and the terms. Put the registered company name here (e.g. "Ngopu SH.P.K.")
 * and its registered office in LEGAL_ADDRESS once the company is registered; until then the trading name is used.
 */
export const LEGAL_ENTITY = 'Ngopu'
export const LEGAL_ADDRESS = 'Tirana, Albania'

/** App store listings. Leave empty until the apps are live; the landing page then shows "Coming soon". */
export const APP_STORE_URL: string = ''
export const PLAY_STORE_URL: string = ''

/**
 * Map tiles. OpenStreetMap's public servers are fine for launch-scale traffic; for heavier use
 * switch to a keyed provider (e.g. MapTiler or Stadia) by changing this one value.
 */
/** Address search in the location sheet (Photon by komoot, OpenStreetMap data, no key needed). */
export const GEOCODER_URL = 'https://photon.komoot.io/api/'

export const MAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

/** Beyond this distance from every store, the app suggests switching to Tirana. */
export const SERVICE_AREA_KM = 30

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 20]

/**
 * Offline demo mode (fake local reservations with the built-in stores) is for development only. In production
 * an unreachable server must never produce an order the store doesn't know about.
 */
export const DEMO_MODE = import.meta.env.DEV || import.meta.env.VITE_DEMO === '1'
