import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minuto per ricerca + generazione

/**
 * POST /api/social-ai/product-recipe
 *
 * RICERCA E GENERAZIONE RICETTE TRADIZIONALI
 *
 * Cerca ricette tradizionali autentiche del prodotto selezionato,
 * genera una struttura dettagliata della ricetta e un'immagine del piatto finito.
 *
 * Body:
 * - productName: string - Nome del prodotto (es: "Pomodoro San Marzano DOP")
 * - productDescription?: string - Descrizione opzionale
 * - productImage?: string - Immagine prodotto base64 (opzionale)
 */

interface ProductRecipeRequest {
  productName: string;
  productDescription?: string;
  productImage?: string;
}

interface RecipeData {
  title: string;
  description: string;
  region: string;
  tradition: string;
  ingredients: {
    item: string;
    quantity: string;
  }[];
  steps: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: 'Facile' | 'Media' | 'Difficile';
  tips: string[];
  imagePrompt: string;
}

interface RecipeResult {
  success: boolean;
  data?: {
    recipe: RecipeData;
    imageUrl: string;
    sources: {
      title: string;
      url: string;
    }[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RecipeResult>> {
  try {
    const { productName, productDescription, productImage } = await request.json() as ProductRecipeRequest;

    if (!productName) {
      return NextResponse.json(
        { success: false, error: 'Nome prodotto richiesto' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Product Recipe] Searching for: ${productName}`);

    // ==========================================
    // FASE 1: RICERCA WEB RICETTE TRADIZIONALI
    // ==========================================

    let webContext = '';
    let sources: { title: string; url: string }[] = [];

    // Usa Google Custom Search per trovare ricette tradizionali
    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (searchApiKey && searchEngineId) {
      try {
        const searchQuery = `ricetta tradizionale ${productName} italiana autentica`;
        const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
        searchUrl.searchParams.append('key', searchApiKey);
        searchUrl.searchParams.append('cx', searchEngineId);
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('num', '5');
        searchUrl.searchParams.append('lr', 'lang_it'); // Risultati in italiano

        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          webContext = searchData.items
            .slice(0, 3)
            .map((item: any) => `${item.title}\n${item.snippet}`)
            .join('\n\n');

          sources = searchData.items.slice(0, 3).map((item: any) => ({
            title: item.title,
            url: item.link
          }));

          console.log(`[Product Recipe] Found ${searchData.items.length} sources`);
        }
      } catch (error) {
        console.warn('[Product Recipe] Web search failed:', error);
        // Continua senza contesto web
      }
    }

    // ==========================================
    // FASE 2: ANALISI E STRUTTURAZIONE RICETTA
    // ==========================================

    const recipePrompt = `Sei uno chef esperto di cucina tradizionale italiana e storico gastronomico.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}

${webContext ? `CONTESTO DA WEB (ricette trovate online):\n${webContext}\n` : ''}

COMPITO:
Crea una ricetta tradizionale AUTENTICA e REALE per questo prodotto.
${webContext ? 'Basati principalmente sulle informazioni trovate nel web context.' : 'Usa le tue conoscenze di ricette tradizionali italiane consolidate.'}

REQUISITI:
- Ricetta TRADIZIONALE e AUTENTICA (NON inventare)
- Se è un ingrediente base, crea ricetta classica che lo usa come protagonista
- Se è un prodotto DOP/IGP, rispetta il disciplinare tradizionale
- Ingredienti precisi con quantità esatte
- Procedimento dettagliato step-by-step
- Regione di origine e tradizione culturale

Rispondi SOLO con JSON valido (no markdown, no \`\`\`):
{
  "title": "Nome ricetta tradizionale (es: Pasta al Pomodoro San Marzano)",
  "description": "Breve descrizione della ricetta e sua importanza culturale (max 150 caratteri)",
  "region": "Regione italiana di origine",
  "tradition": "Contesto tradizionale/culturale della ricetta (max 100 caratteri)",
  "ingredients": [
    { "item": "Nome ingrediente", "quantity": "Quantità precisa" }
  ],
  "steps": [
    "Passo 1 dettagliato",
    "Passo 2 dettagliato",
    "..."
  ],
  "prepTime": "Es: 15 minuti",
  "cookTime": "Es: 30 minuti",
  "servings": "Es: 4 persone",
  "difficulty": "Facile | Media | Difficile",
  "tips": [
    "Consiglio 1 per successo ricetta",
    "Consiglio 2"
  ],
  "imagePrompt": "Descrizione dettagliata in INGLESE per generare immagine food photography del piatto finito (stile: professional food photography, appetizing, traditional Italian dish presentation)"
}

REGOLE CRITICHE:
- Ricetta DEVE essere autentica e verificabile
- NON inventare ricette moderne o fusion
- Ingredienti realistici e reperibili
- Quantità precise (non "q.b." ma numeri)
- Steps chiari e ordinati
- Focus su tradizione e autenticità`;

    console.log('[Product Recipe] Analyzing with Gemini...');

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: recipePrompt }]
    });

    // Estrai JSON dalla risposta
    let responseText = analysisResponse.text.trim();

    // Rimuovi eventuali markdown code blocks
    responseText = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');

    const recipeData: RecipeData = JSON.parse(responseText);

    console.log(`[Product Recipe] Recipe created: ${recipeData.title}`);

    // ==========================================
    // FASE 3: GENERA IMMAGINE FOOD PHOTOGRAPHY
    // ==========================================

    const imagePrompt = `${recipeData.imagePrompt}

STYLE: Professional food photography, appetizing presentation, traditional Italian cuisine aesthetic,
rustic wooden table, natural lighting, garnished beautifully, restaurant quality plating.
COMPOSITION: Centered dish with shallow depth of field, warm inviting colors, authentic Italian atmosphere.
QUALITY: High detail, magazine quality food photography, suitable for social media and marketing.
CONTEXT: Traditional ${recipeData.region} cuisine, authentic presentation.`;

    console.log('[Product Recipe] Generating food image...');

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: imagePrompt }]
    });

    // Estrai immagine generata - prova diverse strutture (come in generate-marketing)
    let imageDataUrl: string | null = null;

    // Struttura 1: response.parts
    for (const part of (imageResponse as any).parts || []) {
      if (part.inlineData?.data) {
        imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        console.log('[Product Recipe] Image generated successfully from parts');
        break;
      }
    }

    // Struttura 2: response.candidates[0].content.parts (struttura standard Gemini API)
    if (!imageDataUrl) {
      const candidates = (imageResponse as any).candidates || [];
      if (candidates.length > 0 && candidates[0].content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[Product Recipe] Image found in candidates structure');
            break;
          }
        }
      }
    }

    if (!imageDataUrl) {
      console.warn('[Product Recipe] No image generated in response');
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    return NextResponse.json({
      success: true,
      data: {
        recipe: recipeData,
        imageUrl: imageDataUrl || '',
        sources
      }
    });

  } catch (error: any) {
    console.error('[Product Recipe] Error:', error);

    // Log dettagliato per debugging
    if (error.message?.includes('JSON')) {
      console.error('[Product Recipe] JSON parsing error - Response might not be valid JSON');
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante generazione ricetta'
      },
      { status: 500 }
    );
  }
}
