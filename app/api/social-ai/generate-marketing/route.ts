import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per generazione completa (video può richiedere tempo)

const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/social-ai/generate-marketing
 *
 * SOCIAL MARKETING AI - Multi-Agent System
 *
 * Genera contenuti marketing completi per social media usando 3 AGENTI IN PARALLELO:
 * 1. Copywriting Agent (Gemini 2.5 Flash) → Caption + Hashtags + CTA
 * 2. Image Agent (Gemini 2.5 Flash Image - Nano Banana 🍌) → Immagine ottimizzata
 * 3. Video Agent (Veo 3.1) → Video marketing (opzionale)
 *
 * Body:
 * - productImage: string (base64) - Foto del prodotto
 * - productName?: string - Nome del prodotto
 * - productDescription?: string - Descrizione
 * - socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
 * - contentType: 'image' | 'video' | 'both'
 * - tone?: 'professional' | 'casual' | 'fun' | 'luxury'
 * - targetAudience?: string - Descrizione target
 */

interface GenerateMarketingRequest {
  productImage: string;
  productName?: string;
  productDescription?: string;
  socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  contentType: 'image' | 'video' | 'both';
  tone?: 'professional' | 'casual' | 'fun' | 'luxury';
  targetAudience?: string;
}

interface MarketingResult {
  copywriting: {
    caption: string;
    hashtags: string[];
    cta: string;
  };
  image?: {
    data: string; // base64
    mimeType: string;
    dataUrl: string;
  };
  video?: {
    operationId: string; // ID per polling del video
    status: 'generating' | 'completed' | 'failed';
    estimatedTime: number; // secondi
  };
  metadata: {
    platform: string;
    aspectRatio: string;
    generatedAt: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateMarketingRequest = await request.json();

    const {
      productImage,
      productName = 'questo prodotto',
      productDescription = '',
      socialPlatform,
      contentType,
      tone = 'professional',
      targetAudience = 'pubblico generale'
    } = body;

    // Validazione
    if (!productImage) {
      return NextResponse.json(
        { error: 'productImage è obbligatorio' },
        { status: 400 }
      );
    }

    if (!['instagram', 'facebook', 'tiktok', 'linkedin'].includes(socialPlatform)) {
      return NextResponse.json(
        { error: 'socialPlatform non valido' },
        { status: 400 }
      );
    }

    // Verifica API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[SOCIAL-AI] API key non configurata');
      return NextResponse.json(
        { error: 'API key Gemini non configurata sul server' },
        { status: 500 }
      );
    }

    // Inizializza client Gemini
    const ai = new GoogleGenAI({ apiKey });

    // Determina aspect ratio in base alla piattaforma
    const aspectRatioMap: Record<string, string> = {
      instagram: '1:1', // Feed post
      facebook: '4:3',
      tiktok: '9:16',   // Vertical video
      linkedin: '16:9'  // Professional widescreen
    };
    const aspectRatio = aspectRatioMap[socialPlatform];

    // Pulisci base64 (rimuovi prefisso se presente)
    const cleanBase64 = productImage.replace(/^data:image\/\w+;base64,/, '');

    // ==========================================
    // 🤖 ESECUZIONE PARALLELA DEI 3 AGENTI
    // ==========================================

    const agents = [];

    // AGENT 1: Copywriting (sempre attivo)
    agents.push(
      generateCopywriting(ai, {
        productName,
        productDescription,
        platform: socialPlatform,
        tone,
        targetAudience,
        productImageBase64: cleanBase64
      })
    );

    // AGENT 2: Image Generation (se richiesto)
    if (contentType === 'image' || contentType === 'both') {
      agents.push(
        generateMarketingImage(ai, {
          productName,
          productDescription,
          platform: socialPlatform,
          aspectRatio,
          productImageBase64: cleanBase64
        })
      );
    } else {
      agents.push(Promise.resolve(null)); // Placeholder
    }

    // AGENT 3: Video Generation (se richiesto)
    if (contentType === 'video' || contentType === 'both') {
      agents.push(
        generateMarketingVideo(ai, {
          productName,
          productDescription,
          platform: socialPlatform,
          aspectRatio,
          productImageBase64: cleanBase64
        })
      );
    } else {
      agents.push(Promise.resolve(null)); // Placeholder
    }

