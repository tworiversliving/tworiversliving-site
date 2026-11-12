// Long-stay, work-stay and contact enquiries: saved to D1, emailed to stay@ with an auto-reply to the guest.
import type { APIRoute } from 'astro';
import { booking } from '../../config/booking';
import { getProperty } from '../../data/properties';
import { clientIp, EMAIL_RE, fail, json, readBody, str } from '../../lib/api';
import { isIsoDate, nightsBetween, todayLondon } from '../../lib/dates';
import { logEvent } from '../../lib/db';
import { emails, notifySlack, sendEmail, type EnquiryData } from '../../lib/email';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const TYPES = ['long_stay', 'work', 'contact'] as const;

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env;
  const body = await readBody(request);
  const type = TYPES.find((t) => t === body.type) ?? 'contact';
  const checkIn = str(body.checkIn, 10) || null;
  const checkOut = str(body.checkOut, 10) || null;
  const guests = Number(body.guests) || null;
  const e: EnquiryData = {
    type,
    property: getProperty(str(body.property, 80)) ? str(body.property, 80) : null,
    checkIn,
    checkOut,
    guests,
    company: str(body.company, 120) || null,
    name: str(body.name, 120),
    email: str(body.email, 200).toLowerCase(),
    phone: str(body.phone, 40) || null,
    purpose: str(body.purpose, 80) || null,
    needsInvoice: body.needsInvoice === true || body.needsInvoice === '1' || body.needsInvoice === 'on',
    message: str(body.message, 3000) || null,
  };

  if (!e.name) return fail('Enter your name.');
  if (!EMAIL_RE.test(e.email)) return fail('Enter a valid email address.');
  if (type === 'contact' && !e.message) return fail('Add a message.');
  if (type !== 'contact') {
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return fail('Choose your arrival and leaving dates.');
    if (checkIn < todayLondon()) return fail('Your arrival date has already passed.');
    if (checkOut <= checkIn) return fail('Your leaving date must be after your arrival date.');
    if (nightsBetween(checkIn, checkOut) > booking.maxNights) {
      return fail(`We can't take stays over ${booking.maxNights} nights.`);
    }
  }
  if (!(await verifyTurnstile(env, body.turnstileToken, clientIp(request)))) {
    return fail("We couldn't check you're not a bot. Reload the page and try again.", 403);
  }

  await env.DB.prepare(
    `INSERT INTO enquiries (type, property, check_in, check_out, guests, company, name, email, phone, purpose, needs_invoice, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(e.type, e.property, e.checkIn, e.checkOut, e.guests, e.company, e.name, e.email, e.phone, e.purpose, e.needsInvoice ? 1 : 0, e.message)
    .run();

  locals.runtime.ctx.waitUntil(
    Promise.all([
      sendEmail(env, emails.enquiryHost(env, e)),
      sendEmail(env, emails.enquiryReply(env, e)),
      notifySlack(env, `New ${e.type.replace('_', ' ')} enquiry from ${e.name}${e.company ? ` (${e.company})` : ''}${e.checkIn ? `, ${e.checkIn} to ${e.checkOut}` : ''}.`),
      logEvent(env.DB, 'enquiry', e.property, { type: e.type }),
    ]),
  );

  // A form posted without JavaScript gets sent back to the page it came from.
  if (!(request.headers.get('accept') ?? '').includes('application/json')) {
    const back = new URL(request.headers.get('referer') ?? '/contact', request.url);
    back.searchParams.set('sent', '1');
    return Response.redirect(back.toString(), 303);
  }
  return json({ ok: true });
};
