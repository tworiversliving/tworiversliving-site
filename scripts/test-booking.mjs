// End-to-end checks of the booking API against a local `wrangler dev` with PMS_PROVIDER=mock.
//
//   npm run build && npx wrangler dev --test-scheduled --port 8799
//   node scripts/test-booking.mjs http://localhost:8799
//
// It runs the request-mode or instant-mode checks depending on what /api/config reports, so run it
// once with STRIPE_SECRET_KEY empty in .dev.vars and once with the Stripe test keys set.
// Instant mode creates real Stripe *test* PaymentIntents (card pm_card_visa) and signs its own
// webhooks with STRIPE_WEBHOOK_SECRET, so refunds run against Stripe test mode. It refuses live keys.
// It wipes the LOCAL D1 tables first and only ever talks to localhost.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = (process.argv[2] ?? 'http://localhost:8799').replace(/\/$/, '');
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('Only runs against localhost.');
const SLUG = 'stoke-newington-3-bed';

const vars = Object.fromEntries(
  readFileSync('.dev.vars', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

// ---------- helpers ----------
let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}
const section = (s) => console.log(`\n${s}`);

async function api(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: body && typeof body !== 'string' ? { 'content-type': 'application/json', accept: 'application/json', ...headers } : headers,
    body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, text, headers: res.headers };
}

function sql(command) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'tworivers', '--local', '--json', '--command', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(out)[0].results;
}
const row = (ref) => sql(`SELECT * FROM bookings WHERE ref = '${ref}'`)[0];

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
// The mock PMS blocks the 8th to 11th and 22nd to 24th of every month. Work two months ahead.
const m = addDays(today, 62).slice(0, 8);
const d = (day) => `${m}${String(day).padStart(2, '0')}`;

const guest = (extra = {}) => ({
  slug: SLUG, guests: 2, firstName: 'Test', lastName: 'Guest', email: 'test@example.com', phone: '07700 900123',
  terms: true, turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', ...extra,
});

async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${vars.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params) : undefined,
  });
  return res.json();
}
const paidIntent = (pence, ref) =>
  stripe('payment_intents', {
    amount: String(pence), currency: 'gbp', payment_method: 'pm_card_visa', confirm: 'true',
    'automatic_payment_methods[enabled]': 'true', 'automatic_payment_methods[allow_redirects]': 'never', 'metadata[ref]': ref,
  });

function signedWebhook(type, object, secret = vars.STRIPE_WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: `evt_test_${Date.now()}`, object: 'event', type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return api('POST', '/api/stripe-webhook', payload, { 'stripe-signature': `t=${t},v1=${sig}`, 'content-type': 'application/json' });
}

// ---------- run ----------
sql('DELETE FROM bookings; DELETE FROM holds; DELETE FROM enquiries; DELETE FROM events;');
const config = (await api('GET', '/api/config')).data;
console.log(`Testing ${BASE} in ${config.mode} mode, stays in ${m.slice(0, 7)}`);

section('Availability');
{
  const r = await api('GET', `/api/availability?slug=${SLUG}&from=${d(1)}&to=${d(28)}`);
  const day = (n) => r.data.days.find((x) => x.date === d(n));
  check('returns a calendar', r.status === 200 && r.data.days.length === 27);
  check('blocked PMS nights are unavailable', day(9).available === false && day(23).available === false);
  check('free nights are available with a price', day(3).available === true && day(3).price > 0);
  check('direct price is 10% under the PMS price', day(3).price === 21600 || day(3).price === 24750, `got ${day(3).price}`);
  check('minimum stay is reported', day(3).minStay === 2);
  check('unknown property is a 404', (await api('GET', '/api/availability?slug=nope')).status === 404);
  check('bad range refused', (await api('GET', `/api/availability?slug=${SLUG}&from=${d(5)}&to=${d(2)}`)).status === 400);
  const past = (await api('GET', `/api/availability?slug=${SLUG}&from=${addDays(today, -3)}&to=${addDays(today, 1)}`)).data;
  check('past nights are unavailable', past.days[0].available === false);
}