    // Esegui tutti gli agenti in PARALLELO
    const results = await Promise.all(agents);
    const copywritingResult = results[0] as { caption: string; hashtags: string[]; cta: string };
    const imageResult = results[1] as { data: string; mimeType: string; dataUrl: string } | null;
    const videoResult = results[2] as { operationId: string; status: string; estimatedTime: number } | null;

    // Costruisci risposta
    const result: MarketingResult = {
      copywriting: copywritingResult,
      metadata: {
        platform: socialPlatform,
        aspectRatio,
        generatedAt: new Date().toISOString()
      }
    };

    if (imageResult) {
      result.image = imageResult;
    }

    if (videoResult) {
      result.video = videoResult as { operationId: string; status: 'generating' | 'completed' | 'failed'; estimatedTime: number };
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('[SOCIAL-AI] Errore:', error);

    return NextResponse.json(
      {
        error: 'Errore durante la generazione dei contenuti marketing',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ==========================================
// 🤖 AGENT 1: COPYWRITING
// ==========================================
async function generateCopywriting(
  ai: GoogleGenAI,
  params: {
    productName: string;
    productDescription: string;
    platform: string;
    tone: string;
    targetAudience: string;
    productImageBase64: string;
  }
): Promise<{ caption: string; hashtags: string[]; cta: string }> {

  const prompt = `Sei un esperto copywriter specializzato in social media marketing.

CONTESTO:
- Prodotto: ${params.productName}
- Descrizione: ${params.productDescription || 'Vedi immagine'}
- Piattaforma: ${params.platform}
- Tone of voice: ${params.tone}
- Target audience: ${params.targetAudience}

TASK:
Analizza l'immagine del prodotto e crea un post marketing completo per ${params.platform}.

STRUTTURA RISPOSTA (formato JSON):
{
  "caption": "Caption accattivante (max 150 caratteri per ${params.platform})",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "cta": "Call-to-Action efficace"
}

REGOLE:
- Caption: emozionale, breve, engaging
- Hashtags: 5-8 hashtags rilevanti e popolari per ${params.platform}
- CTA: chiaro e orientato all'azione
- Tone: ${params.tone}
- NON usare emoji se il tone è "professional"
- USA emoji se il tone è "fun" o "casual"

Rispondi SOLO con il JSON, senza markdown o spiegazioni.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: params.productImageBase64
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Pulisci il JSON (rimuovi markdown se presente)
    const cleanJson = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || [],
      cta: parsed.cta || ''
    };

  } catch (error: any) {
    console.error('[AGENT-COPYWRITING] Errore:', error.message);
    // Fallback
    return {
      caption: `Scopri ${params.productName}!`,
      hashtags: ['#marketing', '#product', '#social'],
      cta: 'Scopri di più!'
    };
  }
}

// ==========================================
// 🤖 AGENT 2: IMAGE GENERATION (Nano Banana 🍌)
// ==========================================
async function generateMarketingImage(
  ai: GoogleGenAI,
  params: {
    productName: string;
    productDescription: string;
    platform: string;
    aspectRatio: string;
    productImageBase64: string;
  }
): Promise<{ data: string; mimeType: string; dataUrl: string } | null> {

  const prompt = `Crea un'immagine marketing professionale e accattivante per ${params.platform}.

Prodotto: ${params.productName}
${params.productDescription ? `Descrizione: ${params.productDescription}` : ''}

STILE:
- Fotografia professionale da studio
- Illuminazione perfetta
- Sfondo elegante e pulito
- Composizione bilanciata
- Adatto per post social su ${params.platform}
- Alta qualità, fotorealistica

COMPOSIZIONE:
- Il prodotto deve essere il focus principale
- Usa l'immagine fornita come riferimento per il prodotto
- Aggiungi elementi visivi che valorizzino il prodotto
- Palette colori armoniosa e professionale

NON includere testo o loghi nell'immagine.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // 🍌 Nano Banana!
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: params.productImageBase64
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseModalities: ['Image'], // Solo immagine
        imageConfig: {
          aspectRatio: params.aspectRatio
        }
      }
    });

    // Estrai immagine generata
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            dataUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
          };
        }
      }
    }

    return null;

  } catch (error: any) {
    console.error('[AGENT-IMAGE] Errore:', error.message);
    return null;
  }
}

