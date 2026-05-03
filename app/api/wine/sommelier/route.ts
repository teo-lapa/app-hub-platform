import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Language = 'it' | 'de' | 'en' | 'fr';
type Tier = 'easy' | 'equilibrato' | 'importante';

interface SommelierRequest {
  restaurantSlug: string;
  tableCode: string;
  dishesInput: string;
  language: Language;
  customerEmail?: string | null;
}

interface WineStock {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  grapes: string[];
  category: string;
  format: string;
  cost_chf: number;
  price_glass_chf: number;
  price_bottle_chf: number;
}

interface WineSuggestion {
  tier: Tier;
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  price_glass_chf: number;
  price_bottle_chf: number;
  reason: string;
  story_short: string;
  tasting_notes: string[];
  service_temp_c: number;
  confidence: number;
}

interface SommelierResponse {
  suggestionId: string;
  wines: WineSuggestion[];
}

// TODO: sostituire con query Prisma `wine_stock` filtrata per restaurantSlug quando il DB è pronto.
// Lista vini di esempio tirata dal listino Vergani 2025/2026 (prezzi grossista * markup HoReCa).
function loadWineStock(_restaurantSlug: string): WineStock[] {
  return [
    { wineId: 'vergani-anima-prosecco-extra-dry-75', name: 'Anima Prosecco Extra Dry', producer: "L'Anima di Vergani", region: 'Veneto', vintage: '2024', grapes: ['Glera'], category: 'Prosecco DOC', format: '75cl', cost_chf: 8.40, price_glass_chf: 7, price_bottle_chf: 26 },
    { wineId: 'vergani-anima-prosecco-rose-75', name: 'Anima Prosecco Rosé Brut', producer: "L'Anima di Vergani", region: 'Veneto', vintage: '2024', grapes: ['Glera', 'Pinot Noir'], category: 'Prosecco DOC Rosé', format: '75cl', cost_chf: 8.40, price_glass_chf: 7, price_bottle_chf: 26 },
    { wineId: 'vergani-cdb-cuvee-prestige-ed47-75', name: 'Cuvée Prestige ED 47 Extra Brut', producer: "Ca' del Bosco", region: 'Lombardia (Franciacorta)', vintage: 'NV', grapes: ['Chardonnay', 'Pinot Nero', 'Pinot Bianco'], category: 'Franciacorta DOCG', format: '75cl', cost_chf: 27.10, price_glass_chf: 14, price_bottle_chf: 78 },
    { wineId: 'vergani-tessari-soave-75', name: 'Soave Tessari', producer: 'Tessari Gianni', region: 'Veneto', vintage: '2024', grapes: ['Garganega', 'Trebbiano'], category: 'Soave DOC', format: '75cl', cost_chf: 9.20, price_glass_chf: 7, price_bottle_chf: 28 },
    { wineId: 'vergani-tessari-soave-perinotto-75', name: 'Soave Perinotto', producer: 'Tessari Gianni', region: 'Veneto', vintage: '2021', grapes: ['Garganega'], category: 'Soave Classico DOC', format: '75cl', cost_chf: 12.70, price_glass_chf: 9, price_bottle_chf: 36 },
    { wineId: 'vergani-muramura-favorita-bianca-75', name: 'Favorita Bianca', producer: 'Mura Mura', region: 'Piemonte', vintage: '2022', grapes: ['Favorita'], category: 'Piemonte DOC', format: '75cl', cost_chf: 21.00, price_glass_chf: 12, price_bottle_chf: 56 },
    { wineId: 'vergani-muramura-timorasso-75', name: 'Timorasso Beatrice', producer: 'Mura Mura', region: 'Piemonte (Colli Tortonesi)', vintage: '2023', grapes: ['Timorasso'], category: 'Colli Tortonesi DOC', format: '75cl', cost_chf: 25.30, price_glass_chf: 13, price_bottle_chf: 64 },
    { wineId: 'vergani-collazzi-fiano-otto-muri-75', name: 'Fiano Otto Muri', producer: 'Collazzi', region: 'Toscana', vintage: '2023', grapes: ['Fiano'], category: 'Toscana IGT', format: '75cl', cost_chf: 14.10, price_glass_chf: 9, price_bottle_chf: 38 },
    { wineId: 'vergani-anima-fiano-75', name: 'Anima Fiano', producer: "L'Anima di Vergani", region: 'Toscana', vintage: '2021', grapes: ['Fiano'], category: 'Toscana IGT', format: '75cl', cost_chf: 20.80, price_glass_chf: 11, price_bottle_chf: 52 },
    { wineId: 'vergani-cdb-corte-lupo-bianco-75', name: 'Corte del Lupo Bianco', producer: "Ca' del Bosco", region: 'Lombardia (Franciacorta)', vintage: '2023', grapes: ['Chardonnay', 'Pinot Bianco'], category: 'Curtefranca DOC', format: '75cl', cost_chf: 24.60, price_glass_chf: 12, price_bottle_chf: 62 },
    { wineId: 'vergani-tessari-due-merlot-cf-75', name: 'Due — Merlot, Cabernet Franc', producer: 'Tessari Gianni', region: 'Veneto', vintage: '2022', grapes: ['Merlot', 'Cabernet Franc'], category: 'Veneto IGT', format: '75cl', cost_chf: 10.00, price_glass_chf: 7, price_bottle_chf: 28 },
    { wineId: 'vergani-collazzi-liberta-75', name: 'Libertà', producer: 'Collazzi', region: 'Toscana', vintage: '2022', grapes: ['Merlot', 'Cabernet Sauvignon', 'Cabernet Franc'], category: 'Toscana IGT', format: '75cl', cost_chf: 13.60, price_glass_chf: 9, price_bottle_chf: 38 },
    { wineId: 'vergani-muramura-nebbiolo-mercuzio-75', name: 'Nebbiolo Mercuzio', producer: 'Mura Mura', region: 'Piemonte (Langhe)', vintage: '2021', grapes: ['Nebbiolo'], category: 'Langhe DOC', format: '75cl', cost_chf: 15.20, price_glass_chf: 10, price_bottle_chf: 42 },
    { wineId: 'vergani-collazzi-chianti-bastioni-75', name: 'Chianti Bastioni', producer: 'Collazzi', region: 'Toscana', vintage: '2022', grapes: ['Sangiovese', 'Merlot', 'Malvasia'], category: 'Chianti Classico DOCG', format: '75cl', cost_chf: 18.10, price_glass_chf: 10, price_bottle_chf: 48 },
    { wineId: 'vergani-collazzi-toscana-igt-75', name: 'Collazzi', producer: 'Collazzi', region: 'Toscana', vintage: '2021', grapes: ['Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Petit Verdot'], category: 'Toscana IGT', format: '75cl', cost_chf: 14.20, price_glass_chf: 9, price_bottle_chf: 42 },
    { wineId: 'vergani-anima-toscana-75', name: 'Anima Toscana', producer: "L'Anima di Vergani", region: 'Toscana', vintage: '2020', grapes: ['Merlot', 'Cabernet Sauvignon', 'Cabernet Franc', 'Petit Verdot'], category: 'Toscana IGT', format: '75cl', cost_chf: 28.50, price_glass_chf: 15, price_bottle_chf: 78 },
    { wineId: 'vergani-muramura-romeo-75', name: 'Romeo', producer: 'Mura Mura', region: 'Piemonte', vintage: '2022', grapes: ['Barbera', 'Nebbiolo'], category: 'Piemonte DOC', format: '75cl', cost_chf: 28.80, price_glass_chf: 15, price_bottle_chf: 78 },
    { wineId: 'vergani-anima-amarone-75', name: 'Anima Amarone', producer: "L'Anima di Vergani", region: 'Veneto', vintage: '2019', grapes: ['Corvina', 'Corvinone', 'Rondinella'], category: 'Amarone della Valpolicella Classico DOCG', format: '75cl', cost_chf: 23.55, price_glass_chf: 14, price_bottle_chf: 68 },
    { wineId: 'vergani-muramura-barbaresco-faset-75', name: 'Barbaresco Faset', producer: 'Mura Mura', region: 'Piemonte', vintage: '2019', grapes: ['Nebbiolo'], category: 'Barbaresco DOCG', format: '75cl', cost_chf: 49.30, price_glass_chf: 22, price_bottle_chf: 128 },
    { wineId: 'vergani-cdb-maurizio-zanella-75', name: 'Maurizio Zanella', producer: "Ca' del Bosco", region: 'Lombardia (Franciacorta)', vintage: '2021', grapes: ['Cabernet Sauvignon', 'Cabernet Franc', 'Merlot'], category: 'Rosso del Sebino IGT', format: '75cl', cost_chf: 56.50, price_glass_chf: 26, price_bottle_chf: 145 },
  ];
}

