import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/social-ai/translate-content
 *
 * TRADUZIONE CONTENUTI PER SOCIAL MEDIA
 * Traduce testo in una delle lingue supportate mantenendo
 * lo stile social media e gli hashtag appropriati.
 *
 * Body:
 * - content: { title, fullContent, socialCaption, hashtags }
 * - targetLanguage: 'it' | 'de' | 'fr' | 'en'
 */

interface TranslateRequest {
  content: {
    title: string;
    fullContent: string;
    socialCaption: string;
    hashtags: string[];
  };
  targetLanguage: 'it' | 'de' | 'fr' | 'en';
}

interface TranslateResult {
  success: boolean;
  data?: {
    title: string;
    fullContent: string;
    socialCaption: string;
    hashtags: string[];
  };
  error?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  'it': 'Italiano',
  'de': 'Tedesco (Svizzero)',
  'fr': 'Francese (Svizzero)',
  'en': 'Inglese'
};

export async function POST(request: NextRequest): Promise<NextResponse<TranslateResult>> {
  try {
    const { content, targetLanguage } = await request.json() as TranslateRequest;

    if (!content || !targetLanguage) {
      return NextResponse.json(
        { success: false, error: 'Contenuto e lingua richiesti' },
        { status: 400 }
      );
    }

    // Se la lingua è italiano, restituisci il contenuto originale
    if (targetLanguage === 'it') {
      return NextResponse.json({
        success: true,
        data: content
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    console.log(`[Translate Content] Translating to ${LANGUAGE_NAMES[targetLanguage]}...`);

    const translatePrompt = `Sei un traduttore esperto specializzato in contenuti social media e food marketing.

CONTENUTO ORIGINALE (Italiano):
- Titolo: ${content.title}
- Contenuto completo: ${content.fullContent}
- Caption Social: ${content.socialCaption}
- Hashtags: ${content.hashtags.join(' ')}

COMPITO:
Traduci TUTTO in ${LANGUAGE_NAMES[targetLanguage]}.

REQUISITI:
- Mantieni lo STESSO tono engaging e social-friendly
- Mantieni le emoji dove presenti
- Traduci gli hashtags in modo appropriato per la lingua target
- Per il tedesco svizzero: usa "ss" invece di "ß" dove appropriato
- Per il francese svizzero: usa termini comuni in Svizzera Romanda
- Mantieni riferimenti a LAPA e www.lapa.ch

Rispondi SOLO con JSON valido (no markdown, no \`\`\`):
{
  "title": "Titolo tradotto",
  "fullContent": "Contenuto completo tradotto",
  "socialCaption": "Caption social tradotta con emoji",
  "hashtags": ["#hashtag1", "#hashtag2", "..."]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: translatePrompt }]
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Risposta vuota da Gemini');
    }

    let responseText = rawText.trim();
    responseText = responseText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    responseText = responseText.replace(/[\x00-\x1F\x7F]/g, ' ');
    responseText = responseText.replace(/,\s*([}\]])/g, '$1');

    let translatedContent;
    try {
      translatedContent = JSON.parse(responseText);
    } catch (parseError: any) {
      // Tentativo di riparazione
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const cleanJson = responseText.substring(jsonStart, jsonEnd + 1);
        translatedContent = JSON.parse(cleanJson);
      } else {
        throw new Error('JSON non valido nella risposta');
      }
    }

    console.log(`[Translate Content] Translation completed: ${translatedContent.title}`);

    return NextResponse.json({
      success: true,
      data: translatedContent
    });

  } catch (error: any) {
    console.error('[Translate Content] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante traduzione'
      },
      { status: 500 }
    );
  }
}
