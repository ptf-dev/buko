// @ts-check
/**
 * Money: the ledger, commission, no-show settlement, payouts, complaints, billing details and reports.
 * Design: docs/payments-and-reporting.md. All amounts here are integer qindarka (1 L = 100).
 *
 * Every money movement is one row in ledger_entries. Balances and reports are always computed from it.
 * store_delta: change to what Ngopu owes the store. platform_delta: change to Ngopu's revenue (VAT included,
 * with the VAT part also in `vat`).
 */
import { HttpError, query, tx } from './db.js'
import { newId } from './auth.js'
import { TIMEZONE } from './time.js'

/**
 * @typedef {{ query: (text: string, params?: unknown[]) => Promise<any> }} Db
 * @typedef {typeof DEFAULT_SETTINGS} Settings
 */

/** Platform-wide money terms. Admins can change them in Finance → Settings. */
export const DEFAULT_SETTINGS = {
  vatRegistered: false,
  vatRatePercent: 20,
  commissionPercent: 20,
  /** Minimum commission per bag, in lek. */
  commissionMinLek: 60,
  membershipFeeLek: 6000,
  membershipFreeMonths: 12,
  /** Days after an order closes before its money can be paid out (covers complaints). */
  holdDays: 3,
  minPayoutLek: 1000,
  /** Minutes after the pickup window ends before an uncollected order counts as a no-show. */
  noShowGraceMinutes: 60,
  payoutEveryDays: 14,
  /** A Monday; payout dates repeat every payoutEveryDays from here. */
  payoutAnchor: '2026-01-05',
  /** New bank details can't be paid to until this many hours after approval (fraud control). */
  bankChangeHoldHours: 48,
}

const Q = { query }

/** @param {Db} [db] @returns {Promise<Settings>} */
export async function getSettings(db = Q) {
  const { rows } = await db.query(`select value from platform_settings where key = 'finance'`)
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.value ?? {}) }
}

