// @ts-check
/** HTTP endpoints for money: the partner Earnings page and the admin Finance pages. Logic lives in finance.js. */
import { timingSafeEqual } from 'node:crypto'
import { requireFinance, requireUser } from './auth.js'
import { recordError } from './monitoring.js'
import { notifyStoreCancelled, sendDueReminders } from './notify.js'
import { HttpError, query } from './db.js'
import {
  addAdjustment,
  balances,
  cancelPaymentRequest,
  createPaymentRequests,
  markRequestPaid,
  settlePaymentRequests,
  buildPayoutRun,
  COMPLAINT_REASONS,
  getSettings,
  lek,
  maskIban,
  monthly,
  monthRange,
  moneySeries,
  nextPayoutDate,
  payoutStatement,
  resolveComplaint,
  reviewBankDetails,
  settleNoShows,
  storeCancelOrder,
  storeTerms,
  submitBankDetails,
  summary,
  toCsv,
  TYPE_LABELS,
  updatePayout,
  updateSettings,
  updateTerms,
} from './finance.js'
import { expirePendingPayments, handleWebhook, markRefundDone, processRefunds, reconcile } from './payments/service.js'
import { iban, int, lekToQ, nipt, num, oneOf, optStr, str } from './validate.js'

/**
 * @typedef {import('./routes.js').Handler} Handler
 */

const DAY = 86_400_000

/** @param {number} days */
function lastDays(days) {
  const to = new Date(Date.now() + 60_000)
  return { from: new Date(to.getTime() - days * DAY).toISOString(), to: to.toISOString(), prevFrom: new Date(to.getTime() - 2 * days * DAY).toISOString() }
}

/** @param {string} name @param {string} text */
function download(name, text) {
  return {
    text,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  }
}

/** @param {any} b */
function billingView(b) {
  return {
    legalName: b?.legal_name ?? null,
    nipt: b?.nipt ?? null,
    iban: maskIban(b?.iban),
    verifiedAt: b?.bank_verified_at ?? null,
    pending: b?.pending_iban
      ? { legalName: b.pending_legal_name, nipt: b.pending_nipt, iban: b.pending_iban, submittedAt: b.pending_submitted_at }
      : null,
    payoutsPaused: !!b?.payouts_paused,
    acceptsCash: !!b?.accepts_cash,
    membershipPaidUntil: b?.membership_paid_until ?? null,
  }
}

/** @param {any} t */
function termsView(t) {
  return { commissionPercent: t.commissionBps / 100, commissionMinLek: t.commissionMin / 100, membershipFeeLek: t.membershipFee / 100, custom: t.custom }
}

/** @param {any} p */
function payoutView(p) {
  return {
    id: p.id,
    runId: p.run_id,
    storeId: p.store_id,
    storeName: p.store_name ?? undefined,
    branch: p.branch ?? undefined,
    amount: p.amount,
    status: p.status,
    legalName: p.legal_name,
    iban: maskIban(p.iban),
    bankReference: p.bank_reference,
    createdAt: p.created_at,
    approvedAt: p.approved_at,
    paidAt: p.paid_at,
    items: p.items ?? undefined,
  }
}

/** @param {any} k */
function complaintView(k) {
  return {
    id: k.id,
    orderId: k.order_id,
    storeId: k.store_id,
    storeName: k.store_name,
    customerName: k.customer_name ?? null,
    reason: k.reason,
    details: k.details,
    status: k.status,
    refundAmount: k.refund_amount,
    fundedBy: k.funded_by,
    resolutionNote: k.resolution_note,
    createdAt: k.created_at,
    resolvedAt: k.resolved_at,
    order: { quantity: k.quantity, unitPrice: k.unit_price, total: k.quantity * k.unit_price * 100, pickupCode: k.pickup_code, collectedAt: k.collected_at, cash: k.payment_method === 'cash' },
  }
}

const COMPLAINT_SELECT = `
  select k.*, s.name as store_name, u.name as customer_name, o.quantity, o.unit_price, o.pickup_code, o.collected_at, o.payment_method
    from complaints k join stores s on s.id = k.store_id join orders o on o.id = k.order_id left join users u on u.id = k.user_id`

/** @param {{ payout: any, lines: any[] }} st */
function statementCsv(st) {
  const p = st.payout
  return toCsv([
    ['Ngopu payout statement'],
    ['Store', `${p.store_name}${p.branch ? ` (${p.branch})` : ''}`],
    ['Legal name', p.legal_name],
    ['Payout', p.id],
    ['Status', p.status],
    ['Paid on', p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : ''],
    ['Bank reference', p.bank_reference],
    ['Total (L)', lek(p.amount)],
    [],
    ['Date', 'Type', 'Order', 'Pickup code', 'Bags', 'Unit price (L)', 'Amount (L)', 'Note'],
    ...st.lines.map((l) => [
      new Date(l.created_at).toISOString().slice(0, 10),
      TYPE_LABELS[/** @type {keyof typeof TYPE_LABELS} */ (l.type)] ?? l.type,
      l.order_id,
      l.pickup_code,
      l.quantity,
      l.unit_price,
      lek(l.store_delta),
      l.note,
    ]),
  ])
}

/* ------------------------------------------------------------------ */
/* Partner                                                             */
/* ------------------------------------------------------------------ */

/** @param {import('./auth.js').SessionUser} user */
function storeOf(user) {
  if (!user.storeId) throw new HttpError(403, 'No store is linked to this account.')
  return user.storeId
}

