# Production setup: payments, email, push, cron, security, monitoring

Everything below is configured with **Vercel environment variables** (Project → Settings → Environment
Variables, target *Production*), then a redeploy. Nothing is committed to the repo. Each part switches
itself on when its variables are present; without them the app keeps working and the feature stays off.

## 1. POK card payments

Built the same way as `ag-web-visionfx/pok` (`api/_lib/payments/providers.js`):

1. The server logs in with the SDK key pair (`/auth/sdk/login`, token cached ~8 h) and creates an SDK
   order for the exact order total (`/merchants/{id}/sdk-orders`). The price never comes from the phone.
2. The app loads `https://static.pokpay.io/public/dist/pokpayments/pok-payment.js` and shows
   `PokPayment.renderForm(...)` inside the checkout sheet. Card details go straight to POK.
3. When the form reports success, the server **reads the order back from POK**. If it's authorised but
   not captured, the server calls `guest-confirm`, then `capture`, then reads it again. Only then is the
   bag reserved and the receipt sent.
4. POK's webhook (`/api/payments/webhook/pok`) is treated as a hint and gets the same read-back, so a
   forged "paid" call does nothing.
5. Refunds: POK's SDK API has no refund call, so refunds show as **"Refund in POK"** in
   Finance → Payments. Refund the card in POK Business → *Pagesat online*, then press **Mark refunded**.

| Variable | Value |
|---|---|
| `PAYMENT_PROVIDER` | `pok` (until then payments stay simulated) |
| `POK_KEY_ID`, `POK_KEY_SECRET`, `POK_MERCHANT_ID` | POK Business → Pagesat online → API Keys (mark the secret *Sensitive*) |
| `POK_ENV` | `production` (default) or `staging` with staging keys |
| `POK_AMOUNT_IN_MINOR_UNITS` | leave unset until checked (see below) |

**Unit: settled — POK takes lek.** Checked on production on 29 Sep 2026: an order for `1` was refused
("minimum is 50 ALL"), an order for `50` was accepted and read back as 50 ALL. So leave
`POK_AMOUNT_IN_MINOR_UNITS` unset. POK's minimum order is 50 L, so bag prices start at 50 L.
If POK ever changes this, re-run the check (it creates an unpaid order that expires):

```sh
POK_KEY_ID=... POK_KEY_SECRET=... POK_MERCHANT_ID=... ./scripts/pok-check-amount.sh
```

Open the order it creates in POK Business. If it shows **1 L**, leave the variable unset. If it shows
**0.01 L**, set `POK_AMOUNT_IN_MINOR_UNITS=1`. The unpaid test order expires by itself.

## 2. Email (verification, password reset, receipts, store cancellations)

Any SMTP provider works (Zoho Mail, Resend, Postmark, Google Workspace…).

| Variable | Example |
|---|---|
| `SMTP_HOST` | `smtp.zoho.eu` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `hello@ngopu.app` |
| `SMTP_PASS` | an app password (Sensitive) |
| `MAIL_FROM` | `Ngopu <hello@ngopu.app>` |
| `CONTACT_EMAIL` | the support address printed in emails (default `info@propfirmstech.com`, the same as `CONTACT_EMAIL` in `src/config.ts`) |

Add SPF and DKIM records for the sending domain at your DNS provider so emails don't land in spam.
Admin → Monitoring shows how many emails were sent, failed or skipped ("Not set up").

## 3. Push notifications

**Web (browser / installed web app):** generate a key pair once and set both:

```sh
npx web-push generate-vapid-keys
```

| Variable | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key (Sensitive) |

The "Pickup reminders" switch appears in Profile once these are set.

**Android / iPhone apps:** the pickup reminder is scheduled on the phone itself (no server needed), so
it works without any of this. Remote pushes for *store cancellations* need a key per platform; the phone
registers its token only once the key for its platform is set (`GET /api/push/config` reports it).

*Android (Firebase Cloud Messaging):* create a Firebase project with an Android app for `al.ngopu.app`.

