// Area guides. Their page (/areas/<slug>) was taken off the site on 2 Nov 2026; src/pages/areas/[slug].astro
// is in git history to bring back. Picks come from the hosts' own guidebook.
// Still to add is marked TO ADD in the comments. A section with no intro and no items is hidden,
// and a place with no note shows its name alone. Bus routes come from src/data/todo.ts.

export interface AreaSection {
  title: string;
  intro: string;
  /** Places or tips. Leave empty until the real picks are added. */
  items: { name: string; note: string }[];
  /** Photo file names from the area's property folder. A file not added yet is left out of the live page (a toned block in dev). */
  photos?: string[];
}

export interface Area {
  slug: string;
  name: string;
  /** Property whose photo folder holds this area's neighbourhood shots. */
  propertySlug: string;
  description: string;
  intro: string[];
  sections: AreaSection[];
}

export const areas: Area[] = [
  {
    slug: 'stoke-newington',
    name: 'Stoke Newington',
    propertySlug: 'stoke-newington-3-bed',
    description: 'Where to eat, walk and work in Stoke Newington, from the two locals who host here.',
    intro: [
      "We grew up in Stoke Newington, so this is the guide we'd give a friend. It's a short train ride from the City, with Church Street for food and drink and three parks within walking distance.",
    ],
    sections: [
      {
        title: 'Getting around',
        intro: 'Stoke Newington station is a five-minute walk from the flat, with trains to Liverpool Street in 15 minutes.',
        items: [],
        photos: ['stoke-newington-station.jpg'],
      },
      {
        title: 'Eat and drink',
        // TO ADD: the guidebook picks, name and one line each.
        intro: 'Church Street is a minute away and has most of what you need.',
        items: [],
        photos: ['church-street.jpg'],
      },
      {
        title: 'Parks',
        intro: 'Three green spaces within walking distance.',
        // TO ADD: one line from the guidebook for each park.
        items: [
          { name: 'Clissold Park', note: '' },
          { name: 'Abney Park', note: '' },
          { name: 'Springfield Park', note: '' },
        ],
        photos: ['clissold-park.jpg'],
      },
      {
        title: 'Working nearby',
        // TO ADD: cafés with good wifi and space to sit.
        intro: 'If you want a change from the desk in the flat.',
        items: [],
        photos: ['working-nearby.jpg'],
      },
      {
        title: 'With children',
        // TO ADD: family picks from the guidebook. Hidden until there is an intro or items.
        intro: '',
        items: [],
      },
    ],
  },
];

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);