/** @type {Handler} */
async function partnerEarnings({ req }) {
  const user = await requireUser(req, 'partner')
  const storeId = storeOf(user)
  await settleNoShows()
  const s = await getSettings()
  const range = lastDays(30)
  await settlePaymentRequests()
  const [terms, bal, sum30, series, months, payouts, complaints, billing, requests] = await Promise.all([
    storeTerms({ query }, storeId, s),
    balances(storeId),
    summary(range.from, range.to, storeId),
    moneySeries(30, storeId),
    monthly(storeId),
    query(`select * from payouts where store_id = $1 and status <> 'cancelled' order by created_at desc limit 50`, [storeId]),
    query(`${COMPLAINT_SELECT} where k.store_id = $1 order by k.created_at desc limit 50`, [storeId]),
    query('select * from store_billing where store_id = $1', [storeId]),
    query(`select * from payment_requests where store_id = $1 and status <> 'cancelled' order by created_at desc limit 20`, [storeId]),
  ])
  return {
    body: {
      requests: requests.rows.map(requestView),
      ngopuBank: { legalName: s.ngopuLegalName, nipt: s.ngopuNipt, bank: s.ngopuBank, iban: s.ngopuIban },
      balance: bal[0],
      nextPayoutAt: nextPayoutDate(s),
      summary: sum30,
      series,
      monthly: months,
      payouts: payouts.rows.map(payoutView),
      complaints: complaints.rows.map(complaintView),
      billing: billingView(billing.rows[0]),
      terms: termsView(terms),
      policy: { holdDays: s.holdDays, minPayoutLek: s.minPayoutLek, payoutEveryDays: s.payoutEveryDays, membershipFreeMonths: s.membershipFreeMonths },
    },
  }
}

/** @type {Handler} */
async function partnerSubmitBilling({ req, body }) {
  const user = await requireUser(req, 'partner')
  const storeId = storeOf(user)
  await submitBankDetails(storeId, { legalName: str(body.legalName, 'Legal name', { max: 120 }), nipt: nipt(body.nipt), iban: iban(body.iban) }, user.id)
  return { body: { ok: true } }
}

/** @type {Handler} */
async function partnerCancelOrder({ req, params, body }) {
  const user = await requireUser(req, 'partner')
  const reason = str(body.reason, 'Reason', { max: 300 })
  await storeCancelOrder(storeOf(user), params.id, reason, user.id)
  await notifyStoreCancelled(params.id)
  await processRefunds()
  return { body: { ok: true } }
}

/** @type {Handler} */
async function partnerPayoutStatement({ req, params, url }) {
  const user = await requireUser(req, 'partner')
  const st = await payoutStatement(params.id)
  if (st.payout.store_id !== user.storeId) throw new HttpError(404, 'Payout not found.')
  if (url.searchParams.get('format') === 'csv') return download(`ngopu-payout-${params.id}.csv`, statementCsv(st))
  return { body: { payout: payoutView(st.payout), lines: st.lines } }
}

/** All money lines for one store in one month, as CSV. @type {Handler} */
async function partnerMonthCsv({ req, url }) {
  const user = await requireUser(req, 'partner')
  const month = str(url.searchParams.get('month'), 'Month', { max: 7 })
  return download(`ngopu-${month}.csv`, await ledgerCsv(month, storeOf(user)))
}

