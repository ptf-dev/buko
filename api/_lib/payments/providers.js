// @ts-check
/**
 * Card payment providers behind one interface. PAYMENT_PROVIDER picks one (default "simulated").
 * To connect a real provider, implement these methods in its adapter; nothing else in the app changes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../db.js'

/**
 * @typedef {{ paymentId: string, orderId: string, amount: number, currency: string, description: string, returnUrl: string, customerEmail?: string | null }} PaymentRequest
 *   amount is in qindarka (1 L = 100).
 * @typedef {{ providerRef: string, status: 'succeeded' | 'pending', redirectUrl?: string, clientRef?: string }} PaymentStart
 *   clientRef: what the app needs to show the provider's own payment form (POK: the SDK order id).
 * @typedef {{ status: 'succeeded' | 'pending' | 'failed', raw: string | null }} PaymentCheck
 * @typedef {{ providerRef: string | null, status: 'succeeded' | 'pending' | 'failed' | 'manual', error?: string }} RefundResult
 *   manual: the provider can't refund by API; an admin refunds in the provider's dashboard and marks it done.
 * @typedef {'payment.succeeded' | 'payment.failed' | 'refund.succeeded' | 'refund.failed' | 'dispute.opened' | 'dispute.won' | 'dispute.lost'} EventType
 * @typedef {{ eventId: string, type: EventType, paymentRef: string, refundRef?: string, disputeRef?: string, amount?: number, error?: string }} ProviderEvent
 * @typedef {{ paymentRef: string, kind: 'payment' | 'refund', amount: number, fee: number, settledAt: string }} Settlement
 * @typedef {{
 *   name: string,
 *   createPayment: (r: PaymentRequest) => Promise<PaymentStart>,
 *   refund: (r: { paymentRef: string, refundId: string, amount: number, reason: string }) => Promise<RefundResult>,
 *   parseWebhook: (req: Request, raw: string) => Promise<ProviderEvent | null>,
 *   fetchSettlements: (from: string, to: string) => Promise<Settlement[] | null>,
 *   fetchPayment?: (ref: string) => Promise<PaymentCheck>,
 *   completePayment?: (ref: string) => Promise<PaymentCheck>,
 * }} PaymentProvider
 */

/** @param {string} secret @param {string} raw */
export function sign(secret, raw) {
  return createHmac('sha256', secret).update(raw).digest('hex')
}

