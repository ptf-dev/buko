// @ts-check
/**
 * Branded email templates (Albanian and English). Table-based HTML with inline styles so they render the same in
 * Gmail, Apple Mail, Outlook and phone mail apps; every email also has a plain-text version.
 *
 * Images are hosted on the website (PNG, since most mail clients don't show SVG):
 *   /email/logo-light.png  – white wordmark for the green header
 *   /img/3d/<category>.png – the store's category illustration (or the store's own photo)
 */
import { TIMEZONE } from './time.js'

export const SITE = 'https://www.ngopu.app'
const APP = `${SITE}/app`
/** Support address printed in emails; the same one the privacy policy and terms name (src/config.ts CONTACT_EMAIL). */
const CONTACT = process.env.CONTACT_EMAIL || 'info@propfirmstech.com'

const C = {
  brand: '#00615f',
  brandDark: '#004a48',
  mint: '#e3f0ee',
  sun: '#ffc94d',
  cream: '#f6f3ec',
  ink: '#10201e',
  muted: '#5b6b69',
  line: '#e6e2d8',
  warn: '#fff4d6',
}
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

/** @typedef {'sq' | 'en'} Lang */

/** @param {unknown} s */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

/** @param {number} lek */
const lek = (lek) => `${new Intl.NumberFormat('sq-AL').format(lek)} L`

/** @param {Date | string | number} d @param {Lang} l */
const day = (d, l) =>
  new Intl.DateTimeFormat(l === 'sq' ? 'sq-AL' : 'en-GB', { timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))

/** @param {Date | string | number} d */
const hm = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(d))

/* ------------------------------------------------------------------ building blocks */

/** @param {string} label @param {string} href @param {'primary' | 'light'} [tone] */
function button(label, href, tone = 'primary') {
  const bg = tone === 'primary' ? C.brand : '#ffffff'
  const fg = tone === 'primary' ? '#ffffff' : C.brand
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0"><tr><td align="center" bgcolor="${bg}" style="border-radius:999px;${tone === 'light' ? `border:2px solid ${C.brand};` : ''}">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:${fg};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`
}

/** @param {string} html */
const p = (html, style = '') => `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.ink};${style}">${html}</p>`

/** @param {string} html */
const small = (html) => `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted}">${html}</p>`

/** @param {[string, string, boolean?][]} rows label, value, strong */
function detailRows(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 8px">${rows
    .map(
      ([k, v, strong]) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:14px;color:${C.muted}">${esc(k)}</td>
<td align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${FONT};font-size:${strong ? 16 : 14}px;font-weight:${strong ? 800 : 600};color:${C.ink}">${v}</td></tr>`,
    )
    .join('')}</table>`
}

/** Numbered steps with round badges. @param {[string, string][]} steps title, text */
function steps(steps) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 10px">${steps
    .map(
      ([t, x], i) => `<tr><td width="40" valign="top" style="padding:8px 0">
<div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${C.mint};color:${C.brand};font-family:${FONT};font-weight:800;font-size:14px;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:8px 0;font-family:${FONT}"><div style="font-size:15px;font-weight:700;color:${C.ink}">${esc(t)}</div><div style="font-size:14px;line-height:1.5;color:${C.muted}">${esc(x)}</div></td></tr>`,
    )
    .join('')}</table>`
}

/** A tinted box (info or warning). @param {string} html @param {'info' | 'warn'} [tone] */
function callout(html, tone = 'info') {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0"><tr><td style="padding:14px 16px;border-radius:14px;background:${tone === 'warn' ? C.warn : C.mint};font-family:${FONT};font-size:14px;line-height:1.5;color:${C.ink}">${html}</td></tr></table>`
}

/**
 * The shared frame: green header with the logo, white card, footer with links.
 * @param {{ lang: Lang, preheader: string, heading: string, hero?: string, body: string, footerNote: string }} o
 */
