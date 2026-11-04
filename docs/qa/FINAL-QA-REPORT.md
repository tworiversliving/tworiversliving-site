# Final pre-approval QA report

Two Rivers Living direct booking site · 4 November 2026 · branch `qa/final-pre-approval`

**Tested against:** a local `wrangler dev` running the production build, with `PMS_PROVIDER=mock`, Stripe **test mode** keys, Cloudflare's always-pass Turnstile test keys, and `RESEND_API_KEY` blank. So emails were rendered and logged, not sent. The live domain is not deployed, so nothing here was tested on tworiversliving.co.uk itself.

## 1. Verdict

**Ready for approval with caveats, not ready to go live.** Every page, the booking flow and the payments work end to end in test mode, and the copy now matches the facts. But five things in "Blockers" must be cleared before real guests can book.

## 2. Blockers (before go-live)

| # | Where | What's wrong | How to fix |
|---|---|---|---|
| 1 | `src/config/site.ts:13-14` | Company number and registered office are still placeholders. A Ltd company's website must show its registered name, number, registered office and place of registration (Companies Act 2006 and the 2015 Business Names Regulations). They are hidden while empty, so the site currently shows none of them. | Fill in `companyNumber` and `registeredOffice`. They then appear on their own in the footer, /terms, /privacy and every email. |
| 2 | `src/lib/pms/index.ts:18-27`, `src/lib/pms/smoobu.ts` | The move to Guesty has no code yet. The only real PMS adapter is Smoobu. If the Smoobu account closes before a Guesty adapter exists, the site has no real availability or prices. | Write a `GuestyAdapter` that implements `PmsAdapter` (`getNights`, `createBooking`, `cancelBooking`) in `src/lib/pms/guesty.ts`. Register it in `getPms`, add `GUESTY_*` secrets and an id mapping in `pmsIdFor`, then set `PMS_PROVIDER=guesty`. |
| 3 | `wrangler.jsonc:14, 22` | `database_id` is all zeros and `PMS_PROVIDER` is `"mock"`. A deploy as it stands would take bookings against the fake calendar. | Follow HANDOFF "Before deploy" steps 1 and 2 (with the Guesty adapter in place of Smoobu). |
| 4 | `src/lib/finalize.ts:46-58`, `src/lib/availability.ts:134-139` | **A guest can lock themselves out.** Checkout places a 30-minute hold. If the guest refreshes, presses back from Stripe or opens a second tab before paying, the new attempt sees their own hold and is told "Some of those nights are already booked." That lasts until the hold lapses. There is no double-booking risk (another guest is correctly refused), but this will lose bookings. Booking logic, so not changed in this pass. | When a checkout comes in for the same email, property and dates as an unpaid booking that is still holding them, release or reuse that hold: pass its ref as `ignoreRef` to the availability check, or expire the old Stripe session and delete its hold before inserting the new one. |
| 5 | Homepage "Lowest price is here", FAQ "Our direct nightly rate is always lower than the price on the booking platforms" (`src/data/faq.ts:24`, `src/pages/index.astro`) | Unverified price claim. Code applies `DIRECT_DISCOUNT=0.10` (10% off the PMS nightly rate, `src/lib/availability.ts:63`). That is checked: every test quote was exactly 10% below the base rate. But I can't see Airbnb or Booking.com prices, so "always lower" can't be confirmed. A comparative price claim that isn't true breaks consumer protection law (DMCC Act 2024, misleading actions). | See decision 2. |

## 3. Fixed in this pass

