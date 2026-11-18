// Every property on the site. To add a property: copy the object below, give it a new slug,
// add its photos to src/assets/properties/<slug>/ and its PMS id to SMOOBU_APARTMENT_IDS.

import { booking, clock, type ExtraId } from '../config/booking';
import { todo } from './todo';

export interface Photo {
  /** File name inside src/assets/properties/<slug>/. Missing files show a labelled placeholder. */
  file: string;
  room: 'Living room' | 'Kitchen and dining' | 'Bedroom 1' | 'Bedroom 2' | 'Bedroom 3' | 'Bathroom' | 'Workspace' | 'Neighbourhood';
  alt: string;
  /** The TV is in shot. Never the first photo anyone sees (BRIEF.md 3). */
  tv?: boolean;
}

export interface Review {
  quote: string;
  name: string; // first name only
  month: string; // e.g. 'October 2026'
  platform: 'Airbnb' | 'Booking.com' | 'Vrbo' | 'Direct';
}

/** Average score on a booking platform, as shown on the listing. Update when the listing changes. */
export interface Rating {
  platform: 'Airbnb' | 'Booking.com';
  score: number;
  outOf: 5 | 10;
  count: number;
}

export interface Property {
  slug: string;
  name: string;
  area: string;
  areaSlug: string;
  postcodeArea: string;
  /** Street for the label over the title, e.g. 'Stoke Newington High Street'. */
  street: string;
  /** Property page h1. The second half is set in Redaction 50, the page's one worn phrase. */
  headline: [string, string];
  /** e.g. 'Top floor', shown in the facts line under the title. */
  floor: string;
  summary: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: string;
  overview: string[];
  sleeping: { room: string; bed: string; photo?: string }[];
  amenities: { top: string[]; all: Record<string, string[]> };
  working: string[];
  walkingTimes: { place: string; time: string }[];
  houseRules: string[];
  goodToKnow: string[];
  extras: ExtraId[];
  photos: Photo[];
  heroPhoto: string;
  cardPhoto: string;
  /** Social share image, cropped to 1.91:1 from the centre. Pick a photo that still reads when cropped. */
  ogPhoto: string;
  reviews: Review[];
  ratings: Rating[];
  /** Shown until the live price loads, and on the share card. In pounds, the cheapest night in src/config/rates.ts. */
  fromPriceFallback: number;
  /** Rough location for the map: a circle, never the exact building. */
  map: { lat: number; lng: number; radiusM: number };
}

