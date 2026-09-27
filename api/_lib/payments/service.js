// @ts-check
/**
 * Card payments around an order: start, confirm (webhook), fail, expire, refunds, disputes, reconciliation.
 * The ledger (finance.js) records money only once the provider has confirmed it.
 */
import { newId } from '../auth.js'
import { HttpError, query, tx } from '../db.js'
import { audit, recordCancellation, recordSale } from '../finance.js'
import { getProvider } from './providers.js'
import { queueRefund } from './queue.js'

/** Minutes a bag stays held while the customer pays. */
export const PAYMENT_HOLD_MINUTES = 10

/** Where the provider sends the customer back after paying (web and app). */
const RETURN_URL = 'https://www.ngopu.app/app/orders'

/**
 * Asks the provider to take payment for a new order (status pending_payment). Returns the order: reserved when
 * the provider confirmed at once (simulated), still pending with a redirect URL when the customer must pay
 * on the provider's page.
 * @param {any} order @param {string} paymentId @param {string | null} email
 */
export async function startPayment(order, paymentId, email) {
  const provider = getProvider()
  /** @type {import('./providers.js').PaymentStart} */
  let start
  try {
    start = await provider.createPayment({
      paymentId,
      orderId: order.id,
      amount: order.quantity * order.unit_price * 100,
      currency: 'ALL',
      description: `Ngopu Surprise Bag × ${order.quantity}`,
      returnUrl: `${RETURN_URL}/${order.id}`,
      customerEmail: email,
    })
  } catch (err) {
    await failPayment(provider.name, null, err instanceof Error ? err.message : 'Provider error', paymentId)
    throw new HttpError(502, 'We couldn’t start the payment. You haven’t been charged. Please try again.')
  }
  await query('update payments set provider_ref = $2, updated_at = now() where id = $1', [paymentId, start.providerRef])
  if (start.status === 'succeeded') return { order: await confirmPayment(provider.name, start.providerRef), redirectUrl: null }
  return { order, redirectUrl: start.redirectUrl ?? null }
}

/**
 * The provider confirmed the payment: the reservation becomes real and the sale is recorded. Idempotent.
 * A payment that arrives after the hold expired gets the bag back if one is left, otherwise an automatic refund.
 * @param {string} providerName @param {string} paymentRef
 */
export async function confirmPayment(providerName, paymentRef) {
  const result = await tx(async (c) => {
    const { rows } = await c.query('select * from payments where provider = $1 and provider_ref = $2 for update', [providerName, paymentRef])
    const p = rows[0]
    if (!p) throw new HttpError(404, 'Payment not found.')
    const { rows: or } = await c.query('select * from orders where id = $1 for update', [p.order_id])
    let o = or[0]
    if (p.status === 'succeeded') return o
    await c.query(`update payments set status = 'succeeded', failure = null, updated_at = now() where id = $1`, [p.id])
    if (o.status === 'expired') {
      const take = await c.query(
        'update bags set quantity = quantity - $1, updated_at = now() where store_id = $2 and quantity >= $1 and not paused',
        [o.quantity, o.store_id],
      )
      if (!take.rowCount) {
        const up = await c.query(
          `update orders set status = 'cancelled', cancelled_at = now(), closed_at = now(), cancelled_by = 'admin',
                  cancel_reason = 'Your payment arrived after the reservation expired and the bag was gone.' where id = $1 returning *`,
          [o.id],
        )
        o = up.rows[0]
        await recordSale(c, o)
        await recordCancellation(c, o)
        await queueRefund(c, o.id, p.amount, 'Late payment, no bag left')
        return o
      }
    }
    if (o.status === 'pending_payment' || o.status === 'expired') {
      const up = await c.query(`update orders set status = 'reserved' where id = $1 returning *`, [o.id])
      o = up.rows[0]
      await recordSale(c, o)
    }
    return o
  })
  await processRefunds()
  return result
}

/**
 * The payment failed (declined, abandoned, provider error): the bag goes back on sale.
 * @param {string} providerName @param {string | null} paymentRef @param {string} error @param {string} [paymentId]
 */