**Check 1: copy consistency**
- Times are written one way everywhere: "from 3pm" and "by 11am". FAQ, terms, house rules, property rules, checkout arrival times, the manage-booking and confirmation pages and all emails used to say 15:00 and 11:00. One formatter, `clock()`, now lives in `src/config/booking.ts`.
- Extras now read "Early check-in from midday" and "Late checkout until 1pm" (were 12:00 and 13:00), including on the Stripe line items. Quiet hours read "10pm to 8am".
- Cancellation has one phrasing: **"Full refund if you cancel up to 5 days before arrival."** Where there's a date, it reads "You can cancel for a full refund until 3pm on …". This replaces "Free cancellation", "Flexible cancellation" and "Cancel more than 5 days before check-in".
- Parking shows "£15 per stay" on the property page, FAQ, terms and checkout. Checkout charges per stay; the property page used to show no basis.
- Navigation is "Work and long stays" everywhere (was "Work & long stays" in the header). The FAQ group was renamed the same way. The FAQ page title is "Questions and answers", matching its h1.
- Stays over 89 nights: the quote API, the enquiry API and the calendar all now say "We can't take stays over 89 nights." Two of them used to invite the guest to get in touch about longer stays.
- The FAQ no longer says "the number is in your arrival email" while there is no phone number.
- The homepage "from" price (hero button, "Two ways to stay", sticky bar) now updates from the live rate, using the same rule as the property page: the lowest direct rate in the next 60 days. It was hard-coded to the £216 fallback.
- The privacy policy no longer names Smoobu. The row is now "Our property management system". Its "Updated" date is 3 November 2026.
- Checked repo-wide: no 212A, no "6 guests", no "smart lock" or "keypad", no £10 or free parking, no hello@ address, and no em or en dashes, TODO, lorem, "[", "undefined" or "NaN" on any rendered page or email. None of the banned words from BRIEF 5 appear.

**Check 3: emails**
- **Logo bug, cause:** every email pointed to `/brand/logo-horizontal.png`, a file that never existed (`public/brand` only had SVGs), so the image was broken in every client, not only Gmail. **Fix:** added `public/brand/logo-horizontal.png`, 400×89 rendered from the SVG and shown at 200×44 with `width` and `height` set. Gmail fetches images through its own proxy, so it will only show once the site is live on tworiversliving.co.uk.
- The email footer printed the placeholder phone "+44 (0)7XXX XXXXXX" and "company no. [company number]". Both are now hidden until they're filled in.
- The arrival and day-after emails no longer say "message us on 7XXX". They say "reply to this email" until there is a phone number.
- The email font stack no longer names Manrope.

**Check 4: links, routes and SEO**
- Canonical and og:url pointed to `.html` URLs (for example `/work-stays.html`) on every page except the homepage. They now match the sitemap (`/work-stays`). The 404 page no longer has a canonical.
- Added `apple-touch-icon.png` (180×180) and its link tag.
- The confirmation page's "See available dates" linked to `/stays`, a redirect. It now goes straight to the property page.

**Check 5: visual and layout**
- The homepage showed the workspace photo twice (hero and room carousel). Rooms with only one photo are now left out of the hero.
- Property page: the bedroom cards now open on a photo the gallery grid doesn't show.
- The checkout page showed the living-room TV shot (`cardPhoto`). It now shows the dining photo.

**Check 6: accessibility**
- Calendar days inside the minimum stay were read out as "not available". They now say "too soon: the minimum stay is 2 nights".

**Check 8: legal**
- /terms now gives the guest limit as a number (7), not just "what the home sleeps". `termsVersion` is bumped to 2026-11-04 because the terms text changed.
- The footer adds the company number and registered office automatically once they are set.

