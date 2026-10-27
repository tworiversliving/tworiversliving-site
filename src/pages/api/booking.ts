// Booking lookup for the confirmation page (by Stripe session) and the manage-booking page (by reference
// and email), plus self-serve cancellation.
import type { APIRoute } from 'astro';
import { fail, json, publicBooking, readBody, str } from '../../lib/api';
import { getBookingByRef, getBookingBySession } from '../../lib/db';
import { cancelByGuest, finalizePaid } from '../../lib/finalize';
import { retrieveSession, stripeEnabled } from '../../lib/stripe';

export const prerender = false;

/** GET ?session_id=cs_... : used by /book/confirmed straight after payment. */
export const GET: APIRoute = async ({ locals, url }) => {
  const env = locals.runtime.env;
  const sessionId = url.searchParams.get('session_id') ?? '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return fail('Missing session.', 400);
  let b = await getBookingBySession(env.DB, sessionId);
  if (!b) return fail("We couldn't find that booking.", 404);

  // If the webhook hasn't landed yet, ask Stripe directly. finalizePaid is safe to call twice.
  if (b.status === 'pending' && stripeEnabled(env)) {
    try {
      const s = await retrieveSession(env, sessionId);
      if (s.payment_status === 'paid') {
        const pi = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);
        b = (await finalizePaid(env, b.ref, pi)) ?? b;
      }
    } catch (e) {
      console.error('Session check failed', e);
    }
  }
  return json({ ok: true, booking: publicBooking(b) });
};

/** POST { ref, email, action?: 'cancel' } : used by /booking. */
export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  const body = await readBody(request);
  const ref = str(body.ref, 20).toUpperCase().replace(/^(TRL)?-?/, 'TRL-');
  const email = str(body.email, 200).toLowerCase();
  const b = await getBookingByRef(env.DB, ref);
  // Same message for a wrong reference or a wrong email, so neither can be guessed one at a time.
  if (!b || b.email.toLowerCase() !== email || b.status === 'pending' || b.status === 'expired') {
    return fail("We couldn't find a booking with that reference and email. Check both against your confirmation email.", 404);
  }
  if (body.action !== 'cancel') return json({ ok: true, booking: publicBooking(b) });

  try {
    const result = await cancelByGuest(env, b);
    if (!result.ok) return fail(result.error, 409);
    const updated = (await getBookingByRef(env.DB, ref))!;
    return json({ ok: true, refundPence: result.refundPence, booking: publicBooking(updated) });
  } catch (e) {
    console.error('Cancel failed', ref, e);
    return fail("We couldn't cancel just now and nothing has changed. Try again, or email us and we'll do it for you.", 502);
  }
};
