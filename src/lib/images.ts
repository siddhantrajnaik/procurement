export interface ItemImage {
  /** Relative to the Vite base so GitHub Pages subpath deploys resolve correctly. */
  src: string;
  alt: string;
  credit: { title: string; author: string; license: string; url: string };
}

const base = import.meta.env.BASE_URL;

// Photographs live in public/images/items. All are Wikimedia Commons files under
// licenses that permit reuse with attribution — see the credits shown in Profile.
const IMAGES = {
  'nickel-resin': {
    src: `${base}images/items/nickel-resin.jpg`,
    alt: 'Nickel affinity chromatography resin in a bottle',
    credit: {
      title: 'Nickel resin',
      author: 'Pdcook',
      license: 'CC BY-SA 3.0',
      url: 'https://commons.wikimedia.org/wiki/File:Nickel_resin.jpg',
    },
  },
  'western-blot': {
    src: `${base}images/items/western-blot.jpg`,
    alt: 'Western blot membrane showing stained protein bands',
    credit: {
      title: 'Western blot 2451',
      author: 'George Chèvre',
      license: 'CC BY-SA 3.0',
      url: 'https://commons.wikimedia.org/wiki/File:Western_blot_2451.jpg',
    },
  },
  'pipette-tips': {
    src: `${base}images/items/pipette-tips.jpg`,
    alt: 'Racks of disposable micropipette tips in laboratory tip boxes',
    credit: {
      title: 'Disposable Pipette Tips in Laboratory Tip Boxes',
      author: 'Gannu03',
      license: 'CC BY-SA 4.0',
      url: 'https://commons.wikimedia.org/wiki/File:Disposable_Pipette_Tips_in_Laboratory_Tip_Boxes.jpg',
    },
  },
  'electron-microscope': {
    src: `${base}images/items/electron-microscope.jpg`,
    alt: 'Transmission electron microscope column in a laboratory',
    credit: {
      title: 'Transmission electron microscope (1)',
      author: 'Gannu03',
      license: 'CC BY-SA 4.0',
      url: 'https://commons.wikimedia.org/wiki/File:Transmission_electron_microscope_(1).jpg',
    },
  },
} satisfies Record<string, ItemImage>;

type ImageKey = keyof typeof IMAGES;

export const ALL_IMAGES: ItemImage[] = Object.values(IMAGES);

// First keyword match wins, so specific items beat the category fallback.
const TITLE_KEYWORDS: [RegExp, ImageKey][] = [
  [/(ni-?nta|nickel|his-?tag|affinity resin|sepharose|column)/i, 'nickel-resin'],
  [/(grid|cryo|quantifoil|microscop|\btem\b)/i, 'electron-microscope'],
  [/(antibod|blot|\bigg\b|conjugate|elisa)/i, 'western-blot'],
  [/(tip|pipette)/i, 'pipette-tips'],
];

const CATEGORY_IMAGES: Record<string, ImageKey> = {
  'Resins & Media': 'nickel-resin',
  Antibodies: 'western-blot',
  Plasticware: 'pipette-tips',
  Equipment: 'electron-microscope',
};

/** Returns null when nothing sensible matches — callers render without a photo. */
export function imageForItem(title: string, category: string): ItemImage | null {
  for (const [pattern, key] of TITLE_KEYWORDS) {
    if (pattern.test(title)) return IMAGES[key];
  }
  const byCategory = CATEGORY_IMAGES[category];
  return byCategory ? IMAGES[byCategory] : null;
}
