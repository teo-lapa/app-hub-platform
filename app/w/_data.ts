// TODO: collegare a DB / API — per ora mock identici al prototipo

export type Tenant = {
  slug: string;
  name: string;
  short: string;
  monogram: string;
  monoStyle: 'italic' | 'normal';
  accent: string;
  cream: string;
  eyebrow: string;
  menu: string[];
};

export type TierWine = {
  tier: 0 | 1 | 2;
  name: string;
  sub: string;
  grape: string;
  region: string;
  year: string;
  glass: number;
  bottle: number;
  accent: string;
  notes: string[];
  temp: number;
  decant: boolean;
  storyShort: string;
};

export const MOCK_TENANT: Tenant = {
  slug: 'mario',
  name: 'Trattoria da Mario',
  short: 'Mario',
  monogram: 'm',
  monoStyle: 'italic',
  accent: '#5a1a1f',
  cream: '#f6f1e8',
  eyebrow: 'TRATTORIA DA MARIO',
  menu: [
    'Tagliatelle al ragù di cinghiale',
    'Bistecca fiorentina 1kg',
    'Risotto ai porcini',
    'Tonno scottato sesamo',
  ],
};

export function getTenant(_slug: string): Tenant {
  // TODO: collegare a DB Prisma — fallback mock
  return MOCK_TENANT;
}

export const TIER_WINES: TierWine[] = [
  {
    tier: 0,
    name: 'Donnafugata',
    sub: 'Sherazade',
    grape: "Nero d'Avola",
    region: 'Sicilia DOC',
    year: '2022',
    glass: 8,
    bottle: 38,
    accent: '#a85565',
    notes: ['Frutti rossi', 'Speziato', 'Tannino fine'],
    temp: 16,
    decant: false,
    storyShort:
      "Etichetta storica della Sicilia: Nero d'Avola in purezza, fermentazione semplice in acciaio. Beva immediata, prezzo onesto.",
  },
  {
    tier: 1,
    name: 'Romeo',
    sub: 'Mura Mura',
    grape: 'Barbera 70% · Nebbiolo 30%',
    region: 'Langhe DOC',
    year: '2021',
    glass: 12,
    bottle: 56,
    accent: '#5a1a1f',
    notes: ['Prugna', 'Viola', 'Liquirizia'],
    temp: 16,
    decant: false,
    storyShort:
      'Federico Grom e Guido, fondatori del gelato che ha conquistato il mondo, oggi fanno vino in Piemonte. Romeo è il loro Barbera-Nebbiolo: rotondo, chiuso bene da un tannino piemontese che dura.',
  },
  {
    tier: 2,
    name: 'Amarone',
    sub: "L'Anima di Vergani",
    grape: 'Corvina · Rondinella · Molinara',
    region: 'Valpolicella Classico DOCG',
    year: '2018',
    glass: 22,
    bottle: 110,
    accent: '#3a0e12',
    notes: ['Ciliegia matura', 'Cuoio', 'Cacao'],
    temp: 18,
    decant: true,
    storyShort:
      "Vergani 1892, oltre cento anni di storia. L'Anima di Vergani è la loro linea propria, selezione delle uve migliori dei colli veneti, appassimento in fruttaio per 100 giorni. Affinato 36 mesi in botte grande.",
  },
];

export const TIER_LABELS = ['Easy', 'Equilibrato', 'Importante'] as const;
