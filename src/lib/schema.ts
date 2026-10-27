// JSON-LD structured data. Base.astro adds Organization and BreadcrumbList to every page;
// pages pass anything specific to them (LodgingBusiness, FAQPage) through Base's `schema` prop.
import { booking } from '../config/booking';
import { site } from '../config/site';
import type { Faq } from '../data/faq';
import type { Property } from '../data/properties';

const abs = (path: string) => new URL(path, site.url).href;
const ORG_ID = abs('/#organization');
// Placeholders like "[company number]" must never reach search engines.
const isSet = (v: string) => Boolean(v) && !v.includes('[');

export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    logo: abs('/brand/logo-stacked.svg'),
    email: site.email,
    ...(site.phoneHref && { telephone: site.phone }),
    ...(isSet(site.companyNumber) && { identifier: { '@type': 'PropertyValue', propertyID: 'Companies House', value: site.companyNumber } }),
    sameAs: [site.instagram, site.linkedin].filter(Boolean),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/** The property page. Address stays at area level: the exact address is only sent before arrival. */
export function lodging(p: Property, images: string[]) {
  const url = abs(`/stays/${p.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${url}#lodging`,
    name: p.name,
    description: p.summary,
    url,
    image: images.map(abs),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'London',
      postalCode: p.postcodeArea.replace(/^London\s+/, ''),
      addressCountry: 'GB',
    },
    checkinTime: booking.checkInTime,
    checkoutTime: booking.checkOutTime,
    numberOfRooms: p.bedrooms,
    petsAllowed: false,
    currenciesAccepted: booking.currency,
    paymentAccepted: 'Card, Apple Pay, Google Pay',
    email: site.email,
    ...(site.phoneHref && { telephone: site.phone }),
    amenityFeature: p.amenities.top.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    brand: { '@id': ORG_ID },
    containsPlace: {
      '@type': 'Apartment',
      name: p.name,
      numberOfRooms: p.bedrooms,
      numberOfBedrooms: p.bedrooms,
      numberOfBathroomsTotal: p.bathrooms,
      occupancy: { '@type': 'QuantitativeValue', maxValue: p.guests },
      petsAllowed: false,
    },
    // No aggregateRating: Google ignores review markup a business publishes about itself.
  };
}

export function faqPage(items: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