function buildSystemPrompt(restaurantSlug: string, language: Language, wines: WineStock[]): string {
  const langMap: Record<Language, string> = {
    it: 'italiano',
    de: 'tedesco (Hochdeutsch)',
    en: 'inglese',
    fr: 'francese',
  };

  const wineList = wines
    .map(
      (w) =>
        `- [${w.wineId}] ${w.name} — ${w.producer} (${w.region}, ${w.vintage}) | vitigni: ${w.grapes.join(', ')} | ${w.category} | calice CHF ${w.price_glass_chf} · bottiglia CHF ${w.price_bottle_chf}`
    )
    .join('\n');

  return `Sei il sommelier del ristorante "${restaurantSlug}". Hai una voce umana, calda, mai snob, mai paternalistica. Parli al cliente come un amico esperto: dritto al punto, niente fuffa, niente termini tecnici inutili.

Compito: dato un ordine di piatti e la lista vini disponibili in cantina QUESTA SERA, suggerisci ESATTAMENTE 3 vini in 3 fasce di prezzo:
- "easy" → fascia accessibile, vino di pronta beva, piacevole, sicuro
- "equilibrato" → giusto compromesso qualità/prezzo, abbinamento più ragionato
- "importante" → vino premium, esperienza alta, da serata speciale

LISTA VINI DISPONIBILI (usa SOLO questi wineId, non inventare):
${wineList}

REGOLE OUTPUT:
1. Rispondi SOLO con un JSON valido, niente markdown, niente testo prima o dopo, niente \`\`\`.
2. Lingua del testo (reason, story_short, tasting_notes): ${langMap[language]}.
3. Schema esatto:
{
  "wines": [
    {
      "tier": "easy" | "equilibrato" | "importante",
      "wineId": "<id dalla lista>",
      "reason": "<2 righe max, perché si abbina ai piatti ordinati>",
      "story_short": "<1-2 righe sulla storia/produttore/territorio>",
      "tasting_notes": ["<nota1>", "<nota2>", "<nota3>"],
      "service_temp_c": <numero intero>,
      "confidence": <intero 0-100, quanto sei sicuro dell'abbinamento>
    }
  ]
}
4. Esattamente 3 vini, uno per ogni tier, nell'ordine: easy, equilibrato, importante.
5. Considera tutti i piatti dell'ordine e cerca il miglior compromesso (non un vino diverso per ogni piatto).
6. Tasting notes: 3 descrittori sensoriali concreti (es. "ciliegia matura", "tannino morbido", "finale lungo").`;
}