function frame(o) {
  const sq = o.lang === 'sq'
  const links = [
    [sq ? 'Hap aplikacionin' : 'Open the app', APP],
    [sq ? 'Privatësia' : 'Privacy', `${SITE}/privacy`],
    [sq ? 'Na shkruaj' : 'Contact us', `mailto:${CONTACT}`],
  ]
  return `<!doctype html>
<html lang="${o.lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(o.heading)}</title>
<style>
  @media (max-width:600px){ .card{padding:24px 20px !important} .h1{font-size:24px !important} .code{font-size:34px !important;letter-spacing:6px !important} }
  a{color:${C.brand}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td bgcolor="${C.brand}" style="background:${C.brand};border-radius:22px 22px 0 0;padding:22px 28px">
    <a href="${APP}" target="_blank"><img src="${SITE}/email/logo-light.png" width="151" height="44" alt="ngopu." style="display:block;border:0;height:44px;width:151px"></a>
  </td></tr>
  ${o.hero ?? ''}
  <tr><td class="card" bgcolor="#ffffff" style="background:#ffffff;padding:32px 32px 28px;border-radius:${o.hero ? '0' : '0'} 0 22px 22px">
    <h1 class="h1" style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;color:${C.ink}">${esc(o.heading)}</h1>
    ${o.body}
  </td></tr>
  <tr><td align="center" style="padding:22px 16px 6px;font-family:${FONT};font-size:13px;color:${C.muted}">
    ${links.map(([l, h]) => `<a href="${esc(h)}" style="color:${C.brand};font-weight:600;text-decoration:none">${esc(l)}</a>`).join(' &nbsp;·&nbsp; ')}
  </td></tr>
  <tr><td align="center" style="padding:8px 24px 24px;font-family:${FONT};font-size:12px;line-height:1.55;color:${C.muted}">
    ${esc(o.footerNote)}<br>Ngopu · Tiranë, Shqipëri
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

/** A full-width image under the header (store photo or category illustration). @param {string} src @param {string} alt @param {string} [bg] */
function heroImage(src, alt, bg = C.mint) {
  return `<tr><td align="center" bgcolor="${bg}" style="background:${bg};padding:24px 0 8px"><img src="${esc(src)}" width="150" height="150" alt="${esc(alt)}" style="display:block;border:0;width:150px;height:150px"></td></tr>`
}

/** @param {string} src @param {string} alt */
function heroPhoto(src, alt) {
  return `<tr><td style="padding:0;line-height:0"><img src="${esc(src)}" width="560" alt="${esc(alt)}" style="display:block;border:0;width:100%;max-width:560px;height:auto"></td></tr>`
}

/* ------------------------------------------------------------------ templates */

/**
 * @typedef {{ subject: string, html: string, text: string }} Email
 */

/** Welcome + confirm email. @param {{ name: string, link: string, lang: Lang }} d @returns {Email} */
export function welcomeVerify(d) {
  const sq = d.lang === 'sq'
  const heading = sq ? `Mirë se erdhe, ${d.name}!` : `Welcome to Ngopu, ${d.name}!`
  const subject = sq ? 'Mirë se erdhe në Ngopu · konfirmo emailin' : 'Welcome to Ngopu · confirm your email'
  const s = sq
    ? [
        ['Zbulo', 'Furrat, kafenetë dhe dyqanet pranë teje nxjerrin çdo ditë ushqimin që s’u shit.'],
        ['Rezervo', 'Zgjidh një Çantë Surprizë me rreth një të tretën e çmimit dhe paguaj në aplikacion.'],
        ['Merre', 'Shko te dyqani në orarin e marrjes, trego kodin dhe rrëshqit. Të bëftë mirë!'],
      ]
    : [
        ['Discover', 'Bakeries, cafés and shops near you list the food they didn’t sell, every day.'],
        ['Reserve', 'Pick a Surprise Bag at about a third of the price and pay in the app.'],
        ['Collect', 'Go to the store in the pickup window, show your code and swipe. Enjoy!'],
      ]
  const html = frame({
    lang: d.lang,
    preheader: sq ? 'Konfirmo emailin që të marrësh faturat dhe të rikuperosh llogarinë.' : 'Confirm your email to get receipts and keep your account safe.',
    heading,
    hero: heroImage(`${SITE}/img/3d/bakery.png`, ''),
    body:
      p(sq ? 'Faleminderit që iu bashkove Ngopu. Bashkë po shpëtojmë ushqim të mirë nga koshi, një çantë në një kohë.' : 'Thanks for joining Ngopu. Together we’re saving good food from the bin, one bag at a time.') +
      p(sq ? 'Konfirmo që ky email është yti:' : 'Please confirm this email is yours:', 'margin-bottom:6px') +
      button(sq ? 'Konfirmo emailin' : 'Confirm my email', d.link) +
      `<div style="height:14px"></div>` +
      p(`<strong>${sq ? 'Si funksionon' : 'How it works'}</strong>`, 'margin-bottom:4px') +
      steps(/** @type {[string, string][]} */ (s)) +
      small(
        sq
          ? `Lidhja vlen për 3 ditë. Nëse butoni nuk punon, hap: <a href="${esc(d.link)}" style="color:${C.brand};word-break:break-all">${esc(d.link)}</a>`
          : `The link works for 3 days. If the button doesn’t work, open: <a href="${esc(d.link)}" style="color:${C.brand};word-break:break-all">${esc(d.link)}</a>`,
      ),
    footerNote: sq ? 'E more këtë email sepse krijove një llogari në Ngopu. Nëse nuk ishe ti, injoroje.' : 'You got this email because an account was created on Ngopu. If it wasn’t you, ignore it.',
  })
  const text = [
    heading,
    '',
    sq ? 'Konfirmo emailin:' : 'Confirm your email:',
    d.link,
    '',
    ...s.map(([t, x], i) => `${i + 1}. ${t}: ${x}`),
    '',
    'Ngopu · ngopu.app',
  ].join('\n')
  return { subject, html, text }
}

/** @param {{ name: string, link: string, lang: Lang }} d @returns {Email} */
export function passwordReset(d) {
  const sq = d.lang === 'sq'
  const heading = sq ? 'Zgjidh një fjalëkalim të ri' : 'Choose a new password'
  const html = frame({
    lang: d.lang,
    preheader: sq ? 'Lidhja vlen për 1 orë dhe punon vetëm një herë.' : 'The link works for 1 hour, once.',
    heading,
    body:
      p(sq ? `Përshëndetje ${esc(d.name)}, dikush (me siguri ti) kërkoi të ndryshojë fjalëkalimin e llogarisë Ngopu.` : `Hi ${esc(d.name)}, someone (probably you) asked to reset your Ngopu password.`) +
      button(sq ? 'Zgjidh fjalëkalim të ri' : 'Choose a new password', d.link) +
      callout(
        sq
          ? '<strong>Nuk e kërkove ti?</strong> Injoroje këtë email: fjalëkalimi yt nuk ndryshon. Lidhja skadon pas 1 ore.'
          : '<strong>Didn’t ask for this?</strong> Ignore this email: your password stays the same. The link expires in 1 hour.',
        'warn',
      ) +
      small(
        sq
          ? `Nëse butoni nuk punon, hap: <a href="${esc(d.link)}" style="color:${C.brand};word-break:break-all">${esc(d.link)}</a>`
          : `If the button doesn’t work, open: <a href="${esc(d.link)}" style="color:${C.brand};word-break:break-all">${esc(d.link)}</a>`,
      ),
    footerNote: sq ? 'E more këtë email sepse u kërkua ndryshimi i fjalëkalimit.' : 'You got this email because a password reset was requested.',
  })
  return {
    subject: sq ? 'Ndrysho fjalëkalimin e Ngopu' : 'Reset your Ngopu password',
    html,
    text: [heading, '', sq ? 'Hap këtë lidhje (vlen 1 orë):' : 'Open this link (valid for 1 hour):', d.link, '', sq ? 'Nëse nuk e kërkove ti, injoroje.' : 'If you didn’t ask for this, ignore it.'].join('\n'),
  }
}

/** Security notice after a password change. @param {{ name: string, lang: Lang, when: Date }} d @returns {Email} */
export function passwordChanged(d) {
  const sq = d.lang === 'sq'
  const heading = sq ? 'Fjalëkalimi yt u ndryshua' : 'Your password was changed'
  const at = `${day(d.when, d.lang)}, ${hm(d.when)}`
  const html = frame({
    lang: d.lang,
    preheader: sq ? 'Nëse nuk ishe ti, na shkruaj menjëherë.' : 'If this wasn’t you, contact us right away.',
    heading,
    body:
      p(sq ? `${esc(d.name)}, fjalëkalimi i llogarisë Ngopu u ndryshua më ${esc(at)}. Për siguri, dole nga llogaria në të gjitha pajisjet.` : `${esc(d.name)}, your Ngopu password was changed on ${esc(at)}. For your safety you’ve been logged out on every device.`) +
      callout(
        sq
          ? `<strong>Nuk ishe ti?</strong> Na shkruaj menjëherë te <a href="mailto:${CONTACT}" style="color:${C.brand}">${CONTACT}</a>.`
          : `<strong>Wasn’t you?</strong> Write to us right away at <a href="mailto:${CONTACT}" style="color:${C.brand}">${CONTACT}</a>.`,
        'warn',
      ),
    footerNote: sq ? 'Njoftim sigurie për llogarinë tënde Ngopu.' : 'A security notice about your Ngopu account.',
  })
  return { subject: sq ? 'Fjalëkalimi i Ngopu u ndryshua' : 'Your Ngopu password was changed', html, text: [heading, '', at, '', `${CONTACT}`].join('\n') }
}

/**
 * @typedef {{ id: string, quantity: number, unit_price: number, unit_original_price: number, pickup_code: string,
 *   pickup_start: Date | string, pickup_end: Date | string, payment_method: string, cancel_reason?: string | null }} OrderRow
 * @typedef {{ name: string, address: string, category: string, lat?: number, lng?: number, photoUrl?: string | null, bagTitle?: string }} StoreInfo
 */

/** @param {StoreInfo} s */
const storeImage = (s) => (s.photoUrl ? heroPhoto(s.photoUrl, s.name) : heroImage(`${SITE}/img/3d/${s.category || 'other'}.png`, ''))

/** @param {StoreInfo} s */
const directions = (s) => (s.lat != null && s.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`)