/** @param {Partial<Settings>} patch @param {string} actor */
export async function updateSettings(patch, actor) {
  return tx(async (c) => {
    const current = await getSettings(c)
    const next = { ...current, ...patch }
    await c.query(
      `insert into platform_settings (key, value) values ('finance', $1)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(next)],
    )
    await audit(c, actor, 'settings.update', 'finance', patch)
    return next
  })
}

/** @param {Db} c @param {string | null} actor @param {string} action @param {string | null} target @param {unknown} [details] */
export async function audit(c, actor, action, target, details) {
  await c.query('insert into audit_log (actor_id, action, target, details) values ($1,$2,$3,$4)', [
    actor,
    action,
    target,
    details === undefined ? null : JSON.stringify(details),
  ])
}

/* ------------------------------------------------------------------ */
/* Commission                                                          */
/* ------------------------------------------------------------------ */

/**
 * A store's terms: its own overrides, or the platform defaults.
 * @param {Db} db @param {string} storeId @param {Settings} s
 */
export async function storeTerms(db, storeId, s) {
  const { rows } = await db.query('select * from store_billing where store_id = $1', [storeId])
  const b = rows[0] ?? {}
  return {
    commissionBps: b.commission_bps ?? Math.round(s.commissionPercent * 100),
    /** Per bag, qindarka. */
    commissionMin: b.commission_min ?? Math.round(s.commissionMinLek * 100),
    membershipFee: b.membership_fee ?? Math.round(s.membershipFeeLek * 100),
    custom: b.commission_bps != null || b.commission_min != null,
  }
}

/**
 * Commission on an order: a percentage of the total, at least the per-bag minimum, never more than the total.
 * @param {number} totalQ @param {number} quantity @param {{ commissionBps: number, commissionMin: number }} terms @param {Settings} s
 */
export function commissionFor(totalQ, quantity, terms, s) {
  const amount = Math.min(totalQ, Math.max(Math.round((totalQ * terms.commissionBps) / 10_000), terms.commissionMin * quantity))
  return { amount, vat: vatIn(amount, s) }
}

/** VAT included in a VAT-inclusive amount. @param {number} amount @param {Settings} s */
function vatIn(amount, s) {
  return s.vatRegistered ? Math.round((amount * s.vatRatePercent) / (100 + s.vatRatePercent)) : 0
}

/* ------------------------------------------------------------------ */
/* Order lifecycle → ledger                                            */
/* ------------------------------------------------------------------ */

const ONCE = 'on conflict (order_id, type) where order_id is not null do nothing'

/** @param {any} o */
const orderTotal = (o) => o.quantity * o.unit_price * 100

/** Payment taken at reservation. Not payable until the order closes. @param {Db} c @param {any} o */
export async function recordSale(c, o) {
  await c.query(
    `insert into ledger_entries (store_id, order_id, type, store_delta, is_demo, created_at) values ($1,$2,'sale',$3,$4,$5) ${ONCE}`,
    [o.store_id, o.id, orderTotal(o), o.is_demo, o.created_at],
  )
}

/** Cancelled before pickup: the whole amount goes back to the customer, no commission. @param {Db} c @param {any} o */
export async function recordCancellation(c, o) {
  await c.query(
    `insert into ledger_entries (store_id, order_id, type, store_delta, eligible_at, is_demo) values ($1,$2,'cancellation',$3,now(),$4) ${ONCE}`,
    [o.store_id, o.id, -orderTotal(o), o.is_demo],
  )
  await c.query(`update ledger_entries set eligible_at = now() where order_id = $1 and type = 'sale'`, [o.id])
}

/**
 * Collected or no-show: the sale is final, so commission is charged and both become payable after the hold.
 * @param {Db} c @param {any} o @param {Settings} [settings]
 */
export async function recordClose(c, o, settings) {
  const s = settings ?? (await getSettings(c))
  const terms = await storeTerms(c, o.store_id, s)
  const { amount, vat } = commissionFor(orderTotal(o), o.quantity, terms, s)
  const eligible = new Date(new Date(o.closed_at ?? Date.now()).getTime() + s.holdDays * 86_400_000)
  await c.query(
    `insert into ledger_entries (store_id, order_id, type, store_delta, platform_delta, vat, eligible_at, is_demo)
     values ($1,$2,'commission',$3,$4,$5,$6,$7) ${ONCE}`,
    [o.store_id, o.id, -amount, amount, vat, eligible, o.is_demo],
  )
  await c.query(`update ledger_entries set eligible_at = $2 where order_id = $1 and type = 'sale' and eligible_at is null`, [o.id, eligible])
}

let lastSettle = 0

/**
 * Closes reservations whose pickup window ended more than the grace period ago as no-shows: the customer
 * isn't refunded and the store is paid. Runs lazily before money is read (at most once a minute per instance).
 */
export async function settleNoShows(force = false) {
  if (!force && Date.now() - lastSettle < 60_000) return 0
  lastSettle = Date.now()
  const s = await getSettings()
  return tx(async (c) => {
    const { rows } = await c.query(
      `update orders set status = 'no_show', closed_at = now()
        where id in (select id from orders where status = 'reserved' and pickup_end < now() - make_interval(mins => $1)
                      order by pickup_end limit 500 for update skip locked)
        returning *`,
      [s.noShowGraceMinutes],
    )
    for (const o of rows) await recordClose(c, o, s)
    return rows.length
  })
}

/**
 * The store can't honour a reservation (e.g. it closed early). Full refund, no commission.
 * @param {string} storeId @param {string} orderId @param {string} reason @param {string} actor
 */
export async function storeCancelOrder(storeId, orderId, reason, actor) {
  return tx(async (c) => {
    const { rows } = await c.query('select * from orders where id = $1 and store_id = $2 for update', [orderId, storeId])
    const o = rows[0]
    if (!o) throw new HttpError(404, 'Order not found.')
    if (o.status !== 'reserved') throw new HttpError(409, 'Only orders waiting for pickup can be cancelled.')
    const up = await c.query(
      `update orders set status = 'cancelled', cancelled_at = now(), closed_at = now(), cancelled_by = 'store', cancel_reason = $2
        where id = $1 returning *`,
      [o.id, reason],
    )
    await recordCancellation(c, up.rows[0])
    await audit(c, actor, 'order.store_cancel', o.id, { reason })
    return up.rows[0]
  })
}

/* ------------------------------------------------------------------ */
/* Complaints                                                          */
/* ------------------------------------------------------------------ */

export const COMPLAINT_REASONS = ['quality', 'quantity', 'wrong_items', 'store_closed', 'staff', 'other']
/** Hours after collection during which a customer can report a problem. */
export const COMPLAINT_WINDOW_HOURS = 24

/**
 * Support decides a complaint. A refund comes out of the store's balance (with Ngopu's commission on that
 * part given back) or is paid by Ngopu as goodwill.
 * @param {string} id @param {string} actor
 * @param {{ action: 'refund' | 'reject', amount?: number, fundedBy?: 'store' | 'ngopu', note: string | null }} d
 */
export async function resolveComplaint(id, actor, d) {
  return tx(async (c) => {
    const { rows } = await c.query(
      `select k.*, o.quantity, o.unit_price, o.is_demo from complaints k join orders o on o.id = k.order_id where k.id = $1 for update of k`,
      [id],
    )
    const k = rows[0]
    if (!k) throw new HttpError(404, 'Complaint not found.')
    if (k.status !== 'open') throw new HttpError(409, 'This complaint is already resolved.')
    if (d.action === 'reject') {
      await c.query(`update complaints set status = 'rejected', resolution_note = $2, resolved_by = $3, resolved_at = now() where id = $1`, [
        id,
        d.note,
        actor,
      ])
      await audit(c, actor, 'complaint.reject', id, { note: d.note })
      return
    }
    const total = orderTotal(k)
    const amount = d.amount ?? total
    if (amount <= 0 || amount > total) throw new HttpError(400, 'The refund must be more than 0 and at most the order total.')
    const s = await getSettings(c)
    if (d.fundedBy === 'ngopu') {
      await c.query(
        `insert into ledger_entries (store_id, order_id, complaint_id, type, platform_delta, vat, eligible_at, note, created_by, is_demo)
         values ($1,$2,$3,'goodwill_refund',$4,0,now(),$5,$6,$7) ${ONCE}`,
        [k.store_id, k.order_id, id, -amount, d.note, actor, k.is_demo],
      )
    } else {
      await c.query(
        `insert into ledger_entries (store_id, order_id, complaint_id, type, store_delta, eligible_at, note, created_by, is_demo)
         values ($1,$2,$3,'complaint_refund',$4,now(),$5,$6,$7) ${ONCE}`,
        [k.store_id, k.order_id, id, -amount, d.note, actor, k.is_demo],
      )
      // Give back the commission on the refunded share.
      const { rows: com } = await c.query(`select platform_delta, vat from ledger_entries where order_id = $1 and type = 'commission'`, [k.order_id])
      if (com[0]) {
        const back = Math.round((com[0].platform_delta * amount) / total)
        const vatBack = Math.round((com[0].vat * amount) / total)
        if (back > 0)
          await c.query(
            `insert into ledger_entries (store_id, order_id, complaint_id, type, store_delta, platform_delta, vat, eligible_at, created_by, is_demo)
             values ($1,$2,$3,'commission_reversal',$4,$5,$6,now(),$7,$8) ${ONCE}`,
            [k.store_id, k.order_id, id, back, -back, -vatBack, actor, k.is_demo],
          )
      }
    }
    await c.query(
      `update complaints set status = 'refunded', refund_amount = $2, funded_by = $3, resolution_note = $4, resolved_by = $5, resolved_at = now() where id = $1`,
      [id, amount, d.fundedBy ?? 'store', d.note, actor],
    )
    await audit(c, actor, 'complaint.refund', id, { amount, fundedBy: d.fundedBy ?? 'store', vatRegistered: s.vatRegistered })
  })
}

/* ------------------------------------------------------------------ */
/* Billing details, terms, adjustments                                 */
/* ------------------------------------------------------------------ */

/** @param {Db} c @param {string} storeId */
async function ensureBilling(c, storeId) {
  await c.query('insert into store_billing (store_id) values ($1) on conflict do nothing', [storeId])
}

/**
 * The store submits its legal name, NIPT and IBAN. They wait for an admin to check them before payouts use them.
 * @param {string} storeId @param {{ legalName: string, nipt: string, iban: string }} d @param {string} actor
 */
export async function submitBankDetails(storeId, d, actor) {
  await tx(async (c) => {
    await ensureBilling(c, storeId)
    await c.query(
      `update store_billing set pending_legal_name = $2, pending_nipt = $3, pending_iban = $4, pending_submitted_at = now(), updated_at = now()
        where store_id = $1`,
      [storeId, d.legalName, d.nipt, d.iban],
    )
    await audit(c, actor, 'billing.submit', storeId, { legalName: d.legalName, nipt: d.nipt, iban: maskIban(d.iban) })
  })
}

/** @param {string} storeId @param {'approve' | 'reject'} action @param {string} actor */
export async function reviewBankDetails(storeId, action, actor) {
  await tx(async (c) => {
    const { rows } = await c.query('select * from store_billing where store_id = $1 for update', [storeId])
    const b = rows[0]
    if (!b?.pending_iban) throw new HttpError(409, 'There are no bank details waiting for review.')
    if (action === 'approve')
      await c.query(
        `update store_billing set legal_name = pending_legal_name, nipt = pending_nipt, iban = pending_iban, bank_verified_at = now(),
                pending_legal_name = null, pending_nipt = null, pending_iban = null, pending_submitted_at = null, updated_at = now()
          where store_id = $1`,
        [storeId],
      )
    else
      await c.query(
        `update store_billing set pending_legal_name = null, pending_nipt = null, pending_iban = null, pending_submitted_at = null, updated_at = now()
          where store_id = $1`,
        [storeId],
      )
    await audit(c, actor, `billing.${action}`, storeId, { iban: maskIban(b.pending_iban) })
  })
}

/**
 * Per-store overrides. `null` returns a term to the platform default.
 * @param {string} storeId @param {Record<string, unknown>} u  column → value @param {string} actor
 */
export async function updateTerms(storeId, u, actor) {
  const keys = Object.keys(u)
  if (!keys.length) throw new HttpError(400, 'Nothing to update.')
  await tx(async (c) => {
    await ensureBilling(c, storeId)
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    await c.query(`update store_billing set ${sets}, updated_at = now() where store_id = $1`, [storeId, ...keys.map((k) => u[k])])
    await audit(c, actor, 'billing.terms', storeId, u)
  })
}

/**
 * Manual correction. Positive = Ngopu credits the store, negative = the store owes Ngopu.
 * @param {string} storeId @param {number} amount @param {string} reason @param {string} actor
 */
export async function addAdjustment(storeId, amount, reason, actor) {
  if (amount === 0) throw new HttpError(400, 'The amount can’t be 0.')
  await tx(async (c) => {
    const { rows } = await c.query('select 1 from stores where id = $1', [storeId])
    if (!rows[0]) throw new HttpError(404, 'Store not found.')
    await c.query(
      `insert into ledger_entries (store_id, type, store_delta, platform_delta, eligible_at, note, created_by) values ($1,'adjustment',$2,$3,now(),$4,$5)`,
      [storeId, amount, -amount, reason, actor],
    )
    await audit(c, actor, 'ledger.adjustment', storeId, { amount, reason })
  })
}

/** @param {string | null | undefined} iban */
export function maskIban(iban) {
  return iban ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : null
}

/* ------------------------------------------------------------------ */
/* Membership fee                                                      */
/* ------------------------------------------------------------------ */

/**
 * Yearly membership: the first `membershipFreeMonths` after approval are free, then the fee is charged from
 * the store's balance once a year. Runs as part of every payout run.
 * @param {Db} c @param {Settings} s @param {string} actor
 */
async function chargeMemberships(c, s, actor) {
  await c.query(
    `insert into store_billing (store_id) select id from stores where status = 'active' on conflict do nothing`,
  )
  await c.query(
    `update store_billing b set membership_paid_until = coalesce(s.approved_at, s.created_at) + make_interval(months => $1)
       from stores s where s.id = b.store_id and b.membership_paid_until is null and s.status = 'active'`,
    [s.membershipFreeMonths],
  )
  const { rows } = await c.query(
    `select b.store_id, coalesce(b.membership_fee, $1) as fee, b.membership_paid_until
       from store_billing b join stores s on s.id = b.store_id
      where s.status = 'active' and b.membership_paid_until <= now() for update of b`,
    [Math.round(s.membershipFeeLek * 100)],
  )
  for (const r of rows) {
    if (r.fee > 0)
      await c.query(
        `insert into ledger_entries (store_id, type, store_delta, platform_delta, vat, eligible_at, note, created_by)
         values ($1,'membership_fee',$2,$3,$4,now(),$5,$6)`,
        [r.store_id, -r.fee, r.fee, vatIn(r.fee, s), `Membership until ${new Date(new Date(r.membership_paid_until).getTime() + 365 * 86_400_000).toISOString().slice(0, 10)}`, actor],
      )
    await c.query(`update store_billing set membership_paid_until = membership_paid_until + interval '1 year' where store_id = $1`, [r.store_id])
  }
  return rows.length
}

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

/** Next scheduled payout date on or after `now`. @param {Settings} s @param {number} [now] */
export function nextPayoutDate(s, now = Date.now()) {
  const anchor = Date.parse(`${s.payoutAnchor}T09:00:00+02:00`)
  const period = s.payoutEveryDays * 86_400_000
  const n = Math.max(0, Math.ceil((now - anchor) / period))
  return new Date(anchor + n * period).toISOString()
}

/**
 * Builds a payout run: one draft payout per store whose payable balance is at least the minimum and whose
 * bank details are approved and past the change hold. Demo data is never paid out.
 * @param {string} actor
 */
export async function buildPayoutRun(actor) {
  await settleNoShows(true)
  return tx(async (c) => {
    await c.query('select pg_advisory_xact_lock(4343)')
    const s = await getSettings(c)
    const memberships = await chargeMemberships(c, s, actor)
    const { rows } = await c.query(
      `select l.store_id, st.name, st.branch, sum(l.store_delta)::int as amount, array_agg(l.id) as ids,
              b.legal_name, b.iban, b.bank_verified_at, coalesce(b.payouts_paused, false) as paused
         from ledger_entries l
         join stores st on st.id = l.store_id
         left join store_billing b on b.store_id = l.store_id
        where l.payout_id is null and not l.is_demo and l.type <> 'payout' and l.eligible_at <= now()
        group by l.store_id, st.name, st.branch, b.legal_name, b.iban, b.bank_verified_at, b.payouts_paused
        order by st.name`,
    )
    const runId = newId('run_')
    const minPayout = Math.round(s.minPayoutLek * 100)
    const holdMs = s.bankChangeHoldHours * 3_600_000
    /** @type {any[]} */
    const created = []
    /** @type {any[]} */
    const skipped = []
    for (const r of rows) {
      const base = { storeId: r.store_id, name: r.name, branch: r.branch, amount: r.amount }
      if (r.amount <= 0) skipped.push({ ...base, reason: r.amount < 0 ? 'The store owes Ngopu; it’s taken from future sales.' : 'Nothing to pay.' })
      else if (r.paused) skipped.push({ ...base, reason: 'Payouts are paused for this store.' })
      else if (!r.iban) skipped.push({ ...base, reason: 'No approved bank details yet.' })
      else if (Date.now() - new Date(r.bank_verified_at).getTime() < holdMs) skipped.push({ ...base, reason: `Bank details changed less than ${s.bankChangeHoldHours} h ago.` })
      else if (r.amount < minPayout) skipped.push({ ...base, reason: `Below the ${s.minPayoutLek.toLocaleString('en')} L minimum; rolls over.` })
      else {
        const id = newId('po_')
        await c.query(
          `insert into payouts (id, run_id, store_id, amount, status, legal_name, iban, created_by) values ($1,$2,$3,$4,'draft',$5,$6,$7)`,
          [id, runId, r.store_id, r.amount, r.legal_name, r.iban, actor],
        )
        await c.query('update ledger_entries set payout_id = $1 where id = any($2::bigint[]) and payout_id is null', [id, r.ids])
        created.push({ ...base, id })
      }
    }
    await audit(c, actor, 'payout.run', runId, { payouts: created.length, total: created.reduce((a, p) => a + p.amount, 0), memberships })
    return { runId, payouts: created, skipped, membershipsCharged: memberships }
  })
}

/**
 * @param {string} id @param {'approve' | 'paid' | 'cancel'} action @param {string} actor @param {string | null} [reference]
 */
export async function updatePayout(id, action, actor, reference = null) {
  return tx(async (c) => {
    const { rows } = await c.query('select * from payouts where id = $1 for update', [id])
    const p = rows[0]
    if (!p) throw new HttpError(404, 'Payout not found.')
    if (action === 'approve') {
      if (p.status !== 'draft') throw new HttpError(409, 'Only draft payouts can be approved.')
      await c.query(`update payouts set status = 'approved', approved_by = $2, approved_at = now() where id = $1`, [id, actor])
    } else if (action === 'paid') {
      if (p.status !== 'approved') throw new HttpError(409, 'Approve the payout before marking it paid.')
      if (!reference) throw new HttpError(400, 'Add the bank transfer reference.')
      await c.query(`update payouts set status = 'paid', paid_by = $2, paid_at = now(), bank_reference = $3 where id = $1`, [id, actor, reference])
      await c.query(
        `insert into ledger_entries (store_id, payout_id, type, store_delta, eligible_at, note, created_by) values ($1,$2,'payout',$3,now(),$4,$5)`,
        [p.store_id, id, -p.amount, `Bank ref ${reference}`, actor],
      )
    } else {
      if (!['draft', 'approved'].includes(p.status)) throw new HttpError(409, 'Paid payouts can’t be cancelled. Use an adjustment instead.')
      await c.query(`update payouts set status = 'cancelled', cancelled_at = now() where id = $1`, [id])
      // Its entries go back into the store's payable balance for the next run.
      await c.query('update ledger_entries set payout_id = null where payout_id = $1', [id])
    }
    await audit(c, actor, `payout.${action}`, id, reference ? { reference } : undefined)
  })
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

/** Balances per store (real money only, demo excluded). @param {string | null} storeId */
export async function balances(storeId = null) {
  const { rows } = await query(
    `select s.id as store_id, s.name, s.branch, s.status,
            coalesce(sum(l.store_delta), 0)::int as owed,
            coalesce(sum(l.store_delta) filter (where l.payout_id is null and l.type <> 'payout' and l.eligible_at <= now()), 0)::int as payable,
            coalesce(sum(l.store_delta) filter (where l.payout_id is null and l.type <> 'payout' and (l.eligible_at is null or l.eligible_at > now())), 0)::int as pending,
            coalesce(sum(l.store_delta) filter (where p.status in ('draft','approved') and l.type <> 'payout'), 0)::int as in_payout
       from stores s
       left join ledger_entries l on l.store_id = s.id and not l.is_demo
       left join payouts p on p.id = l.payout_id
      where ($1::text is null or s.id = $1)
      group by s.id order by s.name`,
    [storeId],
  )
  return rows
}

/**
 * Money totals for a period, from the ledger (by entry date).
 * @param {string} from ISO @param {string} to ISO @param {string | null} storeId
 */
export async function summary(from, to, storeId = null) {
  const { rows } = await query(
    `select
       coalesce(sum(store_delta) filter (where type = 'sale'), 0)::int as gross,
       coalesce(-sum(store_delta) filter (where type = 'cancellation'), 0)::int as cancelled,
       coalesce(-sum(store_delta) filter (where type = 'complaint_refund'), 0)::int as complaint_refunds,
       coalesce(sum(platform_delta) filter (where type in ('commission','commission_reversal')), 0)::int as commission,
       coalesce(-sum(platform_delta) filter (where type = 'goodwill_refund'), 0)::int as goodwill,
       coalesce(sum(platform_delta) filter (where type = 'membership_fee'), 0)::int as membership,
       coalesce(sum(store_delta) filter (where type = 'adjustment'), 0)::int as adjustments,
       coalesce(sum(vat), 0)::int as vat,
       coalesce(sum(platform_delta), 0)::int as platform_total,
       coalesce(sum(store_delta) filter (where type <> 'payout'), 0)::int as store_net,
       coalesce(-sum(store_delta) filter (where type = 'payout'), 0)::int as paid_out
     from ledger_entries where created_at >= $1 and created_at < $2 and ($3::text is null or store_id = $3)`,
    [from, to, storeId],
  )
  const m = rows[0]
  const { rows: o } = await query(
    `select
       count(*) filter (where status = 'collected')::int as collected,
       count(*) filter (where status = 'no_show')::int as no_show,
       count(*) filter (where status = 'cancelled' and cancelled_by = 'customer')::int as cancelled_customer,
       count(*) filter (where status = 'cancelled' and cancelled_by <> 'customer')::int as cancelled_store,
       coalesce(sum(quantity) filter (where status in ('collected','no_show')), 0)::int as bags,
       (select count(*)::int from complaints k where k.created_at >= $1 and k.created_at < $2 and ($3::text is null or k.store_id = $3)) as complaints
     from orders where closed_at >= $1 and closed_at < $2 and ($3::text is null or store_id = $3)`,
    [from, to, storeId],
  )
  const sold = m.gross - m.cancelled
  return {
    ...m,
    net_revenue: m.platform_total - m.vat,
    take_rate: sold > 0 ? m.commission / sold : 0,
    orders: o[0],
  }
}

/** Daily sales and Ngopu revenue for the last `days` Tirana days. @param {number} days @param {string | null} storeId */
export async function moneySeries(days, storeId = null) {
  const { rows } = await query(
    `with d as (
       select generate_series((now() at time zone $1)::date - ($2::int - 1), (now() at time zone $1)::date, interval '1 day')::date as day
     )
     select to_char(d.day, 'YYYY-MM-DD') as day,
            coalesce(sum(l.store_delta) filter (where l.type in ('sale','cancellation')), 0)::int as sales,
            coalesce(sum(l.platform_delta - l.vat), 0)::int as revenue,
            coalesce(sum(l.store_delta) filter (where l.type <> 'payout'), 0)::int as store_net
       from d
       left join ledger_entries l on (l.created_at at time zone $1)::date = d.day and ($3::text is null or l.store_id = $3)
      group by d.day order by d.day`,
    [TIMEZONE, days, storeId],
  )
  return rows
}

/** Month-by-month totals for one store (or everyone). @param {string | null} storeId @param {number} [months] */
export async function monthly(storeId, months = 12) {
  const { rows } = await query(
    `select to_char(created_at at time zone $1, 'YYYY-MM') as month,
            coalesce(sum(store_delta) filter (where type = 'sale'), 0)::int as gross,
            coalesce(-sum(store_delta) filter (where type in ('cancellation','complaint_refund')), 0)::int as refunds,
            coalesce(sum(platform_delta) filter (where type in ('commission','commission_reversal')), 0)::int as commission,
            coalesce(sum(vat), 0)::int as vat,
            coalesce(sum(platform_delta) filter (where type = 'membership_fee'), 0)::int as membership,
            coalesce(sum(store_delta) filter (where type <> 'payout'), 0)::int as store_net,
            coalesce(-sum(store_delta) filter (where type = 'payout'), 0)::int as paid_out
       from ledger_entries
      where ($2::text is null or store_id = $2) and created_at >= date_trunc('month', now() at time zone $1) - make_interval(months => $3 - 1)
      group by 1 order by 1 desc`,
    [TIMEZONE, storeId, months],
  )
  return rows
}

/** The ledger lines behind one payout, with order details. @param {string} payoutId */
export async function payoutStatement(payoutId) {
  const { rows: p } = await query(
    `select p.*, s.name as store_name, s.branch from payouts p join stores s on s.id = p.store_id where p.id = $1`,
    [payoutId],
  )
  if (!p[0]) throw new HttpError(404, 'Payout not found.')
  const { rows: lines } = await query(
    `select l.id, l.type, l.store_delta, l.note, l.created_at, l.order_id, o.quantity, o.unit_price, o.pickup_code, o.status as order_status
       from ledger_entries l left join orders o on o.id = l.order_id
      where l.payout_id = $1 and l.type <> 'payout' order by l.created_at, l.id`,
    [payoutId],
  )
  return { payout: p[0], lines }
}

/** Start and end (exclusive) of a Tirana calendar month, as ISO strings. @param {string} month YYYY-MM */
export async function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'Month must look like 2026-09.')
  const { rows } = await query(
    `select (($2 || '-01')::timestamp at time zone $1) as start, ((($2 || '-01')::date + interval '1 month')::timestamp at time zone $1) as end`,
    [TIMEZONE, month],
  )
  return { from: new Date(rows[0].start).toISOString(), to: new Date(rows[0].end).toISOString() }
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Qindarka → "1234.50" for spreadsheets. @param {number} q */
export const lek = (q) => (q / 100).toFixed(2)

/** @param {(string | number | null | undefined)[][]} rows */
export function toCsv(rows) {
  return (
    '﻿' + // BOM so Excel reads UTF-8 (ë, ç)
    rows.map((r) => r.map((v) => (v == null ? '' : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(',')).join('\r\n')
  )
}

export const TYPE_LABELS = {
  sale: 'Sale',
  cancellation: 'Cancellation refund',
  commission: 'Ngopu commission',
  commission_reversal: 'Commission returned',
  complaint_refund: 'Complaint refund',
  goodwill_refund: 'Refund paid by Ngopu',
  adjustment: 'Adjustment',
  membership_fee: 'Membership fee',
  payout: 'Payout to bank',
}
