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
export const WEB_URL: string = 'https://buko-five.vercel.app/app'

/** Marketing site, linked from the invite-a-friend share. */
export const LANDING_URL = 'https://buko-five.vercel.app'

/** Partner & admin dashboard (web only). */
export const DASHBOARD_URL = `${LANDING_URL}/dashboard`

/** App store listings. Leave empty until the apps are live; the landing page then shows "Coming soon". */
export const APP_STORE_URL: string = ''
export const PLAY_STORE_URL: string = ''

/** Direct Android download offered on the landing page while the Play Store listing is pending. */
export const ANDROID_APK_PATH = '/downloads/ngopu.apk'

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 20]
