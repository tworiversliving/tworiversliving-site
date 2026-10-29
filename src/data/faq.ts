// FAQ copy, used on /faq (all groups) and the home page (the questions marked `home`).
// Answers draw on src/config so times and rules stay in one place.

import { booking, extras } from '../config/booking';
import { site } from '../config/site';

export interface Faq {
  q: string;
  a: string;
  home?: boolean;
}

const pounds = (pence: number) => `£${pence / 100}`;
const parking = extras.find((e) => e.id === 'parking')!;
const early = extras.find((e) => e.id === 'early_checkin')!;
const late = extras.find((e) => e.id === 'late_checkout')!;

export const faqGroups: { title: string; items: Faq[] }[] = [
  {
    title: 'Booking',
    items: [
      {
        q: 'Is it cheaper to book here than on Airbnb or Booking.com?',
        a: 'Yes. Our direct nightly rate is always lower than the price on the booking platforms, and there is no booking or service fee on top. The price you see is the price you pay.',
        home: true,
      },
      {
        q: 'How many people can stay?',
        a: 'Up to 7. There are three double bedrooms, and bedroom 1 also has a sofa bed.',
        home: true,
      },
      {
        q: 'Is there a minimum stay?',
        a: `The minimum stay depends on the dates and is shown in the calendar. It is usually ${booking.defaultMinStay} nights.`,
      },
      {
        q: 'Can I book for more than two weeks?',
        a: `Instant booking covers up to ${booking.maxInstantNights} nights. For anything longer, send us your dates through the work and long stays page and we will come back with a quote. We take stays of up to ${booking.maxNights} nights.`,
      },
    ],
  },
  {
    title: 'Payment and cancellation',
    items: [
      {
        q: 'What is the cancellation policy?',
        a: `Cancel more than ${booking.freeCancellationDays} days before check-in for a full refund. You can do it yourself from the link in your confirmation email.`,
        home: true,
      },
      {
        q: 'How do I pay?',
        a: 'By card, Apple Pay or Google Pay, in full when you book. Payments are handled by Stripe, so your card details never reach us.',
      },
      {
        q: 'Do you take a security deposit?',
        a: 'No.',
      },
    ],
  },
  {
    title: 'During your stay',
    items: [
      {
        q: 'What time are check-in and checkout?',
        a: `Check-in is from ${booking.checkInTime} and checkout is by ${booking.checkOutTime}. Check-in is self check-in with a key lockbox, and we send the details 48 hours before you arrive.`,
        home: true,
      },
      {
        q: 'Can I check in early or leave late?',
        a: `Early check-in from 12:00 is ${pounds(early.price)} and late checkout until 13:00 is ${pounds(late.price)}. We only offer them when the flat is free either side of your stay, so they show up at checkout when they are available.`,
      },
      {
        q: 'Is there parking?',
        a: `We can arrange a visitor permit for the resident bays nearby for ${pounds(parking.price)} per ${parking.per}. It is a permit, not a private space.`,
        home: true,
      },
      {
        q: 'Is the flat step-free?',
        a: 'No. The front door is up a flight of stairs and there is no lift.',
        home: true,
      },
      {
        q: 'Can I bring a pet?',
        a: 'Sorry, no pets.',
      },
      {
        q: 'Who do I contact during my stay?',
        a: `Us, ${site.hosts}. We live a few minutes away, and the number is in your arrival email. ${site.responseTime}`,
      },
    ],
  },
  {
    title: 'Work stays',
    items: [
      {
        q: 'Can you invoice my company?',
        a: 'Yes. Receipts and invoices can go in your company name, and we can take payment by card or bank transfer for long stays.',
      },
      {
        q: 'Is there somewhere to work?',
        a: 'There is a desk and chair, and wifi throughout the flat.',
      },
      {
        q: 'Is the flat cleaned during long stays?',
        a: 'Yes. We clean and change the linen on a schedule that suits your stay. Tell us how often you would like it and we will arrange it.',
      },
    ],
  },
];

export const homeFaqs = faqGroups.flatMap((g) => g.items).filter((f) => f.home);
