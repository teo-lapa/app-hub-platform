import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/social-ai/generate-curiosity-image
 *
 * GENERA ANTEPRIMA IMMAGINE PER CURIOSITÀ FOOD
 * Genera un'immagine AI basata sulla curiosità selezionata
 * per permettere all'utente di vederla prima di pubblicare.
 *
 * Body:
 * - imagePrompt: string - Il prompt per generare l'immagine
 * - title: string - Titolo della curiosità (per contesto)
 */

interface GenerateImageRequest {
  imagePrompt: string;
  title: string;
}

interface GenerateImageResult {
  success: boolean;
  data?: {
    imageUrl: string;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateImageResult>> {
  try {
    const { imagePrompt, title } = await request.json() as GenerateImageRequest;

    if (!imagePrompt) {
      return NextResponse.json(
        { success: false, error: 'imagePrompt richiesto' },
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

    console.log(`[Generate Curiosity Image] Generating image for: ${title}`);

    // Costruisci prompt completo per immagine evocativa
    const fullPrompt = `${imagePrompt}

STYLE: Modern food photography, vibrant colors, Instagram-worthy, professional quality.
COMPOSITION: Clean background, good lighting, appetizing presentation.
MOOD: Engaging, informative, social media friendly.
FORMAT: Square format (1:1), high resolution, suitable for Instagram/Facebook.`;

    let imageDataUrl: string | null = null;

    try {
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [{ text: fullPrompt }],
        config: {
          responseModalities: ['Text', 'Image']
        }
      });

      // Estrai immagine dalla risposta
      for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log('[Generate Curiosity Image] Image generated successfully!');
          break;
        }
      }

      // Fallback: prova struttura alternativa
      if (!imageDataUrl) {
        for (const part of (imageResponse as any).parts || []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }

    } catch (imageError: any) {
      console.error('[Generate Curiosity Image] Image generation failed:', imageError.message);
      throw new Error('Generazione immagine fallita: ' + imageError.message);
    }

    if (!imageDataUrl) {
      throw new Error('Nessuna immagine generata dalla risposta AI');
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl: imageDataUrl
      }
    });

  } catch (error: any) {
    console.error('[Generate Curiosity Image] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante generazione immagine'
      },
      { status: 500 }
    );
  }
}