/** Receipt with the pickup code. @param {{ name: string, lang: Lang, order: OrderRow, store: StoreInfo }} d @returns {Email} */
export function orderReceipt(d) {
  const sq = d.lang === 'sq'
  const o = d.order
  const total = o.quantity * o.unit_price
  const saved = o.quantity * (o.unit_original_price - o.unit_price)
  const cash = o.payment_method === 'cash'
  const window = `${day(o.pickup_start, d.lang)} · ${hm(o.pickup_start)}–${hm(o.pickup_end)}`
  const heading = sq ? 'Çanta jote është e rezervuar!' : 'Your bag is reserved!'
  const code = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr><td align="center" style="padding:18px 12px;border-radius:18px;background:${C.mint}">
<div style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.brand}">${sq ? 'Kodi i marrjes' : 'Pickup code'}</div>
<div class="code" style="margin-top:6px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:40px;font-weight:800;letter-spacing:10px;color:${C.brandDark}">${esc(o.pickup_code)}</div>
<div style="margin-top:6px;font-family:${FONT};font-size:14px;color:${C.ink}"><strong>${esc(window)}</strong></div>
</td></tr></table>`
  const html = frame({
    lang: d.lang,
    preheader: sq ? `Kodi ${o.pickup_code} · ${d.store.name} · ${window}` : `Code ${o.pickup_code} · ${d.store.name} · ${window}`,
    heading,
    hero: storeImage(d.store),
    body:
      p(sq ? `Faleminderit ${esc(d.name)}! Po shpëton ushqim nga koshi. Trego këtë kod në dyqan kur ta marrësh.` : `Thanks ${esc(d.name)}! You’re saving food from going to waste. Show this code at the store when you collect.`) +
      code +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px"><tr><td style="font-family:${FONT}">
<div style="font-size:18px;font-weight:800;color:${C.ink}">${esc(d.store.name)}</div>
<div style="margin-top:2px;font-size:14px;color:${C.muted}">${esc(d.store.address)} · <a href="${esc(directions(d.store))}" style="color:${C.brand};font-weight:600">${sq ? 'Udhëzimet' : 'Directions'}</a></div>
</td></tr></table>` +
      detailRows([
        [sq ? 'Porosia' : 'Order', `${o.quantity} × ${esc(d.store.bagTitle ?? (sq ? 'Çantë Surprizë' : 'Surprise Bag'))}`],
        [sq ? 'Vlera origjinale' : 'Original value', `<s style="color:${C.muted}">${lek(o.quantity * o.unit_original_price)}</s>`],
        [sq ? 'Kursen' : 'You save', `<span style="color:${C.brand}">${lek(saved)}</span>`],
        [cash ? (sq ? 'Paguaj në dyqan' : 'Pay at the store') : sq ? 'Paguar me kartë' : 'Paid by card', lek(total), true],
        [sq ? 'Nr. i porosisë' : 'Order number', `#${esc(o.id.toUpperCase())}`],
      ]) +
      (cash ? callout(sq ? `<strong>Para në dorë:</strong> merr me vete ${lek(total)} dhe paguaj dyqanin kur të japin çantën.` : `<strong>Cash at pickup:</strong> bring ${lek(total)} and pay the store when they hand you the bag.`, 'warn') : '') +
      button(sq ? 'Hap porosinë' : 'Open your order', `${APP}/orders/${o.id}`) +
      small(
        sq
          ? 'Mund ta anulosh deri 2 orë para fillimit të marrjes dhe merr të gjitha paratë mbrapsht. Përmbajtja është surprizë: nëse ke alergji, pyet stafin kur e merr.'
          : 'You can cancel up to 2 hours before pickup starts for a full refund. The contents are a surprise: if you have allergies, ask the staff when you collect.',
      ),
    footerNote: sq ? 'Kjo është fatura e porosisë tënde në Ngopu.' : 'This is the receipt for your Ngopu order.',
  })
  return {
    subject: sq ? `Çanta jote te ${d.store.name} · kodi ${o.pickup_code}` : `Your bag at ${d.store.name} · code ${o.pickup_code}`,
    html,
    text: [
      heading,
      '',
      `${sq ? 'Kodi i marrjes' : 'Pickup code'}: ${o.pickup_code}`,
      `${sq ? 'Merre' : 'Pick up'}: ${window}`,
      `${d.store.name}, ${d.store.address}`,
      `${o.quantity} × ${d.store.bagTitle ?? 'Surprise Bag'} · ${lek(total)} ${cash ? (sq ? '(paguaj në dyqan)' : '(pay at the store)') : sq ? '(paguar me kartë)' : '(paid by card)'}`,
      '',
      `${APP}/orders/${o.id}`,
    ].join('\n'),
  }
}

