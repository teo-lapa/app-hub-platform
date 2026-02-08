import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 120;

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'] as const;
const TONES = ['professional', 'casual', 'fun', 'luxury'] as const;
const CONTENT_TYPES = ['image', 'video', 'both'] as const;
const VIDEO_STYLES = ['cinematic', 'zoom', 'dynamic', 'orbital', 'rotate'] as const;

/**
 * POST /api/social-ai/autopilot/generate-queue
 *
 * The AI brain that decides what to post. Uses Gemini to:
 * 1. Analyze available products
 * 2. Decide which products to feature
 * 3. Choose optimal platform, tone, timing for each
 * 4. Return a prioritized queue of post suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, count = 5 } = body;

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'Nessun prodotto disponibile per la generazione' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key Gemini non configurata' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build product list for AI analysis (category may be string or object)
    const getCategoryName = (cat: any): string => {
      if (!cat) return 'Food';
      if (typeof cat === 'string') return cat;
      if (typeof cat === 'object') return cat.name || cat[1] || 'Food';
      return String(cat);
    };

    const productList = products.slice(0, 20).map((p: any, i: number) =>
      `${i + 1}. "${p.name}" (${getCategoryName(p.category)}, CHF ${p.price || '?'}) - ${p.wasRecentlyPosted ? 'POSTATO DI RECENTE' : 'MAI POSTATO'} - ${p.hasImage ? 'Ha immagine' : 'Senza immagine'}`
    ).join('\n');

    const now = new Date();
    const dayOfWeek = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'][now.getDay()];
    const month = now.toLocaleString('it-IT', { month: 'long' });

    const prompt = `Sei un Social Media Manager esperto per LAPA, azienda svizzera di prodotti alimentari italiani premium.

OGGI: ${dayOfWeek}, ${now.getDate()} ${month} ${now.getFullYear()}

PRODOTTI DISPONIBILI:
${productList}

REGOLE STRATEGICHE:
- PRIORITA' ai prodotti MAI POSTATI (hanno piu' bisogno di visibilita')
- Scegli SOLO prodotti con immagine
- Instagram: ideale per food photography (1:1), usa tone casual/fun
- Facebook: buono per community (4:3), usa tone casual/professional
- LinkedIn: B2B, ristorazione professionale, usa tone professional/luxury
- TikTok: video brevi, Gen-Z, usa tone fun/casual
- Twitter/X: breve e d'impatto (max 280 char), usa tone casual
- YouTube: video di qualita' per canale YouTube, usa tone professional
- Distribuisci tra le piattaforme (non tutti su Instagram)
- Orari migliori: 11:00-13:00 (pranzo), 17:00-19:00 (aperitivo), 20:00-21:00 (cena)
- REGOLA FONDAMENTALE: contentType "video" SOLO per TikTok e YouTube. Instagram, Facebook, LinkedIn, Twitter = SEMPRE "image"
- TikTok/YouTube: scegli prodotti visivamente interessanti per video (pasta fresca, formaggi, salumi)

Genera ESATTAMENTE ${Math.min(count, 8)} post suggeriti come JSON array.

FORMATO OUTPUT (SOLO JSON, nient'altro):
[
  {
    "productIndex": 1,
    "platform": "instagram",
    "tone": "casual",
    "contentType": "image",
    "videoStyle": "cinematic",
    "videoDuration": 6,
    "scheduledTime": "12:00",
    "reasoning": "Mozzarella mai postata, perfetta per Instagram food photography a ora di pranzo"
  }
]

VALORI AMMESSI:
- platform: ${PLATFORMS.join(', ')}
- tone: ${TONES.join(', ')}
- contentType: ${CONTENT_TYPES.join(', ')}
- videoStyle: ${VIDEO_STYLES.join(', ')} (solo se contentType include video)
- videoDuration: 4, 6, 8 (solo se contentType include video)
- scheduledTime: formato HH:MM

Rispondi SOLO con il JSON array, senza markdown o altro testo.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }],
    });

    const text = response.text?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim() || '[]';

    let suggestions;
    try {
      suggestions = JSON.parse(text);
    } catch {
      console.error('[AutopilotQueue] Failed to parse AI response:', text);
      // Fallback: create basic suggestions
      suggestions = products
        .filter((p: any) => p.hasImage && !p.wasRecentlyPosted)
        .slice(0, count)
        .map((p: any, i: number) => ({
          productIndex: products.indexOf(p) + 1,
          platform: PLATFORMS[i % PLATFORMS.length],
          tone: TONES[i % TONES.length],
          contentType: 'image' as const,
          scheduledTime: ['11:30', '12:00', '17:30', '18:00', '20:00'][i % 5],
          reasoning: `Prodotto mai postato, suggerito automaticamente`
        }));
    }

    // Map suggestions to AutopilotPost format
    const today = new Date().toISOString().split('T')[0];
    const queue = suggestions.map((s: any, index: number) => {
      const productIdx = (s.productIndex || index + 1) - 1;
      const product = products[Math.min(productIdx, products.length - 1)];

      // ENFORCE: video SOLO su TikTok e YouTube, tutto il resto = image
      const platform = PLATFORMS.includes(s.platform) ? s.platform : 'instagram';
      const contentType = (platform === 'tiktok' || platform === 'youtube') ? (s.contentType || 'video') : 'image';

      return {
        id: `autopilot-${Date.now()}-${index}`,
        productIndex: productIdx,
        product: {
          id: product.id,
          name: product.name,
          code: product.code || '',
          image: '', // Images mapped client-side to avoid huge payloads
          category: getCategoryName(product.category),
          price: product.price || 0,
        },
        platform,
        tone: TONES.includes(s.tone) ? s.tone : 'casual',
        contentType,
        videoStyle: s.videoStyle || 'cinematic',
        videoDuration: [4, 6, 8].includes(s.videoDuration) ? s.videoDuration : 6,
        scheduledFor: `${today}T${s.scheduledTime || '12:00'}:00`,
        reasoning: s.reasoning || 'Suggerito dall\'AI',
        status: 'queued',
        createdAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        queue,
        stats: {
          total: queue.length,
          queued: queue.length,
          generating: 0,
          ready: 0,
          approved: 0,
          published: 0,
          rejected: 0,
        }
      }
    });

  } catch (error: any) {
    console.error('[AutopilotQueue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante generazione coda autopilot' },
      { status: 500 }
    );
  }
}
