import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lazy initialization
function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY.trim(),
  });
}

interface ExtractedProduct {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'food' | 'non_food';
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * POST /api/inventario-vocale/extract-products
 *
 * Extract products from transcription using Claude AI
 *
 * Request: JSON
 * {
 *   transcription: string,
 *   location?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   products: ExtractedProduct[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcription, location } = body;

    if (!transcription || typeof transcription !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Trascrizione mancante o non valida'
      }, { status: 400 });
    }

    console.log('[VOICE-INVENTORY] Extracting products from transcription:', {
      transcriptionLength: transcription.length,
      location
    });

    const anthropic = getAnthropicClient();

    const systemPrompt = `Sei un assistente specializzato nell'estrazione di prodotti da inventari vocali per ristoranti e fornitori alimentari.

Il tuo compito è:
1. Estrarre TUTTI i prodotti menzionati nella trascrizione
2. Identificare la quantità e l'unità di misura per ogni prodotto
3. Classificare ogni prodotto come "food" (alimentare) o "non_food" (non alimentare)
4. Assegnare un livello di confidenza basato su quanto è chiara l'informazione

CATEGORIE:
- food: tutto ciò che è alimentare (carne, pesce, verdure, latticini, bevande, condimenti, ecc.)
- non_food: detersivi, carta, stoviglie, attrezzature, prodotti per pulizia, ecc.

UNITÀ DI MISURA COMUNI:
- kg, g (peso)
- l, ml (liquidi)
- pz, pezzi (unità singole)
- cartoni, scatole, confezioni (imballaggi)
- sacchi, buste, vaschette

CONFIDENZA:
- high: prodotto e quantità chiaramente menzionati
- medium: prodotto chiaro ma quantità incerta o viceversa
- low: informazione vaga o incompleta

Rispondi SOLO con un JSON array valido, senza altro testo.`;

    const userPrompt = `Estrai i prodotti dalla seguente trascrizione di inventario${location ? ` (zona: ${location})` : ''}:

"${transcription}"

Rispondi con un JSON array di oggetti con questa struttura:
[
  {
    "name": "nome prodotto",
    "quantity": numero,
    "unit": "unità di misura",
    "category": "food" o "non_food",
    "notes": "note opzionali",
    "confidence": "high", "medium" o "low"
  }
]

Se non trovi prodotti, rispondi con un array vuoto: []`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    });

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('Nessuna risposta testuale da Claude');
    }

    let responseText = textContent.text.trim();

    // Clean response - remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    // Parse JSON
    let products: ExtractedProduct[];
    try {
      const parsed = JSON.parse(responseText);

      if (!Array.isArray(parsed)) {
        throw new Error('La risposta non è un array');
      }

      // Add IDs and validate/clean products
      products = parsed.map((p: any, index: number) => ({
        id: `prod_${Date.now()}_${index}`,
        name: String(p.name || '').trim(),
        quantity: typeof p.quantity === 'number' ? p.quantity : parseFloat(p.quantity) || 1,
        unit: String(p.unit || 'pz').trim(),
        category: p.category === 'non_food' ? 'non_food' : 'food',
        notes: p.notes ? String(p.notes).trim() : undefined,
        confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium'
      })).filter((p: ExtractedProduct) => p.name.length > 0);

    } catch (parseError) {
      console.error('[VOICE-INVENTORY] JSON parse error:', parseError, 'Response:', responseText);
      return NextResponse.json({
        success: false,
        error: 'Errore nel parsing della risposta AI'
      }, { status: 500 });
    }

    console.log('[VOICE-INVENTORY] Extracted products:', products.length);

    return NextResponse.json({
      success: true,
      products
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] Extract products error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'estrazione dei prodotti';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