/** The store cancelled. @param {{ name: string, lang: Lang, order: OrderRow, store: StoreInfo }} d @returns {Email} */
export function storeCancelled(d) {
  const sq = d.lang === 'sq'
  const o = d.order
  const total = o.quantity * o.unit_price
  const cash = o.payment_method === 'cash'
  const heading = sq ? 'Na vjen keq, porosia u anulua' : 'Sorry, your order was cancelled'
  const reason = o.cancel_reason ? `<br><em style="color:${C.muted}">“${esc(o.cancel_reason)}”</em>` : ''
  const html = frame({
    lang: d.lang,
    preheader: sq ? `${d.store.name} nuk mund ta përgatisë çantën tënde.` : `${d.store.name} can’t prepare your bag.`,
    heading,
    hero: storeImage(d.store),
    body:
      p((sq ? `${esc(d.name)}, <strong>${esc(d.store.name)}</strong> nuk mund ta përgatisë çantën tënde këtë herë.` : `${esc(d.name)}, <strong>${esc(d.store.name)}</strong> can’t prepare your bag this time.`) + reason) +
      callout(
        cash
          ? sq
            ? '<strong>Nuk je tarifuar.</strong> Porosia ishte me para në dorë, prandaj nuk ke asgjë për të paguar.'
            : '<strong>You weren’t charged.</strong> It was a cash order, so there’s nothing to pay.'
          : sq
            ? `<strong>${lek(total)} po të kthehen</strong> në kartën me të cilën pagove, zakonisht brenda disa ditëve pune.`
            : `<strong>${lek(total)} is on its way back</strong> to the card you paid with, usually within a few working days.`,
      ) +
      p(sq ? 'Ka shumë çanta të tjera që presin të shpëtohen pranë teje.' : 'There are plenty of other bags waiting to be rescued near you.') +
      button(sq ? 'Gjej një çantë tjetër' : 'Find another bag', APP) +
      small(sq ? `Porosia #${esc(o.id.toUpperCase())}. Pyetje? Na shkruaj te ${CONTACT}.` : `Order #${esc(o.id.toUpperCase())}. Questions? Write to ${CONTACT}.`),
    footerNote: sq ? 'Njoftim për porosinë tënde në Ngopu.' : 'An update about your Ngopu order.',
  })
  return {
    subject: sq ? `${d.store.name} anuloi porosinë tënde` : `${d.store.name} cancelled your order`,
    html,
    text: [
      heading,
      '',
      `${d.store.name}${o.cancel_reason ? `: "${o.cancel_reason}"` : ''}`,
      cash ? (sq ? 'Nuk je tarifuar.' : 'You weren’t charged.') : sq ? `${lek(total)} po të kthehen në kartë.` : `${lek(total)} is being refunded to your card.`,
      '',
      APP,
    ].join('\n'),
  }
}