section('Quotes');
{
  const q = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(4), guests: 2 })).data;
  check('3 free nights quote ok', q.ok && q.mode === 'instant' && q.nightCount === 3);
  check('discount = subtotal - stay', q.discount === q.subtotal - q.stay && Math.round(q.subtotal * 0.1) === q.discount);
  check('total = stay + extras', q.total === q.stay + q.extrasTotal);
  const qx = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(4), guests: 2, extras: ['parking'] })).data;
  check('parking adds £15', qx.extrasTotal === 1500 && qx.total === q.total + 1500);
  const nextToBooked = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(5), checkOut: d(8), guests: 2, extras: ['late_checkout'] })).data;
  check('late checkout hidden next to a booked night', nextToBooked.ok && !nextToBooked.eligibleExtras.includes('late_checkout') && nextToBooked.extrasTotal === 0);
  const across = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(7), checkOut: d(10), guests: 2 })).data;
  check('short stay across booked nights refused', !across.ok && /already booked/.test(across.errors[0]));

  const one = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(2), guests: 2 })).data;
  check('minimum stay: 1 night refused', !one.ok && /minimum stay/.test(one.errors[0]), one.errors?.[0]);
  const two = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(3), guests: 2 })).data;
  check('minimum stay: 2 nights ok', two.ok);

  const seven = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(4), guests: 7 })).data;
  const eight = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(4), guests: 8 })).data;
  const zero = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: d(4), guests: 0 })).data;
  check('7 guests ok', seven.ok);
  check('8 guests refused', !eight.ok && /up to 7/.test(eight.errors[0]), eight.errors?.[0]);
  check('0 guests refused', !zero.ok);

  const n89 = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: addDays(d(1), 89), guests: 2 })).data;
  const n90 = (await api('POST', '/api/quote', { slug: SLUG, checkIn: d(1), checkOut: addDays(d(1), 90), guests: 2 })).data;
  check('90 nights refused', !n90.ok && /90 nights/.test(n90.errors[0]), n90.errors?.[0]);
  check('89 nights not refused for length', !(n89.errors ?? []).some((e) => /90 nights/.test(e)));
  const pastQ = (await api('POST', '/api/quote', { slug: SLUG, checkIn: addDays(today, -1), checkOut: addDays(today, 2), guests: 2 })).data;
  check('past check-in refused', !pastQ.ok && /passed/.test(pastQ.errors[0]));
  const far = (await api('POST', '/api/quote', { slug: SLUG, checkIn: addDays(today, 370), checkOut: addDays(today, 373), guests: 2 })).data;
  check('more than a year ahead refused', !far.ok && /year ahead/.test(far.errors[0]));
}

section('Long stays (over 14 nights) go to the enquiry without a PMS check');
{
  // The browser never quotes a 15+ night stay (BookingPanel, date-picker, /book redirect); it goes to /work-stays.
  // The server side of that: /api/enquiry takes any dates up to 89 nights, booked or not, and never asks the PMS.
  const enquirySrc = readFileSync('src/pages/api/enquiry.ts', 'utf8');
  check('enquiry route has no PMS or availability import', !/lib\/pms|availability/.test(enquirySrc));
  const panel = readFileSync('src/components/BookingPanel.astro', 'utf8') + readFileSync('src/scripts/date-picker.ts', 'utf8');
  check('panel and sheet send 15+ nights to /work-stays before quoting', (panel.match(/n > maxInstant[\s\S]{0,300}work-stays/g) ?? []).length >= 2);
  check('/book redirects 15+ nights before quoting', /maxInstant\)\)[\s\S]{0,80}work-stays/.test(readFileSync('src/pages/book/[slug].astro', 'utf8')));
  const r = await api('POST', '/api/enquiry', {
    type: 'long_stay', property: SLUG, checkIn: d(5), checkOut: d(25), guests: 4, name: 'Long Stay', email: 'long@example.com',
    company: 'Acme', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  });
  check('20 nights across booked nights accepted as an enquiry', r.status === 200 && r.data.ok, r.text);
  const onBooked = await api('POST', '/api/enquiry', {
    type: 'work', property: SLUG, checkIn: d(9), checkOut: addDays(d(9), 30), guests: 3, name: 'Starts Booked', email: 'w@example.com',
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  });
  check('enquiry starting on a booked night accepted', onBooked.status === 200, onBooked.text);
  const tooLong = await api('POST', '/api/enquiry', {
    type: 'long_stay', property: SLUG, checkIn: d(1), checkOut: addDays(d(1), 90), name: 'Too Long', email: 'x@example.com', turnstileToken: 'x',
  });
  check('enquiry over 89 nights refused', tooLong.status === 400 && /89 nights/.test(tooLong.data.error), tooLong.text);
  const viaCheckout = await api('POST', '/api/checkout', guest({ checkIn: d(1), checkOut: d(17) }));
  check('/api/checkout refuses 15+ nights', viaCheckout.status === 409, viaCheckout.text);
}

