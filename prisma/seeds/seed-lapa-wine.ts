/**
 * LAPA WINE — DB seed (raw SQL su Neon, via @vercel/postgres)
 *
 * Run:
 *   1) Apply migration first:
 *      psql "$DATABASE_URL" -f migrations/lapa-wine.sql
 *   2) Seed:
 *      npx tsx prisma/seeds/seed-lapa-wine.ts
 *
 * Idempotent — usa ON CONFLICT DO UPDATE per i vini, DELETE+INSERT per stock/menu del demo restaurant.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from '@vercel/postgres';

interface WineSeed {
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

function parseVintage(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  console.log('🍷 LAPA WINE seed — start');

  // ── 1. Wines ───────────────────────────────────────────────────────────────
  const winesPath = join(process.cwd(), 'prisma', 'seed-data', 'lapa-wine-vini.json');
  const wines: WineSeed[] = JSON.parse(readFileSync(winesPath, 'utf-8'));
  console.log(`  📚 Loaded ${wines.length} wines from JSON`);

  for (const w of wines) {
    const vintage = parseVintage(w.vintage);
    await sql`
      INSERT INTO wine_products (
        vergani_sku, name, producer, region, subregion, denomination,
        grape_varieties, vintage, format_cl, wine_type,
        price_vergani_to_lapa_chf, price_carta_suggested_chf, fascia,
        story_short, tasting_notes, food_pairings,
        service_temp_c, decantation_minutes
      ) VALUES (
        ${w.vergani_sku}, ${w.name}, ${w.producer}, ${w.region},
        ${w.subregion ?? null}, ${w.denomination ?? null},
        ${w.grape_varieties as any}, ${vintage}, ${w.format_cl}, ${w.wine_type},
        ${w.price_vergani_to_lapa_chf}, ${w.price_carta_suggested_chf}, ${w.fascia},
        ${w.story_short}, ${w.tasting_notes as any}, ${w.food_pairings as any},
        ${w.service_temp_c ?? null}, ${w.decantation_minutes ?? null}
      )
      ON CONFLICT (vergani_sku) DO UPDATE SET
        name = EXCLUDED.name,
        producer = EXCLUDED.producer,
        region = EXCLUDED.region,
        subregion = EXCLUDED.subregion,
        denomination = EXCLUDED.denomination,
        grape_varieties = EXCLUDED.grape_varieties,
        vintage = EXCLUDED.vintage,
        format_cl = EXCLUDED.format_cl,
        wine_type = EXCLUDED.wine_type,
        price_vergani_to_lapa_chf = EXCLUDED.price_vergani_to_lapa_chf,
        price_carta_suggested_chf = EXCLUDED.price_carta_suggested_chf,
        fascia = EXCLUDED.fascia,
        story_short = EXCLUDED.story_short,
        tasting_notes = EXCLUDED.tasting_notes,
        food_pairings = EXCLUDED.food_pairings,
        service_temp_c = EXCLUDED.service_temp_c,
        decantation_minutes = EXCLUDED.decantation_minutes,
        updated_at = now()
    `;
  }
  console.log(`  ✅ ${wines.length} wines upserted`);

  // ── 2. Demo restaurant: Trattoria da Mario ─────────────────────────────────
  const restRow = await sql`
    INSERT INTO wine_restaurants (
      slug, name, owner_email, address, accent_color, monogram,
      language_default, opzione_commerciale, sconto_acquisto_pct,
      target_rotazione_min_chf_mese
    ) VALUES (
      'trattoria-da-mario', 'Trattoria da Mario', 'mario@trattoria.test',
      'Bahnhofstrasse 47, 8001 Zürich', '#7a1f2b', 'm',
      'it', 'C', 12.00, 1000.00
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      owner_email = EXCLUDED.owner_email,
      address = EXCLUDED.address,
      accent_color = EXCLUDED.accent_color,
      monogram = EXCLUDED.monogram,
      updated_at = now()
    RETURNING id
  `;
  const restaurantId = restRow.rows[0].id as string;
  console.log(`  ✅ Restaurant: Trattoria da Mario (id=${restaurantId})`);

  // ── 3. Menu items demo (wipe + insert) ─────────────────────────────────────
  const menu = [
    { name: 'Tagliatelle al ragù di cinghiale', category: 'primo', ingredients: ['Tagliatelle fresche', 'Cinghiale', 'Vino rosso', 'Pomodoro'] },
    { name: 'Risotto ai porcini', category: 'primo', ingredients: ['Riso Carnaroli', 'Porcini freschi', 'Parmigiano', 'Burro'] },
    { name: 'Pappardelle al tartufo nero', category: 'primo', ingredients: ['Pappardelle', 'Tartufo nero', 'Burro', 'Parmigiano'] },
    { name: 'Bistecca fiorentina 1kg', category: 'secondo', ingredients: ['Manzo Chianina', 'Sale', 'Pepe', 'Olio EVO'] },
    { name: 'Brasato al Barolo', category: 'secondo', ingredients: ['Manzo', 'Barolo', 'Cipolla', 'Carota', 'Sedano'] },
    { name: 'Tonno scottato al sesamo', category: 'pesce', ingredients: ['Tonno fresco', 'Sesamo nero', 'Soia', 'Lime'] },
    { name: 'Branzino al sale', category: 'pesce', ingredients: ['Branzino intero', 'Sale grosso', 'Erbe aromatiche'] },
    { name: 'Tagliere di salumi e formaggi', category: 'antipasto', ingredients: ['Prosciutto crudo', 'Salame', 'Pecorino', 'Parmigiano'] },
    { name: 'Vitello tonnato', category: 'antipasto', ingredients: ['Vitello', 'Tonno', 'Capperi', 'Maionese'] },
    { name: 'Tiramisù della casa', category: 'dessert', ingredients: ['Mascarpone', 'Caffè', 'Savoiardi', 'Cacao'] },
  ];
  await sql`DELETE FROM wine_menu_items WHERE restaurant_id = ${restaurantId}`;
  for (const m of menu) {
    await sql`
      INSERT INTO wine_menu_items (restaurant_id, name, category, ingredients)
      VALUES (${restaurantId}, ${m.name}, ${m.category}, ${m.ingredients as any})
    `;
  }
  console.log(`  ✅ ${menu.length} menu items seeded`);

  // ── 4. Stock for Mario: 30 wines balanced across fasce ────────────────────
  const easy = await sql`SELECT id FROM wine_products WHERE fascia = 'easy' LIMIT 10`;
  const equilibrato = await sql`SELECT id FROM wine_products WHERE fascia = 'equilibrato' LIMIT 12`;
  const importante = await sql`SELECT id FROM wine_products WHERE fascia = 'importante' LIMIT 8`;
  const selection = [...easy.rows, ...equilibrato.rows, ...importante.rows];

  await sql`DELETE FROM wine_restaurant_stocks WHERE restaurant_id = ${restaurantId}`;
  for (const w of selection) {
    const qty = Math.floor(Math.random() * 4) + 2;
    await sql`
      INSERT INTO wine_restaurant_stocks (restaurant_id, wine_id, qty_in_stock, qty_threshold_min)
      VALUES (${restaurantId}, ${w.id as string}, ${qty}, 2)
    `;
  }
  console.log(`  ✅ ${selection.length} wines added to Mario's cellar`);

  console.log('🍷 LAPA WINE seed — done');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