/** @param {string} month @param {string | null} storeId */
async function ledgerCsv(month, storeId) {
  const { from, to } = await monthRange(month)
  const { rows } = await query(
    `select l.*, s.name as store_name, o.quantity, o.unit_price, o.pickup_code
       from ledger_entries l join stores s on s.id = l.store_id left join orders o on o.id = l.order_id
      where l.created_at >= $1 and l.created_at < $2 and ($3::text is null or l.store_id = $3)
      order by l.created_at, l.id`,
    [from, to, storeId],
  )
  return toCsv([
    ['Date', 'Store', 'Type', 'Order', 'Pickup code', 'Bags', 'Unit price (L)', 'Store amount (L)', 'Ngopu amount (L)', 'VAT (L)', 'Payout', 'Note', 'Sample data'],
    ...rows.map((l) => [
      new Date(l.created_at).toISOString().replace('T', ' ').slice(0, 16),
      l.store_name,
      TYPE_LABELS[/** @type {keyof typeof TYPE_LABELS} */ (l.type)] ?? l.type,
      l.order_id,
      l.pickup_code,
      l.quantity,
      l.unit_price,
      lek(l.store_delta),
      lek(l.platform_delta),
      lek(l.vat),
      l.payout_id,
      l.note,
      l.is_demo ? 'yes' : '',
    ]),
  ])
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

/** @type {Handler} */
async function adminFinance({ req, url }) {
  await requireFinance(req)
  const days = int(url.searchParams.get('days') ?? '30', 'Days', 7, 365)
  await settleNoShows()
  const r = lastDays(days)
  const [current, previous, series, bal, counts, s] = await Promise.all([
    summary(r.from, r.to),
    summary(r.prevFrom, r.from),
    moneySeries(Math.min(days, 90), null),
    balances(null),
    query(`select
             (select count(*)::int from complaints where status = 'open') as open_complaints,
             (select count(*)::int from store_billing where pending_iban is not null) as pending_bank,
             (select count(*)::int from payouts where status = 'draft') as draft_payouts,
             (select count(*)::int from payouts where status = 'approved') as approved_payouts,
             (select count(*)::int from store_billing b join stores s on s.id = b.store_id where s.status = 'active' and b.iban is null) as missing_bank,
             (select count(*)::int from refunds where status = 'failed') as failed_refunds,
             (select count(*)::int from refunds where status = 'manual') as manual_refunds,
             (select count(*)::int from disputes where status = 'open') as open_disputes,
             (select count(*)::int from payment_requests where status = 'open') as open_requests,
             (select count(*)::int from payment_requests where status = 'open' and due_at < now()) as overdue_requests`),
    getSettings(),
  ])
  const totals = bal.reduce(
    (a, b) => ({ owed: a.owed + b.owed, payable: a.payable + b.payable, pending: a.pending + b.pending, inPayout: a.inPayout + b.in_payout }),
    { owed: 0, payable: 0, pending: 0, inPayout: 0 },
  )
  return {
    body: {
      days,
      summary: current,
      previous,
      series,
      balances: bal.filter((b) => b.owed !== 0 || b.in_payout !== 0),
      totals,
      counts: counts.rows[0],
      nextPayoutAt: nextPayoutDate(s),
      settings: s,
    },
  }
}

/** @type {Handler} */
async function adminPayouts({ req }) {
  await requireFinance(req)
  const { rows } = await query(
    `select p.*, s.name as store_name, s.branch,
            (select count(*)::int from ledger_entries l where l.payout_id = p.id and l.type <> 'payout') as items
       from payouts p join stores s on s.id = p.store_id order by p.created_at desc, s.name limit 500`,
  )
  return { body: { payouts: rows.map(payoutView) } }
}

/** @type {Handler} */
async function adminBuildRun({ req }) {
  const user = await requireFinance(req)
  return { status: 201, body: await buildPayoutRun(user.id) }
}

/** @param {'approve' | 'paid' | 'cancel'} action @returns {Handler} */
const payoutAction = (action) =>
  async function ({ req, params, body }) {
    const user = await requireFinance(req)
    const ref = action === 'paid' ? str(body.reference, 'Bank reference', { max: 80 }) : null
    await updatePayout(params.id, action, user.id, ref)
    return { body: { ok: true } }
  }

/** Approves every draft in a run at once. @type {Handler} */
async function adminApproveRun({ req, params }) {
  const user = await requireFinance(req)
  const { rows } = await query(`select id from payouts where run_id = $1 and status = 'draft'`, [params.id])
  for (const r of rows) await updatePayout(r.id, 'approve', user.id)
  return { body: { approved: rows.length } }
}

/**
 * Bank bulk-transfer file for the approved payouts in a run. Generic CSV; map the columns to your bank's
 * import format (Raiffeisen/BKT) when the account is opened.
 * @type {Handler}
 */
async function adminBankFile({ req, params }) {
  await requireFinance(req)
  const { rows } = await query(
    `select p.*, s.name as store_name from payouts p join stores s on s.id = p.store_id where p.run_id = $1 and p.status = 'approved' order by s.name`,
    [params.id],
  )
  if (!rows.length) throw new HttpError(409, 'Approve payouts in this run first.')
  return download(
    `ngopu-bank-${params.id}.csv`,
    toCsv([
      ['Beneficiary name', 'IBAN', 'Amount', 'Currency', 'Reference', 'Store'],
      ...rows.map((p) => [p.legal_name, p.iban, lek(p.amount), 'ALL', `Ngopu ${p.id}`, p.store_name]),
    ]),
  )
}

/** @type {Handler} */
async function adminPayoutStatement({ req, params, url }) {
  await requireFinance(req)
  const st = await payoutStatement(params.id)
  if (url.searchParams.get('format') === 'csv') return download(`ngopu-payout-${params.id}.csv`, statementCsv(st))
  return { body: { payout: payoutView(st.payout), lines: st.lines } }
}

/** @type {Handler} */
async function adminComplaints({ req, url }) {
  await requireFinance(req)
  const status = url.searchParams.get('status')
  const { rows } = await query(
    `${COMPLAINT_SELECT} where ($1::text is null or k.status = $1) order by (k.status = 'open') desc, k.created_at desc limit 300`,
    [status && ['open', 'refunded', 'rejected'].includes(status) ? status : null],
  )
  return { body: { complaints: rows.map(complaintView), reasons: COMPLAINT_REASONS } }
}

/** @type {Handler} */
async function adminResolveComplaint({ req, params, body }) {
  const user = await requireFinance(req)
  const action = oneOf(body.action, 'Action', /** @type {const} */ (['refund', 'reject']))
  const note = optStr(body.note, 'Note', { max: 500 })
  if (action === 'reject') {
    if (!note) throw new HttpError(400, 'Add a short note for the customer and store.')
    await resolveComplaint(params.id, user.id, { action, note })
  } else {
    await resolveComplaint(params.id, user.id, {
      action,
      amount: body.amount === undefined || body.amount === null ? undefined : lekToQ(body.amount, 'Refund', 1, 1_000_000),
      fundedBy: oneOf(body.fundedBy ?? 'store', 'Who pays', /** @type {const} */ (['store', 'ngopu'])),
      note,
    })
    await processRefunds()
  }
  return { body: { ok: true } }
}

/** Every store's money terms and bank details, for the admin. @type {Handler} */
async function adminBilling({ req }) {
  await requireFinance(req)
  const s = await getSettings()
  const { rows } = await query(
    `select s.id, s.name, s.branch, s.status, b.* from stores s left join store_billing b on b.store_id = s.id
      where s.status in ('active','suspended','pending') order by (b.pending_iban is not null) desc, s.name`,
  )
  const stores = await Promise.all(
    rows.map(async (r) => ({
      storeId: r.id,
      name: r.name,
      branch: r.branch,
      status: r.status,
      billing: billingView(r),
      terms: termsView(await storeTerms({ query }, r.id, s)),
    })),
  )
  return { body: { stores } }
}

/** @type {Handler} */
async function adminReviewBank({ req, params, body }) {
  const user = await requireFinance(req)
  await reviewBankDetails(params.id, oneOf(body.action, 'Action', /** @type {const} */ (['approve', 'reject'])), user.id)
  return { body: { ok: true } }
}

/** @type {Handler} */
async function adminUpdateTerms({ req, params, body }) {
  const user = await requireFinance(req)
  /** @type {Record<string, unknown>} */
  const u = {}
  if (body.commissionPercent !== undefined) u.commission_bps = body.commissionPercent === null ? null : Math.round(num(body.commissionPercent, 'Commission', 0, 100) * 100)
  if (body.commissionMinLek !== undefined) u.commission_min = body.commissionMinLek === null ? null : lekToQ(body.commissionMinLek, 'Minimum per bag', 0, 10_000)
  if (body.membershipFeeLek !== undefined) u.membership_fee = body.membershipFeeLek === null ? null : lekToQ(body.membershipFeeLek, 'Membership fee', 0, 1_000_000)
  if (body.membershipPaidUntil !== undefined) {
    const d = body.membershipPaidUntil === null ? null : new Date(str(body.membershipPaidUntil, 'Membership date', { max: 30 }))
    if (d && Number.isNaN(d.getTime())) throw new HttpError(400, 'Membership date is not valid.')
    u.membership_paid_until = d
  }
  if (body.payoutsPaused !== undefined) u.payouts_paused = !!body.payoutsPaused
  if (body.acceptsCash !== undefined) u.accepts_cash = !!body.acceptsCash
  await updateTerms(params.id, u, user.id)
  return { body: { ok: true } }
}

/** @type {Handler} */
async function adminAdjust({ req, params, body }) {
  const user = await requireFinance(req)
  await addAdjustment(params.id, lekToQ(body.amount, 'Amount', -1_000_000, 1_000_000), str(body.reason, 'Reason', { max: 300 }), user.id)
  return { status: 201, body: { ok: true } }
}

/** A store's balance and money lines, for the partner detail page. @type {Handler} */
async function adminStoreMoney({ req, params }) {
  await requireFinance(req)
  await settleNoShows()
  const s = await getSettings()
  const [bal, entries, billing, terms, payouts] = await Promise.all([
    balances(params.id),
    query(
      `select l.id, l.type, l.store_delta, l.platform_delta, l.vat, l.note, l.created_at, l.order_id, l.payout_id, l.is_demo, u.name as created_by_name
         from ledger_entries l left join users u on u.id = l.created_by where l.store_id = $1 order by l.created_at desc, l.id desc limit 100`,
      [params.id],
    ),
    query('select * from store_billing where store_id = $1', [params.id]),
    storeTerms({ query }, params.id, s),
    query(`select * from payouts where store_id = $1 order by created_at desc limit 20`, [params.id]),
  ])
  if (!bal[0]) throw new HttpError(404, 'Store not found.')
  return {
    body: {
      balance: bal[0],
      entries: entries.rows,
      billing: billingView(billing.rows[0]),
      terms: termsView(terms),
      payouts: payouts.rows.map(payoutView),
      defaults: { commissionPercent: s.commissionPercent, commissionMinLek: s.commissionMinLek, membershipFeeLek: s.membershipFeeLek },
    },
  }
}

/** @type {Handler} */
async function adminGetSettings({ req }) {
  await requireFinance(req)
  return { body: { settings: await getSettings() } }
}

/** @type {Handler} */
async function adminPatchSettings({ req, body }) {
  const user = await requireFinance(req)
  /** @type {Record<string, unknown>} */
  const p = {}
  if (body.vatRegistered !== undefined) p.vatRegistered = !!body.vatRegistered
  if (body.vatRatePercent !== undefined) p.vatRatePercent = num(body.vatRatePercent, 'VAT rate', 0, 30)
  if (body.commissionPercent !== undefined) p.commissionPercent = num(body.commissionPercent, 'Commission', 0, 100)
  if (body.commissionMinLek !== undefined) p.commissionMinLek = num(body.commissionMinLek, 'Minimum per bag', 0, 10_000)
  if (body.membershipFeeLek !== undefined) p.membershipFeeLek = num(body.membershipFeeLek, 'Membership fee', 0, 1_000_000)
  if (body.membershipFreeMonths !== undefined) p.membershipFreeMonths = int(body.membershipFreeMonths, 'Free months', 0, 60)
  if (body.holdDays !== undefined) p.holdDays = int(body.holdDays, 'Hold days', 0, 60)
  if (body.minPayoutLek !== undefined) p.minPayoutLek = num(body.minPayoutLek, 'Minimum payout', 0, 1_000_000)
  if (body.noShowGraceMinutes !== undefined) p.noShowGraceMinutes = int(body.noShowGraceMinutes, 'No-show grace', 0, 24 * 60)
  if (body.payoutEveryDays !== undefined) p.payoutEveryDays = int(body.payoutEveryDays, 'Payout frequency', 1, 62)
  if (body.bankChangeHoldHours !== undefined) p.bankChangeHoldHours = int(body.bankChangeHoldHours, 'Bank change hold', 0, 720)
  if (body.cashEnabled !== undefined) p.cashEnabled = !!body.cashEnabled
  if (body.cashMinCollected !== undefined) p.cashMinCollected = int(body.cashMinCollected, 'Collected orders for cash', 0, 100)
  if (body.cashMaxNoShows !== undefined) p.cashMaxNoShows = int(body.cashMaxNoShows, 'No-shows allowed', 0, 20)
  if (body.cashMaxOpen !== undefined) p.cashMaxOpen = int(body.cashMaxOpen, 'Open cash orders', 1, 10)
  if (body.feeRequestMinLek !== undefined) p.feeRequestMinLek = num(body.feeRequestMinLek, 'Minimum request', 0, 1_000_000)
  if (body.feeRequestDueDays !== undefined) p.feeRequestDueDays = int(body.feeRequestDueDays, 'Days to pay', 1, 90)
  if (body.ngopuLegalName !== undefined) p.ngopuLegalName = str(body.ngopuLegalName, 'Ngopu legal name', { max: 120 })
  if (body.ngopuNipt !== undefined) p.ngopuNipt = body.ngopuNipt ? nipt(body.ngopuNipt) : ''
  if (body.ngopuBank !== undefined) p.ngopuBank = optStr(body.ngopuBank, 'Bank', { max: 80 }) ?? ''
  if (body.ngopuIban !== undefined) p.ngopuIban = body.ngopuIban ? iban(body.ngopuIban) : ''
  if (!Object.keys(p).length) throw new HttpError(400, 'Nothing to update.')
  return { body: { settings: await updateSettings(p, user.id) } }
}

/**
 * Monthly exports for the accountant.
 * stores: one row per store, the basis for Ngopu's commission invoices. ledger: every money line. payouts: paid payouts.
 * @type {Handler}
 */
async function adminExport({ req, url }) {
  await requireFinance(req)
  const month = str(url.searchParams.get('month'), 'Month', { max: 7 })
  const type = oneOf(url.searchParams.get('type'), 'Export', /** @type {const} */ (['stores', 'ledger', 'payouts']))
  if (type === 'ledger') return download(`ngopu-ledger-${month}.csv`, await ledgerCsv(month, null))
  const { from, to } = await monthRange(month)
  if (type === 'payouts') {
    const { rows } = await query(
      `select p.*, s.name as store_name, b.nipt from payouts p join stores s on s.id = p.store_id left join store_billing b on b.store_id = p.store_id
        where p.status = 'paid' and p.paid_at >= $1 and p.paid_at < $2 order by p.paid_at`,
      [from, to],
    )
    return download(
      `ngopu-payouts-${month}.csv`,
      toCsv([
        ['Paid on', 'Payout', 'Store', 'Legal name', 'NIPT', 'IBAN', 'Amount (L)', 'Bank reference'],
        ...rows.map((p) => [new Date(p.paid_at).toISOString().slice(0, 10), p.id, p.store_name, p.legal_name, p.nipt, p.iban, lek(p.amount), p.bank_reference]),
      ]),
    )
  }
  const { rows } = await query(
    `select s.name, s.branch, b.legal_name, b.nipt,
            coalesce(sum(l.store_delta) filter (where l.type in ('sale','cash_sale')), 0)::int as gross,
            coalesce(sum(l.store_delta) filter (where l.type = 'cash_sale'), 0)::int as cash_sales,
            coalesce(sum(l.store_delta) filter (where l.type = 'fee_payment'), 0)::int as fee_payments,
            coalesce(-sum(l.store_delta) filter (where l.type = 'cancellation'), 0)::int as cancelled,
            coalesce(-sum(l.store_delta) filter (where l.type = 'complaint_refund'), 0)::int as complaint_refunds,
            coalesce(sum(l.platform_delta) filter (where l.type in ('commission','commission_reversal')), 0)::int as commission,
            coalesce(sum(l.vat) filter (where l.type in ('commission','commission_reversal')), 0)::int as commission_vat,
            coalesce(sum(l.platform_delta) filter (where l.type = 'membership_fee'), 0)::int as membership,
            coalesce(sum(l.vat) filter (where l.type = 'membership_fee'), 0)::int as membership_vat,
            coalesce(sum(l.store_delta) filter (where l.type = 'adjustment'), 0)::int as adjustments,
            coalesce(sum(l.store_delta) filter (where l.type not in ('payout','fee_payment')), 0)::int as store_net,
            coalesce(-sum(l.store_delta) filter (where l.type = 'payout'), 0)::int as paid_out,
            bool_or(l.is_demo) as has_demo
       from ledger_entries l join stores s on s.id = l.store_id left join store_billing b on b.store_id = l.store_id
      where l.created_at >= $1 and l.created_at < $2
      group by s.id, b.legal_name, b.nipt order by s.name`,
    [from, to],
  )
  return download(
    `ngopu-stores-${month}.csv`,
    toCsv([
      [`Ngopu monthly store summary ${month} (Tirana time)`],
      [],
      ['Store', 'Legal name', 'NIPT', 'Gross sales (L)', 'Of which cash at pickup (L)', 'Cancelled (L)', 'Complaint refunds (L)', 'Commission incl. VAT (L)', 'Commission VAT (L)',
        'Commission excl. VAT (L)', 'Membership incl. VAT (L)', 'Membership VAT (L)', 'Adjustments to store (L)', 'Store net (L)', 'Paid out (L)', 'Fees paid by transfer (L)', 'Includes sample data'],
      ...rows.map((r) => [
        `${r.name}${r.branch ? ` (${r.branch})` : ''}`,
        r.legal_name,
        r.nipt,
        lek(r.gross),
        lek(r.cash_sales),
        lek(r.cancelled),
        lek(r.complaint_refunds),
        lek(r.commission),
        lek(r.commission_vat),
        lek(r.commission - r.commission_vat),
        lek(r.membership),
        lek(r.membership_vat),
        lek(r.adjustments),
        lek(r.store_net),
        lek(r.paid_out),
        lek(r.fee_payments),
        r.has_demo ? 'yes' : '',
      ]),
    ]),
  )
}

/** @type {Handler} */
async function adminAudit({ req }) {
  await requireFinance(req)
  const { rows } = await query(
    `select a.id::text, a.action, a.target, a.details, a.created_at as "createdAt", u.name as actor
       from audit_log a left join users u on u.id = a.actor_id order by a.created_at desc limit 200`,
  )
  return { body: { entries: rows } }
}

/* ------------------------------------------------------------------ */
/* Payments (provider-ready), cash, payment requests                   */
/* ------------------------------------------------------------------ */

/** Webhook from the card payment provider. @type {Handler} */
async function providerWebhook({ req, params, raw }) {
  return { body: await handleWebhook(params.provider, req, raw ?? '') }
}

/**
 * The cron endpoints accept only the CRON_SECRET bearer (Vercel Cron sends it automatically). A missing secret
 * would make every run fail quietly, so it is also recorded as an error for Admin → Monitoring.
 * @param {Request} req
 */
async function requireCronSecret(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    await recordError({ source: 'api', message: 'CRON_SECRET is not set: the daily housekeeping (unpaid holds, no-shows, refunds, data retention) cannot run.' })
    throw new HttpError(401, 'Unauthorized.')
  }
  const given = req.headers.get('authorization') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(`Bearer ${secret}`)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'Unauthorized.')
}

