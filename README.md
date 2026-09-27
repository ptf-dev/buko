# Buko

Rescue delicious unsold food from local stores at a third of the price. Buko is a mobile-first web app modelled on Too Good To Go: stores list end-of-day **Surprise Bags**, customers reserve and pay in the app, then collect in the store's pickup window.

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

**Buko for Business** (`/partner`)
- Set how many bags are available today
- Validate a customer's pickup code at the counter
- See reservations, collected bags and revenue

## Tech

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Leaflet / react-leaflet, lucide-react icons. State lives in a reducer and is saved to `localStorage`. Seed data is in `src/data/stores.ts`: 15 fictional stores in central Tirana, priced in Lek.

City, currency and default location are set in `src/config.ts`.

## Scripts

```bash
npm install
npm run dev       # start dev server
npm test          # unit tests (vitest)
npm run lint      # oxlint
npm run build     # type-check + production build
```

## Next steps for production

- Backend and API for stores, inventory and orders (replace `SEED_STORES` and the localStorage reducer)
- Real authentication and payments (e.g. Stripe), with email receipts
- Store photos, push notifications for favourites, and a native wrapper (Capacitor / Expo) for the app stores
