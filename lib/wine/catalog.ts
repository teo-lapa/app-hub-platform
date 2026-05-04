// Catalogo vini condiviso — caricato una volta, usato da route sommelier + tool search.
import { readFileSync } from 'fs';
import path from 'path';

export type Tier = 'easy' | 'equilibrato' | 'importante';

export interface CatalogWine {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  subregion?: string;
  denomination: string;
  grape_varieties: string[];
  vintage: string;
  format_cl: number;
  wine_type: string;
  price_vergani_to_lapa_chf: number;
  price_carta_suggested_chf: number;
  fascia: Tier;
  story_short: string;
  tasting_notes: string[];
  food_pairings: string[];
  service_temp_c: number;
  decantation_minutes: number;
}

export interface StockWine extends CatalogWine {
  wineId: string;
  price_glass_chf: number;
  price_bottle_chf: number;
}

let _cache: StockWine[] | null = null;

export function loadCatalog(): StockWine[] {
  if (_cache) return _cache;
  const filePath = path.join(process.cwd(), 'prisma', 'seed-data', 'lapa-wine-vini.json');
  const raw = readFileSync(filePath, 'utf-8');
  const all = JSON.parse(raw) as CatalogWine[];
  _cache = all.map((w) => {
    const bottle = Math.round(w.price_carta_suggested_chf);
    const glass = Math.max(7, Math.round(bottle / 5));
    return { ...w, wineId: w.vergani_sku, price_glass_chf: glass, price_bottle_chf: bottle };
  });
  return _cache;
}

export function findWineById(wineId: string): StockWine | null {
  const w = loadCatalog().find((x) => x.wineId === wineId);
  return w ?? null;
}

// Fuzzy match: se l'AI sbaglia un wineId leggermente, prova a recuperarlo per nome+produttore.
export function fuzzyFindWine(needle: string): StockWine | null {
  const n = needle.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!n) return null;
  const cat = loadCatalog();
  // 1) match esatto su id normalizzato
  for (const w of cat) {
    if (w.wineId.toLowerCase().replace(/[^a-z0-9]+/g, '') === n) return w;
  }
  // 2) match nome+produttore normalizzato che CONTIENE il needle (o viceversa)
  for (const w of cat) {
    const k = (w.name + w.producer).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (k.includes(n) || n.includes(k)) return w;
  }
  return null;
}

// ── SEARCH TOOL ────────────────────────────────────────────────────────
// Filtri leggeri lato server. L'AI passa criteri, noi ritorniamo max 8 risultati ridotti.

export type WineTypeFilter =
  | 'spumante'
  | 'bianco'
  | 'rosato'
  | 'rosso'
  | 'passito'
  | 'dolce'
  | 'grappa'
  | 'distillato';

export interface SearchCriteria {
  wine_type?: WineTypeFilter | WineTypeFilter[];
  fascia?: Tier | Tier[];
  region?: string;
  grape?: string;
  pairing_keyword?: string; // es "carne rossa", "pesce", "formaggi"
  format_cl?: number; // default solo 75 / 70 / 37.5
  max_price_bottle_chf?: number;
  min_price_bottle_chf?: number;
  query?: string; // testo libero, cerca in nome+produttore+regione+denominazione
  limit?: number; // default 8, max 12
}

export interface SearchResultWine {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  wine_type: string;
  fascia: Tier;
  format_cl: number;
  price_bottle_chf: number;
  price_glass_chf: number;
  grape_varieties: string[];
  short_hint: string; // 1 riga di abbinamento o nota chiave
}

const STANDARD_FORMATS = new Set([37.5, 70, 75]);

