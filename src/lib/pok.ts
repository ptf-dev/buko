/**
 * POK's card form (the same SDK the ag-web-visionfx checkout uses). The script is loaded only when a card
 * payment starts, and the form renders inside our own sheet for an SDK order the server created.
 */
const SDK_URL = 'https://static.pokpay.io/public/dist/pokpayments/pok-payment.js'

interface PokPaymentSdk {
  renderForm: (
    elementId: string,
    sdkOrderId: string,
    onSuccess: () => void,
    onError: (err?: unknown) => void,
    options: { env: 'production' | 'staging'; locale: 'al' | 'en' },
  ) => void
}

declare global {
  interface Window {
    PokPayment?: PokPaymentSdk
  }
}

let loading: Promise<PokPaymentSdk> | null = null

export function loadPok(): Promise<PokPaymentSdk> {
  if (window.PokPayment) return Promise.resolve(window.PokPayment)
  if (!loading) {
    loading = new Promise<PokPaymentSdk>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = SDK_URL
      el.async = true
      el.onload = () => (window.PokPayment ? resolve(window.PokPayment) : reject(new Error('POK form unavailable')))
      el.onerror = () => reject(new Error('POK form unavailable'))
      document.head.appendChild(el)
    }).catch((err) => {
      loading = null
      throw err
    })
  }
  return loading
}
