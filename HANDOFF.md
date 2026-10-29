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

## Built so far (Phases 1 and 2)

| File | Status |
| --- | --- |
| package.json, astro.config.mjs, wrangler.jsonc, tsconfig.json | Done. Astro 5.18.2, @astrojs/cloudflare 12.6.13 |
| migrations/0001_init.sql | Done: bookings, holds, enquiries, events |
| public/brand/* , public/favicon.svg | Done |
| src/env.d.ts, src/config/* | Done |
| src/data/properties.ts | Done. All 19 photos listed, grouped by room. Bathroom is a walk-in shower (no bath). Reviews still empty |
| src/lib/dates.ts, db.ts, email.ts, pms/* | Done. email.ts gained `hostConflict` and `hostCancelled` |
| src/lib/availability.ts | Done. Only **confirmed** bookings and active holds block nights (pending bookings no longer do, so an abandoned checkout frees its dates when the 30-minute hold ends) |
| Phase 1 pages, layout, components, global.css | Done |
| src/worker.ts | Done: Astro fetch handler plus `scheduled` cron |
| src/lib/jobs.ts | Done: daily cron. Clears expired holds, expires unpaid bookings after 2h, sends pre-arrival (48h), morning-after-arrival and thank-you emails |
| src/lib/stripe.ts | Done: Embedded Checkout session, refunds, webhook signature check |
| src/lib/finalize.ts | Done: insert booking, hold with first-come tie-break, request-mode alerts, `finalizePaid` (re-check, confirm, write to PMS, or auto-refund on conflict; safe to run twice), guest cancellation |
| src/lib/turnstile.ts, src/lib/api.ts | Done. Turnstile is skipped while TURNSTILE_SECRET_KEY is empty |
| /api/config, /api/availability, /api/quote, /api/checkout, /api/stripe-webhook, /api/enquiry, /api/booking, /ical/[slug].ics | Done. /api/booking does the confirmation-page lookup (by Stripe session) and manage/cancel (by ref + email) |
| src/components/BookingPanel.astro | Done: calendar, guests, live price, Reserve or Enquire (15+ nights go to /work-stays with dates filled in) |
| /book/[slug], /book/confirmed, /booking | Done |
| src/components/EnquiryForm.astro | Turnstile, inline success message, dates carried over from the panel |
| scripts/smoobu-apartments.mjs | Lists Smoobu apartment ids (`node scripts/smoobu-apartments.mjs`) |

**Booking modes.** `/api/config` reports `instant` only when STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are both set; otherwise `request`. The checkout page switches its title, button and wording to match.

**Tested locally (wrangler dev, PMS_PROVIDER=mock, 25 Oct 2026):** availability, quotes, blocked nights, 7-guest cap, 90+ nights refused, early check-in and late checkout hidden next to booked nights, request-mode booking end to end, lookup and withdraw, enquiry (JSON and no-JS form post), iCal feed, daily cron. With a locally signed webhook: bad signature refused, paid booking confirmed and written to the mock PMS, a Stripe retry doesn't duplicate emails, an overlapping paid booking is caught as a conflict.

**Smoobu, tested 26 Oct 2026:** HMAC signing works. Apartment id 3531046 ("Two Rivers Living") is in SMOOBU_APARTMENT_IDS. Availability, prices, minimum stays and quotes come through correctly with PMS_PROVIDER=smoobu. Writing a booking into Smoobu has not been tested.

**Stripe, tested 26 Oct 2026 (Test mode sandbox, PMS_PROVIDER=mock):** full booking in the browser with extras, Turnstile passed, Embedded Checkout paid with 4242, webhook confirmed it and wrote it to the mock PMS, then cancelled at /booking with an automatic refund. Resend accepted the emails without errors.

**Conflict refund against Stripe test mode:** passed 29 Oct 2026 (see Phase 4 below).

**Not tested yet:** the conflict refund on live Stripe, email delivery to the inbox (SPF/DKIM/DMARC), and writing or cancelling a booking in Smoobu.

## Still to build

**Phase 2:** done and tested (see above). The remaining checks are in the Phase 4 checklist.

**Phase 3:** done (27 Oct 2026).

| File | Status |
| --- | --- |
| /terms, /privacy, /cookies, /house-rules, src/layouts/Legal.astro | Done. Plain English, from PLAN.md's legal checklist. Placeholders for company no., registered office and ICO number (`site.icoNumber`). Needs a solicitor's read once |
| src/config/booking.ts | `termsVersion` bumped to 2026-10-27, the date shown on /terms and /house-rules |
| src/components/AreaMap.astro, src/lib/map.ts, scripts/map-tiles.mjs, public/maps/ | Static OSM map with a circle, tiles self-hosted. Re-run the script after moving `map` in properties.ts |
| src/lib/schema.ts | Organization + BreadcrumbList on every page (from Base.astro), LodgingBusiness on the property page, FAQPage on /faq. No review markup: Google ignores self-published reviews for a business |
| src/lib/og.ts | Share images cropped to 1.91:1 from real photos (not upscaled: the photos are 1086px wide). New `ogPhoto` field in properties.ts (dining.jpg) |
| src/pages/robots.txt.ts | Disallows /api/, /book/, /booking, /ical/ and points to the sitemap. Sitemap checked: 13 public pages, no booking pages or 404 |
| src/lib/jobs.ts | Daily retention clean-up matching /privacy: paid bookings 7 years after checkout, unpaid ones and enquiries 12 months |
| README.md, .dev.vars.example | Deploy steps: D1, migrations, secrets, Workers Builds, custom domain, go-live switches |

**Open from Phase 3:** the map circle is centred on the building's rough position, so its centre gives the flat away. Shift `map.lat/lng` a couple of hundred metres and re-run the tile script. Decide what happens to refunds inside the 5-day window (terms currently say none, matching the code).

**Phase 4:** tests and Lighthouse done 29 Oct 2026 on branch `launch/phase-4-checks` (from redesign phase 3, before redesign phases 4 to 6 were merged). Deploy not started. See "Phase 4: tests and launch" below.

## Phase 4: tests and launch (29 Oct 2026)

**Automated tests.** `scripts/test-booking.mjs` runs against a local `wrangler dev` with PMS_PROVIDER=mock. It wipes the local D1 tables, only talks to localhost, and refuses live Stripe keys. Run it once in each mode:

```
npm run build && npx wrangler dev --test-scheduled --port 8799
node scripts/test-booking.mjs http://localhost:8799
```

- Request mode (STRIPE_SECRET_KEY empty): 62 passed. Availability, quotes, minimum stay, 7-guest cap, 90+ nights refused, year-ahead limit, long stays, enquiry (JSON and no-JS form post), request, lookup, withdraw, iCal, daily cron (all three emails, 2h expiry, retention, nothing sent twice).
- Instant mode (Stripe test keys): 76 passed. Adds checkout session and hold, second guest refused on held nights, bad webhook signature refused, paid booking confirmed and written to the mock PMS, webhook retry changes nothing, guest cancel with a full refund in Stripe, **night taken mid-checkout refunded automatically in Stripe**, lapsed session frees the nights.
- Instant-mode payments are real Stripe test PaymentIntents (pm_card_visa); the script signs its own webhooks with STRIPE_WEBHOOK_SECRET, so no `stripe listen` is needed.
- Long stays: the browser sends 15+ nights to /work-stays without calling /api/quote, and /api/enquiry never touches the PMS, so the enquiry takes dates across or starting on booked nights. /api/quote itself still checks availability for 15+ nights; nothing in the site calls it for those stays.
- For the run, RESEND_API_KEY was blank (emails logged, checked by subject and recipient) and TURNSTILE_SECRET_KEY was Cloudflare's always-pass test secret.

**Stripe publishable key.** The test key in .dev.vars was pasted twice (207 characters: the 99-character body, one stray character, then the body again). The right value is `pk_test_` plus the first 99 characters. Check the live one is 107 characters before setting it in Cloudflare.

**Lighthouse (12, local wrangler dev, performance / accessibility / best practices / SEO):**

| Page | Mobile | Desktop |
| --- | --- | --- |
| / | 96 / 100 / 100 / 69 | 100 / 100 / 100 / 69 |
| /stays/stoke-newington-3-bed | 94 / 100 / 100 / 69 | 96 / 100 / 100 / 69 |
| /work-stays | 86 / 100 / 100 / 69 | 100 / 100 / 100 / 69 |
| /book/stoke-newington-3-bed | 64 / 100 / 100 / 69 | 79 / 100 / 100 / 69 |

- SEO 69 is only the noindex tag from `site.indexable: false`. It goes to 100 when that's flipped at launch.
- /book: CLS 0.6. `[data-flow]` is hidden until the quote loads, then the whole form appears and pushes the footer down. Reserve its height (or render it with placeholders) in redesign phase 5 or 6, which restyle this page.
- /work-stays mobile LCP 3.7s. Re-run all of these after the redesign merges: phases 4 to 6 rebuild the property page, /work-stays and /book.
- No banned words or em dashes in any built page.

**Before deploy (needs the owner's go-ahead):**

1. `PMS_PROVIDER` in wrangler.jsonc: "mock" → "smoobu". Leave .dev.vars on mock.
2. `npx wrangler d1 create tworivers`, put the id into `database_id` in wrangler.jsonc (still all zeros), then `npm run db:remote`.
3. `npx wrangler login`, then set and confirm with `npx wrangler secret list`:

| Secret | Needed for | Notes |
| --- | --- | --- |
| SMOOBU_API_KEY, SMOOBU_API_SECRET | Calendar, prices, writing bookings | HMAC pair (legacy key stops 31 Oct 2026) |
| SMOOBU_APARTMENT_IDS | Calendar | `{"stoke-newington-3-bed": 3531046}` |
| RESEND_API_KEY | All email | Domain must be verified first |
| TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY | Bot check on booking and enquiry forms | Add tworiversliving.co.uk to the widget's hostnames |
| ARRIVAL_INFO | Pre-arrival email (address, door code, wifi) | Without it the email says "We will send the address and access details separately", so you must send them by hand |
| STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY | Instant booking | Live keys, only after Stripe verifies. Without them the site takes requests |
| STRIPE_WEBHOOK_SECRET | Instant booking | From the live webhook endpoint, not `stripe listen` |
| SLACK_WEBHOOK_URL | Optional host alerts | |

**Deploy order:** D1 + remote migrations → secrets → Workers Builds (README step 5, project name `tworiversliving`) → custom domain and www redirect (README step 6) → Resend domain → Stripe live webhook once verified → `indexable: true`, sitemap to Search Console.

**Resend DNS.** Add the domain in Resend, region EU. Copy the records Resend shows into Cloudflare DNS, all **DNS only** (grey cloud): an MX and TXT (SPF) on the `send` subdomain, and the DKIM TXT at `resend._domainkey`. These sit on subdomains, so they don't clash with Zoho's MX and SPF on the root. Add DMARC once: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:stay@tworiversliving.co.uk`, then move to `p=quarantine` after a few clean weeks. Check with mail-tester.com or Gmail "Show original" (SPF, DKIM and DMARC all PASS).

**After deploy, test with the owner:**

1. Email: make a request-mode booking and an enquiry with your own Gmail and Outlook addresses. Check inbox, not spam, and the headers.
2. Smoobu write and cancel: this needs a paid instant booking, which appears in the real calendar and on the channels. Ask first. Pick far-off dates, cancel straight away at /booking, then check it's gone from Smoobu and the channels.
3. Live conflict refund: open checkout, block one of the nights in Smoobu, then pay with a real card. It should refund automatically. Unblock afterwards.

**Still blocking launch (owner's side):** WhatsApp number (`todo.whatsapp`, `whatsappHref`, phone in site.ts), ICO registration number, company number and registered office, Stripe verification (site runs in request mode until then), solicitor's read of /terms, /privacy, /cookies, /house-rules, map circle offset, the refund policy inside 5 days (`todo.lateCancellation`), the other open values in src/data/todo.ts (bus routes, wifi speed, parking per stay or per night, shower confirmed), insurance in writing, and a phone check on iPhone and Android.

## Redesign Phase 3: date picker (29 Oct 2026)

`<tr-calendar>` (src/scripts/tr-calendar.ts), the "Your dates" sheet and desktop popover (src/components/DateSheet.astro, logic in src/scripts/date-picker.ts, included once from Base.astro) and `DatePair.astro`, which replaces every native date input. Any element with `data-open-dates` opens the sheet. Prices and availability come from the existing /api/availability and /api/quote; no new endpoint. Stays over 14 nights ignore the PMS calendar (decided 29 Oct 2026): any dates up to 89 nights can be chosen, even across booked nights or starting on one, and go to the enquiry for the hosts to check. The enquiry form's picker shows no availability or prices. Short stays still have to fit free nights.

## Testing Stripe locally

1. Put the test keys from dashboard.stripe.com/test/apikeys in .dev.vars: `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_PUBLISHABLE_KEY=pk_test_...`.
2. Install the Stripe CLI and log in: `brew install stripe/stripe-cli/stripe`, then `stripe login`.
3. In one terminal (choose the **Test mode** sandbox at `stripe login`; CLI 1.55+ refuses to run without `--events`): `stripe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded --forward-to localhost:8787/api/stripe-webhook`. Copy the `whsec_...` it prints into .dev.vars as `STRIPE_WEBHOOK_SECRET`. It stays the same between runs on the same machine.
4. In another: `npm run build && npx wrangler dev --test-scheduled` (wrangler reads .dev.vars at start, so restart it after editing).
5. Book on http://localhost:8787 with card 4242 4242 4242 4242, any future expiry, any CVC. Then cancel at /booking and check the refund in the Stripe dashboard.
6. Conflict test: open checkout, then block one of the nights in D1 or Smoobu before paying. The payment should be refunded automatically.
7. Cron by hand: `curl "http://localhost:8787/__scheduled?cron=0+9+*+*+*"`.

## Testing Smoobu availability

1. Smoobu → Settings → Advanced → API Keys → Create API Key, then Generate Secret. Put both in .dev.vars.
2. `node scripts/smoobu-apartments.mjs` prints each apartment id. Set `SMOOBU_APARTMENT_IDS={"stoke-newington-3-bed": 123456}` in .dev.vars.
3. Set `PMS_PROVIDER=smoobu`, restart wrangler, and open `http://localhost:8787/api/availability?slug=stoke-newington-3-bed`. Compare a few dates and prices with the Smoobu calendar.
4. Don't make a paid test booking against Smoobu unless you want it to appear in the real calendar and channels.

## Prompts for each new chat

Phase 1: `Read HANDOFF.md and PLAN.md. Finish Phase 1 only: design tokens in src/styles/global.css, Base layout, Header, Footer and all static content pages, using src/data/properties.ts and src/config/*. Follow PLAN.md's "Keeping it human" rules. Don't touch src/lib. Run npm run build at the end.`

Phase 2: done. To finish its checks: `Read HANDOFF.md. Stripe and Smoobu keys are now in .dev.vars. Run the "Testing Stripe locally" and "Testing Smoobu availability" steps and fix what fails.`

Phase 4: `Read HANDOFF.md and PLAN.md. Run the Phase 4 checklist, fix what fails, then help me deploy.`

## Running locally

```
npm install
npx wrangler d1 migrations apply tworivers --local
npm run build && npx wrangler dev --test-scheduled   # full site with API routes, D1 and cron on :8787
npm run dev                                          # faster for page and style work
```