export function searchWines(c: SearchCriteria): SearchResultWine[] {
  const cat = loadCatalog();
  const norm = (s: string) => s.toLowerCase();
  const types = c.wine_type ? new Set(([] as WineTypeFilter[]).concat(c.wine_type as WineTypeFilter)) : null;
  const fasce = c.fascia ? new Set(([] as Tier[]).concat(c.fascia as Tier)) : null;
  const region = c.region ? norm(c.region) : null;
  const grape = c.grape ? norm(c.grape) : null;
  const pair = c.pairing_keyword ? norm(c.pairing_keyword) : null;
  const q = c.query ? norm(c.query) : null;
  const formatFilter = c.format_cl ?? null;

  const results = cat.filter((w) => {
    if (types && !types.has(w.wine_type as WineTypeFilter)) return false;
    if (fasce && !fasce.has(w.fascia)) return false;
    if (region && !norm(w.region + ' ' + (w.subregion ?? '')).includes(region)) return false;
    if (grape && !w.grape_varieties.some((g) => norm(g).includes(grape))) return false;
    if (pair && !w.food_pairings.some((p) => norm(p).includes(pair))) return false;
    if (formatFilter != null) {
      if (w.format_cl !== formatFilter) return false;
    } else {
      // default: solo formati standard (75 vino, 70 grappa, 37.5 passito)
      if (!STANDARD_FORMATS.has(w.format_cl)) return false;
    }
    if (c.max_price_bottle_chf != null && w.price_bottle_chf > c.max_price_bottle_chf) return false;
    if (c.min_price_bottle_chf != null && w.price_bottle_chf < c.min_price_bottle_chf) return false;
    if (q) {
      const hay = norm(w.name + ' ' + w.producer + ' ' + w.region + ' ' + w.denomination + ' ' + w.grape_varieties.join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Ordina per fascia (easy → importante) poi per prezzo crescente
  const fasciaOrder: Record<Tier, number> = { easy: 0, equilibrato: 1, importante: 2 };
  results.sort((a, b) => fasciaOrder[a.fascia] - fasciaOrder[b.fascia] || a.price_bottle_chf - b.price_bottle_chf);

  const limit = Math.min(c.limit ?? 8, 12);
  return results.slice(0, limit).map((w) => ({
    wineId: w.wineId,
    name: w.name,
    producer: w.producer,
    region: w.region,
    vintage: w.vintage,
    wine_type: w.wine_type,
    fascia: w.fascia,
    format_cl: w.format_cl,
    price_bottle_chf: w.price_bottle_chf,
    price_glass_chf: w.price_glass_chf,
    grape_varieties: w.grape_varieties,
    short_hint: w.tasting_notes.slice(0, 2).join(', ') || w.food_pairings.slice(0, 2).join(', '),
  }));
}

export interface WineDetails {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  subregion?: string;
  denomination: string;
  vintage: string;
  wine_type: string;
  fascia: Tier;
  grape_varieties: string[];
  story_short: string;
  tasting_notes: string[];
  food_pairings: string[];
  service_temp_c: number;
  decantation_minutes: number;
  formats_available: { wineId: string; format_cl: number; price_bottle_chf: number; price_glass_chf?: number }[];
}

// Ritorna scheda completa di un vino + tutti i formati disponibili (magnum, jeroboam, ecc).
export function getWineDetails(wineId: string): WineDetails | null {
  const head = findWineById(wineId);
  if (!head) return null;
  const baseName = head.name.replace(/\s+(Magnum|Jeroboam|Mezza Bottiglia|Cassa Legno|Edizione Speciale|6 Litri|12 Litri|18 Litri).*$/i, '').trim();
  const formats = loadCatalog()
    .filter((w) => w.producer === head.producer)
    .filter((w) => {
      const n = w.name.replace(/\s+(Magnum|Jeroboam|Mezza Bottiglia|Cassa Legno|Edizione Speciale|6 Litri|12 Litri|18 Litri).*$/i, '').trim();
      return n === baseName;
    })
    .sort((a, b) => a.format_cl - b.format_cl)
    .map((w) => ({
      wineId: w.wineId,
      format_cl: w.format_cl,
      price_bottle_chf: w.price_bottle_chf,
      ...(w.format_cl === 75 ? { price_glass_chf: w.price_glass_chf } : {}),
    }));
  return {
    wineId: head.wineId,
    name: baseName,
    producer: head.producer,
    region: head.region,
    subregion: head.subregion,
    denomination: head.denomination,
    vintage: head.vintage,
    wine_type: head.wine_type,
    fascia: head.fascia,
    grape_varieties: head.grape_varieties,
    story_short: head.story_short,
    tasting_notes: head.tasting_notes,
    food_pairings: head.food_pairings,
    service_temp_c: head.service_temp_c,
    decantation_minutes: head.decantation_minutes,
    formats_available: formats,
  };
}