export async function failPayment(providerName, paymentRef, error, paymentId) {
  await tx(async (c) => {
    const { rows } = paymentId
      ? await c.query('select * from payments where id = $1 for update', [paymentId])
      : await c.query('select * from payments where provider = $1 and provider_ref = $2 for update', [providerName, paymentRef])
    const p = rows[0]
    if (!p || p.status !== 'pending') return
    await c.query(`update payments set status = 'failed', failure = $2, updated_at = now() where id = $1`, [p.id, error])
    const up = await c.query(`update orders set status = 'expired', closed_at = now() where id = $1 and status = 'pending_payment' returning *`, [p.order_id])
    if (up.rows[0]) await c.query('update bags set quantity = quantity + $1, updated_at = now() where store_id = $2', [up.rows[0].quantity, up.rows[0].store_id])
  })
}

let lastExpire = 0

/** Releases bags held for payments that never completed. Runs lazily, at most once a minute per instance. */
export async function expirePendingPayments(force = false) {
  if (!force && Date.now() - lastExpire < 60_000) return 0
  lastExpire = Date.now()
  return tx(async (c) => {
    const { rows } = await c.query(
      `update orders set status = 'expired', closed_at = now()
        where id in (select id from orders where status = 'pending_payment' and created_at < now() - make_interval(mins => $1)
                      order by created_at limit 200 for update skip locked)
        returning *`,
      [PAYMENT_HOLD_MINUTES],
    )
    for (const o of rows) {
      await c.query('update bags set quantity = quantity + $1, updated_at = now() where store_id = $2', [o.quantity, o.store_id])
      await c.query(`update payments set status = 'expired', updated_at = now() where order_id = $1 and status = 'pending'`, [o.id])
    }
    return rows.length
  })
}

/**
 * Sends queued refunds to the provider. Failed ones are retried (up to 5 times, 10 minutes apart).
 * Each refund is claimed before sending so two instances never send the same one.
 */
export async function processRefunds() {
  const { rows } = await query(
    `update refunds set status = 'sent', attempts = attempts + 1, updated_at = now()
      where id in (select id from refunds
                    where status = 'queued' or (status = 'failed' and attempts < 5 and updated_at < now() - interval '10 minutes')
                    order by created_at limit 25 for update skip locked)
      returning *`,
  )
  let done = 0
  for (const r of rows) {
    const { rows: pr } = await query('select * from payments where id = $1', [r.payment_id])
    const p = pr[0]
    try {
      const res = await getProvider(p.provider).refund({ paymentRef: p.provider_ref, refundId: r.id, amount: r.amount, reason: r.reason })
      const status = res.status === 'succeeded' ? 'succeeded' : res.status === 'failed' ? 'failed' : 'sent'
      await query('update refunds set status = $2, provider_ref = $3, last_error = $4, updated_at = now() where id = $1', [r.id, status, res.providerRef, res.error ?? null])
      if (status === 'succeeded') done++
    } catch (err) {
      await query(`update refunds set status = 'failed', last_error = $2, updated_at = now() where id = $1`, [r.id, err instanceof Error ? err.message : String(err)])
    }
  }
  return done
}

/**
 * A provider webhook. Signature checked by the adapter; each event is handled once.
 * @param {string} providerName @param {Request} req @param {string} raw
 */
export async function handleWebhook(providerName, req, raw) {
  const provider = getProvider(providerName)
  const e = await provider.parseWebhook(req, raw)
  if (!e) return { ignored: true }
  const seen = await query('select 1 from webhook_events where provider = $1 and event_id = $2', [provider.name, e.eventId])
  if (seen.rows[0]) return { duplicate: true }
  switch (e.type) {
    case 'payment.succeeded':
      await confirmPayment(provider.name, e.paymentRef)
      break
    case 'payment.failed':
      await failPayment(provider.name, e.paymentRef, e.error ?? 'Payment failed')
      break
    case 'refund.succeeded':
    case 'refund.failed':
      await query(`update refunds set status = $2, last_error = $3, updated_at = now() where provider_ref = $1 or id = $1`, [
        e.refundRef,
        e.type === 'refund.succeeded' ? 'succeeded' : 'failed',
        e.error ?? null,
      ])
      break
    case 'dispute.opened':
    case 'dispute.won':
    case 'dispute.lost':
      await handleDispute(provider.name, e)
      break
  }
  await query('insert into webhook_events (provider, event_id, type, payload) values ($1,$2,$3,$4) on conflict do nothing', [
    provider.name,
    e.eventId,
    e.type,
    raw ? JSON.stringify(safeJson(raw)) : null,
  ])
  return { ok: true }
}

/** @param {string} raw */
function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return { raw: raw.slice(0, 2000) }
  }
}

/**
 * A customer disputed the charge with their bank (chargeback). The amount is held from the store's balance
 * while it's open; released if Ngopu wins, kept (the bank refunded the customer) if it's lost.
 * @param {string} providerName @param {import('./providers.js').ProviderEvent} e
 */
