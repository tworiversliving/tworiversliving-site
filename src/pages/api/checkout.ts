// Takes the guest's details and either opens Stripe Embedded Checkout (instant booking)
// or, when Stripe isn't set up, records a booking request for the hosts to confirm.
import type { APIRoute } from 'astro';
import { booking as rules, type ExtraId } from '../../config/booking';
import { clientIp, EMAIL_RE, fail, json, publicBooking, readBody, str } from '../../lib/api';
import { getQuote } from '../../lib/availability';
import { logEvent, setStatus } from '../../lib/db';
import { insertBooking, notifyRequest, placeHold, releaseHold, type GuestDetails } from '../../lib/finalize';
import { createCheckoutSession, stripeEnabled } from '../../lib/stripe';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, url }) => {
  const env = locals.runtime.env;
  const body = await readBody(request);
  const ip = clientIp(request);

  const guest: GuestDetails = {
    firstName: str(body.firstName, 80),
    lastName: str(body.lastName, 80),
    email: str(body.email, 200).toLowerCase(),
    phone: str(body.phone, 40),
    arrivalTime: str(body.arrivalTime, 40) || null,
    workTrip: body.workTrip === true || body.workTrip === 'yes' || body.workTrip === '1',
    company: str(body.company, 120) || null,
    notes: str(body.notes, 1000) || null,
    ip,
  };
  if (!guest.firstName || !guest.lastName) return fail('Enter your first and last name.');
  if (!EMAIL_RE.test(guest.email)) return fail('Enter a valid email address.');
  if (guest.phone.replace(/\D/g, '').length < 7) return fail('Enter a mobile number we can reach you on.');
  if (body.terms !== true && body.terms !== 'on' && body.terms !== '1') return fail('Tick the box to agree to the booking terms and house rules.');
  if (!(await verifyTurnstile(env, body.turnstileToken, ip))) return fail("We couldn't check you're not a bot. Reload the page and try again.", 403);

  let quote;
  try {
    quote = await getQuote(env, {
      slug: str(body.slug, 80),
      checkIn: str(body.checkIn, 10),
      checkOut: str(body.checkOut, 10),
      guests: Number(body.guests),
      extras: Array.isArray(body.extras) ? (body.extras.filter((x) => typeof x === 'string') as ExtraId[]) : [],
    });
  } catch (e) {
    console.error('checkout quote failed', e);
    return fail("We couldn't check those dates just now. Try again in a moment.", 502);
  }
  if (!quote.ok) return fail(quote.errors[0] ?? 'Those dates are not available.', 409);
  if (quote.mode !== 'instant') {
    return fail(`Stays of ${rules.maxInstantNights + 1} nights or more are booked by enquiry. Use the long stay form and we'll reply with a quote.`, 409);
  }

  // Request mode: no payment, the hosts confirm by hand.
  if (!stripeEnabled(env)) {
    const b = await insertBooking(env, quote, guest, 'request');
    locals.runtime.ctx.waitUntil(notifyRequest(env, b));
    return json({ ok: true, mode: 'request', booking: publicBooking(b) });
  }

  // Instant mode: hold the nights, then open Checkout. The hold and the session lapse together.
  const b = await insertBooking(env, quote, guest, 'instant');
  const expiresAt = new Date(Date.now() + (rules.holdMinutes + 1) * 60_000);
  if (!(await placeHold(env, b, expiresAt))) {
    await setStatus(env.DB, b.ref, 'expired');
    return fail('Another guest is booking those nights right now. Try different dates, or check back in half an hour.', 409);
  }
  try {
    const session = await createCheckoutSession(env, b, url.origin, expiresAt);
    await env.DB.prepare('UPDATE bookings SET stripe_session_id = ? WHERE ref = ?').bind(session.id, b.ref).run();
    locals.runtime.ctx.waitUntil(logEvent(env.DB, 'checkout_open', b.property, { ref: b.ref, total: b.total_pence }));
    return json({ ok: true, mode: 'instant', ref: b.ref, clientSecret: session.clientSecret });
  } catch (e) {
    console.error('Stripe session failed', e);
    await releaseHold(env, b.ref);
    await setStatus(env.DB, b.ref, 'expired');
    return fail("We couldn't open the payment step. Nothing has been charged. Try again in a moment.", 502);
  }
};