/**
 * Daily housekeeping (Vercel Cron, see vercel.json): release unpaid holds, settle no-shows, retry refunds,
 * settle payment requests and reconcile yesterday with the provider. Protected by CRON_SECRET.
 * @type {Handler}
 */
async function dailyCron({ req }) {
  await requireCronSecret(req)
  const to = new Date()
  const from = new Date(to.getTime() - DAY)
  const [expired, noShows, refunds] = [await expirePendingPayments(true), await settleNoShows(true), await processRefunds()]
  const reminders = await sendDueReminders(true)
  await query("delete from login_attempts where created_at < now() - interval '2 days'")
  await query("delete from user_tokens where expires_at < now() - interval '2 days'")
  // Retention promised in the privacy policy.
  await query("delete from analytics_events where created_at < now() - interval '13 months'")
  await query("delete from error_events where resolved_at < now() - interval '90 days'")
  await settlePaymentRequests()
  const recon = await reconcile(from.toISOString(), to.toISOString())
  return { body: { expired, noShows, refunds, reminders, reconciliation: recon } }
}

/**
 * Frequent housekeeping for an external scheduler (e.g. cron-job.org every 5 minutes, with the CRON_SECRET
 * bearer): pickup reminders, unpaid holds and refunds on time even when the app is quiet. Protected like the
 * daily job.
 * @type {Handler}
 */
