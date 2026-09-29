// @ts-check
/**
 * Transactional email: account verification, password reset, order receipts and store cancellations.
 * Sent over SMTP (any provider: Zoho, Resend, Postmark, Gmail Workspace…) configured with
 *   SMTP_HOST, SMTP_PORT (default 465), SMTP_USER, SMTP_PASS, MAIL_FROM (default "Ngopu <hello@ngopu.app>").
 * Every send is recorded in email_log. Without SMTP settings nothing is sent and the log says so, so the
 * rest of the app works the same before email is set up.
 */
import nodemailer from 'nodemailer'
import { query } from './db.js'
import { TIMEZONE } from './time.js'

export const APP_URL = 'https://www.ngopu.app'

/** @type {import('nodemailer').Transporter | null} */
let transport = null

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 465
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // A slow mail server must not hold up a checkout or a sign-up for long.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 10_000,
    })
  }
  return transport
}

/**
 * Sends one email and records it. Never throws: a mail problem must not fail the action that triggered it.
 * @param {{ to: string, kind: string, subject: string, html: string, text: string }} m
 * @returns {Promise<boolean>} whether it was handed to the mail server
 */
export async function sendMail(m) {
  if (!mailConfigured()) {
    await log(m, 'not_configured', null, null)
    if (process.env.NODE_ENV !== 'production') console.info(`[mail not configured] ${m.kind} → ${m.to}\n${m.text}`)
    return false
  }
  try {
    const info = await getTransport().sendMail({
      from: process.env.MAIL_FROM || 'Ngopu <hello@ngopu.app>',
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
    })
    await log(m, 'sent', info.messageId ?? null, null)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('mail failed', m.kind, msg)
    await log(m, 'failed', null, msg.slice(0, 500))
    return false
  }
}

/** @param {{ to: string, kind: string, subject: string }} m @param {string} status @param {string | null} id @param {string | null} error */
async function log(m, status, id, error) {
  await query('insert into email_log (to_email, kind, subject, status, provider_id, error) values ($1,$2,$3,$4,$5,$6)', [
    m.to,
    m.kind,
    m.subject,
    status,
    id,
    error,
  ]).catch(() => {})
}

/* ------------------------------------------------------------------ templates */

/** @typedef {'sq' | 'en'} Lang */

/** @param {unknown} v @returns {Lang} */
export function lang(v) {
  return v === 'en' ? 'en' : 'sq'
}

/** @param {string} s */
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

/**
 * The shared layout: plain, readable in every mail client, brand colour only on the button.
 * @param {{ title: string, intro: string, rows?: [string, string][], button?: { label: string, href: string }, outro?: string, lang: Lang }} p
 */
