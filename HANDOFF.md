# Handoff: Two Rivers Living site

The full spec is the "Direct Booking Website Build Plan" doc. Export it as Markdown and save it in this folder as `PLAN.md`.
This file records what is already built and the decisions made after the plan was written.

## Changes to the plan (these override PLAN.md)

- **Booking mode switch.** Stripe can't verify the business until the site is live, so the site must work without Stripe.
  If `STRIPE_SECRET_KEY` is not set, the Reserve button sends a **booking request** instead of taking payment.
  The guest gets a "request received" email and the hosts get an alert. With the key set, it switches to instant booking.
- **Smoobu auth.** The legacy single `Api-Key` header stops working on 31 Oct 2026. Use HMAC signing:
  API key and secret from Smoobu → Settings → Advanced → API Keys. This is already implemented in `src/lib/pms/smoobu.ts`.
  The property ID is looked up with `GET /api/apartments` and stored in the `SMOOBU_APARTMENT_IDS` secret as JSON.
- **Hold length is 30 min, not 15.** That is Stripe Checkout's minimum session expiry.
- **Property data** lives in `src/data/properties.ts` (a TS file, not content collections).
- **Phone** is a placeholder in `src/config/site.ts` until WhatsApp Business is set up. **ICO** registration and **Stripe** verification are still outstanding.
- The GitHub repo is `tworiversliving/tworiversliving-site`.

## Built so far (Phase 1 and part of Phase 2)

| File | Status |
| --- | --- |
| package.json, astro.config.mjs, wrangler.jsonc, tsconfig.json | Done. Astro 5.18.2, @astrojs/cloudflare 12.6.13, custom worker entry `src/worker.ts` (not yet written) |
| migrations/0001_init.sql | Done: bookings, holds, enquiries, events |
| public/brand/* , public/favicon.svg | Done: cropped logos, light versions for the dark footer, symbol mark |
| src/env.d.ts | Done: Env bindings and secrets |
| src/config/site.ts, booking.ts, rates.ts | Done: business details, booking rules, extras, fallback rates |
| src/data/properties.ts | Done: Stoke Newington flat with all copy, photos list, rules. Reviews empty until real ones are added |
| src/lib/dates.ts | Done |
| src/lib/pms/* | Done: types, Smoobu (HMAC), iCal and mock adapters, factory |
| src/lib/availability.ts | Done: calendar (PMS + D1 bookings + holds), getQuote, extras eligibility, gbp() |
| src/lib/db.ts | Done: row types, refs, status updates, event log |
| src/lib/email.ts | Done: Resend sender, all guest and host templates, Slack notify |

## Still to build

**Phase 1 remainder (new chat):** global.css tokens, Base layout, Header, Footer, Photo (placeholder if the file is missing), PropertyCard, and all content pages from the plan's sitemap. Pages are static, using copy from `src/data/properties.ts`.

**Phase 2 remainder (new chat):** `src/worker.ts` (fetch through the Astro handler, plus a `scheduled` cron handler), `src/lib/stripe.ts`, `src/lib/finalize.ts`, `src/lib/turnstile.ts`, and these API routes: `/api/config`, `/api/availability`, `/api/quote`, `/api/checkout`, `/api/stripe-webhook`, `/api/enquiry`, `/ical/[slug].ics`. Then the pages that use them: the BookingPanel calendar, `/book/[slug]`, `/book/confirmed` and `/booking` (manage and cancel).

**Phase 3 (new chat):** legal pages, structured data, OG images, README with deploy steps.

**Phase 4 (new chat):** tests with the mock PMS, Lighthouse, deploy and launch checklist.

## Prompts for each new chat

Phase 1: `Read HANDOFF.md and PLAN.md. Finish Phase 1 only: design tokens in src/styles/global.css, Base layout, Header, Footer and all static content pages, using src/data/properties.ts and src/config/*. Follow PLAN.md's "Keeping it human" rules. Don't touch src/lib. Run npm run build at the end.`

Phase 2: `Read HANDOFF.md and PLAN.md. Build the Phase 2 remainder listed in HANDOFF.md, using the existing src/lib modules. Bookings must fall back to request mode when STRIPE_SECRET_KEY is unset. Test the full flow locally with PMS_PROVIDER=mock and wrangler dev.`

Phase 3: `Read HANDOFF.md and PLAN.md. Do Phase 3: legal pages (terms, privacy, cookies, house rules), JSON-LD, sitemap check, OG images and a README with Cloudflare deploy steps (D1 create, migrations, secrets, Workers Builds from GitHub, custom domain).`

Phase 4: `Read HANDOFF.md and PLAN.md. Run the Phase 4 checklist, fix what fails, then help me deploy.`

## Running locally

```
npm install
npx wrangler d1 migrations apply tworivers --local
npm run dev
```
