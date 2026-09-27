// @ts-check
/**
 * Card payment providers behind one interface. PAYMENT_PROVIDER picks one (default "simulated").
 * To connect a real provider, implement these five methods in its adapter; nothing else in the app changes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../db.js'

/**
 * @typedef {{ paymentId: string, orderId: string, amount: number, currency: string, description: string, returnUrl: string, customerEmail?: string | null }} PaymentRequest
 *   amount is in qindarka (1 L = 100).
 * @typedef {{ providerRef: string, status: 'succeeded' | 'pending', redirectUrl?: string }} PaymentStart
 * @typedef {{ providerRef: string | null, status: 'succeeded' | 'pending' | 'failed', error?: string }} RefundResult
 * @typedef {'payment.succeeded' | 'payment.failed' | 'refund.succeeded' | 'refund.failed' | 'dispute.opened' | 'dispute.won' | 'dispute.lost'} EventType
 * @typedef {{ eventId: string, type: EventType, paymentRef: string, refundRef?: string, disputeRef?: string, amount?: number, error?: string }} ProviderEvent
 * @typedef {{ paymentRef: string, kind: 'payment' | 'refund', amount: number, fee: number, settledAt: string }} Settlement
 * @typedef {{
 *   name: string,
 *   createPayment: (r: PaymentRequest) => Promise<PaymentStart>,
 *   refund: (r: { paymentRef: string, refundId: string, amount: number, reason: string }) => Promise<RefundResult>,
 *   parseWebhook: (req: Request, raw: string) => Promise<ProviderEvent | null>,
 *   fetchSettlements: (from: string, to: string) => Promise<Settlement[] | null>,
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
 * POK (pokpay.io) adapter. Fill in once the merchant contract and API documentation arrive:
 * credentials come from POK_API_KEY / POK_API_SECRET / POK_MERCHANT_ID / POK_WEBHOOK_SECRET.
 * Map POK's statuses and event names onto the ones above; amounts in POK's unit → qindarka.
 * @type {PaymentProvider}
 */
const pok = {
  name: 'pok',
  async createPayment() {
    throw notConnected()
  },
  async refund() {
    throw notConnected()
  },
  async parseWebhook() {
    throw notConnected()
  },
  async fetchSettlements() {
    throw notConnected()
  },
}

function notConnected() {
  return new HttpError(503, 'The POK payment integration isn’t connected yet.')
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
