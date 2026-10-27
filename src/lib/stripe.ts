// Stripe Embedded Checkout, refunds and webhook checks.
// Instant booking is only switched on when both Stripe keys are set; otherwise the site takes booking requests.
import Stripe from 'stripe';
import { booking as rules } from '../config/booking';
import { getProperty } from '../data/properties';
import { fmtDate } from './dates';
import type { BookingRow } from './db';

export const stripeEnabled = (env: Env) => !!env.STRIPE_SECRET_KEY && !!env.STRIPE_PUBLISHABLE_KEY;

export function getStripe(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** Opens an Embedded Checkout session for a pending booking. Returns the client secret for the page. */
export async function createCheckoutSession(env: Env, b: BookingRow, origin: string, expiresAt: Date) {
  const property = getProperty(b.property);
  const nights = (JSON.parse(b.nights_json) as unknown[]).length;
  const extras = JSON.parse(b.extras_json) as { id: string; label: string; pence: number }[];
  const stayPence = b.total_pence - b.extras_pence;
  const session = await getStripe(env).checkout.sessions.create(
    {
      ui_mode: 'embedded',
      mode: 'payment',
      currency: rules.currency.toLowerCase(),
      customer_email: b.email,
      client_reference_id: b.ref,
      metadata: { ref: b.ref, property: b.property },
      payment_intent_data: {
        description: `${b.ref}: ${property?.name ?? b.property}, ${b.check_in} to ${b.check_out}`,
        metadata: { ref: b.ref },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: stayPence,
            product_data: {
              name: property?.name ?? b.property,
              description: `${nights} night${nights === 1 ? '' : 's'}, ${fmtDate(b.check_in)} to ${fmtDate(b.check_out)}, direct rate`,
            },
          },
        },
        ...extras.map((e) => ({ quantity: 1, price_data: { currency: 'gbp', unit_amount: e.pence, product_data: { name: e.label } } })),
      ],
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      return_url: `${origin}/book/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    },
    { idempotencyKey: `checkout-${b.ref}` },
  );
  return { id: session.id, clientSecret: session.client_secret! };
}

export async function retrieveSession(env: Env, sessionId: string) {
  return getStripe(env).checkout.sessions.retrieve(sessionId);
}

/** Refunds a payment, in full unless `amountPence` is given. Safe to retry. */
export async function refund(env: Env, ref: string, paymentIntent: string, amountPence?: number) {
  return getStripe(env).refunds.create(
    { payment_intent: paymentIntent, ...(amountPence ? { amount: amountPence } : {}), metadata: { ref } },
    { idempotencyKey: `refund-${ref}` },
  );
}

/** Checks the Stripe-Signature header and returns the parsed event. Throws if it doesn't match. */
export async function verifyWebhook(env: Env, request: Request): Promise<Stripe.Event> {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  const signature = request.headers.get('stripe-signature') ?? '';
  const body = await request.text();
  return Stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
}
