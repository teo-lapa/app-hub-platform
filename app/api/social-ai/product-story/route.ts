import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minuto per ricerca + generazione

/**
 * POST /api/social-ai/product-story
 *
 * RICERCA E GENERAZIONE STORIA DEL PRODOTTO
 *
 * Cerca informazioni storiche, origine, tradizione e curiosità del prodotto,
 * genera una struttura dettagliata della storia e un'immagine rappresentativa.
 *
 * Body:
 * - productName: string - Nome del prodotto (es: "Parmigiano Reggiano DOP")
 * - productDescription?: string - Descrizione opzionale
 * - productImage?: string - Immagine prodotto base64 (opzionale)
 */

interface ProductStoryRequest {
  productName: string;
  productDescription?: string;
  productImage?: string;
}

interface StoryData {
  title: string;
  subtitle: string;
  introduction: string;
  origin: {
    region: string;
    history: string;
    year?: string;
  };
  tradition: {
    description: string;
    culturalSignificance: string;
  };
  production: {
    method: string;
    uniqueCharacteristics: string[];
  };
  certification?: {
    type: string; // DOP, IGP, STG, etc.
    description: string;
  };
  curiosities: string[];
  pairings: string[];
  quote?: string;
  imagePrompt: string;
}

interface StoryResult {
  success: boolean;
  data?: {
    story: StoryData;
    imageUrl: string;
    sources: {
      title: string;
      url: string;
    }[];
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<StoryResult>> {
  try {
    const { productName, productDescription, productImage } = await request.json() as ProductStoryRequest;

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

    console.log(`[Product Story] Searching for: ${productName}`);

    // ==========================================
    // FASE 1: RICERCA WEB STORIA PRODOTTO
    // ==========================================

    let webContext = '';
    let sources: { title: string; url: string }[] = [];

    // Usa Google Custom Search per trovare informazioni storiche
    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (searchApiKey && searchEngineId) {
      try {
        const searchQuery = `storia origine tradizione ${productName} italiano DOP IGP`;
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

          console.log(`[Product Story] Found ${searchData.items.length} sources`);
        }
      } catch (error) {
        console.warn('[Product Story] Web search failed:', error);
        // Continua senza contesto web
      }
    }

    // ==========================================
    // FASE 2: ANALISI E STRUTTURAZIONE STORIA
    // ==========================================

    const storyPrompt = `Sei uno storico gastronomico esperto di prodotti italiani tradizionali e certificazioni DOP/IGP.

PRODOTTO: ${productName}
${productDescription ? `DESCRIZIONE: ${productDescription}` : ''}

${webContext ? `CONTESTO DA WEB (informazioni trovate online):\n${webContext}\n` : ''}

COMPITO:
Crea una STORIA COMPLETA e AUTENTICA di questo prodotto italiano.
${webContext ? 'Basati principalmente sulle informazioni trovate nel web context.' : 'Usa le tue conoscenze consolidate sui prodotti italiani tradizionali.'}

REQUISITI:
- Informazioni VERIFICABILI e AUTENTICHE
- Origine geografica precisa
- Storia e tradizione documentata
- Se è un prodotto DOP/IGP/STG, includi informazioni sulla certificazione
- Curiosità interessanti e poco conosciute
- Abbinamenti gastronomici tradizionali

Rispondi SOLO con JSON valido (no markdown, no \`\`\`):
{
  "title": "Titolo accattivante per il blog (es: 'Parmigiano Reggiano: Il Re dei Formaggi dal 1200')",
  "subtitle": "Sottotitolo descrittivo (max 100 caratteri)",
  "introduction": "Introduzione coinvolgente che cattura l'attenzione (2-3 frasi)",
  "origin": {
    "region": "Regione/zona di origine",
    "history": "Storia dettagliata delle origini (3-4 frasi)",
    "year": "Anno o periodo di origine (se noto)"
  },
  "tradition": {
    "description": "Descrizione della tradizione produttiva (3-4 frasi)",
    "culturalSignificance": "Importanza culturale e sociale del prodotto"
  },
  "production": {
    "method": "Metodo di produzione tradizionale (3-4 frasi)",
    "uniqueCharacteristics": ["Caratteristica 1", "Caratteristica 2", "..."]
  },
  "certification": {
    "type": "DOP | IGP | STG | Nessuna",
    "description": "Descrizione della certificazione e cosa garantisce"
  },
  "curiosities": [
    "Curiosità interessante 1",
    "Curiosità interessante 2",
    "Curiosità interessante 3"
  ],
  "pairings": [
    "Abbinamento gastronomico 1",
    "Abbinamento gastronomico 2",
    "Abbinamento gastronomico 3"
  ],
  "quote": "Una citazione famosa o un detto popolare sul prodotto (se esiste)",
  "imagePrompt": "Descrizione dettagliata in INGLESE per generare immagine evocativa del prodotto (stile: artistic food photography, traditional Italian setting, warm lighting, rustic atmosphere)"
}

REGOLE CRITICHE:
- Informazioni DEVONO essere autentiche e verificabili
- NON inventare date, nomi o fatti storici
- Se non sei sicuro di qualcosa, omettilo
- Focus su autenticità e tradizione italiana`;

    console.log('[Product Story] Analyzing with Gemini...');

    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: storyPrompt }]
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
    responseText = responseText.replace(/[\x00-\x1F\x7F]/g, ' ');
    responseText = responseText.replace(/,\s*([}\]])/g, '$1');
    responseText = responseText.replace(/:\s*"([^"]*)\n([^"]*)"/g, ': "$1 $2"');

    let storyData: StoryData;
    try {
      storyData = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('[Product Story] JSON parse failed, attempting repair...');
      console.error('[Product Story] Raw response (first 500 chars):', responseText.substring(0, 500));

      try {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          let cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
          cleanJson = cleanJson.replace(/\/\/[^\n]*/g, '');
          cleanJson = cleanJson.replace(/(?<!\\)"\s*\n/g, '",\n');

          storyData = JSON.parse(cleanJson);
          console.log('[Product Story] JSON repaired successfully!');
        } else {
          throw new Error('Cannot find valid JSON structure');
        }
      } catch (repairError) {
        console.error('[Product Story] JSON repair failed:', repairError);
        throw new Error(`JSON non valido da Gemini: ${parseError.message}. Riprova.`);
      }
    }

    console.log(`[Product Story] Story created: ${storyData.title}`);

    // ==========================================
    // FASE 3: GENERA IMMAGINE EVOCATIVA
    // ==========================================

    const imagePrompt = `${storyData.imagePrompt}

STYLE: Artistic food photography, traditional Italian setting, warm golden lighting, rustic wooden background,
authentic atmosphere, heritage and tradition feel, magazine quality.
COMPOSITION: Product as hero, shallow depth of field, warm inviting colors, Italian countryside or traditional kitchen elements.
QUALITY: High detail, editorial quality photography, suitable for blog and social media marketing.
CONTEXT: Traditional Italian food heritage, authentic presentation, storytelling mood.`;

    console.log('[Product Story] Generating story image...');

    let imageDataUrl: string | null = null;

    try {
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [{ text: imagePrompt }],
        config: {
          responseModalities: ['Text', 'Image']
        }
      });

      // Estrai immagine dalla struttura candidates (formato standard)
      for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log('[Product Story] Image generated successfully!');
          break;
        }
      }

      // Fallback: prova struttura alternativa .parts
      if (!imageDataUrl) {
        for (const part of (imageResponse as any).parts || []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[Product Story] Image found in parts structure');
            break;
          }
        }
      }
    } catch (imageError: any) {
      console.error('[Product Story] Image generation failed:', imageError.message);
    }

    if (!imageDataUrl) {
      console.error('[Product Story] No image generated - this will cause publish to fail');
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    return NextResponse.json({
      success: true,
      data: {
        story: storyData,
        imageUrl: imageDataUrl || '',
        sources
      }
    });

  } catch (error: any) {
    console.error('[Product Story] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante generazione storia'
      },
      { status: 500 }
    );
  }
}