| Where | Variable | Value |
|---|---|---|
| Vercel | `FCM_SERVICE_ACCOUNT` | Firebase → Project settings → Service accounts → Generate new private key: the whole JSON (Sensitive) |
| Codemagic | `GOOGLE_SERVICES_JSON` | `base64 -i google-services.json` (Firebase → Project settings → Your apps). The Android workflows write it to `android/app/google-services.json`, which is not committed |

*iPhone (Apple Push Notification service, no Firebase needed):* in the Apple Developer portal, enable
**Push Notifications** and **Associated Domains** on the App ID `al.ngopu.app`, and create an APNs key
(Certificates, Identifiers & Profiles → Keys → Apple Push Notifications service). Download the `.p8` once.

| Variable | Value |
|---|---|
| `APNS_KEY_ID` | the 10-character key id |
| `APNS_TEAM_ID` | the Apple team id |
| `APNS_KEY` | the contents of the `.p8` file (Sensitive; newlines may be pasted as `\n`) |
| `APNS_BUNDLE_ID` | only if the bundle id ever differs from `al.ngopu.app` |
| `APNS_ENV` | `sandbox` only for Xcode debug builds on a device; leave unset for TestFlight and the App Store |

The phone reminders stay local, so only web subscriptions get the reminder push; cancellations go to
every device. Dead tokens (uninstalled app) are removed on the first failed send.

## 3b. Links that open the apps

Share links, email links and push notifications point at `https://www.ngopu.app/app/...`. The apps claim
those links (and `/store/:id`) once the two files in `public/.well-known/` name the real apps:

| File | Replace |
|---|---|
| `apple-app-site-association` | `TEAMID` with the Apple team id (`TEAMID.al.ngopu.app`) |
| `assetlinks.json` | `REPLACE_WITH_PLAY_SIGNING_SHA256` with the SHA-256 of the **Play app signing** certificate (Play Console → Test and release → App integrity), formatted `AA:BB:...`. For the Codemagic-signed test APK use the keystore's fingerprint instead (`keytool -list -v -keystore ngopu.keystore`) |

Redeploy the site afterwards. Until then the links open the website, exactly as before. The landing page,
the dashboard and the legal pages are never claimed by the apps.

**Timing:** Vercel's free plan runs crons once a day, so reminders are also sent whenever the app polls
(every minute while anyone has it open). For reminders on time even when it's quiet, add a free
external cron (e.g. cron-job.org) calling every 5 minutes:

```
GET https://www.ngopu.app/api/cron/tick
Authorization: Bearer <CRON_SECRET>
```

## 4. Housekeeping cron

| Variable | Value |
|---|---|
| `CRON_SECRET` | any long random string (`openssl rand -hex 32`, mark it *Sensitive*) |

Vercel Cron calls `GET /api/cron/daily` at 03:15 UTC with this secret as a Bearer token. The job releases unpaid holds, settles no-shows, retries refunds, reconciles with POK and applies the retention periods promised in the privacy policy. Without the variable every run fails with 401 and the failure shows up in Admin → Monitoring.

## 5. Security

- **Login limits:** 5 wrong passwords per account and 30 per IP in 15 minutes; 3 password-reset emails
  per address per hour; 20 sign-ups per IP per hour.
- **Two-factor login:** required for every admin (set up at next login, with 10 recovery codes),
  optional for partners (Store profile → Login security). A lost phone: another admin uses **Reset 2FA**
  in Team & settings.
- **Finance permission:** payouts, refunds, billing, finance settings and money reports need it.
  Admins who existed before this change keep it; new admins get it only if an admin with it ticks the box.

## 6. Monitoring

Admin → **Monitoring**: grouped errors from the app, dashboard and server (with stack traces), app
visits per day, the visit → order funnel, platforms, most viewed screens and email delivery. All
anonymous, stored in our own database; statistics are deleted after 13 months, fixed errors after 90 days.
