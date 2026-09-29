# Ngopu

Rescue delicious unsold food from local stores at a third of the price. Ngopu is a mobile-first web app modelled on Too Good To Go: stores list end-of-day **Surprise Bags**, customers reserve and pay in the app, then collect in the store's pickup window.

## Features

**Customer app**
- **Onboarding**: intro slides, your name, and location (GPS or city centre)
- **Discover**: carousels for *Collect now*, *Recommended*, *Save before it's too late*, *New*, *Nearby*, categories and vegetarian/vegan, plus category shortcuts
- **Browse**: search, list and map views (price pins on OpenStreetMap), filters for pickup day, food type, diet and sold-out, and sorting by relevance, distance, price or rating
- **Location and radius** picker (1–20 km)
- **Store page**: bag details, price and discount, pickup window with countdown, address and directions, allergen notice, review highlights, share, favourite
- **Checkout**: quantity (max 4 per order), payment method, terms confirmation
- **Orders**: pickup code, **swipe to collect**, add to calendar (.ics), receipt, cancel up to 2 h before pickup (the bag is restocked), then rate the bag with tags. A reserved order whose pickup window ends without collection is marked missed.
- **Favourites**
- **Profile**: impact stats (meals saved, money saved, CO₂e avoided), levels, notifications, diet preferences, invite friends, reset demo data

**Ngopu for Business** (`/partner`)
- Set how many bags are available today
- Validate a customer's pickup code at the counter
- See reservations, collected bags and revenue

## Partner & admin dashboard

`/dashboard` (`dashboard.html`, `src/dashboard/`), web only:

- **Partners** apply at `/dashboard/apply` (linked from the landing page) and get a login right away. Once an admin approves the store, they can:
  - set today's bag count and pause selling,
  - edit their Surprise Bag (price, pickup window, diet, allergens) with a live preview,
  - see reservations as they arrive and check customers' pickup codes,
  - edit their store profile and map location.
- **Admins** (a small team, all with equal access) see platform KPIs and a daily chart. They approve, reject, suspend or reactivate stores, edit any store's listing or profile, browse all orders, and manage the admin team. They can also create a login for a store (e.g. the seeded demo stores, or a store signed up by phone) and reset a store's password. They can also load or remove labelled sample orders to try the dashboard before launch.
- The first admin account is created at `/dashboard/setup`, which only works while no admin exists.

## Backend

`api/` holds a Vercel Function (plain ESM JavaScript, type-checked with `// @ts-check`) with a Postgres database (Neon via Vercel):

- Tables are created automatically on first request, and an empty database is seeded with the fictional demo stores (`api/_lib/seed-stores.json`, exported from `src/data/stores.ts` by `node scripts/export-seed.mjs`). In production (`VERCEL_ENV=production`) they are seeded suspended, and a migration suspends them in databases seeded earlier, so nobody can pay for a bag at a store that doesn't exist.
- Passwords are hashed with scrypt. Sessions are httpOnly cookies.
- Customers don't need an account: their orders are tied to a random device ID.
- Pickup windows are computed in Tirana time (Europe/Tirane) whatever the server's timezone.
- Reserving locks the bag row, so two customers can't buy the last bag.
- The customer app loads live stock and order status from the API. When no API is reachable (e.g. `npm run dev` without a database), it falls back to the built-in demo data.

### Connecting the database (once)

1. On vercel.com, open the **buko** project → **Storage** → **Create Database** → **Neon (Serverless Postgres)** → connect it to the project for all environments. This sets `DATABASE_URL`.
2. Redeploy, then open `/dashboard` and create the first admin account.

### Running the full stack locally

```bash
npm run build:web
DATABASE_URL=postgres://user@localhost:5432/buko npm run serve:local   # http://localhost:4180
```

## Website & landing page

Live at **https://www.ngopu.app**:

- `/` is the marketing landing page (`landing.html`, `src/landing/`). Its buttons link to the web app, the Android download and the App Store.
- `/app` is the web app (`index.html`, `src/App.tsx`).
- `/dashboard` is the partner & admin dashboard.
- `/api/*` is the backend.
- `/privacy` and `/terms` are the privacy policy and the terms of service (`src/landing/privacyCopy.ts`, `src/landing/termsCopy.ts`).

`npm run build:web` builds both pages and arranges them for Vercel (`scripts/web-layout.mjs`, `vercel.json`). Store links, the landing URL, the web app URL, the public contact email and the legal entity (`LEGAL_ENTITY`, `LEGAL_ADDRESS`, named in the privacy policy and terms) are set in `src/config.ts`. Until `APP_STORE_URL` / `PLAY_STORE_URL` are filled in, the landing page shows "Coming soon" for both stores (only release-signed builds from the stores are offered to the public; debug APKs are for testers). Screenshots used on the landing page are in `public/landing/`.

