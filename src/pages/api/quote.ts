// Live price for chosen dates, guests and extras. Logged to the funnel.
import type { APIRoute } from 'astro';
import type { ExtraId } from '../../config/booking';
import { fail, json, readBody, str } from '../../lib/api';
import { getQuote } from '../../lib/availability';
import { logEvent } from '../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  const body = await readBody(request);
  try {
    const quote = await getQuote(env, {
      slug: str(body.slug, 80),
      checkIn: str(body.checkIn, 10),
      checkOut: str(body.checkOut, 10),
      guests: Number(body.guests),
      extras: Array.isArray(body.extras) ? (body.extras.filter((x) => typeof x === 'string') as ExtraId[]) : [],
    });
    if (quote.ok) locals.runtime.ctx.waitUntil(logEvent(env.DB, 'quote', quote.slug, { checkIn: quote.checkIn, nights: quote.nightCount, guests: quote.guests }));
    return json(quote);
  } catch (e) {
    console.error('quote failed', e);
    return fail("We couldn't price those dates just now. Try again in a moment.", 502);
  }
};
