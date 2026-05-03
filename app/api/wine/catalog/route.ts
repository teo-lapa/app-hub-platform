import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
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

// Stessi 30 SKU hardcoded del sommelier endpoint (TODO: tirare da DB).
const DEMO_STOCK_SKUS = new Set<string>([
  'anima-prosecco-extra-dry-2024-75cl',
  'anima-prosecco-rose-brut-2024-75cl',
  'tessari-soave-2024-75cl',
  'tessari-soave-perinotto-2021-75cl',
  'tessari-due-2022-75cl',
  'mura-mura-favorita-bianca-2022-75cl',
  'mura-mura-timorasso-beatrice-2023-75cl',
  'mura-mura-nebbiolo-mercuzio-2021-75cl',
  'mura-mura-barbaresco-iago-2022-75cl',
  'mura-mura-romeo-2022-75cl',
  'cdb-cuvee-prestige-ed47-extra-brut-75cl',
  'cdb-corte-del-lupo-bianco-2023-75cl',
  'cdb-corte-del-lupo-rosso-2022-75cl',
  'anima-amarone-2019-75cl',
  'anima-fiano-2021-75cl',
  'anima-toscana-2020-75cl',
  'tessari-soloris-rebellis-2022-75cl',
  'collazzi-fiano-otto-muri-2023-75cl',
  'collazzi-bianco-2023-75cl',
  'collazzi-liberta-2022-75cl',
  'collazzi-collazzi-2021-75cl',
  'le-sorgenti-scirus-2017-75cl',
  'mura-mura-barbaresco-faset-2019-75cl',
  'mura-mura-barbaresco-serragrilli-2020-75cl',
  'mura-mura-barbaresco-starderi-2020-75cl',
  'cdb-cuvee-prestige-rose-ed47-75cl',
  'cdb-vc-saten-2020-75cl',
  'cdb-annamaria-clementi-2014-2015-75cl',
  'cdb-vc-extra-brut-2019-75cl',
  'cdb-vc-dosage-zero-2020-75cl',
]);

let _cache: CatalogWine[] | null = null;

function loadCatalog(): CatalogWine[] {
  if (_cache) return _cache;
  const filePath = path.join(process.cwd(), 'prisma', 'seed-data', 'lapa-wine-vini.json');
  const raw = readFileSync(filePath, 'utf-8');
  const all = JSON.parse(raw) as CatalogWine[];
  _cache = all.filter((w) => DEMO_STOCK_SKUS.has(w.vergani_sku));
  return _cache;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    // TODO: filtra per restaurantSlug quando il DB esisterà. Per ora ritorna sempre il demo stock.
    const wines = loadCatalog();
    return NextResponse.json({ slug, wines });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[catalog] Error:', message);
    return NextResponse.json({ error: `Catalog failed: ${message}` }, { status: 500 });
  }
}