function layout(p) {
  const rows = (p.rows ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#5b6b69;font-size:14px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join('')
  const html = `<!doctype html><html lang="${p.lang}"><body style="margin:0;background:#f6f3ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#10201e">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<p style="font-size:22px;font-weight:800;margin:0 0 20px;color:#00615f">ngopu<span style="color:#f5b400">.</span></p>
<div style="background:#fff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(p.title)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px">${esc(p.intro)}</p>
${rows ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px">${rows}</table>` : ''}
${p.button ? `<p style="margin:20px 0"><a href="${esc(p.button.href)}" style="display:inline-block;background:#00615f;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${esc(p.button.label)}</a></p>` : ''}
${p.outro ? `<p style="font-size:13px;line-height:1.5;color:#5b6b69;margin:16px 0 0">${esc(p.outro)}</p>` : ''}
</div>
<p style="font-size:12px;color:#5b6b69;margin:16px 4px">Ngopu · Tiranë · <a href="${APP_URL}" style="color:#5b6b69">ngopu.app</a></p>
</div></body></html>`
  const text = [
    p.title,
    '',
    p.intro,
    ...(p.rows ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(p.button ? ['', `${p.button.label}: ${p.button.href}`] : []),
    ...(p.outro ? ['', p.outro] : []),
    '',
    'Ngopu · ngopu.app',
  ].join('\n')
  return { html, text }
}

/** @param {number} lek */
const lekFmt = (lek) => `${new Intl.NumberFormat('sq-AL').format(lek)} L`

/** @param {Date | string | number} d @param {Lang} l */
function when(d, l) {
  return new Intl.DateTimeFormat(l === 'sq' ? 'sq-AL' : 'en-GB', { timeZone: TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

/** @param {Date | string | number} d */
function hm(d) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

/** @param {{ to: string, name: string, link: string, lang: Lang }} p */
export function verifyEmail(p) {
  const sq = p.lang === 'sq'
  const subject = sq ? 'Konfirmo emailin tënd në Ngopu' : 'Confirm your email for Ngopu'
  return sendMail({
    to: p.to,
    kind: 'verify_email',
    subject,
    ...layout({
      lang: p.lang,
      title: sq ? `Përshëndetje ${p.name}!` : `Hi ${p.name}!`,
      intro: sq
        ? 'Konfirmo që ky email është yti, që të të dërgojmë faturat dhe të rikuperosh llogarinë nëse harron fjalëkalimin.'
        : 'Confirm this email is yours so we can send your receipts and help you back in if you forget your password.',
      button: { label: sq ? 'Konfirmo emailin' : 'Confirm email', href: p.link },
      outro: sq ? 'Lidhja skadon pas 3 ditësh. Nëse nuk e krijove ti llogarinë, injoroje këtë email.' : 'The link expires in 3 days. If you didn’t create an account, ignore this email.',
    }),
  })
}

/** @param {{ to: string, name: string, link: string, lang: Lang }} p */
export function resetPassword(p) {
  const sq = p.lang === 'sq'
  return sendMail({
    to: p.to,
    kind: 'reset_password',
    subject: sq ? 'Ndrysho fjalëkalimin e Ngopu' : 'Reset your Ngopu password',
    ...layout({
      lang: p.lang,
      title: sq ? 'Ndrysho fjalëkalimin' : 'Reset your password',
      intro: sq ? `${p.name}, kliko më poshtë për të zgjedhur një fjalëkalim të ri.` : `${p.name}, tap below to choose a new password.`,
      button: { label: sq ? 'Zgjidh fjalëkalim të ri' : 'Choose a new password', href: p.link },
      outro: sq
        ? 'Lidhja skadon pas 1 ore dhe punon vetëm një herë. Nëse nuk e kërkove ti, injoroje: fjalëkalimi yt nuk ndryshon.'
        : 'The link expires in 1 hour and works once. If you didn’t ask for this, ignore it: your password stays the same.',
    }),
  })
}

/**
 * Receipt once an order is confirmed (card paid, or cash reserved).
 * @param {{ to: string, name: string, lang: Lang, order: any, storeName: string, storeAddress: string }} p
 */
export function orderReceipt(p) {
  const sq = p.lang === 'sq'
  const o = p.order
  const total = o.quantity * o.unit_price
  const cash = o.payment_method === 'cash'
  return sendMail({
    to: p.to,
    kind: 'receipt',
    subject: sq ? `Çanta jote te ${p.storeName} · kodi ${o.pickup_code}` : `Your order at ${p.storeName} · code ${o.pickup_code}`,
    ...layout({
      lang: p.lang,
      title: sq ? 'Çanta jote është e rezervuar!' : 'Your bag is reserved!',
      intro: sq ? `Faleminderit ${p.name}. Trego kodin në dyqan kur ta marrësh.` : `Thanks ${p.name}. Show the code at the store when you collect.`,
      rows: [
        [sq ? 'Kodi' : 'Pickup code', o.pickup_code],
        [sq ? 'Dyqani' : 'Store', p.storeName],
        [sq ? 'Adresa' : 'Address', p.storeAddress],
        [sq ? 'Merre' : 'Pick up', `${when(o.pickup_start, p.lang)}–${hm(o.pickup_end)}`],
        [sq ? 'Sasia' : 'Quantity', `${o.quantity} × Surprise Bag`],
        [cash ? (sq ? 'Paguaj në dyqan' : 'Pay at the store') : sq ? 'Paguar me kartë' : 'Paid by card', lekFmt(total)],
        [sq ? 'Porosia' : 'Order', o.id],
      ],
      button: { label: sq ? 'Hap porosinë' : 'Open your order', href: `${APP_URL}/app/orders/${o.id}` },
      outro: sq
        ? 'Mund ta anulosh deri 2 orë para fillimit të marrjes. Përmbajtja është surprizë; pyet stafin për alergjenët.'
        : 'You can cancel up to 2 hours before pickup starts. Contents are a surprise; ask the staff about allergens.',
    }),
  })
}

/**
 * The store cancelled a customer's order.
 * @param {{ to: string, name: string, lang: Lang, order: any, storeName: string, reason: string | null }} p
 */
export function storeCancelled(p) {
  const sq = p.lang === 'sq'
  const o = p.order
  const total = o.quantity * o.unit_price
  const cash = o.payment_method === 'cash'
  return sendMail({
    to: p.to,
    kind: 'store_cancelled',
    subject: sq ? `${p.storeName} anuloi porosinë tënde` : `${p.storeName} cancelled your order`,
    ...layout({
      lang: p.lang,
      title: sq ? 'Na vjen keq, porosia u anulua' : 'Sorry, your order was cancelled',
      intro: sq
        ? `${p.storeName} nuk mund ta përgatisë çantën tënde${p.reason ? `: “${p.reason}”` : '.'}`
        : `${p.storeName} can’t prepare your bag${p.reason ? `: “${p.reason}”` : '.'}`,
      rows: [
        [sq ? 'Porosia' : 'Order', o.id],
        cash ? [sq ? 'Pagesa' : 'Payment', sq ? 'Nuk të tarifuam' : 'You weren’t charged'] : [sq ? 'Rimbursim' : 'Refund', lekFmt(total)],
      ],
      button: { label: sq ? 'Gjej një çantë tjetër' : 'Find another bag', href: `${APP_URL}/app` },
      outro: cash ? undefined : sq ? 'Rimbursimi kthehet në kartën tënde brenda disa ditëve pune.' : 'The refund goes back to your card within a few working days.',
    }),
  })
}