async function tickCron({ req }) {
  await requireCronSecret(req)
  return { body: { expired: await expirePendingPayments(true), reminders: await sendDueReminders(true), refunds: await processRefunds() } }
}

/** Payments, refunds and disputes for the admin (Finance → Payments). @type {Handler} */
async function adminPayments({ req }) {
  await requireFinance(req)
  await processRefunds()
  const [payments, refunds, disputes] = await Promise.all([
    query(
      `select p.id, p.order_id as "orderId", p.provider, p.provider_ref as "providerRef", p.amount, p.refunded, p.fee, p.status, p.failure, p.created_at as "createdAt",
              s.name as "storeName"
         from payments p join orders o on o.id = p.order_id join stores s on s.id = o.store_id
        where not o.is_demo order by p.created_at desc limit 200`,
    ),
    query(
      `select r.id, r.order_id as "orderId", r.amount, r.reason, r.status, r.attempts, r.last_error as "lastError", r.created_at as "createdAt", s.name as "storeName"
         from refunds r join orders o on o.id = r.order_id join stores s on s.id = o.store_id
        where not o.is_demo order by (r.status = 'failed') desc, r.created_at desc limit 200`,
    ),
    query(
      `select d.id, d.order_id as "orderId", d.amount, d.status, d.created_at as "createdAt", d.resolved_at as "resolvedAt", s.name as "storeName"
         from disputes d join stores s on s.id = d.store_id order by (d.status = 'open') desc, d.created_at desc limit 100`,
    ),
  ])
  return { body: { provider: process.env.PAYMENT_PROVIDER ?? 'simulated', payments: payments.rows, refunds: refunds.rows, disputes: disputes.rows } }
}