interface ClaudeWine {
  tier: Tier;
  wineId: string;
  reason: string;
  story_short: string;
  tasting_notes: string[];
  service_temp_c: number;
  confidence: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SommelierRequest;
    const { restaurantSlug, tableCode, dishesInput, language, customerEmail } = body;

    if (!restaurantSlug || !dishesInput || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantSlug, dishesInput, language' },
        { status: 400 }
      );
    }

    console.log('[SOMMELIER] Request:', { restaurantSlug, tableCode, dishesInput, language, customerEmail });

    const wines = loadWineStock(restaurantSlug);
    const systemPrompt = buildSystemPrompt(restaurantSlug, language, wines);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SOMMELIER] ANTHROPIC_API_KEY missing');
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY missing on this environment' },
        { status: 500 }
      );
    }

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Piatti ordinati al tavolo ${tableCode}:\n${dishesInput}\n\nSuggerisci 3 vini (easy / equilibrato / importante) in JSON come da schema.`,
        },
      ],
    });

    const textBlock = completion.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`Invalid JSON response from Claude: ${raw.slice(0, 200)}`);
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as { wines: ClaudeWine[] };

    const wineMap = new Map(wines.map((w) => [w.wineId, w]));
    const suggestions: WineSuggestion[] = parsed.wines.map((cw) => {
      const w = wineMap.get(cw.wineId);
      if (!w) {
        throw new Error(`Claude returned unknown wineId: ${cw.wineId}`);
      }
      return {
        tier: cw.tier,
        wineId: w.wineId,
        name: w.name,
        producer: w.producer,
        region: w.region,
        vintage: w.vintage,
        price_glass_chf: w.price_glass_chf,
        price_bottle_chf: w.price_bottle_chf,
        reason: cw.reason,
        story_short: cw.story_short,
        tasting_notes: cw.tasting_notes,
        service_temp_c: cw.service_temp_c,
        confidence: cw.confidence,
      };
    });

    const suggestionId = randomUUID();

    console.log('[SOMMELIER] Suggested:', suggestionId, suggestions.map((s) => `${s.tier}:${s.wineId}`));

    // TODO: salvare suggestionId + payload su DB Prisma (tabella wine_suggestion).
    const response: SommelierResponse = { suggestionId, wines: suggestions };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    // @ts-expect-error - Anthropic SDK errors expose .status
    const apiStatus = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
    console.error('[SOMMELIER] Error:', message, { apiStatus, stack });
    return NextResponse.json(
      { error: `Sommelier failed: ${message}`, apiStatus },
      { status: 500 }
    );
  }
}
