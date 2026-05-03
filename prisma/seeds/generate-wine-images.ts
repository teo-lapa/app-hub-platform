/**
 * LAPA WINE — generazione immagini bottiglie con Nano Banana (Gemini 3.1 Flash Image Preview)
 *
 * Per ogni "unique product" (produttore + nome bottiglia, indipendente dal formato)
 * passa a Nano Banana:
 *   - L'immagine della pagina del listino Vergani come riferimento (image-to-image)
 *   - Un prompt strutturato che chiede una foto studio uniforme
 * Output salvati in `public/wines/{slug}.png` (PNG perché Nano Banana ritorna PNG).
 *
 * Run:
 *   npx tsx prisma/seeds/generate-wine-images.ts            # batch tutti
 *   npx tsx prisma/seeds/generate-wine-images.ts --test     # solo test 1 (Romeo)
 *   npx tsx prisma/seeds/generate-wine-images.ts --producer="Mura Mura"
 *   npx tsx prisma/seeds/generate-wine-images.ts --skip-existing  # salta già fatte
 *
 * Costo stimato: ~CHF 0.04 per immagine × ~60 unique products = ~CHF 2.50
 * Tempo: ~10-15s per immagine, batch ~10-15 minuti totale.
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env', override: false });
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const PHOTOS_DIR = join(PROJECT_ROOT, 'prisma', 'seed-data', 'wine-photos-input');
const OUT_DIR = join(PROJECT_ROOT, 'public', 'wines');
const CATALOG_PATH = join(PROJECT_ROOT, 'prisma', 'seed-data', 'lapa-wine-vini.json');

interface CatalogWine {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  vintage?: string;
  format_cl: number;
  wine_type: string;
  fascia: string;
  grape_varieties: string[];
}

// Mapping producer → file della pagina listino Vergani (reference per Nano Banana)
const PRODUCER_TO_PAGE: Record<string, string[]> = {
  'Mura Mura': ['page-piemonte-mura-mura.jpeg'],
  "Ca' del Bosco": ['page-lombardia-cadelbosco.jpeg'],
  "L'Anima di Vergani": ['page-veneto-anima-tessari.jpeg', 'page-toscana-anima-sorgenti.jpeg'],
  'Tessari Gianni': ['page-veneto-anima-tessari.jpeg'],
  'Collazzi': ['page-toscana-collazzi.jpeg'],
  'Le Sorgenti': ['page-toscana-anima-sorgenti.jpeg'],
  'Berta': ['page-piemonte-berta-tranoi.jpeg', 'page-piemonte-berta-riserve.jpeg'],
};

// Slug stabile per il filename: producer + name (senza annata, senza formato)
function productSlug(producer: string, name: string): string {
  return `${producer}-${name}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuovi accenti
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function loadReferenceImages(producer: string): { mimeType: string; data: string }[] {
  const pages = PRODUCER_TO_PAGE[producer];
  if (!pages || pages.length === 0) return [];
  return pages.map((p) => {
    const buf = readFileSync(join(PHOTOS_DIR, p));
    return { mimeType: 'image/jpeg', data: buf.toString('base64') };
  });
}

function buildPrompt(w: CatalogWine): string {
  const grapes = w.grape_varieties.join(', ');
  const isGrappa = w.wine_type === 'grappa' || w.wine_type === 'distillato';
  const isSpumante = w.wine_type === 'spumante';
  const bottleHint = isGrappa
    ? 'bottiglia/decanter di grappa con tappo elegante (non bottiglia di vino)'
    : isSpumante
      ? 'bottiglia da spumante metodo classico con muselet/gabbietta visibile'
      : 'bottiglia di vino bordolese o borgognona standard 75cl';

  return `STUDIO PRODUCT PHOTOGRAPHY for restaurant wine list (Aesop / Apple Wallet aesthetic).

You are looking at a page from the Vergani 2025/26 wholesale price list. Find the bottle of:
  • Producer: ${w.producer}
  • Wine: ${w.name}${w.vintage && w.vintage !== 'NV' ? ` (vintage ${w.vintage})` : ''}
  • Type: ${w.wine_type}
  • Grapes: ${grapes}
  • Hint: ${bottleHint}

Generate ONE clean photograph of THAT EXACT bottle, isolated:
  - Background: solid uniform cream color #f6f1e8 (no texture, no gradient, no shadows on background)
  - Lighting: soft diffused studio light from upper-left, soft shadow from base
  - Bottle CENTERED in frame, vertical orientation, full bottle visible head-to-base
  - Aspect ratio 2:3 (portrait), e.g. 1024×1536
  - Label: PERFECTLY identical to the original on the reference page — preserve text, layout, colors, typography. Do NOT redesign or "improve" the label. Keep it photorealistic.
  - Cap/cork visible, glass color realistic for wine type
  - NO table, NO glass, NO accessories, NO people, NO grapes, NO leaves, NO text overlay, NO watermark
  - Photorealistic, high resolution, sharp focus on label

Output: ONE image only, no extra text in the response.`;
}

async function generateOne(
  ai: GoogleGenAI,
  w: CatalogWine,
  outPath: string,
): Promise<{ ok: boolean; reason?: string }> {
  const refs = loadReferenceImages(w.producer);
  if (refs.length === 0) return { ok: false, reason: `no reference page for producer '${w.producer}'` };

  const contents: any[] = [];
  for (const ref of refs) {
    contents.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
  }
  contents.push({ text: buildPrompt(w) });

  let response: any;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents,
      config: { responseModalities: ['Text', 'Image'] },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `API error: ${msg}` };
  }

  // Estrai immagine — prova entrambe le strutture (parts diretta e candidates[].content.parts)
  const candidates = (response as any).candidates || [];
  const parts: any[] = [
    ...((response as any).parts || []),
    ...(candidates[0]?.content?.parts || []),
  ];
  for (const part of parts) {
    if (part.inlineData && part.inlineData.data) {
      const buf = Buffer.from(part.inlineData.data, 'base64');
      writeFileSync(outPath, buf);
      return { ok: true };
    }
  }
  return { ok: false, reason: 'no image in response' };
}

interface UniqueProduct {
  slug: string;
  primary: CatalogWine; // record da cui generare prompt
  skus: string[]; // tutti gli SKU (annate/formati) condividono questa immagine
}

function buildUniqueList(catalog: CatalogWine[]): UniqueProduct[] {
  const map = new Map<string, UniqueProduct>();
  for (const w of catalog) {
    const slug = productSlug(w.producer, w.name);
    if (!map.has(slug)) {
      map.set(slug, { slug, primary: w, skus: [w.vergani_sku] });
    } else {
      const u = map.get(slug)!;
      u.skus.push(w.vergani_sku);
      // Se questo è formato 75cl (preferito) o ha annata più recente, sostituisci primary
      if (
        (u.primary.format_cl !== 75 && w.format_cl === 75) ||
        (u.primary.format_cl === w.format_cl && (w.vintage || '') > (u.primary.vintage || ''))
      ) {
        u.primary = w;
      }
    }
  }
  return Array.from(map.values());
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY in env');
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const skipExisting = args.includes('--skip-existing');
  const producerFilter = (args.find((a) => a.startsWith('--producer='))?.split('=')[1] || '').replace(/^"|"$/g, '');

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as CatalogWine[];
  const unique = buildUniqueList(catalog);
  console.log(`📚 Catalog: ${catalog.length} SKUs → ${unique.length} unique products`);

  let queue = unique;
  if (isTest) {
    queue = unique.filter((u) => u.primary.name === 'Romeo' && u.primary.producer === 'Mura Mura');
    console.log(`🧪 Test mode: ${queue.length} item(s) (Romeo Mura Mura)`);
  } else if (producerFilter) {
    queue = unique.filter((u) => u.primary.producer === producerFilter);
    console.log(`🎯 Filter producer="${producerFilter}": ${queue.length} item(s)`);
  }

  const ai = new GoogleGenAI({ apiKey });

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const failures: { slug: string; reason: string }[] = [];

  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    const outPath = join(OUT_DIR, `${u.slug}.png`);

    if (skipExisting && existsSync(outPath)) {
      console.log(`[${i + 1}/${queue.length}] ⏭  ${u.slug} (already exists)`);
      skipCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${queue.length}] 🎨 ${u.slug}… `);
    const t0 = Date.now();
    const r = await generateOne(ai, u.primary, outPath);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (r.ok) {
      console.log(`✓ (${dt}s)`);
      okCount++;
    } else {
      console.log(`✗ ${r.reason}`);
      failCount++;
      failures.push({ slug: u.slug, reason: r.reason || 'unknown' });
    }
  }

  console.log('');
  console.log(`✅ Done. ok=${okCount}  skip=${skipCount}  fail=${failCount}`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f.slug}: ${f.reason}`));
  }
}

main().catch((e) => {
  console.error('❌ Script failed:', e);
  process.exit(1);
});