/** @type {Handler} */
async function adminRetryRefund({ req, params }) {
  const user = await requireFinance(req)
  const { rowCount } = await query(`update refunds set status = 'queued', updated_at = now() where id = $1 and status = 'failed'`, [params.id])
  if (!rowCount) throw new HttpError(409, 'Only failed refunds can be retried.')
  await query('insert into audit_log (actor_id, action, target) values ($1,$2,$3)', [user.id, 'refund.retry', params.id])
  await processRefunds()
  return { body: { ok: true } }
}

/** A refund the provider can't make by API (POK) was made by hand in its dashboard. @type {Handler} */
async function adminRefundDone({ req, params, body }) {
  const user = await requireFinance(req)
  await markRefundDone(params.id, typeof body.reference === 'string' ? body.reference.slice(0, 120) : '')
  await query('insert into audit_log (actor_id, action, target) values ($1,$2,$3)', [user.id, 'refund.manual', params.id])
  return { body: { ok: true } }
}

/** @type {Handler} */
async function adminReconcile({ req, body }) {
  await requireFinance(req)
  const days = int(body.days ?? 7, 'Days', 1, 90)
  const to = new Date()
  return { body: await reconcile(new Date(to.getTime() - days * DAY).toISOString(), to.toISOString()) }
}

/** The store turns cash at pickup on or off. @type {Handler} */
async function partnerCash({ req, body }) {
  const user = await requireUser(req, 'partner')
  await updateTerms(storeOf(user), { accepts_cash: !!body.acceptsCash }, user.id)
  return { body: { ok: true } }
}

