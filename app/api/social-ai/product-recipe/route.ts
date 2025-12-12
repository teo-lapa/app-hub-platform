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
  recipeSuggestion?: string; // Suggerimento ricetta opzionale (es: "Carbonara", "Amatriciana")
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
    const { productName, productDescription, productImage, recipeSuggestion } = await request.json() as ProductRecipeRequest;

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

    console.log(`[Product Recipe] Searching for: ${productName}${recipeSuggestion ? ` (suggerimento: ${recipeSuggestion})` : ''}`);

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
        // Se c'è un suggerimento, cercalo specificamente
        const searchQuery = recipeSuggestion
          ? `ricetta ${recipeSuggestion} tradizionale italiana ${productName}`
          : `ricetta tradizionale ${productName} italiana autentica`;
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
${recipeSuggestion ? `RICETTA RICHIESTA: ${recipeSuggestion} (l'utente vuole specificamente questa ricetta!)` : ''}

${webContext ? `CONTESTO DA WEB (ricette trovate online):\n${webContext}\n` : ''}

COMPITO:
${recipeSuggestion
  ? `Crea la ricetta "${recipeSuggestion}" usando "${productName}" come ingrediente principale.`
  : 'Crea una ricetta tradizionale AUTENTICA e REALE per questo prodotto.'}
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
    const rawText = analysisResponse.text;
    if (!rawText) {
      throw new Error('Risposta vuota da Gemini');
    }

    let responseText = rawText.trim();

    // Rimuovi eventuali markdown code blocks
    responseText = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');

    // Pulizia JSON robusta
    // 1. Rimuovi caratteri di controllo problematici
    responseText = responseText.replace(/[\x00-\x1F\x7F]/g, ' ');
    // 2. Rimuovi virgole trailing prima di ] o }
    responseText = responseText.replace(/,\s*([}\]])/g, '$1');
    // 3. Rimuovi newlines dentro le stringhe (causa errori JSON)
    responseText = responseText.replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');

    let recipeData: RecipeData;
    try {
      recipeData = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('[Product Recipe] JSON parse failed, attempting repair...');
      console.error('[Product Recipe] Raw response (first 500 chars):', responseText.substring(0, 500));

      // Tentativo di riparazione più aggressivo
      try {
        // Trova l'inizio e la fine del JSON object
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          let cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
          // Rimuovi eventuali commenti
          cleanJson = cleanJson.replace(/\/\/[^\n]*/g, '');
          // Fix virgolette non escapate
          cleanJson = cleanJson.replace(/(?<!\\)"\s*\n/g, '",\n');

          recipeData = JSON.parse(cleanJson);
          console.log('[Product Recipe] JSON repaired successfully!');
        } else {
          throw new Error('Cannot find valid JSON structure');
        }
      } catch (repairError) {
        console.error('[Product Recipe] JSON repair failed:', repairError);
        throw new Error(`JSON non valido da Gemini: ${parseError.message}. Riprova.`);
      }
    }

    console.log(`[Product Recipe] Recipe created: ${recipeData.title}`);

    // ==========================================
    // FASE 3: GENERA IMMAGINE FOOD PHOTOGRAPHY
    // ==========================================

    const imagePrompt = `${recipeData.imagePrompt}

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Generate at maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must look like a real photograph taken by a professional food photographer
- SHARP DETAILS: Every element must be crisp and in focus, no blur or artifacts
- PROFESSIONAL LIGHTING: Soft natural daylight from window, subtle fill light, no harsh shadows

STYLE:
- Professional food photography by award-winning photographer
- Michelin-star restaurant quality plating and presentation
- Traditional Italian cuisine aesthetic with modern styling
- Rustic wooden table or marble surface with natural textures
- Natural side lighting creating depth and dimension
- Garnished beautifully with fresh herbs and authentic ingredients

COMPOSITION:
- Rule of thirds, dish slightly off-center
- Shallow depth of field (f/2.8) with creamy bokeh background
- 45-degree overhead angle (hero shot)
- Warm, inviting color palette (golden tones, rich reds, fresh greens)
- Negative space for text overlay if needed
- Props: vintage utensils, linen napkin, fresh ingredients scattered artistically

TECHNICAL SPECIFICATIONS:
- Magazine cover quality (Bon Appétit, Food & Wine level)
- Color grading: warm and appetizing (slightly orange/yellow tones)
- High dynamic range with detail in highlights and shadows
- NO artificial looking elements, NO CGI appearance
- Steam or sauce drizzle for freshness appeal

CONTEXT: Traditional ${recipeData.region} cuisine, authentic Italian home cooking atmosphere.
DO NOT include any text, watermarks, or logos in the image.`;

    console.log('[Product Recipe] Generating food image...');

    let imageDataUrl: string | null = null;

    try {
      // Prepara contents con immagine prodotto come riferimento (se disponibile)
      const imageContents: any[] = [];

      // Se abbiamo l'immagine del prodotto, usala come riferimento visivo per qualità migliore
      if (productImage) {
        const cleanProductBase64 = productImage.replace(/^data:image\/\w+;base64,/, '');
        imageContents.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanProductBase64
          }
        });
        console.log('[Product Recipe] Using product image as visual reference for better quality');
      }

      // Aggiungi il prompt con istruzioni sul riferimento
      const enhancedImagePrompt = productImage
        ? `Use the provided product image as VISUAL REFERENCE for the main ingredient appearance and quality.
The generated image should feature a finished dish that prominently showcases this ingredient.

${imagePrompt}`
        : imagePrompt;

      imageContents.push({ text: enhancedImagePrompt });

      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: imageContents,
        config: {
          responseModalities: ['Text', 'Image']
        }
      });

      // Estrai immagine dalla struttura candidates (formato standard)
      for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log('[Product Recipe] Image generated successfully!');
          break;
        }
      }

      // Fallback: prova struttura alternativa .parts
      if (!imageDataUrl) {
        for (const part of (imageResponse as any).parts || []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[Product Recipe] Image found in parts structure');
            break;
          }
        }
      }
    } catch (imageError: any) {
      console.error('[Product Recipe] Image generation failed:', imageError.message);
    }

    if (!imageDataUrl) {
      console.error('[Product Recipe] No image generated - this will cause publish to fail');
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
