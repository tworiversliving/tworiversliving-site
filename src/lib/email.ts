import { booking as rules } from '../config/booking';
import { site } from '../config/site';
import { getProperty } from '../data/properties';
import { gbp } from './availability';
import { addDays, fmtDateLong, londonToUtc } from './dates';
import type { BookingRow } from './db';

// Guest and host emails, sent through Resend from stay@. Written to read like a person wrote them.

interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(env: Env, mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email not sent: RESEND_API_KEY missing] ${mail.subject} → ${mail.to}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: Array.isArray(mail.to) ? mail.to : [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      reply_to: mail.replyTo ?? env.HOST_EMAIL,
    }),
  });
  if (!res.ok) console.error('Resend failed', res.status, await res.text().catch(() => ''));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Paragraphs in, branded email out. Lines starting with "- " become a list. */
function layout(env: Env, paragraphs: string[], rows?: [string, string][]): { html: string; text: string } {
  const body = paragraphs
    .map((p) =>
      p.startsWith('- ')
        ? `<ul style="margin:0 0 16px;padding-left:20px">${p.split('\n').map((l) => `<li style="margin:0 0 6px">${esc(l.replace(/^- /, ''))}</li>`).join('')}</ul>`
        : `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
  const table = rows?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 24px;font-size:15px">${rows
        .map(([k, v]) => `<tr><td style="padding:8px 0;border-top:1px solid #D9DCD1;color:#5C6657;width:42%">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #D9DCD1;color:#2F3A2B">${esc(v)}</td></tr>`)
        .join('')}</table>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#EEF0E8;font-family:Manrope,Helvetica,Arial,sans-serif;color:#2F3A2B;font-size:16px;line-height:1.6">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<img src="${env.SITE_URL}/brand/logo-horizontal.png" alt="Two Rivers Living" width="200" style="display:block;margin:0 0 28px">
<div style="background:#FAFAF6;border:1px solid #D9DCD1;border-radius:4px;padding:28px 24px">${body}${table}</div>
<p style="font-size:13px;color:#5C6657;margin:20px 0 0">${esc(site.legalName)} · ${esc(site.email)} · ${esc(site.phone)}<br>Registered in England and Wales, company no. ${esc(site.companyNumber)}</p>
</div></body></html>`;
  const text = [...paragraphs, ...(rows ?? []).map(([k, v]) => `${k}: ${v}`), '', `${site.legalName} · ${site.email}`].join('\n\n');
  return { html, text };
}

function stayRows(b: BookingRow): [string, string][] {
  const p = getProperty(b.property);
  const extras = JSON.parse(b.extras_json) as { label: string; pence: number }[];
  return [
    ['Booking reference', b.ref],
    ['Home', p?.name ?? b.property],
    ['Check-in', `${fmtDateLong(b.check_in)} from ${rules.checkInTime}`],
    ['Checkout', `${fmtDateLong(b.check_out)} by ${rules.checkOutTime}`],
    ['Guests', String(b.guests)],
    ...extras.map((e) => [e.label, gbp(e.pence)] as [string, string]),
    ['Total', gbp(b.total_pence)],
  ];
}

export function freeCancellationDeadline(b: Pick<BookingRow, 'check_in'>): Date {
  return londonToUtc(addDays(b.check_in, -rules.freeCancellationDays), rules.checkInTime);
}

const deadlineText = (b: BookingRow) =>
  `${rules.checkInTime} on ${fmtDateLong(addDays(b.check_in, -rules.freeCancellationDays))}`;

export const emails = {
  confirmed(env: Env, b: BookingRow) {
    const { html, text } = layout(
      env,
      [
        `Hi ${b.first_name},`,
        "Your stay is booked and paid. Here are the details.",
        `You can cancel for a full refund until ${deadlineText(b)}. To view or cancel the booking, go to ${env.SITE_URL}/booking and enter your reference and email.`,
        `We'll email the address, how to get in and the wifi details 48 hours before you arrive. If you need anything before then, reply to this email.`,
        `See you soon,\n${site.hosts}`,
      ],
      stayRows(b),
    );
    return { to: b.email, subject: `Booking confirmed: ${b.ref}`, html, text };
  },
  requested(env: Env, b: BookingRow) {
    const { html, text } = layout(
      env,
      [
        `Hi ${b.first_name},`,
        "Thanks for your booking request. Nothing has been charged yet.",
        "We'll check the dates and reply within a few hours with a confirmation and a secure link to pay. Your booking is confirmed once payment is made.",
        `${site.hosts}`,
      ],
      stayRows(b),
    );
    return { to: b.email, subject: `Booking request received: ${b.ref}`, html, text };
  },
  hostNewBooking(env: Env, b: BookingRow) {
    const kind = b.mode === 'request' ? 'NEW BOOKING REQUEST (not paid, needs a payment link)' : 'New direct booking, paid';
    const { html, text } = layout(
      env,
      [
        kind,
        `${b.first_name} ${b.last_name} · ${b.email} · ${b.phone}`,
        b.work_trip ? `Work trip${b.company ? ` for ${b.company}` : ''}` : 'Leisure stay',
        b.arrival_time ? `Estimated arrival: ${b.arrival_time}` : '',
        b.notes ? `Notes: ${b.notes}` : '',
        b.pms_ref ? `Added to the PMS as ${b.pms_ref}.` : b.mode === 'instant' ? 'Check the PMS: it was not added automatically.' : 'Block these dates in the PMS once confirmed.',
      ].filter(Boolean),
      stayRows(b),
    );
    return { to: env.HOST_EMAIL, subject: `${b.mode === 'request' ? 'Request' : 'Booking'}: ${b.ref}, ${b.check_in} to ${b.check_out}`, html, text, replyTo: b.email };
  },
  conflict(env: Env, b: BookingRow) {
    const { html, text } = layout(env, [
      `Hi ${b.first_name},`,
      `We're sorry. While you were paying, the last of those nights was booked by another guest, so we couldn't confirm your stay. We've refunded the full ${gbp(b.total_pence)} to your card. It usually shows within 5 to 10 working days.`,
      `If you'd like to look at other dates, reply to this email and we'll help.`,
      `${site.hosts}`,
    ]);
    return { to: b.email, subject: `We couldn't confirm booking ${b.ref}`, html, text };
  },
  cancelled(env: Env, b: BookingRow, refundPence: number) {
    const { html, text } = layout(env, [
      `Hi ${b.first_name},`,
      `Your booking ${b.ref} is cancelled.`,
      refundPence > 0
        ? `We've refunded ${gbp(refundPence)} to your card. It usually shows within 5 to 10 working days.`
        : 'This cancellation was inside the 5-day window, so no refund is due under the booking terms.',
      `We hope to host you another time.\n${site.hosts}`,
    ]);
    return { to: b.email, subject: `Booking cancelled: ${b.ref}`, html, text };
  },
  preArrival(env: Env, b: BookingRow, info: ArrivalInfo | undefined) {
    const p = getProperty(b.property);
    const lines = info
      ? [
          `- Address: ${info.address}\n- Getting in: ${info.access}\n- Wifi: ${info.wifiName}, password ${info.wifiPassword}${info.parking ? `\n- Parking: ${info.parking}` : ''}${info.extra ? `\n- ${info.extra}` : ''}`,
        ]
      : ['We will send the address and access details separately.'];
    const { html, text } = layout(env, [
      `Hi ${b.first_name},`,
      `You arrive on ${fmtDateLong(b.check_in)}. Check-in is from ${rules.checkInTime}.`,
      ...lines,
      `A few house rules: ${p?.houseRules.slice(2).join('; ').toLowerCase()}.`,
      `If anything isn't right when you arrive, message us on ${site.phone} and one of us can be there quickly.`,
      `${site.hosts}`,
    ]);
    return { to: b.email, subject: `Your stay on ${fmtDateLong(b.check_in)}: how to get in`, html, text };
  },
  checkinFollowup(env: Env, b: BookingRow) {
    const { html, text } = layout(env, [
      `Hi ${b.first_name},`,
      `We hope you've settled in. If anything isn't right, tell us now and we'll sort it while you're here. You can reply to this email or message us on ${site.phone}.`,
      `${site.hosts}`,
    ]);
    return { to: b.email, subject: 'Is everything OK with the flat?', html, text };
  },
  thankYou(env: Env, b: BookingRow) {
    const { html, text } = layout(env, [
      `Hi ${b.first_name},`,
      `Thanks for staying with us. If you come back to London, book on ${env.SITE_URL} for our best price, or reply to this email and we'll hold dates for you.`,
      `${site.hosts}`,
    ]);
    return { to: b.email, subject: 'Thanks for staying with us', html, text };
  },
  enquiryHost(env: Env, e: EnquiryData) {
    const { html, text } = layout(
      env,
      [`New ${e.type.replace('_', ' ')} enquiry from ${e.name}.`, e.message ? `Message: ${e.message}` : ''].filter(Boolean),
      [
        ['Name', e.name],
        ['Email', e.email],
        ['Phone', e.phone || '-'],
        ['Company', e.company || '-'],
        ['Dates', e.checkIn && e.checkOut ? `${e.checkIn} to ${e.checkOut}` : '-'],
        ['Guests', e.guests ? String(e.guests) : '-'],
        ['Purpose', e.purpose || '-'],
        ['Needs an invoice', e.needsInvoice ? 'Yes' : 'No'],
      ],
    );
    return { to: env.HOST_EMAIL, subject: `Enquiry: ${e.name}${e.company ? `, ${e.company}` : ''}`, html, text, replyTo: e.email };
  },
  enquiryReply(env: Env, e: EnquiryData) {
    const { html, text } = layout(env, [
      `Hi ${e.name.split(' ')[0]},`,
      e.type === 'contact'
        ? `Thanks for getting in touch. ${site.responseTime}`
        : `Thanks for your enquiry. We'll check the dates and come back to you with a quote. ${site.responseTime}`,
      `${site.hosts}\n${site.legalName}`,
    ]);
    return { to: e.email, subject: 'Thanks, we have your enquiry', html, text };
  },
};

export interface EnquiryData {
  type: 'long_stay' | 'work' | 'contact';
  property?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  company?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  purpose?: string | null;
  needsInvoice?: boolean;
  message?: string | null;
}

export interface ArrivalInfo {
  address: string;
  access: string;
  wifiName: string;
  wifiPassword: string;
  parking?: string;
  extra?: string;
}

export function arrivalInfo(env: Env, slug: string): ArrivalInfo | undefined {
  try {
    return env.ARRIVAL_INFO ? (JSON.parse(env.ARRIVAL_INFO) as Record<string, ArrivalInfo>)[slug] : undefined;
  } catch {
    return undefined;
  }
}

export async function notifySlack(env: Env, text: string) {
  if (!env.SLACK_WEBHOOK_URL) return;
  await fetch(env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => {});
}
