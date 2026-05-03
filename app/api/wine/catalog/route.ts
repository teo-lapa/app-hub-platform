import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

interface CatalogWine {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  subregion?: string;
  denomination?: string;
  grape_varieties: string[];
  vintage?: string;
  format_cl: number;
  wine_type: string;
  price_vergani_to_lapa_chf: number;
  price_carta_suggested_chf: number;
  fascia: string;
  story_short: string;
  tasting_notes: string[];
  food_pairings: string[];
  service_temp_c?: number;
  decantation_minutes?: number;
}

interface EnrichedWine extends CatalogWine {
  image_url: string | null;
}

// productSlug deve combaciare con quello in prisma/seeds/generate-wine-images.ts
function productSlug(producer: string, name: string): string {
  return `${producer}-${name}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let _cache: EnrichedWine[] | null = null;

function loadCatalog(): EnrichedWine[] {
  if (_cache) return _cache;
  const jsonPath = path.join(process.cwd(), 'prisma', 'seed-data', 'lapa-wine-vini.json');
  const raw = readFileSync(jsonPath, 'utf-8');
  const all = JSON.parse(raw) as CatalogWine[];

  // Per ogni vino, controlla se esiste l'immagine generata in public/wines/{slug}.png
  // public/ è servito staticamente da Next.js → image_url = "/wines/{slug}.png"
  const winesDir = path.join(process.cwd(), 'public', 'wines');
  const enriched: EnrichedWine[] = all.map((w) => {
    const slug = productSlug(w.producer, w.name);
    const imgRelative = `/wines/${slug}.png`;
    const imgAbsolute = path.join(winesDir, `${slug}.png`);
    return {
      ...w,
      image_url: existsSync(imgAbsolute) ? imgRelative : null,
    };
  });
  _cache = enriched;
  return enriched;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    // TODO: filtra per restaurantSlug quando il DB esisterà. Per ora ritorna l'intero catalogo Vergani disponibile.
    const wines = loadCatalog();
    return NextResponse.json({ slug, wines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[catalog] Error:', message);
    return NextResponse.json({ error: `Catalog failed: ${message}` }, { status: 500 });
  }
}