**Check 9: security**
- Added security headers to every response: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` and `Permissions-Policy`. Static pages get them from `public/_headers`, API routes from `src/middleware.ts`; the list lives in `src/lib/headers.ts`. Checked with curl on both kinds of response.

**Dead code**
- Deleted the unused `src/components/PropertyCard.astro`. `src/data/areas.ts` is kept on purpose for when the area guide returns. There are no unused packages, and Manrope and Newsreader are gone.

## 4. Needs a decision from you

1. **The address.** Is 212 Stoke Newington High Street, London N16 7HU the flat itself? The site keeps the flat's address private until 48 hours before arrival (the map is a circle, and schema.org only gives "London N16"). /contact shows "Post: Two Rivers Living Ltd, Stoke Newington High Street, London N16", which is incomplete for post. Options:
   - (a) It is also the registered office: put it in `registeredOffice` and accept that the flat's address becomes public.
   - (b) Use a separate registered office or service address, and keep 212 private.
   - (c) Remove the "Post" line from /contact.
2. **"Lowest price" claim.** Options:
   - (a) Compare the direct price with Airbnb and Booking.com for 5 dates yourself (direct is base minus 10%), and keep the wording if it holds.
   - (b) Soften it to "Book direct and pay 10% less than our standard rate, with no booking or cleaning fees".
   - (c) Remove "Lowest price is here" and the FAQ "always lower".
3. **Parking basis.** Checkout charges £15 **per stay**, and the site now says so. Right, or should it be per night? If per night, change `per` on the parking extra in `src/config/booking.ts`.
4. **Cancelling inside 5 days.** /terms says no refund (with "get in touch anyway"); `todo.lateCancellation` is empty. Keep no refund, or offer something (for example a refund if the nights are rebooked)?
5. **Payment methods.** Stripe offers Klarna, Revolut Pay, Amazon Pay and Link as well as cards. The FAQ and schema say "card, Apple Pay or Google Pay". Turn the extras off in the Stripe dashboard (Settings, Payment methods), or should I update the copy? Also, Stripe shows the business name as "Tworiversliving". Change it to "Two Rivers Living" under Settings, Public details.
6. **Visit counts.** /privacy and /cookies say visits are counted with Cloudflare Web Analytics, but nothing in the code adds it. Turn it on in the Cloudflare dashboard at launch, or remove those lines?
7. **Guesty in the privacy policy.** Name Guesty in the processors table once it actually receives guest data? (The row is generic until then.)
8. **Values still empty** (lines are hidden until filled): phone and WhatsApp number, wifi speed, bus routes. ICO registration number: has the data protection fee been paid? The privacy page leaves it out until there is a real number.
9. **Phone gallery repeats.** On the property page on phones, the gallery swipes through every photo (as BRIEF 4.2 asks), so the bedroom photos also appear in the "Where you'll sleep" cards further down. Accept, or have the phone gallery show only the five desktop photos?
10. **Share images.** The homepage and property page use the 1200×630 card. Other pages crop a photo to 1086×570 (same shape, and the photos aren't upscaled). Accept, or use the card everywhere?
11. **Content-Security-Policy.** Not added yet, because it needs testing with Stripe Embedded Checkout and Turnstile on the live domain. Add one after launch? A starting point: `default-src 'self'; script-src 'self' https://js.stripe.com https://challenges.cloudflare.com; frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com; connect-src 'self' https://api.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline'`.
12. **Preview URL.** Once `indexable` is true, the workers.dev preview would be indexable too. Set `"workers_dev": false` in wrangler.jsonc once the custom domain works?
13. **Small one.** The enquiry form only offers 1 to 7 guests, but `/api/enquiry` accepts any number. Leave it (the hosts read every enquiry) or cap it at 7?

## 5. Booking flow test log

Mock calendar: the 8th to 11th and 22nd to 24th of each month are booked. Rates are £240 Sunday to Thursday and £275 Friday and Saturday, minus 10% direct. Minimum stay is 2 nights. All cases were run at 390px (date sheet) and 1440px (booking card and popover) with the same results, unless noted.

