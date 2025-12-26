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

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Generate at maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must look like a real photograph, not AI-generated or CGI
- SHARP DETAILS: Crisp focus on main subject, no blur or artifacts
- PROFESSIONAL LIGHTING: Studio-quality lighting with soft shadows

STYLE:
- Modern food photography for Instagram/social media
- Vibrant, saturated colors that pop on mobile screens
- Clean, minimalist aesthetic with professional quality
- Trendy food styling (2024 social media trends)
- Eye-catching composition that stops the scroll

COMPOSITION:
- Clean, solid color or gradient background (white, marble, or pastel)
- Dramatic lighting creating depth and dimension
- Hero angle: 45-degree or flat lay depending on subject
- Appetizing presentation with garnishes and props
- Negative space for potential text overlay
- Rule of thirds positioning

TECHNICAL SPECIFICATIONS:
- Instagram-optimized square format (1:1 aspect ratio)
- High contrast, vivid colors (slightly boosted saturation)
- Sharp focus with subtle depth of field
- Professional color grading (bright, airy feel)
- NO artificial or CGI appearance
- Clean, commercial look suitable for brand marketing

MOOD: Engaging, shareable, scroll-stopping, informative yet appetizing.
DO NOT include any text, watermarks, logos, or hands in the image.`;

    let imageDataUrl: string | null = null;

    try {
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
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
