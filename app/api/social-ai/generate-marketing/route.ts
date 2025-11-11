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
  videoStyle?: 'classic' | 'explosive' | 'premium' | 'dynamic' | 'cinematic';
  videoDuration?: 6 | 8;
  companyLogo?: string;
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
      targetAudience = 'pubblico generale',
      videoStyle = 'classic',
      videoDuration = 8,
      companyLogo
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
          productImageBase64: cleanBase64,
          videoStyle,
          videoDuration,
          companyLogo: companyLogo ? companyLogo.replace(/^data:image\/\w+;base64,/, '') : undefined
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
    videoStyle?: 'classic' | 'explosive' | 'premium' | 'dynamic' | 'cinematic';
    videoDuration?: 6 | 8;
    companyLogo?: string;
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

  const videoStyle = params.videoStyle || 'classic';
  const videoDuration = params.videoDuration || 8;

  // ==========================================
  // 📝 PROMPT LIBRARY - 5 STILI VIDEO
  // ==========================================

  const videoStylePrompts = {
    // 🎬 CLASSICO: Rotazione smooth professionale
    classic: `Create a PREMIUM PROFESSIONAL product video for ${params.platform} advertising.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

⭐ CRITICAL - MATCH THE PRODUCT IMAGE EXACTLY:
- Use the provided image as EXACT visual reference
- Recreate IDENTICAL product (colors, textures, shape, packaging)
- Product MUST look exactly like the reference photo

🎬 CAMERA MOVEMENT:
- Smooth 360° rotation around the product at constant speed
- Professional turntable showcase style
- Camera orbits horizontally at product's eye level
- Complete or near-complete rotation during ${videoDuration} seconds

💎 LIGHTING & ENVIRONMENT:
- High-end studio lighting with soft key light and rim lights
- Elegant gradient background (dark to light) or solid premium color
- Product sits on premium surface (white marble, glossy black, brushed metal)
- Clean, minimal, professional aesthetic

✨ VISUAL QUALITY:
- Photorealistic commercial product photography
- Sharp focus throughout, subtle depth of field
- Natural color grading, accurate product colors
- Broadcast-quality smooth motion

DURATION: ${videoDuration} seconds
STYLE: Classic luxury product showcase`,

    // 💥 ESPLOSIVO: Esplosione + ricomposizione
    explosive: `Create an EXPLOSIVE, HIGH-ENERGY product reveal video for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

⭐ CRITICAL - MATCH THE PRODUCT IMAGE EXACTLY:
- Use the provided image as EXACT visual reference
- Product MUST look identical to the reference photo

💥 EXPLOSIVE EFFECT SEQUENCE:
1. START (0-${Math.floor(videoDuration * 0.3)}s): Product intact, centered, slightly rotating
2. EXPLOSION (${Math.floor(videoDuration * 0.3)}-${Math.floor(videoDuration * 0.5)}s):
   - Product EXPLODES into hundreds of particles/fragments
   - Dramatic burst with energy trails
   - Particles scatter in all directions with motion blur
3. RECOMPOSITION (${Math.floor(videoDuration * 0.5)}-${videoDuration}s):
   - Particles reverse and fly back together
   - Product reassembles piece by piece
   - Ends with perfect intact product, slightly rotating

🎨 VISUAL STYLE:
- High contrast, vibrant colors
- Particle effects with glow and trails
- Dynamic lighting changes during explosion/recomposition
- Dark or gradient background to emphasize particles
- Cinematic color grading

⚡ MOTION:
- Fast-paced, energetic
- Slow motion during peak explosion moment
- Speed ramps for dramatic effect

DURATION: ${videoDuration} seconds
STYLE: Epic explosive product reveal with particle effects`,

    // ✨ PREMIUM: Slow motion elegante luxury
    premium: `Create an ULTRA-LUXURY, ELEGANT slow-motion product video for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

⭐ CRITICAL - MATCH THE PRODUCT IMAGE EXACTLY:
- Use the provided image as EXACT visual reference
- Product MUST look identical to the reference photo

✨ PREMIUM CAMERA MOVEMENT:
- Extremely slow, graceful dolly movement around product
- Combination of slow horizontal orbit + gentle vertical rise
- Subtle parallax effect revealing product dimensions
- Smooth as silk, high-end commercial style

💎 LUXURY VISUAL ELEMENTS:
- Soft golden hour or studio lighting with warm tones
- Elegant bokeh in background with subtle sparkle/light particles
- Premium materials visible: reflections on glossy surfaces, texture details
- Luxury backdrop: silk fabric, velvet, gold accents, or sophisticated gradient
- Subtle lens flares and light rays

🎭 ATMOSPHERE:
- Sophisticated, aspirational, high-end fashion commercial feel
- Every frame looks like luxury magazine photography
- Emphasis on product's premium quality and craftsmanship
- Slow motion emphasizes elegance (time feels slower in luxury)

📸 TECHNICAL:
- Shallow depth of field, product in sharp focus
- Film-like color grading (slightly desaturated, warm)
- Perfect exposure and highlights

DURATION: ${videoDuration} seconds in elegant slow motion
STYLE: Ultra-premium luxury fashion commercial`,

    // ⚡ DINAMICO: Zoom + movimento veloce energetico
    dynamic: `Create a DYNAMIC, ENERGETIC, FAST-PACED product video for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

⭐ CRITICAL - MATCH THE PRODUCT IMAGE EXACTLY:
- Use the provided image as EXACT visual reference
- Product MUST look identical to the reference photo

⚡ DYNAMIC CAMERA SEQUENCE:
1. START (0-${Math.floor(videoDuration * 0.25)}s):
   - Quick zoom in from wide shot to medium
   - Product enters frame with energy
2. MID (${Math.floor(videoDuration * 0.25)}-${Math.floor(videoDuration * 0.6)}s):
   - Fast orbit around product (180-270°)
   - Camera moves with speed and purpose
   - Quick position changes, dynamic angles
3. END (${Math.floor(videoDuration * 0.6)}-${videoDuration}s):
   - Dramatic push in to hero shot
   - Slight slow-motion on final moment
   - Product fills frame, commanding presence

🎨 ENERGETIC VISUAL STYLE:
- Vibrant, punchy colors with high saturation
- Dynamic lighting that changes with camera movement
- Motion blur on fast movements (but product stays sharp)
- Bold, graphic background or energetic gradient
- High contrast, edgy modern aesthetic

⚡ MOTION CHARACTERISTICS:
- Fast-paced, exciting, attention-grabbing
- Quick cuts in motion (camera speed changes)
- Modern music video / sports commercial energy
- Youth-oriented, bold, confident

DURATION: ${videoDuration} seconds of non-stop action
STYLE: High-energy dynamic sports/tech commercial`,

    // 🎥 CINEMATICO: Dolly in + parallax Hollywood
    cinematic: `Create a CINEMATIC, HOLLYWOOD-STYLE product video for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `DESCRIPTION: ${params.productDescription}` : ''}

⭐ CRITICAL - MATCH THE PRODUCT IMAGE EXACTLY:
- Use the provided image as EXACT visual reference
- Product MUST look identical to the reference photo

🎥 CINEMATIC CAMERA MOVEMENT:
- Professional dolly-in shot with parallax effect
- Camera slowly pushes forward toward product
- Subtle vertical rise as camera approaches (hero angle)
- Background elements move at different speeds (parallax/depth)
- Smooth, controlled, blockbuster film style

🎬 HOLLYWOOD PRODUCTION VALUE:
- Dramatic cinematic lighting (rim lights, motivated lighting)
- Atmospheric haze/smoke for depth and drama
- Lens characteristics: anamorphic-style bokeh, subtle lens breathing
- Foreground and background elements for depth layers
- Epic scale feeling even for small products

🌟 ATMOSPHERE & MOOD:
- Dramatic, storytelling quality
- Product as the "hero" of an epic story
- Moody color grading (teal & orange, or desaturated with color pops)
- Atmospheric particles floating in light rays
- Sense of discovery and revelation

📽️ TECHNICAL CINEMATIC DETAILS:
- Shallow depth of field (f/2.8 equivalent)
- Motion blur for realism
- Film grain texture (subtle)
- Widescreen cinematic framing

DURATION: ${videoDuration} seconds of pure cinema
STYLE: Hollywood blockbuster product reveal`
  };

  const prompt = videoStylePrompts[videoStyle];

  // Aggiungi istruzioni per il logo se presente
  const finalPrompt = params.companyLogo
    ? `${prompt}

🏷️ COMPANY BRANDING:
- Subtly integrate the company logo in bottom corner (last ${Math.floor(videoDuration * 0.4)} seconds)
- Logo should be elegant overlay, not distracting
- Semi-transparent, professional placement
- Fades in smoothly`
    : prompt;

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
      source: {
        prompt: finalPrompt,
        image: {
          imageBytes: params.productImageBase64,
          mimeType: 'image/jpeg'
        }
      },
      config: {
        aspectRatio: veoAspectRatio,
        durationSeconds: videoDuration,
        resolution: '720p'
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
