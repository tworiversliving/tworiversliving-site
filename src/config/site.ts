// Business details shown across the site. Values in [square brackets] are placeholders:
// replace them before the site goes live (see README, "Before launch"). Pages hide a line while its
// value is a placeholder (see `filled` below); the email footer still prints them.

export const site = {
  name: 'Two Rivers Living',
  legalName: 'Two Rivers Living Ltd',
  url: 'https://tworiversliving.co.uk',
  email: 'stay@tworiversliving.co.uk',
  // Placeholder until the guest phone / WhatsApp Business number is set up.
  phone: '+44 (0)7XXX XXXXXX',
  phoneHref: '',
  whatsappHref: '',
  companyNumber: '17484358',
  registeredOffice: '212A Stoke Newington High Street, London N16 7HU',
  // From the ICO once the data protection fee is paid. Shown on /privacy.
  icoNumber: '[ICO registration number]',
  correspondenceAddress: '212A Stoke Newington High Street, London N16 7HU',
  responseTime: 'We reply within a few hours.',
  hosts: 'Hamza and Emmanuel',
  instagram: '',
  linkedin: '',
  // Keeps search engines out of the preview. Set to true at launch (Phase 4 checklist).
  indexable: false,
};

export const nav = [
  { href: '/stays/stoke-newington-3-bed', label: 'The flat' },
  { href: '/work-stays', label: 'Work and long stays' },
  { href: '/faq', label: 'Questions' },
];

/** False while a value is empty or still a [placeholder], so pages can hide the line instead. */
export const filled = (value: string) => value.trim() !== '' && !value.includes('[');
