// Our own calendar feed of direct bookings and active holds, for a PMS to import
// (only needed with the iCal adapter; with Smoobu, bookings are written over the API).
import type { APIRoute } from 'astro';
import { getProperty } from '../../data/properties';
import { todayLondon } from '../../lib/dates';

export const prerender = false;

const compact = (iso: string) => iso.replaceAll('-', '');

export const GET: APIRoute = async ({ locals, params }) => {
  const env = locals.runtime.env;
  const slug = (params.slug ?? '').replace(/\.ics$/, '');
  const property = getProperty(slug);
  if (!property) return new Response('Not found', { status: 404 });

  const today = todayLondon();
  const now = new Date().toISOString();
  const [bookings, holds] = await Promise.all([
    env.DB.prepare("SELECT ref, check_in, check_out FROM bookings WHERE property = ? AND status = 'confirmed' AND check_out >= ?")
      .bind(slug, today)
      .all<{ ref: string; check_in: string; check_out: string }>(),
    env.DB.prepare('SELECT booking_ref AS ref, check_in, check_out FROM holds WHERE property = ? AND expires_at > ?')
      .bind(slug, now)
      .all<{ ref: string; check_in: string; check_out: string }>(),
  ]);

  const stamp = now.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = [...bookings.results.map((b) => ({ ...b, kind: 'Direct booking' })), ...holds.results.map((h) => ({ ...h, kind: 'Held while paying' }))].map((e) =>
    [
      'BEGIN:VEVENT',
      `UID:${e.ref}-${e.kind === 'Direct booking' ? 'b' : 'h'}@tworiversliving.co.uk`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.check_in)}`,
      `DTEND;VALUE=DATE:${compact(e.check_out)}`,
      `SUMMARY:${e.kind} ${e.ref}`,
      'END:VEVENT',
    ].join('\r\n'),
  );

  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Two Rivers Living//Direct bookings//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n');
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
};