| Case | Expected | Actual | |
|---|---|---|---|
| 1 night (1 to 2 Dec) | Refused, minimum stay | 2 Dec can't be picked as checkout; the label now explains the 2-night minimum | Pass |
| 2 nights (minimum) | Instant, price | "Continue · £432"; card: £480, −£48, fees £0, total £432 | Pass |
| 3 nights | Instant | £648 | Pass |
| 14 nights, across a month and weekend rates (25 Jan to 8 Feb) | Instant | Quote £3,150 (£3,500 − 10%) | Pass* |
| 15 nights | "Ask for a quote", dates prefilled | Button "Ask for a quote" → `/work-stays?checkIn=…&checkOut=…&guests=2#quote` | Pass |
| 20 nights, across booked nights | Quote | Same as 15 nights; booked nights don't stop it (by design, 29 Oct decision) | Pass |
| 90 nights | Blocked | "We can't take stays over 89 nights.", button disabled; API and enquiry refuse too | Pass |
| Includes a booked night (6 to 9 Dec) | Refused | 9 Dec restarts the selection; the API says nights are booked | Pass |
| Check-in on a booked day (9 Nov) | Not bookable as a short stay | Can be picked as check-in (allowed for 15+ night quotes, by design); no short-stay checkout can be completed | Pass (by design) |
| Checkout before check-in | Restart | The earlier date becomes the new check-in | Pass |
| Same day twice | No zero-night stay | Stays as check-in only | Pass |
| Past date | Not selectable | `aria-disabled`, "not available" | Pass |
| Across a month and year (29 Dec to 2 Jan) | Correct price | 4 nights, £995 − £99.50 = £895.50 | Pass |
| Guests 1, 7, 8 | 1 to 7 only | Stepper stops at 1 and 7 (buttons disabled); desktop select offers 1 to 7; API refuses 8 (test script) | Pass |
| Parking only | £15 per stay | Page, quote and Stripe all £663.00; Stripe line "Parking permit £15.00" | Pass |
| Early check-in only | £25 | £704.50 everywhere | Pass |
| Late checkout only | £25 | £704.50 everywhere | Pass |
| All three extras | £65 | £713.00 everywhere; four Stripe line items | Pass |
| Totals match (calendar, card, checkout, Stripe, email) | To the penny | Matched in every case; the email total comes from the same stored row (checked in a rendered template) | Pass |
| Card 4242 4242 4242 4242 | Paid, confirmed | Stripe `paid`; D1 `confirmed`, written to the mock PMS; confirmation page shows it; host and guest emails logged | Pass |
| Card 4000 0000 0000 0002 | Declined, nothing confirmed | Stripe "Your credit card was declined"; D1 `pending`; its hold frees the dates when the 30-minute session ends | Pass |
| Card 4000 0025 0000 3155 (3D Secure) | Paid after the challenge | Challenge completed; Stripe `paid`; D1 `confirmed` | Pass |
| Refresh mid-checkout, back from Stripe, second tab | No double booking | No double booking, but the same guest is locked out for 30 minutes | **Fail (Blocker 4)** |
| Manage booking: look up | Correct values | Reference, dates, guests, total and refund deadline all correct; wrong email gets a 404 (test script) | Pass |
| Cancel more than 5 days out | Full refund | Status `refunded`, £648 refunded in Stripe test mode, emails logged | Pass |
| Cancel inside 5 days | Refused | `canCancel=false`, refused with the terms wording | Pass |
| Enquiry: valid | Saved, two emails | 200; host and guest emails logged | Pass |
| Enquiry: Turnstile missing | Refused | 403 "We couldn't check you're not a bot…" | Pass |
| Enquiry: validation | Clear messages | No name, bad email, checkout before check-in and 90 nights all refused with plain messages | Pass |
| Enquiry: 8 guests | Refused? | Accepted by the API (the form only offers 1 to 7) | See decision 13 |
| API test script | All pass | 76 of 76 in instant mode | Pass |

*The first run of the 14-night case failed because bookings from the test script were still in the local database; with the local tables cleared it passed.

**Emails the site sends (12):** booking confirmed, booking request received, new booking (to hosts), couldn't confirm / refunded (conflict), conflict alert (to hosts), booking cancelled, cancellation (to hosts), arrival details (48 hours before), day-after check-in, thank you, enquiry (to hosts), enquiry reply. All were rendered and read:
- sender "Two Rivers Living <stay@tworiversliving.co.uk>"
- replies go to stay@, or to the guest on host emails
- every email has a plain-text version
- links point to tworiversliving.co.uk
- no em dashes or placeholders

They were not delivered to real inboxes in this pass (HANDOFF "After deploy" step 1 still applies).

## 6. Scores

| | Before this pass | After |
|---|---|---|
| Lighthouse mobile, home (perf / a11y / BP / SEO) | 100 / 100 / 100 / 69 (31 Oct, before the focus carousel) | 92 / 100 / 100 / 69 |
| Lighthouse mobile, property | 97 to 99 / 100 / 100 / 69 (31 Oct) | 95 / 100 / 100 / 69 |
| axe (WCAG 2.1 AA and best practice), 16 routes | 0 violations (3 Nov, before fixes) | 0 violations |
| `qa.mjs`, every route at 360/390/430/768/1440 | 0 failures | 0 failures, 2 warnings (side slides in the room carousel load the 720px image they grow into, on purpose) |