export const properties: Property[] = [
  {
    slug: 'stoke-newington-3-bed',
    name: 'Three-bedroom flat in Stoke Newington',
    area: 'Stoke Newington',
    areaSlug: 'stoke-newington',
    postcodeArea: 'London N16',
    street: 'Stoke Newington High Street',
    headline: ['A three-bedroom flat,', 'a minute from Church Street.'],
    floor: 'Top floor',
    summary: 'Three double bedrooms on Stoke Newington High Street, a minute from Church Street.',
    guests: 7,
    bedrooms: 3,
    bathrooms: 1,
    beds: '3 double beds and a sofa bed',
    overview: [
      'Three private double bedrooms, so nobody sleeps on the sofa unless they want to. A dining table seats everyone together, and the kitchen is set up for proper meals in.',
      "It's a top floor flat, so you get good natural light through the day and nobody walking about above you. There's a washing machine for longer stays, and a real desk and chair for anyone who needs to work.",
      'Church Street is a minute away for cafés, pubs and restaurants. Stoke Newington station is a five-minute walk, with trains to Liverpool Street in 15 minutes.',
      "We're Hamza and Emmanuel. We were born and raised in Stoke Newington, live a few minutes away and look after the flat ourselves.",
    ],
    sleeping: [
      { room: 'Bedroom 1', bed: 'Double bed and a sofa bed', photo: 'bedroom-1.jpg' },
      { room: 'Bedroom 2', bed: 'Double bed', photo: 'bedroom-2.jpg' },
      { room: 'Bedroom 3', bed: 'Double bed', photo: 'bedroom-3.jpg' },
    ],
    amenities: {
      top: [
        'Wifi throughout',
        'Desk and chair',
        'Washing machine',
        'Full kitchen',
        'Dining table for everyone',
        'Walk-in shower',
        'Towels and bed linen',
        'TV',
        'Self check-in',
        'Parking permit available',
      ],
      all: {
        Kitchen: ['Oven and hob', 'Fridge-freezer', 'Microwave', 'Kettle and toaster', 'Pots, pans, crockery and cutlery for everyone', 'Dining table'],
        Bedrooms: ['Three double beds', 'Sofa bed in bedroom 1', 'Bed linen provided'],
        Bathroom: ['Walk-in shower', 'Towels provided'],
        'Living and working': ['Wifi throughout', 'Desk and chair', 'TV', 'Sofas'],
        Laundry: ['Washing machine'],
        Arrival: ['Self check-in with a key lockbox', `Check-in from ${clock(booking.checkInTime)}, checkout by ${clock(booking.checkOutTime)}`],
      },
    },
    working: [
      'A dedicated desk and chair, away from the living room.',
      todo.wifiSpeed ? `Wifi throughout the flat, tested at ${todo.wifiSpeed}.` : 'Wifi throughout the flat.',
      'A washing machine and full kitchen, so longer stays are easy.',
    ],
    walkingTimes: [
      { place: 'Church Street', time: '1 min walk' },
      { place: 'Stoke Newington station', time: '5 min walk' },
      { place: 'Liverpool Street', time: '15 min by train' },
      { place: 'Clissold Park', time: '15 min walk' },
    ],
    houseRules: [
      `Check-in from ${clock(booking.checkInTime)}, checkout by ${clock(booking.checkOutTime)}`,
      'Up to 7 guests',
      'No smoking anywhere in the flat',
      'No pets',
      'No parties or events',
      'Quiet hours from 10pm to 8am',
    ],
    goodToKnow: [
      'The front door is up a flight of stairs and there is no lift. Worth knowing with a pushchair or heavy cases.',
      'There is one bathroom, so larger groups may want to stagger mornings.',
      'Parking is a visitor permit for nearby resident bays, not a private space.',
      'There is no dishwasher.',
      'The flat is in a residential building with neighbours either side. It suits families, friends and work trips, not parties.',
      'An exterior camera covers the entrance. There are no cameras inside the flat.',
    ],
    extras: ['parking', 'early_checkin', 'late_checkout'],
    photos: [
      { file: 'living-room.jpg', room: 'Living room', alt: 'Living room with two sofas, a chandelier and daylight from the sash window', tv: true },
      { file: 'living-room-tv.jpg', room: 'Living room', alt: 'Living room seating facing the wall-mounted TV', tv: true },
      { file: 'living-room-detail.jpg', room: 'Living room', alt: 'Round wooden coffee table in front of the sofa by the window' },
      { file: 'dining.jpg', room: 'Kitchen and dining', alt: 'Dining table laid for six beside the living room window' },
      { file: 'kitchen.jpg', room: 'Kitchen and dining', alt: 'Kitchen with a gas cooker, fridge-freezer and worktop space' },
      { file: 'kitchen-detail.jpg', room: 'Kitchen and dining', alt: 'Kitchen worktop with kettle, toaster and gas hob' },
      { file: 'bedroom-1.jpg', room: 'Bedroom 1', alt: 'Bedroom 1 with a double bed, a rug and two sash windows over the street' },
      { file: 'bedroom-1-alt.jpg', room: 'Bedroom 1', alt: 'Double bed in bedroom 1, with a desk and chair to one side and shelves to the other' },
      { file: 'bedroom-1-window.jpg', room: 'Bedroom 1', alt: 'Afternoon sun through the sash window in bedroom 1, beside a full-length mirror' },
      { file: 'bedroom-2.jpg', room: 'Bedroom 2', alt: 'Bedroom 2 with a double bed under the window and a sliding wardrobe' },
      { file: 'bedroom-2-alt.jpg', room: 'Bedroom 2', alt: 'Bedroom 2 looking from the bed towards the door and round mirror' },
      { file: 'bedroom-3.jpg', room: 'Bedroom 3', alt: 'Bedroom 3 with a double bed, bedside table and lamp by the window' },
      { file: 'bedroom-3-alt.jpg', room: 'Bedroom 3', alt: 'Bedroom 3 from the bed, with a wardrobe in the corner and the door' },
      { file: 'bedroom-3-detail.jpg', room: 'Bedroom 3', alt: 'Bedside lamp and framed prints in bedroom 3' },
      { file: 'bathroom.jpg', room: 'Bathroom', alt: 'Bathroom with a walk-in shower, basin and toilet' },
      { file: 'bathroom-2.jpg', room: 'Bathroom', alt: 'Walk-in shower with a glass screen next to the basin' },
      { file: 'bathroom-detail.jpg', room: 'Bathroom', alt: 'Framed street map on the tiled bathroom wall' },
      { file: 'workspace.jpg', room: 'Workspace', alt: 'Desk chair in bedroom 1, beside the double bed' },
      { file: 'bedroom-doors.jpg', room: 'Workspace', alt: 'The three bedroom doors off the hallway' },
      { file: 'church-street.jpg', room: 'Neighbourhood', alt: 'Shops and cafés on Stoke Newington Church Street' },
      { file: 'clissold-park.jpg', room: 'Neighbourhood', alt: 'Clissold Park on a clear day' },
    ],
    heroPhoto: 'living-room.jpg',
    // Checkout page photo. Not a TV shot (BRIEF.md 3).
    cardPhoto: 'dining.jpg',
    ogPhoto: 'dining.jpg',
    // Add the four real reviews here (3 Airbnb, 1 Booking.com). The section stays hidden while this is empty.
    reviews: [],
    // From the listings, 29 Oct 2026
    ratings: [
      { platform: 'Airbnb', score: 4.8, outOf: 5, count: 5 },
      { platform: 'Booking.com', score: 9, outOf: 10, count: 2 },
    ],
    fromPriceFallback: 220,
    map: { lat: 51.5628, lng: -0.0742, radiusM: 400 },
  },
];

/** e.g. "4.8/5 on Airbnb · 9/10 on Booking.com" */
export const ratingLine = (p: Property) => p.ratings.map((r) => `${r.score}/${r.outOf} on ${r.platform}`).join(' · ');

export const getProperty = (slug: string) => properties.find((p) => p.slug === slug);