async function handleDispute(providerName, e) {
  await tx(async (c) => {
    const { rows } = await c.query('select p.*, o.store_id, o.is_demo from payments p join orders o on o.id = p.order_id where p.provider = $1 and p.provider_ref = $2', [
      providerName,
      e.paymentRef,
    ])
    const p = rows[0]
    if (!p) throw new HttpError(404, 'Payment not found.')
    const { rows: ds } = await c.query('select * from disputes where payment_id = $1 for update', [p.id])
    let d = ds[0]
    if (e.type === 'dispute.opened' && !d) {
      const amount = e.amount ?? p.amount
      const id = newId('dp_')
      await c.query('insert into disputes (id, payment_id, order_id, store_id, amount, provider_ref) values ($1,$2,$3,$4,$5,$6)', [
        id,
        p.id,
        p.order_id,
        p.store_id,
        amount,
        e.disputeRef ?? null,
      ])
      await c.query(
        `insert into ledger_entries (store_id, order_id, type, store_delta, eligible_at, note, is_demo)
         values ($1,$2,'chargeback_hold',$3,now(),'Card payment disputed by the customer',$4)
         on conflict (order_id, type) where order_id is not null do nothing`,
        [p.store_id, p.order_id, -amount, p.is_demo],
      )
      await audit(c, null, 'dispute.opened', p.order_id, { amount })
      return
    }
    if (!d || d.status !== 'open') return
    if (e.type === 'dispute.won') {
      await c.query(`update disputes set status = 'won', resolved_at = now() where id = $1`, [d.id])
      await c.query(
        `insert into ledger_entries (store_id, order_id, type, store_delta, eligible_at, note, is_demo)
         values ($1,$2,'chargeback_release',$3,now(),'Dispute won',$4)
         on conflict (order_id, type) where order_id is not null do nothing`,
        [p.store_id, p.order_id, d.amount, p.is_demo],
      )
    } else if (e.type === 'dispute.lost') {
      await c.query(`update disputes set status = 'lost', resolved_at = now() where id = $1`, [d.id])
    }
    await audit(c, null, e.type, p.order_id, { amount: d.amount })
  })
}

/**
 * Compares the provider's settlement report with our payments for a period and records processor fees.
 * @param {string} from ISO @param {string} to ISO
 */
export async function reconcile(from, to) {
  const provider = getProvider()
  const { rows: ours } = await query(
    `select p.*, o.store_id, o.is_demo from payments p join orders o on o.id = p.order_id
      where p.provider = $1 and p.status = 'succeeded' and p.created_at >= $2 and p.created_at < $3`,
    [provider.name, from, to],
  )
  const settlements = await provider.fetchSettlements(from, to)
  const total = ours.reduce((a, p) => a + p.amount, 0)
  if (!settlements) return { provider: provider.name, available: false, payments: ours.length, total }
  const byRef = new Map(ours.map((p) => [p.provider_ref, p]))
  const seen = new Set()
  /** @type {any[]} */ const unknownAtProvider = []
  /** @type {any[]} */ const amountMismatch = []
  let fees = 0
  for (const s of settlements.filter((x) => x.kind === 'payment')) {
    const p = byRef.get(s.paymentRef)
    if (!p) {
      unknownAtProvider.push(s)
      continue
    }
    seen.add(s.paymentRef)
    if (s.amount !== p.amount) amountMismatch.push({ paymentRef: s.paymentRef, ours: p.amount, theirs: s.amount })
    if (s.fee > 0 && p.fee == null) {
      await tx(async (c) => {
        await c.query('update payments set fee = $2 where id = $1', [p.id, s.fee])
        await c.query(
          `insert into ledger_entries (store_id, order_id, type, platform_delta, eligible_at, note, is_demo)
           values ($1,$2,'processor_fee',$3,now(),'Card processing fee',$4)
           on conflict (order_id, type) where order_id is not null do nothing`,
          [p.store_id, p.order_id, -s.fee, p.is_demo],
        )
      })
      fees += s.fee
    }
  }
  const missingAtProvider = ours.filter((p) => !seen.has(p.provider_ref)).map((p) => ({ paymentRef: p.provider_ref, amount: p.amount, orderId: p.order_id }))
  return { provider: provider.name, available: true, payments: ours.length, total, matched: seen.size, missingAtProvider, unknownAtProvider, amountMismatch, feesRecorded: fees }
}
