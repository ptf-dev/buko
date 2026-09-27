# Store privacy answers: Google Play Data safety & Apple App Privacy

Answers for the **Ngopu customer app** (`al.ngopu.app`) as the code works today. They match the public privacy policy at `/privacy` (`src/landing/privacyCopy.ts`).

The partner dashboard is a website, not part of the app, so it is **not** covered by these forms.

> Update these answers (and the policy) before shipping anything that changes data handling: real payments, push notifications, analytics, crash reporting or customer accounts.

## What the app actually sends to our server

| Data | Sent to server? | Where in code |
|---|---|---|
| Random device ID (app-generated UUID) | Yes, with every order request | `src/lib/api.ts` → `deviceId()` |
| Orders (store, quantity, price, pickup window, pickup code, chosen payment method, status) | Yes | `api/_lib/routes.js` → `createOrder` |
| Ratings (1–5 stars + tags) | Yes, if the user rates | `rateOrder` |
| Location | **No**, used on the device only to sort stores by distance | `src/lib/native.ts` → `currentPosition()` |
| Name / email typed in the profile, diet preferences, favourites | **No**, stored only on the device | `src/state/store.tsx` (localStorage) |
| Card / payment details | **No**, payments are simulated in the beta | `src/pages/CheckoutSheet.tsx` |

Third parties that receive the device's IP address when the app is used: OpenStreetMap (map tiles) and Google Fonts. Hosting is Vercel; the database is Neon. These are service providers, not "sharing" in either store's definition.

## Google Play Console → App content → Data safety

**Data collection and security**
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data be deleted? **Yes**. Users email the contact address with their order number (see the policy's "How to delete your data" section).

**Data types**

| Category → type | Collected | Shared | Processed ephemerally? | Required or optional | Purposes |
|---|---|---|---|---|---|
| Financial info → Purchase history | Yes | No | No | Required (needed to reserve) | App functionality |
| App activity → Other user-generated content (ratings) | Yes | No | No | Optional | App functionality |
| Device or other IDs → Device or other IDs (app-generated random ID) | Yes | No | No | Required | App functionality, Fraud prevention, security, and compliance |

**Do not declare** (not collected under Google's definition, because it never leaves the device):
- Location: approximate or precise. The permission is requested, but the location is processed on the device only. Google's definition of "collected" is data transmitted off the device.
- Personal info: name, email address. Typed into the profile, kept on the device.

**Other Play Console items**
- **Privacy policy URL:** `https://buko-five.vercel.app/privacy` (update when the domain changes)
- **Ads:** No, the app contains no ads.
- **App access:** no login needed; all features are available without special access.
- **Account deletion:** not required. The app doesn't let users create accounts. (Partner accounts are created on the website.)
- **Location permission** (asked in the declaration or review): "Used only on the device to show and sort nearby partner stores by distance. Not sent to our servers." Foreground only; no background location.
- **Content rating:** food marketplace, no user-to-user chat, no gambling or violence. Expected rating: Everyone / PEGI 3.
- **Target audience:** 16+ (see the policy's "Children" section). Not designed for children.

## Apple App Store Connect → App Privacy

- **Do you or your third-party partners collect data from this app?** Yes

| Apple data type | Linked to the user's identity? | Used for tracking? | Purposes |
|---|---|---|---|
| Purchases → Purchase History | No (tied to a random device ID only, no name or account) | No | App Functionality |
| User Content → Other User Content (ratings) | No | No | App Functionality |
| Identifiers → Device ID | No | No | App Functionality |

- **Location:** not collected. It is processed on the device only; Apple's definition covers data transmitted off the device.
- **Tracking (App Tracking Transparency):** No. The app doesn't track users across other companies' apps or websites.
- **Location permission text** (`NSLocationWhenInUseUsageDescription` in `ios/App/App/Info.plist`): "Ngopu uses your location to show surprise bags from stores near you."
- **Privacy policy URL:** `https://buko-five.vercel.app/privacy`

## Before you submit

1. In `src/config.ts`, set `LEGAL_ENTITY` to your registered company name and add its address to the policy's "Who we are" section. Check `CONTACT_EMAIL` is the address you want public.
2. When the new domain (e.g. ngopu.app) is live, update `LANDING_URL` and the privacy-policy URL in both consoles.
3. Have the policy reviewed by someone who knows Albanian data-protection law before the public launch.
