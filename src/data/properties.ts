// Every property on the site. To add a property: copy the object below, give it a new slug,
// add its photos to src/assets/properties/<slug>/ and its PMS id to SMOOBU_APARTMENT_IDS.

import type { ExtraId } from '../config/booking';

export interface Photo {
  /** File name inside src/assets/properties/<slug>/. Missing files show a labelled placeholder. */
  file: string;
  room: 'Living room' | 'Kitchen and dining' | 'Bedroom 1' | 'Bedroom 2' | 'Bedroom 3' | 'Bathroom' | 'Workspace' | 'Neighbourhood';
  alt: string;
}

export interface Review {
  quote: string;
  name: string; // first name only
  month: string; // e.g. 'October 2026'
  platform: 'Airbnb' | 'Booking.com' | 'Vrbo' | 'Direct';
}

export interface Property {
  slug: string;
  name: string;
  area: string;
  areaSlug: string;
  postcodeArea: string;
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
  reviews: Review[];
  /** Shown on cards until the live price loads. In pounds, after the direct discount. */
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
    summary: 'Three double bedrooms on Stoke Newington High Street, a minute from Church Street.',
    guests: 7,
    bedrooms: 3,
    bathrooms: 1,
    beds: '3 double beds and a sofa bed',
    overview: [
      'Three private double bedrooms, so nobody sleeps on the sofa unless they want to. A dining table seats everyone together, and the kitchen is set up for proper meals in.',
      "It's a top floor flat, so you get good natural light through the day and nobody walking about above you. There's a washing machine for longer stays, and a real desk and chair for anyone who needs to work.",
      'Church Street is a minute away for cafés, pubs and restaurants. Stoke Newington station is a five-minute walk, with trains to Liverpool Street in about 15 minutes.',
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
        'Bath and shower',
        'Towels and bed linen',
        'TV',
        'Self check-in',
        'Parking permit available',
      ],
      all: {
        Kitchen: ['Oven and hob', 'Fridge-freezer', 'Microwave', 'Kettle and toaster', 'Pots, pans, crockery and cutlery for everyone', 'Dining table'],
        Bedrooms: ['Three double beds', 'Sofa bed in bedroom 1', 'Bed linen provided'],
        Bathroom: ['Bath with shower', 'Towels provided'],
        'Living and working': ['Wifi throughout', 'Desk and chair', 'TV', 'Sofas'],
        Laundry: ['Washing machine'],
        Arrival: ['Self check-in with a key lockbox', 'Check-in from 15:00, checkout by 11:00'],
      },
    },
    working: [
      'A dedicated desk and chair, away from the living room.',
      'Wifi throughout the flat. [Add the measured speed, e.g. "80 Mbps tested in October 2026"].',
      'A washing machine and full kitchen, so longer stays are easy.',
    ],
    walkingTimes: [
      { place: 'Church Street', time: '1 min walk' },
      { place: 'Stoke Newington station', time: '5 min walk' },
      { place: 'Liverpool Street', time: 'about 15 min by train' },
      { place: 'Clissold Park', time: 'short walk' },
    ],
    houseRules: [
      'Check-in from 15:00, checkout by 11:00',
      'Up to 7 guests',
      'No smoking anywhere in the flat',
      'No pets',
      'No parties or events',
      'Quiet hours from 22:00 to 08:00',
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
      { file: 'living-room.jpg', room: 'Living room', alt: 'Living room with sofas and daylight from the front windows' },
      { file: 'dining.jpg', room: 'Kitchen and dining', alt: 'Dining table set for the whole group' },
      { file: 'kitchen.jpg', room: 'Kitchen and dining', alt: 'Kitchen with oven, hob and worktop space' },
      { file: 'bedroom-1.jpg', room: 'Bedroom 1', alt: 'Bedroom 1 with a double bed' },
      { file: 'bedroom-2.jpg', room: 'Bedroom 2', alt: 'Bedroom 2 with a double bed' },
      { file: 'bedroom-3.jpg', room: 'Bedroom 3', alt: 'Bedroom 3 with a double bed' },
      { file: 'bathroom.jpg', room: 'Bathroom', alt: 'Bathroom with bath and shower' },
      { file: 'workspace.jpg', room: 'Workspace', alt: 'Desk and chair by the window' },
      { file: 'bedroom-doors.jpg', room: 'Workspace', alt: 'The three bedroom doors off the hallway' },
      { file: 'church-street.jpg', room: 'Neighbourhood', alt: 'Shops and cafés on Stoke Newington Church Street' },
      { file: 'clissold-park.jpg', room: 'Neighbourhood', alt: 'Clissold Park on a clear day' },
    ],
    heroPhoto: 'living-room.jpg',
    cardPhoto: 'living-room.jpg',
    // Add the four real reviews here (3 Airbnb, 1 Booking.com). The section stays hidden while this is empty.
    reviews: [],
    fromPriceFallback: 216,
    map: { lat: 51.5628, lng: -0.0742, radiusM: 400 },
  },
];

export const getProperty = (slug: string) => properties.find((p) => p.slug === slug);
