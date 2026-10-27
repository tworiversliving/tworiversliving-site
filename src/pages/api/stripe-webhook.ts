// Stripe calls this when a Checkout session is paid or lapses.
// Locally: `stripe listen --events checkout.session.completed,... --forward-to localhost:8787/api/stripe-webhook` (see HANDOFF.md).
import type { APIRoute } from 'astro';
import { json } from '../../lib/api';
import { getBookingBySession } from '../../lib/db';
import { expireBooking, finalizePaid } from '../../lib/finalize';
import { verifyWebhook } from '../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  let event;
  try {
    event = await verifyWebhook(env, request);
  } catch (e) {
    console.error('Webhook signature check failed', e);
    return json({ error: 'Invalid signature' }, 400);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'checkout.session.expired') {
    const session = event.data.object;
    const ref = session.metadata?.ref ?? (await getBookingBySession(env.DB, session.id))?.ref;
    if (!ref) return json({ received: true, ignored: 'no booking' });

    if (event.type === 'checkout.session.expired') {
      await expireBooking(env, ref);
    } else if (session.payment_status === 'paid') {
      const pi = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
      // Throws on a temporary failure, so Stripe retries.
      await finalizePaid(env, ref, pi);
    }
  }
  return json({ received: true });
};
