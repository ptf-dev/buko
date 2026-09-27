// @ts-check
import { newId } from '../auth.js'

/**
 * Queues a card refund for an order, inside the caller's transaction (next to the ledger entry that explains
 * it). processRefunds() sends it to the provider after the transaction commits. Orders without a card payment
 * (cash, demo) queue nothing. Never refunds more than was paid.
 * @param {{ query: (text: string, params?: unknown[]) => Promise<any> }} c
 * @param {string} orderId @param {number} amount qindarka @param {string} reason
 * @returns {Promise<string | null>} refund id
 */
export async function queueRefund(c, orderId, amount, reason) {
  const { rows } = await c.query(`select * from payments where order_id = $1 and status = 'succeeded' for update`, [orderId])
  const p = rows[0]
  if (!p) return null
  const amt = Math.min(amount, p.amount - p.refunded)
  if (amt <= 0) return null
  const id = newId('rf_')
  await c.query('insert into refunds (id, payment_id, order_id, amount, reason) values ($1,$2,$3,$4,$5)', [id, p.id, orderId, amt, reason])
  await c.query('update payments set refunded = refunded + $2, updated_at = now() where id = $1', [p.id, amt])
  return id
}