/** @param {any} r */
function requestView(r) {
  return {
    id: r.id,
    number: r.number,
    storeId: r.store_id,
    storeName: r.store_name ?? undefined,
    amount: r.amount,
    status: r.status,
    dueAt: r.due_at,
    paidAt: r.paid_at,
    reference: r.reference,
    note: r.note,
    createdAt: r.created_at,
  }
}

/** @type {Handler} */
async function adminRequests({ req }) {
  await requireFinance(req)
  await settlePaymentRequests()
  const { rows } = await query(
    `select r.*, s.name as store_name from payment_requests r join stores s on s.id = r.store_id order by (r.status = 'open') desc, r.created_at desc limit 300`,
  )
  return { body: { requests: rows.map(requestView) } }
}

/** Creates requests for every store owing at least the minimum. @type {Handler} */
async function adminRunRequests({ req }) {
  const user = await requireFinance(req)
  return { status: 201, body: { created: await createPaymentRequests(user.id) } }
}

/** @type {Handler} */
async function adminStoreRequest({ req, params }) {
  const user = await requireFinance(req)
  const created = await createPaymentRequests(user.id, params.id)
  if (!created.length) throw new HttpError(409, 'This store doesn’t owe anything, or already has an open request.')
  return { status: 201, body: { request: created[0] } }
}

/** @type {Handler} */
async function adminRequestPaid({ req, params, body }) {
  const user = await requireFinance(req)
  const amount = body.amount === undefined || body.amount === null || body.amount === '' ? null : lekToQ(body.amount, 'Amount', 1, 10_000_000)
  await markRequestPaid(params.id, amount, str(body.reference, 'Bank reference', { max: 80 }), user.id)
  return { body: { ok: true } }
}

/** @type {Handler} */
async function adminRequestCancel({ req, params }) {
  const user = await requireFinance(req)
  await cancelPaymentRequest(params.id, user.id)
  return { body: { ok: true } }
}

/** @param {string} v */
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)

/**
 * Printable payment request (the store saves it as PDF from the browser). Not a fiscal invoice: Ngopu's
 * fiscalised commission invoice comes from the accountant / e-invoice system.
 * @param {string} id @param {string | null} storeId  restricts to one store (partner view)
 */
