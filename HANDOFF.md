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

**Not tested yet:** the conflict refund against real Stripe (block a night mid-checkout), email delivery to the inbox (SPF/DKIM/DMARC), and writing or cancelling a booking in Smoobu.

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

**Phase 4 (new chat):** tests with the mock PMS, Lighthouse, deploy and launch checklist.

## Redesign Phase 3: date picker (29 Oct 2026)

`<tr-calendar>` (src/scripts/tr-calendar.ts), the "Your dates" sheet and desktop popover (src/components/DateSheet.astro, logic in src/scripts/date-picker.ts, included once from Base.astro) and `DatePair.astro`, which replaces every native date input. Any element with `data-open-dates` opens the sheet. Prices and availability come from the existing /api/availability and /api/quote; no new endpoint. Stays over 14 nights ignore the PMS calendar (decided 29 Oct 2026): any dates up to 89 nights can be chosen, even across booked nights or starting on one, and go to the enquiry for the hosts to check. The enquiry form's picker shows no availability or prices. Short stays still have to fit free nights.

## Redesign Phase 4: property page (29 Oct 2026)

`src/pages/stays/[slug].astro` rebuilt to BRIEF.md 4.2. The gallery and room tiles still use PhotoCarousel and PhotoCard, restyled from the page. The lightbox and "All N photos" count only include photo files that exist (19 today, so the brief's "24" isn't shown); TV shots come last in each room. New fields in properties.ts: `street`, `headline`, `floor`. StickyBar.astro has a `bar` variant (full-width paper bar, always shown). AreaMap.astro takes an `href` (links to a Google Maps search for the area, not the circle centre). BookingPanel.astro restyled only; its logic and the over-14-nights rule are unchanged. The "Working here" list (with its bracketed wifi placeholder) is folded into the "What's in the flat" schedule; the hosts paragraph moved to the HOSTS row.

## Redesign Phase 5: remaining pages (29 Oct 2026)

Committed together with Phase 4 in 478d269 (the commit message only says Phase 4). /work-stays, /areas/stoke-newington, /about, /faq, /contact, /book-direct, the legal pages (src/layouts/Legal.astro), /booking, /book/confirmed and the 404 restyled to BRIEF.md 4.4. /stays is a 302 to the property page that keeps the query string (src/pages/stays/index.astro), so a listing can come back when there is a second property. Bracketed placeholders are gone from rendered pages: `filled()` in src/config/site.ts hides a line while its value is empty or still in [brackets], and src/data/areas.ts marks what is still to add with `TO ADD` comments. The Open Graph card from 4.5 was left for Phase 6.

## Redesign Phase 6: mobile QA and polish (31 Oct 2026)

QA runs from a folder outside the repo, `../qa` (Playwright and Lighthouse live there, not in this project):

```
npm run build && npx wrangler dev --port 8787 --var PMS_PROVIDER:mock   # wait for the build first
cd ../qa && node qa.mjs --shots                  # every route at 360/390/430/768/1440, results in qa/out/
node qa.mjs --routes=/,/faq --widths=390         # a subset
npx lighthouse http://localhost:8787/ --only-categories=performance --chrome-flags="--headless=new"
```

qa.mjs fails on horizontal scroll, tap targets under 44px, contrast under 4.5:1, images without width/height, console errors, a covered sticky-bar button, `vh` in any stylesheet, a missing Redaction preload, and animation with reduced motion on. It also checks inside the date sheet, the desktop popover and the phone menu. Errors logged by Turnstile's own iframe are ignored (it runs its own CSP and anti-debug code). Final run: 0 failures, 0 warnings.

Fixed in this phase:
- Tap targets: header nav and logo, footer links and email, `.text-link`, links inside a Schedule value, checkbox and radio labels on /book, the "All 19 photos" button and the popover's Close are all 44px tall now.
- Booked nights in the calendar were faded to 2.4:1. They can still end a stay or sit inside a long one, so they are `--forest-soft` with the strike-through instead. Days that can't be picked at all (past days) stay faded.
- The homepage said "5 of 22 photos"; it now counts only photo files that exist (19), matching the property page.
- `.section + .section` was cancelling the top padding of every ruled section after the first (the area guide's headings sat on the rule). `.section.section--ruled` now wins.
- A missing photo renders nothing on the live site (it was a blank grey block on the homepage, /about and the area guide); the toned block with its filename still shows in dev or with PUBLIC_SHOW_PHOTO_TODOS=true. Their grids drop to one column when the photo is absent.
- Map tiles are lazy `<img>`s now, not SVG `<image>`s, which loaded eagerly and slowed the property page's first photo. Lighthouse mobile on wrangler dev: home 100, property 97 to 99 (was 90 to 92, LCP 3.3s, now about 1.9s).
- /work-stays kitchen photo: its margin never applied (scoped style on a child component); it is 3:2 on phones instead of a thin 16:7 strip.
- The floating sticky bar sits 12px above the home indicator (`calc(12px + env(safe-area-inset-bottom))`) instead of touching it. The property bar, the sheet footer and the phone menu already padded by the safe area. The sheet and menu use dvh; the 404 uses svh.
- Section 5: removed the labels that repeated their heading ("Why book here" on the homepage, "Book direct" on /book-direct), the arrow icon on photo cards, and font weights 600/700 on the booking pages (only 400 and 500 are loaded). The property page's distances are a distance Schedule, like the homepage.
- Open Graph card (BRIEF.md 4.5): `public/og/stoke-newington.png`, used by the homepage and the property page through Base's `ogCard` prop. Other pages still crop a photo (src/lib/og.ts). Render it with `cd ../qa && node ../tworiversliving-site/scripts/og-card.mjs`; it reads guests, bedrooms, `fromPriceFallback` and `ogPhoto` from properties.ts, so re-run it when the price changes.

**Open from Phase 6:** photos still to shoot (hosts, Church Street, Clissold Park, station, working nearby); until then those slots are left out and the area guide reads thin. The guidebook picks for the area guide (`TO ADD` in src/data/areas.ts). /book-direct says "Payments are handled by Stripe" while the site still runs in request mode. The share card bakes in £216, so it goes stale if the from price changes and nobody re-runs the script. Safe-area spacing was checked in the CSS, not on a real iPhone.

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
