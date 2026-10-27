// Area guides, one page each at /areas/<slug>. Picks come from the hosts' own guidebook.
// Anything in [square brackets] is a placeholder and shows highlighted on the page until replaced.

export interface AreaSection {
  title: string;
  intro: string;
  /** Places or tips. Leave empty until the real picks are added. */
  items: { name: string; note: string }[];
  /** Photo file names from the area's property folder. */
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
        intro:
          'Stoke Newington station is a five-minute walk from the flat, with trains to Liverpool Street in about 15 minutes. [Add bus routes and times once confirmed.]',
        items: [],
      },
      {
        title: 'Eat and drink',
        intro: 'Church Street is a minute away and has most of what you need. [Add the guidebook picks: name and one line each.]',
        items: [],
        photos: ['church-street.jpg'],
      },
      {
        title: 'Parks',
        intro: 'Three green spaces within walking distance.',
        items: [
          { name: 'Clissold Park', note: '[One line from the guidebook.]' },
          { name: 'Abney Park', note: '[One line from the guidebook.]' },
          { name: 'Springfield Park', note: '[One line from the guidebook.]' },
        ],
        photos: ['clissold-park.jpg'],
      },
      {
        title: 'Working nearby',
        intro: 'If you want a change from the desk in the flat. [Add cafés with good wifi and space to sit.]',
        items: [],
      },
      {
        title: 'With children',
        intro: '[Add family picks from the guidebook.]',
        items: [],
      },
    ],
  },
];

export const getArea = (slug: string) => areas.find((a) => a.slug === slug);
