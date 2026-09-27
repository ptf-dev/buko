import type { Location } from './types'

/** App-wide settings. Change these to launch Buko in a different city. */
export const APP_NAME = 'Buko'

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

/** Public web address, used for share links from the native app. Leave empty to share text only. */
export const WEB_URL: string = ''

export const RADIUS_OPTIONS_KM = [1, 2, 5, 10, 20]
