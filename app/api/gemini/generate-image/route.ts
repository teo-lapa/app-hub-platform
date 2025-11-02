import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 secondi per generazione immagine

/**
 * POST /api/gemini/generate-image
 *
 * Genera un'immagine usando Google Gemini (Nano Banana)
 *
 * Body:
 * - prompt: string - Descrizione testuale dell'immagine da generare
 * - aspectRatio?: string - Rapporto aspetto (default: "1:1")
 * - baseImage?: string - Base64 di un'immagine esistente da modificare (opzionale)
 */
export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '1:1', baseImage } = await request.json();

    // Validazione input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Il campo "prompt" è obbligatorio' },
        { status: 400 }
      );
    }

    // Verifica API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ [GEMINI-IMAGE] API key non configurata');
      return NextResponse.json(
        { error: 'API key Gemini non configurata sul server' },
        { status: 500 }
      );
    }

    console.log('🎨 [GEMINI-IMAGE] Generazione immagine:', {
      promptLength: prompt.length,
      aspectRatio,
      hasBaseImage: !!baseImage
    });

    // Inizializza client Gemini
    const ai = new GoogleGenAI({ apiKey });

    // Prepara il contenuto per Gemini
    const contents: any[] = [];

    // Se c'è un'immagine base, aggiungila
    if (baseImage) {
      // Rimuovi prefisso data:image se presente
      const base64Data = baseImage.replace(/^data:image\/\w+;base64,/, '');

      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      });
    } else {
      // Solo testo
      contents.push({
        role: 'user',
        parts: [{ text: prompt }]
      });
    }

    // Genera immagine con Gemini 2.5 Flash Image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
      config: {
        responseModalities: ['Image'],
        imageConfig: {
          aspectRatio: aspectRatio as any
        }
      }
    });

    // Estrai l'immagine generata
    let generatedImage: { data: string; mimeType: string } | null = null;

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          generatedImage = {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          };
          break;
        }
      }
      if (generatedImage) break;
    }

    if (!generatedImage) {
      console.error('❌ [GEMINI-IMAGE] Nessuna immagine generata nella risposta');
      return NextResponse.json(
        { error: 'Gemini non ha generato un\'immagine. Riprova con un prompt diverso.' },
        { status: 500 }
      );
    }

    console.log('✅ [GEMINI-IMAGE] Immagine generata con successo');

    // Restituisci immagine in base64
    return NextResponse.json({
      success: true,
      image: {
        data: generatedImage.data, // Base64
        mimeType: generatedImage.mimeType,
        dataUrl: `data:${generatedImage.mimeType};base64,${generatedImage.data}`
      },
      prompt,
      aspectRatio
    });

  } catch (error: any) {
    console.error('❌ [GEMINI-IMAGE] Errore:', error);

    // Gestisci errori specifici di Gemini
    let errorMessage = 'Errore durante la generazione dell\'immagine';

    if (error.message?.includes('API key')) {
      errorMessage = 'Chiave API Gemini non valida';
    } else if (error.message?.includes('quota')) {
      errorMessage = 'Quota API Gemini esaurita';
    } else if (error.message?.includes('safety')) {
      errorMessage = 'Il prompt è stato bloccato dai filtri di sicurezza';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message
      },
      { status: 500 }
    );
  }
}