async function requestPage(id, storeId) {
  const { rows } = await query(
    `select r.*, s.name as store_name, s.branch, s.address, b.legal_name, b.nipt
       from payment_requests r join stores s on s.id = r.store_id left join store_billing b on b.store_id = r.store_id
      where r.id = $1 and ($2::text is null or r.store_id = $2)`,
    [id, storeId],
  )
  const r = rows[0]
  if (!r) throw new HttpError(404, 'Payment request not found.')
  const s = await getSettings()
  const { rows: lines } = await query(
    `select type, sum(-store_delta)::int as amount from ledger_entries
      where store_id = $1 and not is_demo and created_at <= $2 and type in ('commission','commission_reversal','membership_fee','adjustment','chargeback_hold','chargeback_release')
      group by type having sum(store_delta) <> 0 order by type`,
    [r.store_id, r.created_at],
  )
  const covered = lines.reduce((a, l) => a + l.amount, 0) - r.amount
  const d = (/** @type {any} */ v) => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const L = (/** @type {number} */ q) => `${q < 0 ? '−' : ''}${(Math.abs(q) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} L`
  const bank = s.ngopuIban
    ? `<p><b>${esc(s.ngopuLegalName)}</b>${s.ngopuNipt ? ` · NIPT ${esc(s.ngopuNipt)}` : ''}<br>${esc(s.ngopuBank)}<br>IBAN <b>${esc(s.ngopuIban.replace(/(.{4})/g, '$1 ').trim())}</b></p>`
    : `<p class="warn">Ngopu’s bank account will be added here. Contact us before paying.</p>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.number)} · Ngopu payment request</title>
<style>
  body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#10302d;background:#f4f2ec;margin:0;padding:24px}
  main{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:40px}
  h1{font-size:26px;margin:0 0 4px} .muted{color:#5b6765} .brand{color:#00615f;font-weight:800;font-size:22px}
  table{width:100%;border-collapse:collapse;margin:24px 0} td,th{padding:10px 0;border-bottom:1px solid #e6e3dc;text-align:left}
  td:last-child,th:last-child{text-align:right} .total td{font-weight:700;font-size:18px;border-bottom:0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px} .box{background:#f4f2ec;border-radius:12px;padding:16px}
  .warn{color:#7a5400} .status{display:inline-block;padding:2px 10px;border-radius:99px;background:#e1f3ec;color:#0b6b4f;font-weight:600;font-size:13px}
  @media print{body{background:#fff;padding:0} main{border-radius:0;padding:0} .noprint{display:none}}
</style></head><body><main>
<p class="brand">ngopu.</p>
<h1>Payment request ${esc(r.number)}</h1>
<p class="muted">Issued ${d(r.created_at)} · due ${d(r.due_at)}${r.status !== 'open' ? ` · <span class="status">${r.status === 'paid' ? 'Paid' : r.status === 'settled' ? 'Settled from payouts' : 'Cancelled'}</span>` : ''}</p>
<div class="grid"><div><p class="muted">For</p><p><b>${esc(r.legal_name ?? r.store_name)}</b>${r.nipt ? `<br>NIPT ${esc(r.nipt)}` : ''}<br>${esc(r.store_name)}${r.branch ? ` – ${esc(r.branch)}` : ''}<br>${esc(r.address)}</p></div>
<div><p class="muted">From</p><p><b>${esc(s.ngopuLegalName)}</b>${s.ngopuNipt ? `<br>NIPT ${esc(s.ngopuNipt)}` : ''}<br>Tirana, Albania</p></div></div>
<p>These are Ngopu fees your store owes, mostly commission on orders customers paid in cash at pickup, which Ngopu didn’t collect. Card sales are settled automatically in your payouts.</p>
<table><thead><tr><th>Fees owed to Ngopu (all time, up to ${d(r.created_at)})</th><th>Amount</th></tr></thead><tbody>
${lines.map((l) => `<tr><td>${esc(TYPE_LABELS[/** @type {keyof typeof TYPE_LABELS} */ (l.type)] ?? l.type)}</td><td>${L(l.amount)}</td></tr>`).join('')}
${covered > 0 ? `<tr><td class="muted">Already covered by your card sales</td><td class="muted">${L(-covered)}</td></tr>` : ''}
<tr class="total"><td>Amount to pay</td><td>${L(r.amount)}</td></tr></tbody></table>
<div class="box"><p style="margin-top:0"><b>Pay by bank transfer</b> with the reference <b>${esc(r.number)}</b> by ${d(r.due_at)}.</p>${bank}
<p class="muted" style="margin-bottom:0">If you don’t pay, the amount is taken from your next Ngopu payouts instead.</p></div>
<p class="muted" style="font-size:13px;margin-top:24px">This is a payment request, not a tax invoice. Ngopu’s fiscal invoice for commission is issued separately.</p>
<p class="noprint"><button onclick="print()">Print or save as PDF</button></p>
</main></body></html>`
  return { text: html, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
}

/** @type {Handler} */
async function partnerRequestPage({ req, params }) {
  const user = await requireUser(req, 'partner')
  return requestPage(params.id, storeOf(user))
}

/** @type {Handler} */
async function adminRequestPage({ req, params }) {
  await requireFinance(req)
  return requestPage(params.id, null)
}

/** @type {[string, string, Handler][]} */
export const FINANCE_ROUTES = [
  ['POST', 'payments/webhook/:provider', providerWebhook],
  ['GET', 'cron/daily', dailyCron],
  ['GET', 'cron/tick', tickCron],
  ['GET', 'admin/finance/payments', adminPayments],
  ['POST', 'admin/finance/refunds/:id/retry', adminRetryRefund],
  ['POST', 'admin/finance/refunds/:id/done', adminRefundDone],
  ['POST', 'admin/finance/reconcile', adminReconcile],
  ['PATCH', 'partner/cash', partnerCash],
  ['GET', 'partner/payment-requests/:id', partnerRequestPage],
  ['GET', 'admin/finance/requests', adminRequests],
  ['POST', 'admin/finance/requests/run', adminRunRequests],
  ['POST', 'admin/finance/requests/:id/paid', adminRequestPaid],
  ['POST', 'admin/finance/requests/:id/cancel', adminRequestCancel],
  ['GET', 'admin/finance/requests/:id', adminRequestPage],
  ['POST', 'admin/stores/:id/payment-request', adminStoreRequest],
  ['GET', 'partner/earnings', partnerEarnings],
  ['PATCH', 'partner/billing', partnerSubmitBilling],
  ['POST', 'partner/orders/:id/cancel', partnerCancelOrder],
  ['GET', 'partner/payouts/:id/statement', partnerPayoutStatement],
  ['GET', 'partner/statement', partnerMonthCsv],
  ['GET', 'admin/finance', adminFinance],
  ['GET', 'admin/finance/payouts', adminPayouts],
  ['POST', 'admin/finance/payouts/run', adminBuildRun],
  ['POST', 'admin/finance/payouts/:id/approve', payoutAction('approve')],
  ['POST', 'admin/finance/payouts/:id/paid', payoutAction('paid')],
  ['POST', 'admin/finance/payouts/:id/cancel', payoutAction('cancel')],
  ['GET', 'admin/finance/payouts/:id/statement', adminPayoutStatement],
  ['POST', 'admin/finance/runs/:id/approve', adminApproveRun],
  ['GET', 'admin/finance/runs/:id/bank-file', adminBankFile],
  ['GET', 'admin/finance/billing', adminBilling],
  ['GET', 'admin/finance/settings', adminGetSettings],
  ['PATCH', 'admin/finance/settings', adminPatchSettings],
  ['GET', 'admin/finance/export', adminExport],
  ['GET', 'admin/finance/audit', adminAudit],
  ['GET', 'admin/complaints', adminComplaints],
  ['POST', 'admin/complaints/:id/resolve', adminResolveComplaint],
  ['GET', 'admin/stores/:id/money', adminStoreMoney],
  ['POST', 'admin/stores/:id/billing/review', adminReviewBank],
  ['PATCH', 'admin/stores/:id/billing', adminUpdateTerms],
  ['POST', 'admin/stores/:id/adjustments', adminAdjust],
]
