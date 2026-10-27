// Tells the booking pages which mode is live and which public keys to use.
import type { APIRoute } from 'astro';
import { json } from '../../lib/api';
import { stripeEnabled } from '../../lib/stripe';

export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
  const env = locals.runtime.env;
  return json({
    mode: stripeEnabled(env) ? 'instant' : 'request',
    stripePublishableKey: stripeEnabled(env) ? env.STRIPE_PUBLISHABLE_KEY : null,
    turnstileSiteKey: env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY ?? null) : null,
  });
};
