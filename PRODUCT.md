# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The customer app also ships as Android and iOS apps through a Capacitor wrapper around the same web code, so its design language stays web, not native.

## Users

- **Customers** in Tirana who want good food cheaply and like the idea of cutting waste. They browse on their phones, reserve a Surprise Bag, and collect it at the store during a short pickup window, often on the way home.
- **Partner stores**: bakeries, restaurants, cafés, supermarkets, greengrocers and similar shops with unsold food at the end of the day. Staff use the dashboard at the counter or back office: set today's bag count and details, see who is coming, check pickup codes.
- **Buko ops team**: a small team of admins, all with the same full access. They review store applications, approve or suspend partners, and watch platform activity.

## Product Purpose

Buko connects stores that have surplus food with people nearby who will buy it at about a third of the price, so less food is thrown away. Success means bags get rescued: stores list surplus daily, customers reserve and collect, and both come back.

## Positioning

A local Too Good To Go for Tirana, priced in Lek, with Albanian partner stores. Customers can start in the browser without installing anything.

## Operating Context

- Customer flow: Discover or Browse (list/map, filters) → store page → reserve (quantity, payment method) → pickup code → swipe to collect at the counter → rate.
- Partner flow: stores apply from the landing page, an admin approves them, and then they log in to the dashboard to manage their Surprise Bag and validate pickups.
- Pickup windows are short daily time slots in local Tirana time (Europe/Tirane).
- Cancellation is allowed up to 2 hours before pickup starts.

## Capabilities and Constraints

- Stack: React + TypeScript + Vite + Tailwind CSS v4. Customer app at `/app`, landing page at `/`, dashboard at `/dashboard`. Deployed on Vercel.
- Backend: Vercel Functions (`api/`) with Postgres (Neon via Vercel). Email + password login for partners and admins. Customers are identified by a device token, not an account.
- Roles: `admin` (equal, full access) and `partner` (one store each).
- Onboarding: stores apply, then an admin approves (decided by the user).
- Payments are simulated. There are no real payment, payout or email-sending integrations yet (undecided).
- Currency is ALL (Lek). The UI copy is English.

## Brand Commitments

- Name: **Buko**, with the wordmark "buko." and a yellow dot.
- Brand colours already in use: teal `#00615f` (primary), dark teal `#00403e`, mint `#b9e4d4`, sun yellow `#ffc94d`, cream `#faf6ef`.
- The user asked for the landing page to feel "app style / Apple-like".

## Evidence on Hand

- Seed partner stores in `src/data/stores.ts` are **fictional** demo data.
- App screenshots are in `public/landing/`.
- There are no real testimonials, user counts, partner logos or press yet. Do not invent them.
- Industry figures used in copy: roughly a third of food is lost or wasted (UN FAO), and about 2.7 kg CO₂e is avoided per rescued bag.

## Product Principles

1. The bag must get rescued: every screen should make reserving (customers) or listing (partners) faster.
2. Counter-speed for partners: the key partner actions (set today's count, check a code) take seconds, even on a phone.
3. Honest numbers: show only real data, with clear empty states. Never fake traction.
4. One source of truth: customers, partners and admins see the same stock and orders.