section('Enquiry');
{
  const contact = await api('POST', '/api/enquiry', { type: 'contact', name: 'Ann', email: 'ann@example.com', message: 'Hello', turnstileToken: 'x' });
  check('contact enquiry ok', contact.status === 200 && contact.data.ok);
  check('contact without a message refused', (await api('POST', '/api/enquiry', { type: 'contact', name: 'Ann', email: 'ann@example.com', turnstileToken: 'x' })).status === 400);
  check('bad email refused', (await api('POST', '/api/enquiry', { type: 'contact', name: 'Ann', email: 'nope', message: 'x', turnstileToken: 'x' })).status === 400);
  if (vars.TURNSTILE_SECRET_KEY) {
    const noToken = await api('POST', '/api/enquiry', { type: 'contact', name: 'Ann', email: 'ann@example.com', message: 'Hi' });
    check('missing Turnstile token refused', noToken.status === 403);
  }
  const form = await api('POST', '/api/enquiry', 'type=contact&name=NoJS&email=nojs%40example.com&message=Hi&turnstileToken=x', {
    // Browsers send Origin on a form post; without it Astro's cross-site check returns 403.
    'content-type': 'application/x-www-form-urlencoded', referer: `${BASE}/contact`, origin: BASE,
  });
  check('form post without JS redirects back with ?sent=1', form.status === 303 && /\/contact\?sent=1/.test(form.headers.get('location') ?? ''));
  const saved = sql("SELECT type, COUNT(*) AS n FROM enquiries GROUP BY type ORDER BY type");
  check('enquiries saved to D1', saved.reduce((s, r) => s + r.n, 0) === 4, JSON.stringify(saved));
}

if (config.mode === 'request') {
  section('Request mode booking');
  check('/api/config says request with no Stripe key', config.stripePublishableKey === null);
  const bad = await api('POST', '/api/checkout', guest({ checkIn: d(1), checkOut: d(4), terms: false }));
  check('terms box required', bad.status === 400 && /Tick the box/.test(bad.data.error));
  const r = await api('POST', '/api/checkout', guest({ checkIn: d(1), checkOut: d(4) }));
  check('request recorded', r.status === 200 && r.data.mode === 'request' && r.data.booking.status === 'requested', r.text);
  const ref = r.data.booking.ref;
  const b = row(ref);
  check('terms version and time stored', b.terms_version && b.terms_accepted_at);
  const still = (await api('GET', `/api/availability?slug=${SLUG}&from=${d(1)}&to=${d(4)}`)).data.days;
  check('a request does not block the nights', still.every((x) => x.available));
  check('lookup with the wrong email fails', (await api('POST', '/api/booking', { ref, email: 'wrong@example.com' })).status === 404);
  const look = await api('POST', '/api/booking', { ref: ref.replace('TRL-', '').toLowerCase(), email: 'TEST@example.com' });
  check('lookup by ref without prefix and any-case email', look.status === 200 && look.data.booking.canCancel === true, look.text);
  const cancel = await api('POST', '/api/booking', { ref, email: 'test@example.com', action: 'cancel' });
  check('request withdrawn', cancel.status === 200 && cancel.data.booking.status === 'cancelled' && cancel.data.refundPence === 0, cancel.text);
  const again = await api('POST', '/api/booking', { ref, email: 'test@example.com', action: 'cancel' });
  check('second cancel refused', again.status === 409);
}

