import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// API: Rigenera Immagine Articolo
// ==========================================

export async function POST(request: Request) {
  try {
    const { articleTitle, articleSubtitle, imagePrompt, productImage } = await request.json();

    console.log('[Regenerate Image] Starting image regeneration...');

    // Validazione
    if (!articleTitle || !imagePrompt) {
      return NextResponse.json(
        { error: 'Titolo articolo e prompt immagine richiesti' },
        { status: 400 }
      );
    }

    // Inizializza Gemini
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!
    });

    // ==========================================
    // GENERA IMMAGINE DI COPERTINA
    // ==========================================

    const fullImagePrompt = `${imagePrompt}

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

ARTICLE TITLE: "${articleTitle}"
ARTICLE SUBTITLE: "${articleSubtitle || ''}"

CONTEXT: Premium Italian food brand (LAPA), professional audience, Swiss market.
DO NOT include any text, watermarks, or logos in the image.`;

    console.log('[Regenerate Image] Generating new cover image with Gemini...');

    let imageDataUrl: string | null = null;

    try {
      const imageContents: any[] = [];

      // Se c'è un'immagine prodotto, usala come riferimento
      if (productImage) {
        const cleanProductBase64 = productImage.replace(/^data:image\/\w+;base64,/, '');
        imageContents.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanProductBase64
          }
        });
        console.log('[Regenerate Image] Using product image as visual reference');
      }

      imageContents.push({ text: fullImagePrompt });

      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: imageContents,
        config: {
          responseModalities: ['Text', 'Image']
        }
      });

      // Cerca l'immagine nella risposta
      for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          console.log('[Regenerate Image] New cover image generated successfully!');
          break;
        }
      }

      // Fallback: cerca in parts
      if (!imageDataUrl) {
        for (const part of (imageResponse as any).parts || []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[Regenerate Image] Image found in parts structure');
            break;
          }
        }
      }
    } catch (imageError: any) {
      console.error('[Regenerate Image] Image generation failed:', imageError.message);
      return NextResponse.json(
        { error: `Errore generazione immagine: ${imageError.message}` },
        { status: 500 }
      );
    }

    if (!imageDataUrl) {
      return NextResponse.json(
        { error: 'Impossibile generare immagine. Riprova.' },
        { status: 500 }
      );
    }

    console.log('[Regenerate Image] Success!');

    return NextResponse.json({
      success: true,
      imageUrl: imageDataUrl
    });

  } catch (error: any) {
    console.error('[Regenerate Image] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante la rigenerazione immagine' },
      { status: 500 }
    );
  }
}