// ==========================================
// 🤖 AGENT 3: VIDEO GENERATION (Veo 3.1)
// ==========================================
async function generateMarketingVideo(
  ai: GoogleGenAI,
  params: {
    productName: string;
    productDescription: string;
    platform: string;
    aspectRatio: string;
    productImageBase64: string;
  }
): Promise<{ operationId: string; status: string; estimatedTime: number } | null> {

  // Usa API key separata per Veo se disponibile
  const veoApiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!veoApiKey) {
    console.error('[AGENT-VIDEO] Nessuna API key disponibile per Veo');
    return null;
  }

  // Crea client dedicato per Veo con la sua API key
  const veoAI = new GoogleGenAI({ apiKey: veoApiKey });

  // Prompt potenziato per video fotorealistici basati sull'immagine del prodotto
  const prompt = `Create a premium, hyper-realistic product video for ${params.platform} social media advertising.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

CRITICAL INSTRUCTIONS - FOLLOW EXACTLY THE PRODUCT IMAGE:
- Use the provided product image as the EXACT visual reference
- Recreate the EXACT product shown in the image (same colors, textures, shape, packaging)
- Maintain the EXACT appearance from the photo - this is crucial
- The product MUST look identical to the reference image

CAMERA MOVEMENT (choose ONE that best showcases the product):
1. Smooth 360° rotation around the product (professional product showcase)
2. Slow zoom in from medium shot to close-up (reveal details)
3. Dolly in with slight parallax (cinematic approach)
4. Elegant vertical pan from bottom to top (hero product reveal)

LIGHTING & ATMOSPHERE:
- Professional studio lighting setup
- Soft shadows and highlights that enhance product features
- Clean, premium aesthetic
- High-end commercial photography style

ENVIRONMENT:
- Elegant, minimal background that doesn't distract from product
- Subtle depth of field (product in focus, background slightly blurred)
- Premium surface (marble, wood, or neutral backdrop as appropriate)

VISUAL QUALITY:
- Photorealistic 3D rendering quality
- Sharp focus on product
- Natural color grading
- Commercial advertising standard

MOTION:
- Smooth, fluid camera movement
- No jerky or sudden movements
- Professional gimbal-style stabilization
- Slow-motion emphasis on key product features

DURATION: 6 seconds of premium content
STYLE: Luxury commercial product photography in motion`;

  try {
    // Converti l'aspect ratio per Veo (solo 16:9 o 9:16)
    const veoAspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    if (isDev) {
      console.log('[AGENT-VIDEO] Starting image-to-video generation:', {
        product: params.productName,
        platform: params.platform,
        aspectRatio: veoAspectRatio,
        imageSize: params.productImageBase64.length
      });
    }

    // Usa IMAGE-TO-VIDEO con l'immagine del prodotto come riferimento
    const operation = await veoAI.models.generateVideos({
      model: 'veo-3.1-generate-preview', // Latest Veo model
      prompt: prompt,
      image: {
        inlineData: {
          mimeType: 'image/jpeg',
          data: params.productImageBase64
        }
      },
      config: {
        aspectRatio: veoAspectRatio,
        durationSeconds: 6,
        resolution: '720p',
        // Parametri per migliorare la qualità e fedeltà all'immagine
        imageToVideoConfig: {
          preserveImageFidelity: true // Mantieni fedeltà all'immagine di input
        }
      }
    });

    if (!operation || !operation.name) {
      return null;
    }

    return {
      operationId: operation.name || '',
      status: 'generating',
      estimatedTime: 120 // ~2 minuti stima
    };

  } catch (error: any) {
    console.error('[AGENT-VIDEO] Errore durante la richiesta video:', error.message);
    if (isDev) {
      console.error('[AGENT-VIDEO] Stack:', error.stack);
    }

    // L'API Veo potrebbe non essere disponibile o configurata
    // Restituisci null invece di lanciare l'errore per permettere agli altri agenti di completare
    return null;
  }
}
