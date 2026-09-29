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
import * as T from './email-templates.js'

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
 * @returns {Promise<{ ok: boolean, error?: string }>} whether the mail server accepted it, and why not
 */
export async function sendMail(m) {
  if (!mailConfigured()) {
    await log(m, 'not_configured', null, null)
    if (process.env.NODE_ENV !== 'production') console.info(`[mail not configured] ${m.kind} → ${m.to}\n${m.text}`)
    return { ok: false, error: 'Email isn’t set up: SMTP_HOST, SMTP_USER and SMTP_PASS are needed.' }
  }
  try {
    const from = process.env.MAIL_FROM || `Ngopu <${process.env.SMTP_USER}>`
    const mail = { from, to: m.to, subject: m.subject, html: m.html, text: m.text }
    let info
    try {
      info = await getTransport().sendMail(mail)
    } catch (err) {
      // Zoho (and most providers) only send as the login mailbox or its aliases ("553 … not allowed to relay").
      // Fall back to the login mailbox, with replies still going to MAIL_FROM.
      if (!/\b553\b|not allowed|relay/i.test(err instanceof Error ? err.message : '')) throw err
      console.warn('mail: MAIL_FROM refused, sending as SMTP_USER. Add it as an alias in the mail provider to use it.')
      info = await getTransport().sendMail({ ...mail, from: `Ngopu <${process.env.SMTP_USER}>`, replyTo: from })
    }
    await log(m, 'sent', info.messageId ?? null, null)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('mail failed', m.kind, msg)
    await log(m, 'failed', null, msg.slice(0, 500))
    return { ok: false, error: msg.slice(0, 500) }
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

/* ------------------------------------------------------------------ emails (templates in email-templates.js) */

/** @param {{ to: string, name: string, link: string, lang: Lang }} p */
export function verifyEmail(p) {
  return sendMail({ to: p.to, kind: 'verify_email', ...T.welcomeVerify(p) })
}

/** @param {{ to: string, name: string, link: string, lang: Lang }} p */
export function resetPassword(p) {
  return sendMail({ to: p.to, kind: 'reset_password', ...T.passwordReset(p) })
}

/** @param {{ to: string, name: string, lang: Lang }} p */
export function passwordChanged(p) {
  return sendMail({ to: p.to, kind: 'password_changed', ...T.passwordChanged({ ...p, when: new Date() }) })
}

/** @param {{ to: string, name: string, lang: Lang, order: any, store: import('./email-templates.js').StoreInfo }} p */
export function orderReceipt(p) {
  return sendMail({ to: p.to, kind: 'receipt', ...T.orderReceipt(p) })
}

/** @param {{ to: string, name: string, lang: Lang, order: any, store: import('./email-templates.js').StoreInfo }} p */
export function storeCancelled(p) {
  return sendMail({ to: p.to, kind: 'store_cancelled', ...T.storeCancelled(p) })
}

/** A sample of the branded emails, sent from Admin → Monitoring to check the mail setup. @param {{ to: string, name: string, lang: Lang }} p */
export function testEmail(p) {
  const e = T.welcomeVerify({ name: p.name, lang: p.lang, link: `${APP_URL}/app` })
  return sendMail({ to: p.to, kind: 'test', subject: `[Test] ${e.subject}`, html: e.html, text: e.text })
}

/** Temporary SMTP diagnosis (DIAG_TOKEN): checks the login with the mail server. Never returns the password. */
export async function diagnoseSmtp() {
  const user = process.env.SMTP_USER ?? ''
  const from = process.env.MAIL_FROM ?? ''
  const out = {
    configured: mailConfigured(),
    host: process.env.SMTP_HOST ?? null,
    port: process.env.SMTP_PORT ?? null,
    user: user.replace(/^(.).*(@.*)$/, '$1***$2'),
    userHasSpaces: /\s/.test(user),
    passLength: (process.env.SMTP_PASS ?? '').length,
    passHasSpaces: /\s/.test(process.env.SMTP_PASS ?? ''),
    fromMatchesUser: from.toLowerCase().includes(user.toLowerCase().trim()),
    from: from.replace(/<(.).*(@.*)>/, '<$1***$2>'),
    verify: /** @type {string} */ ('not run'),
  }
  if (out.configured) {
    try {
      await getTransport().verify()
      out.verify = 'ok'
    } catch (err) {
      out.verify = err instanceof Error ? err.message : String(err)
    }
  }
  const { rows } = await query(`select kind, status, error, created_at from email_log order by created_at desc limit 8`)
  return { ...out, recent: rows }
}