if (config.mode === 'instant') {
  if (!vars.STRIPE_SECRET_KEY.startsWith('sk_test_')) throw new Error('Instant-mode tests only run with Stripe test keys.');
  section('Instant mode booking (Stripe test mode)');
  check('publishable key looks right', /^pk_test_[A-Za-z0-9]{99}$/.test(config.stripePublishableKey ?? ''), `length ${config.stripePublishableKey?.length}`);

  // Pay, confirm, cancel, refund.
  const r = await api('POST', '/api/checkout', guest({ checkIn: d(1), checkOut: d(4), extras: ['parking'] }));
  check('checkout session opened', r.status === 200 && r.data.mode === 'instant' && r.data.clientSecret, r.text);
  const ref = r.data.ref;
  let b = row(ref);
  check('booking pending with a session id', b.status === 'pending' && b.stripe_session_id?.startsWith('cs_test_'));
  check('nights held while paying', sql(`SELECT COUNT(*) AS n FROM holds WHERE booking_ref = '${ref}'`)[0].n === 1);
  const blocked = (await api('GET', `/api/availability?slug=${SLUG}&from=${d(1)}&to=${d(4)}`)).data.days;
  check('held nights show as taken', blocked.every((x) => !x.available));
  const clash = await api('POST', '/api/checkout', guest({ checkIn: d(2), checkOut: d(5), email: 'other@example.com' }));
  check('second guest on held nights refused', clash.status === 409, clash.text);

  check('webhook with a bad signature refused', (await signedWebhook('checkout.session.completed', { id: b.stripe_session_id }, 'whsec_wrong')).status === 400);
  const pi = await paidIntent(b.total_pence, ref);
  check('Stripe test payment succeeded', pi.status === 'succeeded', JSON.stringify(pi.error ?? pi.status));
  const event = { id: b.stripe_session_id, object: 'checkout.session', metadata: { ref }, payment_status: 'paid', payment_intent: pi.id };
  const hook = await signedWebhook('checkout.session.completed', event);
  check('webhook accepted', hook.status === 200, hook.text);
  b = row(ref);
  check('booking confirmed', b.status === 'confirmed' && b.payment_intent === pi.id);
  check('written to the mock PMS', b.pms_ref === `mock-${ref}`);
  check('hold released', sql(`SELECT COUNT(*) AS n FROM holds WHERE booking_ref = '${ref}'`)[0].n === 0);
  check('confirmed nights stay blocked', (await api('GET', `/api/availability?slug=${SLUG}&from=${d(1)}&to=${d(4)}`)).data.days.every((x) => !x.available));
  await signedWebhook('checkout.session.completed', event);
  check('webhook retry changes nothing', row(ref).updated_at === b.updated_at && sql(`SELECT COUNT(*) AS n FROM events WHERE type = 'paid'`)[0].n === 1);
  const conf = await api('GET', `/api/booking?session_id=${b.stripe_session_id}`);
  check('confirmation page lookup by session', conf.status === 200 && conf.data.booking.status === 'confirmed' && conf.data.booking.total === b.total_pence);
  const ical = await api('GET', `/ical/${SLUG}.ics`);
  check('booking appears in the iCal feed', ical.text.includes(`Direct booking ${ref}`));

  const cancel = await api('POST', '/api/booking', { ref, email: 'test@example.com', action: 'cancel' });
  check('guest cancel ok', cancel.status === 200 && cancel.data.booking.status === 'refunded' && cancel.data.refundPence === b.total_pence, cancel.text);
  const refunds = await stripe(`refunds?payment_intent=${pi.id}`);
  check('full refund in Stripe', refunds.data?.[0]?.amount === b.total_pence && refunds.data[0].status === 'succeeded', JSON.stringify(refunds.data?.[0]?.status));
  check('nights free again', (await api('GET', `/api/availability?slug=${SLUG}&from=${d(1)}&to=${d(4)}`)).data.days.every((x) => x.available));

  // A night is taken while the guest is paying: automatic refund.
  section('Night taken mid-checkout');
  const r2 = await api('POST', '/api/checkout', guest({ checkIn: d(14), checkOut: d(17), email: 'clash@example.com' }));
  const ref2 = r2.data.ref;
  const b2 = row(ref2);
  sql(`INSERT INTO bookings (ref, property, check_in, check_out, guests, nights_json, extras_json, subtotal_pence, discount_pence, extras_pence,
       total_pence, status, mode, first_name, last_name, email, phone, terms_version, terms_accepted_at)
       VALUES ('TRL-OTHER1', '${SLUG}', '${d(15)}', '${d(16)}', 2, '[]', '[]', 0, 0, 0, 0, 'confirmed', 'instant', 'O', 'T', 'o@example.com', '1', 'x', 'x')`);
  const pi2 = await paidIntent(b2.total_pence, ref2);
  await signedWebhook('checkout.session.completed', { id: b2.stripe_session_id, metadata: { ref: ref2 }, payment_status: 'paid', payment_intent: pi2.id });
  check('booking marked as a conflict', row(ref2).status === 'conflict');
  const refunds2 = await stripe(`refunds?payment_intent=${pi2.id}`);
  check('refunded automatically in Stripe', refunds2.data?.[0]?.amount === b2.total_pence, JSON.stringify(refunds2.data?.[0]));

  // Session lapses without payment.
  section('Checkout lapses');
  const r3 = await api('POST', '/api/checkout', guest({ checkIn: d(18), checkOut: d(21), email: 'lapse@example.com' }));
  const b3 = row(r3.data.ref);
  await signedWebhook('checkout.session.expired', { id: b3.stripe_session_id, metadata: { ref: b3.ref }, payment_status: 'unpaid' });
  check('expired session frees the nights', row(b3.ref).status === 'expired' && (await api('GET', `/api/availability?slug=${SLUG}&from=${d(18)}&to=${d(21)}`)).data.days.every((x) => x.available));
  check('expired booking hidden from lookup', (await api('POST', '/api/booking', { ref: b3.ref, email: 'lapse@example.com' })).status === 404);
}