/** @param {string} a @param {string} b */
function safeEqual(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Stand-in used until a real provider is connected: every card payment succeeds at once and every refund
 * succeeds. With SIMULATE_ASYNC_PAYMENTS=1 payments stay pending until a signed test webhook confirms them,
 * which exercises the real flow (see scripts in docs/payments-and-reporting.md).
 * @type {PaymentProvider}
 */
const simulated = {
  name: 'simulated',
  async createPayment(r) {
    const providerRef = `sim_${r.paymentId}`
    if (process.env.SIMULATE_ASYNC_PAYMENTS === '1') return { providerRef, status: 'pending', redirectUrl: `${r.returnUrl}?simulated=${providerRef}` }
    return { providerRef, status: 'succeeded' }
  },
  async refund(r) {
    return { providerRef: `simrf_${r.refundId}`, status: 'succeeded' }
  },
  async parseWebhook(req, raw) {
    const secret = process.env.SIMULATED_WEBHOOK_SECRET
    if (!secret) throw new HttpError(404, 'Not found.')
    const got = req.headers.get('x-simulated-signature') ?? ''
    if (!safeEqual(got, sign(secret, raw))) throw new HttpError(401, 'Bad signature.')
    const e = JSON.parse(raw)
    return { eventId: String(e.id), type: e.type, paymentRef: String(e.paymentRef), refundRef: e.refundRef, disputeRef: e.disputeRef, amount: e.amount, error: e.error }
  },
  async fetchSettlements() {
    // Nothing settles for real; reconciliation reports only on our own records.
    return null
  },
}

/**
 * POK (pokpay.io) adapter, built like the ag-web-visionfx checkout (pok/server.js there):
 *   1. the server logs in with the SDK key pair and creates an SDK order for the exact amount;
 *   2. the app renders POK's own card form for that order id (PokPayment.renderForm);
 *   3. nothing is trusted from the browser or the webhook: the order is always read back from POK before
 *      the reservation is confirmed, and finished with guest-confirm / capture if the form left it uncaptured.
 * Env: POK_KEY_ID, POK_KEY_SECRET, POK_MERCHANT_ID; optional POK_ENV (production | staging, default production)
 * and POK_AMOUNT_IN_MINOR_UNITS (see AMOUNT_IN_MINOR_UNITS).
 * @type {PaymentProvider}
 */
const pok = {
  name: 'pok',
  async createPayment(r) {
    const token = await pokToken()
    const res = await fetch(`${pokBase()}/merchants/${process.env.POK_MERCHANT_ID}/sdk-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: toPokAmount(r.amount),
        currencyCode: 'ALL',
        autoCapture: true,
        shippingCost: 0,
        webhookUrl: `${PUBLIC_API}/payments/webhook/pok`,
        redirectUrl: r.returnUrl,
      }),
    })
    const body = await res.json().catch(() => null)
    // 403 here means POK_MERCHANT_ID does not belong to this key pair.
    if (!res.ok) throw new Error(`POK create order failed: ${res.status} ${body?.message ?? ''}`.trim())
    const id = body?.data?.sdkOrder?.id || body?.data?.id
    if (!id) throw new Error('POK create order returned no id')
    return { providerRef: String(id), status: 'pending', clientRef: String(id) }
  },
  async fetchPayment(ref) {
    const o = await pokOrder(ref)
    return { status: pokPaid(o) ? 'succeeded' : /fail|declin|cancel|expir/i.test(o.status ?? '') ? 'failed' : 'pending', raw: o.status ?? null }
  },
  async completePayment(ref) {
    // POK's docs disagree about whether the form captures or the server must finish the order. Only called when
    // a read-back shows it uncaptured: try the guest path first (renderForm drives guest checkout), then capture,
    // then trust nothing but a fresh read of the order.
    const token = await pokToken()
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    for (const url of [`${pokBase()}/sdk-orders/${ref}/guest-confirm`, `${pokBase()}/merchants/${process.env.POK_MERCHANT_ID}/sdk-orders/${ref}/capture`]) {
      try {
        const res = await fetch(url, { method: 'POST', headers, body: '{}' })
        if (res.ok) break
        console.warn('pok complete attempt failed', res.status, url.split('/').pop())
      } catch (err) {
        console.warn('pok complete attempt errored', err instanceof Error ? err.message : err)
      }
    }
    const o = await pokOrder(ref)
    return { status: pokPaid(o) ? 'succeeded' : 'pending', raw: o.status ?? null }
  },
  async refund() {
    // POK's SDK API has no refund call we can rely on: refunds are made in POK Business (Pagesat online) and
    // marked done in Finance → Payments, which records them here.
    return { providerRef: null, status: 'manual' }
  },
  async parseWebhook(_req, raw) {
    // Anyone can POST here and POK doesn't sign it, so the body is only a hint: re-read the order from POK.
    let b
    try {
      b = JSON.parse(raw)
    } catch {
      return null
    }
    const ref = b?.sdkOrderId || b?.data?.sdkOrder?.id || b?.id
    if (!ref || !/^[A-Za-z0-9-]{1,64}$/.test(String(ref))) return null
    const o = await pokOrder(String(ref))
    const paid = pokPaid(o)
    if (!paid && !/fail|declin|cancel|expir/i.test(o.status ?? '')) return null
    return { eventId: `${ref}:${paid ? 'paid' : 'failed'}`, type: paid ? 'payment.succeeded' : 'payment.failed', paymentRef: String(ref), error: paid ? undefined : `POK: ${o.status}` }
  },
  async fetchSettlements() {
    // No settlement report in POK's SDK API; reconciliation lists our own records.
    return null
  },
}

/** Where POK sends webhooks. */
const PUBLIC_API = 'https://www.ngopu.app/api'

/**
 * Whether POK's API wants lek or qindarka. Its docs show `"amount": 100` and never say which.
 * Left false (lek) on purpose, as in ag-web-visionfx: if POK actually wanted qindarka, false undercharges 100×
 * (caught on the first sale), while true on a lek API would charge 100× to a real card. Settle it once with
 * scripts/pok-check-amount.sh, then set POK_AMOUNT_IN_MINOR_UNITS=1 only if the dashboard shows 0.01 L.
 */
const AMOUNT_IN_MINOR_UNITS = () => process.env.POK_AMOUNT_IN_MINOR_UNITS === '1'

/** @param {number} qindarka */
export function toPokAmount(qindarka) {
  return AMOUNT_IN_MINOR_UNITS() ? qindarka : Math.round(qindarka / 100)
}

export function pokConfigured() {
  return Boolean(process.env.POK_KEY_ID && process.env.POK_KEY_SECRET && process.env.POK_MERCHANT_ID)
}

export function pokEnv() {
  return process.env.POK_ENV === 'staging' ? 'staging' : 'production'
}

function pokBase() {
  // POK_API_BASE points tests at a local stand-in; production never sets it.
  if (process.env.POK_API_BASE) return process.env.POK_API_BASE
  return pokEnv() === 'staging' ? 'https://api-staging.pokpay.io' : 'https://api.pokpay.io'
}

/** @type {{ token: string, base: string, expiresAt: number } | null} */
let cachedToken = null

/** Tokens last hours (production returned expiresIn 28800000 ms), so reuse one while the instance is warm. */
async function pokToken() {
  if (!pokConfigured()) throw new HttpError(503, 'Card payments aren’t set up yet.')
  const now = Date.now()
  const base = pokBase()
  if (cachedToken && cachedToken.base === base && cachedToken.expiresAt > now + 30_000) return cachedToken.token
  const res = await fetch(`${base}/auth/sdk/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyId: process.env.POK_KEY_ID, keySecret: process.env.POK_KEY_SECRET }),
  })
  // 400/401 almost always means the wrong environment: production keys only work on api.pokpay.io.
  if (!res.ok) throw new Error(`POK login failed: ${res.status}`)
  const body = await res.json()
  const token = body?.data?.accessToken
  if (!token) throw new Error('POK login returned no accessToken')
  cachedToken = { token, base, expiresAt: now + (Number(body?.data?.expiresIn) || 300_000) }
  return token
}

/** @param {string} ref */
async function pokOrder(ref) {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(ref)) throw new HttpError(400, 'Bad payment reference.')
  const token = await pokToken()
  const res = await fetch(`${pokBase()}/sdk-orders/${ref}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`POK read order failed: ${res.status}`)
  return /** @type {{ id?: string, status?: string, amount?: number, capturedAmount?: number }} */ (body?.data?.sdkOrder || body?.data || {})
}

/** Same test as the ag-web-visionfx checkout: captured money, or a paid/captured/completed status. @param {{ status?: string, capturedAmount?: number }} o */
export function pokPaid(o) {
  return (Number(o.capturedAmount) || 0) > 0 || /paid|captur|success|complete/i.test(o.status ?? '')
}

/** @type {Record<string, PaymentProvider>} */
const PROVIDERS = { simulated, pok }

/** @param {string} [name] @returns {PaymentProvider} */
export function getProvider(name) {
  const key = name ?? process.env.PAYMENT_PROVIDER ?? 'simulated'
  const p = PROVIDERS[key]
  if (!p) throw new HttpError(500, `Unknown payment provider "${key}".`)
  return p
}
