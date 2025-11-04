import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per generazione completa (video può richiedere tempo)

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
      console.error('❌ [SOCIAL-AI] API key non configurata');
      return NextResponse.json(
        { error: 'API key Gemini non configurata sul server' },
        { status: 500 }
      );
    }

    console.log('🚀 [SOCIAL-AI] Avvio generazione marketing:', {
      platform: socialPlatform,
      contentType,
      tone,
      hasProductName: !!productName
    });

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

    console.log(`⚡ [SOCIAL-AI] Esecuzione ${agents.length} agenti in parallelo...`);

    // Esegui tutti gli agenti in PARALLELO
    const results = await Promise.all(agents);
    const copywritingResult = results[0] as { caption: string; hashtags: string[]; cta: string };
    const imageResult = results[1] as { data: string; mimeType: string; dataUrl: string } | null;
    const videoResult = results[2] as { operationId: string; status: string; estimatedTime: number } | null;

    console.log('✅ [SOCIAL-AI] Tutti gli agenti completati!');

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
    console.error('❌ [SOCIAL-AI] Errore:', error);

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

  console.log('✍️ [AGENT-COPYWRITING] Generazione copy...');

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

    console.log('✅ [AGENT-COPYWRITING] Completato');

    return {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || [],
      cta: parsed.cta || ''
    };

  } catch (error: any) {
    console.error('❌ [AGENT-COPYWRITING] Errore:', error.message);
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

  console.log('🎨 [AGENT-IMAGE] Generazione immagine con Nano Banana 🍌...');

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
          console.log('✅ [AGENT-IMAGE] Immagine generata con Nano Banana 🍌');

          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png',
            dataUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`
          };
        }
      }
    }

    console.warn('⚠️ [AGENT-IMAGE] Nessuna immagine generata');
    return null;

  } catch (error: any) {
    console.error('❌ [AGENT-IMAGE] Errore:', error.message);
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

  console.log('🎬 [AGENT-VIDEO] Generazione video con Veo 3.1...');

  const prompt = `Crea un video marketing dinamico e professionale per ${params.platform}.

Prodotto: ${params.productName}
${params.productDescription ? `Descrizione: ${params.productDescription}` : ''}

STILE VIDEO:
- Movimento fluido e cinematografico
- Transizioni eleganti
- Focus sul prodotto
- Illuminazione professionale da studio
- Atmosfera premium e accattivante
- Adatto per pubblicità su ${params.platform}

AZIONE:
- Il prodotto viene mostrato da diverse angolazioni
- Camera lenta per enfatizzare dettagli
- Movimento rotatorio smooth intorno al prodotto
- Zoom in progressivo sui dettagli chiave

DURATA: 6 secondi
AUDIO: Musica di sottofondo elegante e professionale`;

  try {
    // Converti l'aspect ratio per Veo (solo 16:9 o 9:16)
    const veoAspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    console.log('🎬 [AGENT-VIDEO] Configurazione:', {
      model: 'veo-3.1-generate-preview',
      aspectRatio: veoAspectRatio,
      durationSeconds: 6
    });

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview', // Latest Veo model
      prompt: prompt,
      config: {
        aspectRatio: veoAspectRatio,
        durationSeconds: 6,
        resolution: '720p'
      }
    });

    if (!operation || !operation.name) {
      console.warn('⚠️ [AGENT-VIDEO] Operazione video non ha restituito un ID');
      return null;
    }

    console.log('⏳ [AGENT-VIDEO] Video in generazione (operationId:', operation.name, ')');

    return {
      operationId: operation.name || '',
      status: 'generating',
      estimatedTime: 120 // ~2 minuti stima
    };

  } catch (error: any) {
    console.error('❌ [AGENT-VIDEO] Errore durante la richiesta video:', error.message);
    console.error('❌ [AGENT-VIDEO] Stack:', error.stack);

    // L'API Veo potrebbe non essere disponibile o configurata
    // Restituisci null invece di lanciare l'errore per permettere agli altri agenti di completare
    console.warn('⚠️ [AGENT-VIDEO] Video generation fallita, continuo con solo immagine e copy');
    return null;
  }
}
