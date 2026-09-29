/** Money types for the Earnings and Finance pages. Amounts from the API are qindarka (1 L = 100). */

const lekFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** 123456 → "1,234.56 L"; whole amounts drop the decimals. */
export function money(q: number): string {
  return `${lekFormat.format(q / 100)} L`
}

/** A deduction: "−80 L", or "0 L" when there's nothing. */
export function minus(q: number): string {
  return q ? `−${money(q)}` : money(0)
}

/** Signed, for ledger lines: "+320 L" / "−80 L". */
export function signedMoney(q: number): string {
  if (q === 0) return money(0)
  return `${q > 0 ? '+' : '−'}${money(Math.abs(q))}`
}

export function shortDate(iso: string | number | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export interface Balance {
  store_id: string
  name: string
  branch: string | null
  status: string
  owed: number
  payable: number
  pending: number
  in_payout: number
}

export interface MoneySummary {
  gross: number
  cash_sales: number
  fee_payments: number
  processor_fees: number
  chargebacks: number
  cancelled: number
  complaint_refunds: number
  commission: number
  goodwill: number
  membership: number
  adjustments: number
  vat: number
  platform_total: number
  store_net: number
  paid_out: number
  net_revenue: number
  take_rate: number
  orders: { collected: number; collected_cash: number; no_show: number; cancelled_customer: number; cancelled_store: number; bags: number; complaints: number }
}

export interface MoneyDay {
  day: string
  sales: number
  revenue: number
  store_net: number
}

export interface MonthRow {
  month: string
  gross: number
  refunds: number
  commission: number
  vat: number
  membership: number
  store_net: number
  paid_out: number
}

export type PayoutStatus = 'draft' | 'approved' | 'paid' | 'cancelled'

export interface Payout {
  id: string
  runId: string
  storeId: string
  storeName?: string
  branch?: string | null
  amount: number
  status: PayoutStatus
  legalName: string | null
  iban: string | null
  bankReference: string | null
  createdAt: string
  approvedAt: string | null
  paidAt: string | null
  items?: number
}

export type ComplaintStatus = 'open' | 'refunded' | 'rejected'

export interface Complaint {
  id: string
  orderId: string
  storeId: string
  storeName: string
  customerName: string | null
  reason: string
  details: string | null
  status: ComplaintStatus
  refundAmount: number | null
  fundedBy: 'store' | 'ngopu' | null
  resolutionNote: string | null
  createdAt: string
  resolvedAt: string | null
  order: { quantity: number; unitPrice: number; total: number; pickupCode: string; collectedAt: string | null; cash?: boolean }
}

export const COMPLAINT_REASON_LABELS: Record<string, string> = {
  quality: 'Food quality',
  quantity: 'Too little food',
  wrong_items: 'Not what was described',
  store_closed: 'Store closed / no bag',
  staff: 'Staff or pickup experience',
  other: 'Something else',
}

export interface PaymentRequest {
  id: string
  number: string
  storeId: string
  storeName?: string
  amount: number
  status: 'open' | 'paid' | 'settled' | 'cancelled'
  dueAt: string
  paidAt: string | null
  reference: string | null
  note: string | null
  createdAt: string
}

export interface Billing {
  acceptsCash: boolean
  legalName: string | null
  nipt: string | null
  iban: string | null
  verifiedAt: string | null
  pending: { legalName: string; nipt: string; iban: string; submittedAt: string } | null
  payoutsPaused: boolean
  membershipPaidUntil: string | null
}

export interface Terms {
  commissionPercent: number
  commissionMinLek: number
  membershipFeeLek: number
  custom: boolean
}

export interface FinanceSettings {
  vatRegistered: boolean
  vatRatePercent: number
  commissionPercent: number
  commissionMinLek: number
  membershipFeeLek: number
  membershipFreeMonths: number
  holdDays: number
  minPayoutLek: number
  noShowGraceMinutes: number
  payoutEveryDays: number
  payoutAnchor: string
  bankChangeHoldHours: number
  cashEnabled: boolean
  cashMinCollected: number
  cashMaxNoShows: number
  cashMaxOpen: number
  feeRequestMinLek: number
  feeRequestDueDays: number
  ngopuLegalName: string
  ngopuNipt: string
  ngopuBank: string
  ngopuIban: string
}

export interface PartnerEarnings {
  requests: PaymentRequest[]
  ngopuBank: { legalName: string; nipt: string; bank: string; iban: string }
  balance: Balance
  nextPayoutAt: string
  summary: MoneySummary
  series: MoneyDay[]
  monthly: MonthRow[]
  payouts: Payout[]
  complaints: Complaint[]
  billing: Billing
  terms: Terms
  policy: { holdDays: number; minPayoutLek: number; payoutEveryDays: number; membershipFreeMonths: number }
}

export interface AdminFinanceOverview {
  days: number
  summary: MoneySummary
  previous: MoneySummary
  series: MoneyDay[]
  balances: Balance[]
  totals: { owed: number; payable: number; pending: number; inPayout: number }
  counts: {
    open_complaints: number
    pending_bank: number
    draft_payouts: number
    approved_payouts: number
    missing_bank: number
    failed_refunds: number
    manual_refunds: number
    open_disputes: number
    open_requests: number
    overdue_requests: number
  }
  nextPayoutAt: string
  settings: FinanceSettings
}

export interface LedgerLine {
  id: string
  type: string
  store_delta: number
  platform_delta: number
  vat: number
  note: string | null
  created_at: string
  order_id: string | null
  payout_id: string | null
  is_demo: boolean
  created_by_name: string | null
}

export const LEDGER_LABELS: Record<string, string> = {
  sale: 'Sale',
  cancellation: 'Cancellation refund',
  commission: 'Ngopu commission',
  commission_reversal: 'Commission returned',
  complaint_refund: 'Complaint refund',
  goodwill_refund: 'Refund paid by Ngopu',
  adjustment: 'Adjustment',
  membership_fee: 'Membership fee',
  payout: 'Payout to bank',
  cash_sale: 'Cash sale',
  cash_collected: 'Cash kept by the store',
  fee_payment: 'Fee payment to Ngopu',
  chargeback_hold: 'Disputed payment (held)',
  chargeback_release: 'Dispute won (released)',
  processor_fee: 'Card processing fee',
}

/** Sold value: what customers kept (sales minus cancellations). */
export const sold = (s: MoneySummary) => s.gross - s.cancelled
