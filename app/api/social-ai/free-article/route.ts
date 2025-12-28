import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minuto per ricerca + generazione

/**
 * POST /api/social-ai/free-article
 *
 * GENERAZIONE ARTICOLO DA IDEA LIBERA
 *
 * Trasforma un'idea o concetto in un articolo completo professionale,
 * strutturato per blog e social media.
 *
 * Body:
 * - idea: string - L'idea o concetto dell'utente
 * - objective: string - Obiettivo articolo (blog_seo, inspirational, b2b, storytelling)
 * - tone: string - Tone of voice (professional, casual, fun, luxury)
 * - targetAudience?: string - Target audience opzionale
 * - productName?: string - Nome prodotto correlato (opzionale)
 * - productImage?: string - Immagine prodotto base64 (opzionale)
 */

interface FreeArticleRequest {
  idea: string;
  objective: 'blog_seo' | 'inspirational' | 'b2b' | 'storytelling';
  tone: 'professional' | 'casual' | 'fun' | 'luxury';
  targetAudience?: string;
  productName?: string;
  productImage?: string;
}

interface ArticleSection {
  title: string;
  content: string;
}

interface ArticleData {
  title: string;
  subtitle: string;
  introduction: string;
  sections: ArticleSection[];
  conclusion: string;
  seoKeywords: string[];
  socialSuggestions: {
    instagram: string;
    facebook: string;
    linkedin: string;
    hashtags: string[];
  };
  imagePrompt: string;
}