section('iCal feed');
{
  sql(`INSERT INTO bookings (ref, property, check_in, check_out, guests, nights_json, extras_json, subtotal_pence, discount_pence, extras_pence,
       total_pence, status, mode, first_name, last_name, email, phone, terms_version, terms_accepted_at)
       VALUES ('TRL-ICAL01', '${SLUG}', '${d(26)}', '${d(28)}', 2, '[]', '[]', 0, 0, 0, 0, 'confirmed', 'instant', 'I', 'C', 'i@example.com', '1', 'x', 'x')`);
  const r = await api('GET', `/ical/${SLUG}.ics`);
  check('served as text/calendar', r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('text/calendar'));
  check('valid calendar wrapper', r.text.startsWith('BEGIN:VCALENDAR\r\n') && r.text.includes('END:VCALENDAR'));
  check('confirmed booking listed with all-day dates', r.text.includes(`DTSTART;VALUE=DATE:${d(26).replaceAll('-', '')}`) && r.text.includes(`DTEND;VALUE=DATE:${d(28).replaceAll('-', '')}`));
  check('guest names and emails not in the feed', !/i@example\.com|test@example\.com/.test(r.text));
  check('unknown property is a 404', (await api('GET', '/ical/nope.ics')).status === 404);
}

section('Daily cron');
{
  const ins = (ref, ci, co, status = 'confirmed', created = "datetime('now')", pi = 'NULL') =>
    `INSERT INTO bookings (ref, property, check_in, check_out, guests, nights_json, extras_json, subtotal_pence, discount_pence, extras_pence,
     total_pence, status, mode, first_name, last_name, email, phone, terms_version, terms_accepted_at, created_at, payment_intent)
     VALUES ('${ref}', '${SLUG}', '${ci}', '${co}', 2, '[]', '[]', 0, 0, 0, 0, '${status}', 'instant', 'C', 'R', 'cron@example.com', '1', 'x', 'x', ${created}, ${pi})`;
  sql(
    [
      ins('TRL-CRON01', addDays(today, 2), addDays(today, 5)), // pre-arrival due
      ins('TRL-CRON02', addDays(today, -1), addDays(today, 2)), // morning after arrival
      ins('TRL-CRON03', addDays(today, -4), addDays(today, -1)), // thank you
      ins('TRL-CRON04', addDays(today, 20), addDays(today, 23)), // nothing due
      ins('TRL-CRON05', addDays(today, 30), addDays(today, 33), 'pending', "datetime('now', '-3 hours')"), // unpaid, lapsed
      ins('TRL-CRON06', addDays(today, 40), addDays(today, 43), 'pending', "datetime('now', '-10 minutes')"), // still paying
      ins('TRL-CRON07', '2018-01-01', '2018-01-03', 'confirmed', "'2017-12-01 00:00:00'", "'pi_old'"), // past retention
      ins('TRL-CRON08', '2025-06-01', '2025-06-03', 'expired', "'2025-05-01 00:00:00'"), // unpaid, over 12 months
      `INSERT INTO holds (booking_ref, property, check_in, check_out, expires_at) VALUES ('TRL-CRON05', '${SLUG}', '${addDays(today, 30)}', '${addDays(today, 33)}', '2020-01-01T00:00:00.000Z')`,
      `INSERT INTO enquiries (type, name, email, created_at) VALUES ('contact', 'Old', 'old@example.com', '2025-01-01 00:00:00')`,
    ].join('; '),
  );
  const run = await fetch(`${BASE}/__scheduled?cron=0+9+*+*+*`);
  check('cron runs', run.status === 200);
  await new Promise((r) => setTimeout(r, 1500)); // the jobs run in waitUntil
  const flags = Object.fromEntries(sql("SELECT ref, status, pre_arrival_sent AS p, checkin_followup_sent AS c, thank_you_sent AS t FROM bookings WHERE ref LIKE 'TRL-CRON%'").map((r) => [r.ref, r]));
  check('pre-arrival sent 48h before', flags['TRL-CRON01']?.p === 1);
  check('morning-after-arrival sent', flags['TRL-CRON02']?.c === 1);
  check('thank-you sent the day after checkout', flags['TRL-CRON03']?.t === 1);
  check('nothing sent too early', flags['TRL-CRON04']?.p === 0 && flags['TRL-CRON04']?.c === 0);
  check('unpaid booking expired after 2h', flags['TRL-CRON05']?.status === 'expired');
  check('booking still paying left alone', flags['TRL-CRON06']?.status === 'pending');
  check('expired hold cleared', sql("SELECT COUNT(*) AS n FROM holds WHERE booking_ref = 'TRL-CRON05'")[0].n === 0);
  check('7-year-old paid booking deleted', !flags['TRL-CRON07']);
  check('12-month-old unpaid booking deleted', !flags['TRL-CRON08']);
  check('12-month-old enquiry deleted', sql("SELECT COUNT(*) AS n FROM enquiries WHERE name = 'Old'")[0].n === 0);
  const before = JSON.stringify(flags);
  await fetch(`${BASE}/__scheduled?cron=0+9+*+*+*`);
  await new Promise((r) => setTimeout(r, 1500));
  const after = Object.fromEntries(sql("SELECT ref, status, pre_arrival_sent AS p, checkin_followup_sent AS c, thank_you_sent AS t FROM bookings WHERE ref LIKE 'TRL-CRON%'").map((r) => [r.ref, r]));
  check('second run sends nothing twice', JSON.stringify(after) === before);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
