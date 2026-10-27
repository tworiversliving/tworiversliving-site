// Calendar for the booking panel: which nights are free, the direct price and the minimum stay.
import type { APIRoute } from 'astro';
import { booking } from '../../config/booking';
import { getProperty } from '../../data/properties';
import { fail, json } from '../../lib/api';
import { getCalendar } from '../../lib/availability';
import { addDays, isIsoDate, nightsBetween, todayLondon } from '../../lib/dates';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const env = locals.runtime.env;
  const slug = url.searchParams.get('slug') ?? '';
  if (!getProperty(slug)) return fail('Unknown property.', 404);

  const today = todayLondon();
  const from = url.searchParams.get('from') ?? today;
  const to = url.searchParams.get('to') ?? addDays(today, booking.bookingWindowDays + 1);
  if (!isIsoDate(from) || !isIsoDate(to) || to <= from) return fail('Invalid date range.');
  if (nightsBetween(from, to) > booking.bookingWindowDays + 31) return fail('Date range too long.');

  try {
    const days = await getCalendar(env, slug, from, to);
    return json(
      {
        ok: true,
        slug,
        today,
        maxNights: booking.maxNights,
        maxInstantNights: booking.maxInstantNights,
        defaultMinStay: booking.defaultMinStay,
        days: days.map((d) => ({ date: d.date, available: d.available, price: d.price, minStay: d.minStay })),
      },
      200,
      { 'Cache-Control': 'private, max-age=60' },
    );
  } catch (e) {
    console.error('availability failed', e);
    return fail("We couldn't load the calendar just now.", 502);
  }
};
