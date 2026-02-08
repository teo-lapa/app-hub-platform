import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/social-ai/refine-video
 *
 * Video refinement with natural language prompts.
 * Takes the original video parameters + user's refinement prompt,
 * uses Gemini to create an enhanced video prompt,
 * then regenerates with Veo 3.1.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalPrompt,
      refinementPrompt,
      productImage,
      videoStyle = 'cinematic',
      videoDuration = 6,
      aspectRatio = '16:9',
    } = body;

    if (!refinementPrompt) {
      return NextResponse.json({ error: 'Prompt di modifica richiesto' }, { status: 400 });
    }

    if (!productImage) {
      return NextResponse.json({ error: 'Immagine prodotto richiesta' }, { status: 400 });
    }

    const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key non configurata' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // STEP 1: Use Gemini to merge original + refinement into enhanced prompt
    const mergePrompt = `Sei un esperto di video marketing e motion design.

PROMPT VIDEO ORIGINALE:
${originalPrompt || `Video marketing prodotto con stile ${videoStyle}, durata ${videoDuration}s`}

MODIFICA RICHIESTA DALL'UTENTE:
"${refinementPrompt}"

MAPPATURA MODIFICHE COMUNI:
- "piu lento" / "slow" → riduci velocita', movimenti fluidi e lenti
- "piu veloce" / "fast" → accelera, tagli rapidi, energia
- "piu zoom" → aggiungi slow zoom progressivo verso il prodotto
- "piu drammatico" / "dramatic" → illuminazione Rembrandt, ombre profonde, musica epica
- "cambia luce" / "lighting" → modifica schema illuminazione (golden hour, studio, naturale)
- "piu dinamico" → movimenti camera rapidi, transizioni energiche
- "piu elegante" / "luxury" → movimenti minimali, sfondo scuro, riflessi dorati
- "ruota" / "rotate" → rotazione 360 gradi del prodotto
- "esplosione" → effetto disassemblaggio e riassemblaggio
- "aereo" / "orbital" → camera che orbita attorno al prodotto

Crea un NUOVO prompt per Veo 3.1 che incorpora la modifica richiesta.
Il prompt deve essere in INGLESE e descrivere esattamente:
- Movimenti camera specifici
- Illuminazione
- Velocita'/ritmo
- Durata: ${videoDuration} secondi
- Aspect ratio: ${aspectRatio}

Rispondi SOLO con il nuovo prompt video, senza altro testo.`;

    const mergeResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: mergePrompt }],
    });

    const enhancedPrompt = mergeResponse.text?.trim() || originalPrompt;

    console.log('[VideoRefine] Enhanced prompt:', enhancedPrompt);

    // STEP 2: Generate new video with Veo 3.1
    // Clean the product image base64
    let productImageBase64 = productImage;
    if (productImageBase64.includes(',')) {
      productImageBase64 = productImageBase64.split(',')[1];
    }

    const veoAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    const validDuration = [4, 6, 8].includes(videoDuration) ? videoDuration : 6;

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: enhancedPrompt,
      image: {
        imageBytes: productImageBase64,
        mimeType: 'image/jpeg',
      },
      config: {
        aspectRatio: veoAspectRatio,
        durationSeconds: validDuration,
        numberOfVideos: 1,
      },
    });

    if (!operation || !operation.name) {
      return NextResponse.json(
        { error: 'Veo 3.1 non ha restituito un operation ID' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        operationId: operation.name,
        status: 'generating',
        enhancedPrompt,
        originalRefinement: refinementPrompt,
        estimatedTime: 120,
      }
    });

  } catch (error: any) {
    console.error('[VideoRefine] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore durante raffinamento video' },
      { status: 500 }
    );
  }
}