## Tech

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Leaflet / react-leaflet, lucide-react icons. Vercel Functions + Postgres (`pg`). Customer app state lives in a reducer, is saved to `localStorage`, and syncs with the API. Seed data is in `src/data/stores.ts`: 15 fictional stores in central Tirana, priced in Lek.

City, currency and default location are set in `src/config.ts`.

## Scripts

```bash
npm install
npm run dev       # start dev server
npm test          # unit tests (vitest)
npm run lint      # oxlint
npm run build     # type-check + production build
npm run build:web # production build laid out for the website (landing + /app)
```

## Native apps (Android & iOS)

The web app is wrapped with [Capacitor](https://capacitorjs.com). The native projects are in `android/` and `ios/`. App id is `al.buko.app`. The native builds use the device's location permission, system share sheet, status bar and a Ngopu splash screen and icon (sources are in `assets/`).

```bash
npm run cap:sync        # build the app + copy into native projects (run after every change)
npm run android:apk     # build android/app/build/outputs/apk/debug/app-debug.apk (testing only, never publish it)
npm run android:open    # open in Android Studio (run on emulator / device)
npm run ios:open        # open in Xcode (macOS only)
```

The project needs Node.js 22.12 or newer. Android needs JDK 21 and the Android SDK (platform 36). iOS needs macOS with Xcode. To regenerate icons and splash screens after changing `assets/`, run `npx @capacitor/assets generate`.

To make share links from the app open the web version, set `WEB_URL` in `src/config.ts` once the site is deployed.

## Cloud builds (Codemagic)

`codemagic.yaml` defines four workflows:

| Workflow | Output | Setup needed |
|---|---|---|
| `android-debug` | Test APK (runs on every push) | None |
| `ios-simulator` | Unsigned simulator build, to check the iOS app compiles | None |
| `android-release` | Signed `.aab` for Google Play | Upload a keystore named `ngopu_keystore` in Codemagic |
| `ios-release` | Signed `.ipa`, uploaded to TestFlight | Apple Developer account, App Store Connect API key in Codemagic named `codemagic`, and an app with bundle ID `al.ngopu.app` |

Android version codes come from Codemagic's `BUILD_NUMBER`. Release signing reads the `CM_KEYSTORE_*` variables that Codemagic sets (see `android/app/build.gradle`).

## Next steps for production

- Real payments (e.g. Stripe) and payouts to partners, with email receipts and password-reset emails
- Customer accounts (orders are currently tied to the device)
- Store photos, push notifications for favourites, and signed release builds for Google Play and the App Store

## Design tooling

[Impeccable](https://impeccable.style) is installed as a project skill in `.claude/skills/impeccable` (Apache-2.0), and product context is in `PRODUCT.md`. Its design-check hook is enabled in `.impeccable/config.json`. On a new machine, run `/impeccable hooks on` once in Claude Code so the hook is installed there too (the hook settings file is per-machine). To run the detector by hand:

```bash
.claude/skills/impeccable/scripts/impeccable detect src/dashboard src/landing
```

## Mobile testing with tapflow (Mac)

[tapflow](https://github.com/jo-duchan/tapflow) runs the real iOS Simulator and Android emulator in your browser and replays the test flows in `.tapflow/flows/`.

1. Install and start it: `npm install -g tapflow && tapflow setup && tapflow start`, then open http://localhost:4000 and create the admin account.
2. Build the apps:
   - Android: `npm run android:apk` → `android/app/build/outputs/apk/debug/app-debug.apk`
   - iOS: `npm run ios:sim-build` → `build/ngopu-ios-sim.app.zip`
3. Upload the build in tapflow's **App Center** and note its build id.
4. Run the flows on a device:
   ```sh
   npm run test:mobile -- --device "iPhone 17" --build <build-id>
   npm run test:mobile -- --device "Pixel_8" --build <android-build-id>
   ```

| Flow | What it checks |
|---|---|
| `guest-browse` | Intro → browse as a guest → open a store → Reserve asks you to log in. No side effects. |
| `account-lifecycle` | Sign up in onboarding → log out → log in → delete the account. Uses the live API with the test account `tapflow-e2e@ngopu.app` and deletes it at the end. |
| `cleanup-test-account` | Run once if `account-lifecycle` stopped halfway and left the test account behind. |

Failure screenshots go to `.tapflow/artifacts/`, the JUnit report to `build/tapflow-report.xml`. The flows don't reserve bags, because that would take real stock from live stores.
