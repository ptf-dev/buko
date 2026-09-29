# Store privacy answers: Google Play Data safety & Apple App Privacy

Answers for the **Ngopu customer app** (`al.ngopu.app`) as the code works today. They match the public privacy policy at `/privacy` (`src/landing/privacyCopy.ts`).

The partner dashboard is a website, not part of the app, so it is **not** covered by these forms.

> Update these answers (and the policy) before shipping anything that changes data handling: real payments, push notifications, analytics or crash reporting.

## What the app actually sends to our server

| Data | Sent to server? | Where in code |
|---|---|---|
| Account: name, email, password (stored as a scrypt hash) | Yes, when the user signs up (required to reserve) | `api/_lib/routes.js` → `signup` |
| Random device ID (app-generated UUID) | Yes, with every order request | `src/lib/api.ts` → `deviceId()` |
| Push token (Firebase on Android, APNs on iPhone) | Yes, only while the "Pickup reminders" switch is on and the user is signed in; removed on log out or when the switch is off | `src/lib/push.ts` → `registerRemote()` |
| Orders (store, quantity, price, pickup window, pickup code, chosen payment method, status) | Yes | `api/_lib/routes.js` → `createOrder` |
| Ratings (1–5 stars + tags) | Yes, if the user rates | `rateOrder` |
| Location | **No**, used on the device only to sort stores by distance | `src/lib/native.ts` → `currentPosition()` |
| Diet preferences, favourites, chosen area | **No**, stored only on the device | `src/state/store.tsx` (localStorage) |
| Card / payment details | **Collected by POK, not by us**: the card form is POK's, inside the app. Declare it as data collected by a third party for payments | `src/components/CardPayment.tsx`, `api/_lib/payments/providers.js` |

Third parties that receive the device's IP address when the app is used: OpenStreetMap (map tiles), Photon by komoot (address search), Google Fonts and POK (card payments). Push notifications go through Google (Firebase Cloud Messaging) on Android and Apple (APNs) on iPhone; they carry the store name, the pickup time and the pickup code, never the person's name or email. Hosting is Vercel; the database is Neon. These are service providers, not "sharing" in either store's definition.

## Google Play Console → App content → Data safety

**Data collection and security**
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data be deleted? **Yes**. In the app: Profile → Delete account. Outside the app: email the contact address (see the policy's "How to delete your data" section).

**Data types**

| Category → type | Collected | Shared | Processed ephemerally? | Required or optional | Purposes |
|---|---|---|---|---|---|
| Personal info → Name | Yes | No | No | Required (needed to reserve) | App functionality, Account management |
| Personal info → Email address | Yes | No | No | Required (needed to reserve) | App functionality, Account management |
| Financial info → Purchase history | Yes | No | No | Required (needed to reserve) | App functionality |
| App activity → Other user-generated content (ratings) | Yes | No | No | Optional | App functionality |
| Device or other IDs → Device or other IDs (app-generated random ID; push token when reminders are on) | Yes | No | No | Required (push token optional) | App functionality, Fraud prevention, security, and compliance |

**Do not declare** (not collected under Google's definition, because it never leaves the device):
- Location: approximate or precise. The permission is requested, but the location is processed on the device only. Google's definition of "collected" is data transmitted off the device.

**Other Play Console items**
- **Privacy policy URL:** `https://www.ngopu.app/privacy`
- **Ads:** No, the app contains no ads.
- **App access:** browsing needs no login. Reserving needs a free account that reviewers can create themselves in the app (Profile → Create account), or give them a test login you created.
- **Account deletion:** required, and provided. In-app: Profile → Delete account. Web link for the Play form: `https://www.ngopu.app/privacy#delete` (explains in-app deletion and the email route).
- **Location permission** (asked in the declaration or review): "Used only on the device to show and sort nearby partner stores by distance. Not sent to our servers." Foreground only; no background location.
- **Content rating:** food marketplace, no user-to-user chat, no gambling or violence. Expected rating: Everyone / PEGI 3.
- **Target audience:** 16+ (see the policy's "Children" section). Not designed for children.

## Apple App Store Connect → App Privacy

- **Do you or your third-party partners collect data from this app?** Yes

| Apple data type | Linked to the user's identity? | Used for tracking? | Purposes |
|---|---|---|---|
| Contact Info → Name | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | No | App Functionality |
| Purchases → Purchase History | Yes | No | App Functionality |
| User Content → Other User Content (ratings) | Yes | No | App Functionality |
| Identifiers → User ID (account ID) | Yes | No | App Functionality |
| Identifiers → Device ID (random ID; push token when reminders are on) | Yes | No | App Functionality |

- **Account deletion (guideline 5.1.1(v)):** in-app, Profile → Delete account.

- **Location:** not collected. It is processed on the device only; Apple's definition covers data transmitted off the device.
- **Tracking (App Tracking Transparency):** No. The app doesn't track users across other companies' apps or websites.
- **Location permission text** (`NSLocationWhenInUseUsageDescription` in `ios/App/App/Info.plist`): "Ngopu uses your location to show surprise bags from stores near you."
- **Privacy policy URL:** `https://www.ngopu.app/privacy`

## Before you submit

1. In `src/config.ts`, set `LEGAL_ENTITY` to your registered company name and add its address to the policy's "Who we are" section. Check `CONTACT_EMAIL` is the address you want public.
2. Have the policy reviewed by someone who knows Albanian data-protection law before the public launch.