The "before" Lighthouse figures are from HANDOFF Phase 6; I didn't rerun Lighthouse before making fixes. The homepage LCP is the hero photo, at 3.1s on a heavily loaded machine. SEO 69 is only the deliberate `noindex` while `site.indexable` is false; it goes to 100 when that is switched on at launch.

## 7. Open values (`src/data/todo.ts` and `src/config/site.ts`)

| Value | State | On the site while empty |
|---|---|---|
| WhatsApp number and link | Empty | Hidden (footer, menu, contact); emails say "reply to this email" |
| Phone | Placeholder `+44 (0)7XXX XXXXXX` | Hidden everywhere (`phoneHref` empty), including emails now |
| Clissold Park walk time | Filled: "15 min walk" | Shown. Please confirm it was walked |
| Bus routes | Empty | "Buses" row hidden |
| Wifi speed | Empty | Shows "wifi throughout" with no speed |
| Shower or bath | Filled: "Walk-in shower" | Shown. Please confirm |
| Parking basis | Empty in todo; checkout uses per stay | Shows "£15 per stay" (decision 3) |
| After the refund window | Empty | /terms says no refund (decision 4) |
| Company number, registered office | Placeholders | Hidden (Blocker 1) |
| ICO number | Placeholder | Hidden (decision 8) |

**Still relying on Smoobu:** only `src/lib/pms/smoobu.ts`, its branch in `src/lib/pms/index.ts`, the `SMOOBU_*` env types in `src/env.d.ts`, and code comments. Nothing guest-facing names Smoobu now. The Guesty switch needs:
- an adapter
- secrets
- property id mapping
- a check that Guesty returns per-night prices and minimum stays the way `getNights` expects
- a test write and cancel, as in HANDOFF "After deploy" step 2

**Configuration to set in production:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (live, 107 characters), `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (without the secret, Turnstile lets everything through: `src/lib/turnstile.ts:5`), PMS secrets, and `ARRIVAL_INFO`. Stripe test or live mode follows whichever keys are set; nothing is hard-coded. The webhook signature and Turnstile token are both checked on the server. There are no admin routes. Turn on "Always Use HTTPS" in Cloudflare. **No secrets were found** in the repo, its git history or the built client files.

## 8. Approval checklist for Hamza

Use the preview link on a phone and on a laptop.

1. **Homepage.** Read it top to bottom. Check the facts: 7 guests, three double bedrooms plus a sofa bed, 1 minute to Church Street, about 15 minutes to Liverpool Street, no fees. Swipe through "Inside the flat" and check every room name and photo is right.
2. **The flat page** (tap "The flat"). Check check-in 3pm and checkout 11am, the house rules, the "Good to know" notes and the cancellation line ("Full refund if you cancel up to 5 days before arrival"). Tap "All 19 photos" and look through every room.
3. **Pick dates.** Tap "Check dates" and choose 3 nights next month. You should see the price for those nights, "no fees" and a Continue button. Then choose 20 nights: the button should change to "Ask for a quote".
4. **Make one test booking** (only while the site is in test mode). Continue to checkout, tick parking, fill in your own name and email, tick the terms and pay with card **4242 4242 4242 4242**, any future date, any 3 digits. Check that:
   - the confirmation page shows your reference and the right total
   - you get the "Booking confirmed" email with the logo showing
   - the email total matches the page
5. **Cancel it.** Go to "Manage a booking" in the footer, enter the reference and email, and cancel. You should get a full refund message and a cancellation email.
6. **Ask for a quote.** On "Work and long stays", send an enquiry. You should get a "Thanks, we have your enquiry" email, and stay@ should get the details.
7. **Legal pages.** Open Booking terms, House rules, Privacy and Cookies from the footer and read them once.
8. **Tell us** anything that's wrong or reads oddly, and answer the questions in section 4.
