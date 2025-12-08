import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minuto per ricerca + generazione

/**
 * POST /api/social-ai/food-curiosity
 *
 * RICERCA CURIOSITÀ E NEWS DAL MONDO FOOD MEDITERRANEO
 *
 * Cerca su internet (news, social, giornali, libri) curiosità interessanti
 * sul mondo del food mediterraneo e italiano.
 * Restituisce 4-5 argomenti tra cui l'utente può scegliere.
 *
 * Body:
 * - topic?: string - Argomento specifico (opzionale, es: "olio d'oliva", "vino italiano")
 * - category?: string - Categoria (es: "news", "tradizione", "innovazione", "sostenibilità")
 */

interface FoodCuriosityRequest {
  topic?: string;
  category?: string;
}

interface CuriosityItem {
  id: string;
  title: string;
  summary: string;
  fullContent: string;
  source?: string;
  tags: string[];
  imagePrompt: string;
  socialCaption: string;
  hashtags: string[];
}

interface CuriosityResult {
  success: boolean;
  data?: {
    curiosities: CuriosityItem[];
    searchQuery: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<CuriosityResult>> {
  try {
    const { topic, category } = await request.json() as FoodCuriosityRequest;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Costruisci query di ricerca
    let searchQuery = 'curiosità novità food mediterraneo italiano';
    if (topic) searchQuery = `${topic} curiosità novità food`;
    if (category) {
      const categoryMap: Record<string, string> = {
        'news': 'ultime notizie news',
        'tradizione': 'tradizione storia origini',
        'innovazione': 'innovazione tecnologia futuro',
        'sostenibilità': 'sostenibilità ambiente eco-friendly',
        'salute': 'salute benefici proprietà'
      };
      searchQuery += ` ${categoryMap[category] || category}`;
    }

    console.log(`[Food Curiosity] Searching for: ${searchQuery}`);

    // ==========================================
    // FASE 1: RICERCA WEB MULTICANALE
    // ==========================================

    let webContext = '';
    const sources: string[] = [];

    const searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (searchApiKey && searchEngineId) {
      try {
        // Ricerca principale
        const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
        searchUrl.searchParams.append('key', searchApiKey);
        searchUrl.searchParams.append('cx', searchEngineId);
        searchUrl.searchParams.append('q', searchQuery + ' 2024 2025');
        searchUrl.searchParams.append('num', '10');
        searchUrl.searchParams.append('lr', 'lang_it');
        searchUrl.searchParams.append('sort', 'date'); // Risultati recenti

        const searchResponse = await fetch(searchUrl.toString());
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          webContext = searchData.items
            .slice(0, 8)
            .map((item: any) => `FONTE: ${item.title}\n${item.snippet}\nURL: ${item.link}`)
            .join('\n\n---\n\n');

          searchData.items.slice(0, 8).forEach((item: any) => {
            sources.push(item.link);
          });

          console.log(`[Food Curiosity] Found ${searchData.items.length} sources`);
        }
      } catch (error) {
        console.warn('[Food Curiosity] Web search failed:', error);
      }
    }

    // ==========================================
    // FASE 2: GENERA CURIOSITÀ CON AI
    // ==========================================

    const curiosityPrompt = `Sei un esperto di food journalism e content creator specializzato in cibo mediterraneo e italiano.

ARGOMENTO RICHIESTO: ${topic || 'Food mediterraneo/italiano in generale'}
CATEGORIA: ${category || 'Tutte'}

${webContext ? `CONTESTO DA WEB (notizie e informazioni recenti):\n${webContext}\n` : ''}

COMPITO:
Genera 5 CURIOSITÀ/ARGOMENTI interessanti e VIRALI per post social sul food mediterraneo.
Devono essere:
- ATTUALI (notizie recenti, trend 2024-2025)
- INTERESSANTI (cose che la gente non sa)
- VERIFICABILI (basate su fatti reali)
- SOCIAL-FRIENDLY (adatte a Instagram, Facebook, LinkedIn)
- ITALIANE/MEDITERRANEE (focus su cibo italiano e mediterraneo)

TIPI DI CURIOSITÀ:
- Notizie recenti dal mondo food
- Scoperte scientifiche su alimenti
- Trend gastronomici emergenti
- Storie di produttori/artigiani
- Curiosità storiche poco conosciute
- Benefici salutari di alimenti
- Record e primati alimentari italiani
- Innovazioni nel settore food

Rispondi SOLO con JSON valido (no markdown, no \`\`\`):
{
  "curiosities": [
    {
      "id": "cur_1",
      "title": "Titolo accattivante per social (max 60 caratteri)",
      "summary": "Riassunto breve (max 150 caratteri)",
      "fullContent": "Contenuto completo della curiosità (3-4 frasi informative e interessanti)",
      "source": "Fonte se nota (es: 'Studio Università di Bologna 2024')",
      "tags": ["tag1", "tag2", "tag3"],
      "imagePrompt": "Descrizione in INGLESE per generare immagine evocativa",
      "socialCaption": "Caption pronta per social media in italiano (con emoji, max 200 caratteri)",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
    }
  ]
}

REGOLE:
- Genera ESATTAMENTE 5 curiosità diverse
- Ogni curiosità deve essere UNICA e NON ripetitiva
- Focus su NOVITÀ e cose INTERESSANTI
- Linguaggio coinvolgente ma professionale
- Hashtags rilevanti e popolari nel settore food`;

    console.log('[Food Curiosity] Generating curiosities with Gemini...');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: curiosityPrompt }]
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Risposta vuota da Gemini');
    }

    let responseText = rawText.trim();
    responseText = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    responseText = responseText.replace(/[\x00-\x1F\x7F]/g, ' ');
    responseText = responseText.replace(/,\s*([}\]])/g, '$1');

    let result: { curiosities: CuriosityItem[] };
    try {
      result = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('[Food Curiosity] JSON parse failed, attempting repair...');

      try {
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          let cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
          cleanJson = cleanJson.replace(/\/\/[^\n]*/g, '');
          result = JSON.parse(cleanJson);
        } else {
          throw new Error('Cannot find valid JSON structure');
        }
      } catch (repairError) {
        throw new Error(`JSON non valido: ${parseError.message}`);
      }
    }

    console.log(`[Food Curiosity] Generated ${result.curiosities.length} curiosities`);

    return NextResponse.json({
      success: true,
      data: {
        curiosities: result.curiosities,
        searchQuery
      }
    });

  } catch (error: any) {
    console.error('[Food Curiosity] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante ricerca curiosità'
      },
      { status: 500 }
    );
  }
}