interface ArticleResult {
  success: boolean;
  data?: {
    article: ArticleData;
    imageUrl: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ArticleResult>> {
  try {
    const { idea, objective, tone, targetAudience, productName, productImage } = await request.json() as FreeArticleRequest;

    if (!idea || idea.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Inserisci un\'idea di almeno 10 caratteri' },
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

    console.log(`[Free Article] Generating article from idea: ${idea.substring(0, 50)}...`);

    // ==========================================
    // CONFIGURAZIONE OBIETTIVO
    // ==========================================

    const objectiveConfig: Record<string, { description: string; focus: string }> = {
      blog_seo: {
        description: 'Articolo ottimizzato per SEO e motori di ricerca',
        focus: 'Usa parole chiave strategiche, titoli H2/H3 ottimizzati, meta description efficace. Focus su contenuto informativo e di valore per il lettore.'
      },
      inspirational: {
        description: 'Articolo ispirazionale ed emozionale',
        focus: 'Racconta una storia coinvolgente, usa emozioni e storytelling. Crea connessione emotiva con il lettore attraverso esperienze e sensazioni.'
      },
      b2b: {
        description: 'Articolo commerciale B2B per professionisti',
        focus: 'Focus su valore per il business, ROI, efficienza. Linguaggio professionale, dati e statistiche, case study. Target: ristoratori, chef, buyer.'
      },
      storytelling: {
        description: 'Articolo narrativo con storytelling',
        focus: 'Racconta la storia del prodotto/concetto come una narrazione avvincente. Usa elementi narrativi: personaggi, ambientazione, conflitto, risoluzione.'
      }
    };

    const toneConfig: Record<string, string> = {
      professional: 'Tono autorevole, credibile, formale ma accessibile. Evita slang e colloquialismi.',
      casual: 'Tono conversazionale, amichevole, come parlare con un amico. Usa espressioni colloquiali.',
      fun: 'Tono energico, giocoso, entusiasta. Usa emoji con moderazione, metafore divertenti.',
      luxury: 'Tono esclusivo, sofisticato, raffinato. Linguaggio elegante, evoca esclusività e qualità premium.'
    };

    const selectedObjective = objectiveConfig[objective] || objectiveConfig.blog_seo;
    const selectedTone = toneConfig[tone] || toneConfig.professional;

    // ==========================================
    // FASE 1: RICERCA WEB (opzionale)
    // ==========================================

    let webContext = '';

    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (searchApiKey && searchEngineId) {
      try {
        const searchQuery = `${idea} food italiano gastronomia ${productName || ''}`.trim();
        const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
        searchUrl.searchParams.append('key', searchApiKey);
        searchUrl.searchParams.append('cx', searchEngineId);
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('num', '3');
        searchUrl.searchParams.append('lr', 'lang_it');

        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          webContext = searchData.items
            .slice(0, 3)
            .map((item: any) => `${item.title}\n${item.snippet}`)
            .join('\n\n');

          console.log(`[Free Article] Found ${searchData.items.length} web sources`);
        }
      } catch (error) {
        console.warn('[Free Article] Web search failed:', error);
      }
    }

    // ==========================================
    // FASE 2: GENERAZIONE ARTICOLO
    // ==========================================

    const articlePrompt = `Sei un content strategist e food editor professionale esperto di gastronomia italiana e mediterranea.

IDEA DELL'UTENTE:
"${idea}"

${productName ? `PRODOTTO CORRELATO: ${productName}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}

OBIETTIVO ARTICOLO: ${selectedObjective.description}
${selectedObjective.focus}

TONE OF VOICE: ${selectedTone}

${webContext ? `CONTESTO DA WEB (usa come ispirazione):\n${webContext}\n` : ''}

COMPITO:
Trasforma questa idea in un ARTICOLO COMPLETO, strutturato e di alta qualità per il blog LAPA (fornitore food italiano premium in Svizzera).

REQUISITI:
1. Titolo principale accattivante e ottimizzato
2. Sottotitolo che espande il concetto (max 120 caratteri)
3. Introduzione coinvolgente (2-3 paragrafi)
4. 3-5 sezioni con sottotitoli H2 e contenuto approfondito
5. Conclusione con call-to-action
6. Keywords SEO rilevanti
7. Suggerimenti per post social derivati (Instagram, Facebook, LinkedIn)
8. Prompt per generare immagine di copertina

FOCUS TEMATICO:
- Food italiano / mediterraneo
- Valore per ristoratori, pizzerie, professionisti HoReCa
- Qualità, tradizione, autenticità
- Mercato Svizzera (Zurigo, Berna, Basilea, etc.)

Rispondi SOLO con JSON valido (no markdown, no \`\`\`):
{
  "title": "Titolo principale dell'articolo",
  "subtitle": "Sottotitolo descrittivo (max 120 caratteri)",
  "introduction": "Introduzione coinvolgente di 2-3 paragrafi...",
  "sections": [
    {
      "title": "Titolo Sezione 1",
      "content": "Contenuto approfondito della sezione 1..."
    },
    {
      "title": "Titolo Sezione 2",
      "content": "Contenuto approfondito della sezione 2..."
    },
    {
      "title": "Titolo Sezione 3",
      "content": "Contenuto approfondito della sezione 3..."
    }
  ],
  "conclusion": "Conclusione con call-to-action...",
  "seoKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "socialSuggestions": {
    "instagram": "Caption per Instagram (max 2200 caratteri, con emoji)",
    "facebook": "Post per Facebook (più lungo, con link)",
    "linkedin": "Post professionale per LinkedIn",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
  },
  "imagePrompt": "Descrizione dettagliata in INGLESE per generare immagine di copertina (stile: editorial food photography, premium quality)"
}

REGOLE CRITICHE:
- Contenuto ORIGINALE e di VALORE
- Adatta stile e linguaggio al tone of voice richiesto
- Includi riferimenti al food italiano/mediterraneo dove pertinente
- Le sezioni devono essere sostanziose (almeno 150 parole ciascuna)
- I social suggestions devono essere pronti per pubblicazione`;

    console.log('[Free Article] Generating article with Gemini...');

    const articleResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: articlePrompt }]
    });

    const rawText = articleResponse.text;
    if (!rawText) {
      throw new Error('Risposta vuota da Gemini');
    }

    let responseText = rawText.trim();
    responseText = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    responseText = responseText.replace(/[\x00-\x1F\x7F]/g, ' ');
    responseText = responseText.replace(/,\s*([}\]])/g, '$1');

    let articleData: ArticleData;
    try {
      articleData = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('[Free Article] JSON parse failed, attempting repair...');

      try {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          let cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
          cleanJson = cleanJson.replace(/\/\/[^\n]*/g, '');

          articleData = JSON.parse(cleanJson);
          console.log('[Free Article] JSON repaired successfully!');
        } else {
          throw new Error('Cannot find valid JSON structure');
        }
      } catch (repairError) {
        console.error('[Free Article] JSON repair failed:', repairError);
        throw new Error(`JSON non valido da Gemini: ${parseError.message}. Riprova.`);
      }
    }

    console.log(`[Free Article] Article created: ${articleData.title}`);

    // ==========================================
    // FASE 3: GENERA IMMAGINE DI COPERTINA
    // ==========================================

    const imagePrompt = `${articleData.imagePrompt}

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 16:9 LANDSCAPE format for blog header
- ULTRA HIGH RESOLUTION: Generate at maximum possible resolution
- PHOTOREALISTIC: Must look like a real photograph taken by a professional editorial photographer
- SHARP DETAILS: Every texture must be crisp and professional

STYLE:
- Editorial food/lifestyle photography for premium magazine
- Professional, clean, modern aesthetic
- Warm, inviting lighting
- High-end quality suitable for blog header

COMPOSITION:
- Clean background with subtle depth
- Professional food styling if applicable
- Suitable as article cover image
- Visual storytelling that matches the article theme

CONTEXT: Premium Italian food brand (LAPA), professional audience, Swiss market.
DO NOT include any text, watermarks, or logos in the image.`;

    console.log('[Free Article] Generating cover image...');

    let imageDataUrl: string | null = null;

    try {
      const imageContents: any[] = [];

      if (productImage) {
        const cleanProductBase64 = productImage.replace(/^data:image\/\w+;base64,/, '');
        imageContents.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanProductBase64
          }
        });
        console.log('[Free Article] Using product image as visual reference');
      }

      imageContents.push({ text: imagePrompt });

      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: imageContents,
        config: {
          responseModalities: ['Text', 'Image']
        }
      });

      for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log('[Free Article] Cover image generated successfully!');
          break;
        }
      }

      if (!imageDataUrl) {
        for (const part of (imageResponse as any).parts || []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[Free Article] Image found in parts structure');
            break;
          }
        }
      }
    } catch (imageError: any) {
      console.error('[Free Article] Image generation failed:', imageError.message);
    }

    // ==========================================
    // RISULTATO FINALE
    // ==========================================

    return NextResponse.json({
      success: true,
      data: {
        article: articleData,
        imageUrl: imageDataUrl || ''
      }
    });

  } catch (error: any) {
    console.error('[Free Article] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante generazione articolo'
      },
      { status: 500 }
    );
  }
}
