import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { sql } from '@vercel/postgres';
import { findSimilarHighPerformingPosts, extractRAGInsights } from '@/lib/social-ai/embedding-service';
import { analyzeSentiment, type SentimentAnalysis } from '@/lib/social-ai/sentiment-analyzer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per generazione completa (video può richiedere tempo)

const isDev = process.env.NODE_ENV === 'development';

// ==========================================
// 🧹 HELPER: Pulisce nome prodotto
// ==========================================
function cleanProductName(name: string): string {
  if (!name) return name;

  // Rimuovi ultima parte se contiene unità di misura o packaging
  // Es: "FIORDILATTE JULIENNE TAGLIO NAPOLI VASC DA 2.5 KG" → "FIORDILATTE JULIENNE TAGLIO NAPOLI"
  const measurementPatterns = /\s+(VASC|BUSTA|SACCO|CONFEZIONE|CONF|PKG|KG|GR|ML|LT|PZ|PEZZI|DA)\s+.*$/i;
  let cleaned = name.replace(measurementPatterns, '');

  // Rimuovi anche pattern tipo "2.5 KG", "250 GR", etc.
  cleaned = cleaned.replace(/\s+\d+[\.,]?\d*\s*(KG|GR|G|ML|L|LT|LITRI|GRAMMI)$/i, '');

  return cleaned.trim();
}

// ==========================================
// 🧹 HELPER: Pulisce descrizione prodotto
// ==========================================
function cleanProductDescription(description: string, productName: string): string {
  if (!description) return description;

  let cleaned = description;

  // Se la descrizione inizia con il nome del prodotto, rimuovilo
  if (productName && cleaned.toLowerCase().startsWith(productName.toLowerCase())) {
    cleaned = cleaned.substring(productName.length).trim();
    // Rimuovi eventuali caratteri separatori iniziali
    cleaned = cleaned.replace(/^[\-\–\—\:\s]+/, '');
  }

  // Limita a max 200 caratteri per marketing
  if (cleaned.length > 200) {
    cleaned = cleaned.substring(0, 197) + '...';
  }

  return cleaned.trim();
}

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
  videoStyle?: 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic' | 'explosion' | 'orbital' | 'reassembly';
  videoDuration?: 6 | 12 | 30;  // Durata video in secondi (default: 6)

  // Branding
  includeLogo?: boolean;     // Se true, include logo e motto nell'immagine/video
  logoImage?: string;        // Logo aziendale (base64) - opzionale
  companyMotto?: string;      // Slogan/Motto aziendale - opzionale

  // Geo-Targeting & RAG
  productCategory?: string;  // Categoria prodotto per RAG matching (es: 'Food', 'Gastro', 'Beverage')
  targetCanton?: string;     // Canton Svizzero per hashtags localizzati (es: 'Zürich', 'Bern', 'Ticino')
  targetCity?: string;       // Città target (es: 'Zürich', 'Lugano')
  targetLanguage?: string;   // Lingua target (es: 'de', 'it', 'fr', 'en')
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
  sentiment?: SentimentAnalysis; // Sentiment & engagement prediction
  metadata: {
    platform: string;
    aspectRatio: string;
    generatedAt: string;
    postId?: string; // UUID del post salvato nel database
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
      videoStyle = 'default',
      videoDuration = 6,    // Default: 6 secondi
      includeLogo = false,
      logoImage,        // Logo aziendale (base64) - opzionale
      companyMotto,     // Slogan/Motto aziendale - opzionale
      // Geo-Targeting & RAG
      productCategory,
      targetCanton,
      targetCity,
      targetLanguage
    } = body;

    // Validazione
    if (!productImage) {
      return NextResponse.json(
        { error: 'productImage è obbligatorio' },
        { status: 400 }
      );
    }

    // 🧹 PULIZIA DATI PRODOTTO
    const cleanedName = cleanProductName(productName);
    const cleanedDescription = cleanProductDescription(productDescription, productName);

    if (!['instagram', 'facebook', 'tiktok', 'linkedin'].includes(socialPlatform)) {
      return NextResponse.json(
        { error: 'socialPlatform non valido' },
        { status: 400 }
      );
    }

    // Usa VEO_API_KEY dedicata se disponibile, altrimenti fallback a GEMINI_API_KEY
    // IMPORTANTE: Deve essere la stessa API key usata in check-video-status
    const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[SOCIAL-AI] API key non configurata');
      return NextResponse.json(
        { error: 'API key Gemini non configurata sul server' },
        { status: 500 }
      );
    }

    // Inizializza client Gemini (NUOVO SDK)
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

    // AGENT 1: Copywriting (sempre attivo) - con RAG
    agents.push(
      generateCopywriting(ai, {
        productName: cleanedName,
        productDescription: cleanedDescription,
        platform: socialPlatform,
        tone,
        targetAudience,
        productImageBase64: cleanBase64,
        productCategory,
        targetCanton
      })
    );

    // AGENT 2: Image Generation (se richiesto)
    if (contentType === 'image' || contentType === 'both') {
      agents.push(
        generateMarketingImage(ai, {
          productName: cleanedName,
          productDescription: cleanedDescription,
          platform: socialPlatform,
          tone,
          aspectRatio,
          productImageBase64: cleanBase64,
          includeLogo,
          logoImage,
          companyMotto
        })
      );
    } else {
      agents.push(Promise.resolve(null)); // Placeholder
    }

    // AGENT 3: Video Generation (se richiesto)
    if (contentType === 'video' || contentType === 'both') {
      agents.push(
        generateMarketingVideo(ai, {
          productName: cleanedName,
          productDescription: cleanedDescription,
          platform: socialPlatform,
          aspectRatio,
          productImageBase64: cleanBase64,
          videoStyle,
          videoDuration,
          includeLogo,
          logoImage,
          companyMotto
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

    // ==========================================
    // 🧠 SENTIMENT ANALYSIS & ENGAGEMENT PREDICTION
    // ==========================================
    let sentimentResult: SentimentAnalysis | undefined;

    try {
      if (isDev) {
        console.log('[SENTIMENT] Analyzing generated copy...');
      }

      sentimentResult = await analyzeSentiment({
        caption: copywritingResult.caption,
        hashtags: copywritingResult.hashtags,
        cta: copywritingResult.cta,
        platform: socialPlatform,
        tone,
        productName: cleanedName
      });

      if (isDev) {
        console.log('[SENTIMENT] ✓ Analysis complete:', {
          sentiment: sentimentResult.sentiment,
          predictedEngagement: `${sentimentResult.predictedEngagement}%`,
          recommendation: sentimentResult.recommendation
        });
      }
    } catch (sentimentError) {
      console.error('[SENTIMENT] Analysis failed:', sentimentError);
      // Continue without sentiment - graceful degradation
    }

    // Costruisci risposta
    const result: MarketingResult = {
      copywriting: copywritingResult,
      sentiment: sentimentResult, // Add sentiment analysis
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

    // ==========================================
    // 💾 SAVE TO DATABASE
    // ==========================================
    try {
      // Determine aspect ratio for storage
      const videoStyle = body.videoStyle || 'default';

      // Save post to database (with geo-targeting fields)
      const savedPost = await sql`
        INSERT INTO social_posts (
          product_name,
          product_category,
          platform,
          content_type,
          caption,
          hashtags,
          cta,
          tone,
          video_style,
          video_duration,
          aspect_ratio,
          logo_url,
          company_motto,
          target_canton,
          target_city,
          target_language,
          status,
          created_at
        ) VALUES (
          ${cleanedName},
          ${productCategory || null},
          ${socialPlatform},
          ${contentType},
          ${copywritingResult.caption},
          ${copywritingResult.hashtags},
          ${copywritingResult.cta},
          ${tone},
          ${videoStyle},
          ${videoDuration || 6},
          ${aspectRatio},
          ${logoImage || null},
          ${companyMotto || null},
          ${targetCanton || null},
          ${targetCity || null},
          ${targetLanguage || null},
          'draft',
          NOW()
        )
        RETURNING id
      `;

      const postId = savedPost.rows[0]?.id;

      if (isDev && postId) {
        console.log(`[DATABASE] ✓ Post saved with ID: ${postId}`);
      }

      // Add post ID to result metadata
      result.metadata = {
        ...result.metadata,
        postId
      };

    } catch (dbError: any) {
      // Log error but don't fail the request - data is still returned to user
      console.error('[DATABASE] Failed to save post:', dbError.message);
      if (isDev) {
        console.error('[DATABASE] Error details:', dbError);
      }
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
    productCategory?: string;
    targetCanton?: string;
  }
): Promise<{ caption: string; hashtags: string[]; cta: string }> {

  // ==========================================
  // 🧠 RAG: Find similar high-performing posts
  // ==========================================
  let ragInsights = '';

  try {
    if (isDev) {
      console.log('[RAG] Searching for similar high-performing posts...');
    }

    const similarPosts = await findSimilarHighPerformingPosts({
      productName: params.productName,
      platform: params.platform,
      productCategory: params.productCategory,
      targetCanton: params.targetCanton,
      minEngagement: 3.0,
      limit: 5
    });

    if (similarPosts.length > 0) {
      const insights = await extractRAGInsights(similarPosts);

      ragInsights = `

📊 PERFORMANCE DATA (from ${similarPosts.length} similar high-performing posts):
- Top Hashtags: ${insights.topHashtags.slice(0, 8).join(', ')}
- Successful CTAs: ${insights.successfulCTAs.slice(0, 2).join(' | ')}
- Average Engagement: ${insights.avgEngagement.toFixed(2)}%
- Effective Tone: ${insights.tonePatterns.join(', ')}

💡 RECOMMENDATION: Use these proven hashtags and CTA style for maximum engagement.`;

      if (isDev) {
        console.log('[RAG] ✓ Found insights from', similarPosts.length, 'similar posts');
        console.log('[RAG] Top hashtags:', insights.topHashtags.slice(0, 5));
      }
    } else {
      if (isDev) {
        console.log('[RAG] No similar posts found - using default strategy');
      }
    }
  } catch (ragError) {
    console.error('[RAG] Failed to fetch insights:', ragError);
    // Continue without RAG insights - graceful degradation
  }

  const prompt = `Sei un esperto copywriter specializzato in social media marketing.

CONTESTO:
- Prodotto: ${params.productName}
- Descrizione: ${params.productDescription || 'Vedi immagine'}
- Piattaforma: ${params.platform}
- Tone of voice: ${params.tone}
- Target audience: ${params.targetAudience}${ragInsights}

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
- Hashtags: 5-8 hashtags rilevanti e popolari per ${params.platform}${ragInsights ? '\n- PRIORITÀ: Usa gli hashtags suggeriti dai dati di performance' : ''}
- CTA: chiaro e orientato all'azione, DEVE includere "www.lapa.ch" (es: "Visita www.lapa.ch", "Scopri di più su www.lapa.ch", "Ordina su www.lapa.ch")
- Tone: ${params.tone}
- NON usare emoji se il tone è "professional"
- USA emoji se il tone è "fun" o "casual"

Rispondi SOLO con il JSON, senza markdown o spiegazioni.`;

  try {
    // NUOVO SDK - usa generateContent() con model specificato
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: params.productImageBase64
          }
        },
        { text: prompt }
      ]
    });

    const textResponse = response.text || '';

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
    tone: string;
    aspectRatio: string;
    productImageBase64: string;
    includeLogo: boolean;
    logoImage?: string;
    companyMotto?: string;
  }
): Promise<{ data: string; mimeType: string; dataUrl: string } | null> {

  // Prompt diversi per ogni tone (ENGLISH for better quality)
  const tonePrompts = {
    professional: `Create a PROFESSIONAL marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

STYLE:
- Professional studio photography
- Soft, uniform lighting
- Clean white/gray elegant background
- Balanced, formal composition
- High quality, photorealistic

COMPOSITION:
- Product is the main focus
- Use provided image as exact reference
- Corporate, professional environment
- Sober, refined color palette`,

    casual: `Create a CASUAL, NATURAL marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

STYLE:
- Natural lifestyle photography
- Soft natural light (daylight style)
- Everyday, relaxed environment
- Spontaneous yet curated composition
- Photorealistic with friendly atmosphere

COMPOSITION:
- Product integrated in real-life context
- Use provided image as reference
- Natural elements (wood, fabrics, plants)
- Warm, welcoming color palette`,

    fun: `Create a FUN, COLORFUL marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

STYLE:
- Vibrant, playful photography
- Bright, energetic lighting
- Vivid, eye-catching POP colors
- Dynamic, creative composition
- Young, fun atmosphere

COMPOSITION:
- Product as protagonist in playful scene
- Use provided image as reference
- Colorful elements, patterns, geometric shapes
- Bold, festive color palette`,

    luxury: `Create a LUXURY, EXCLUSIVE marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

STYLE:
- High-end premium magazine photography
- Dramatic lighting with rim light
- Elegant background (marble, velvet, gold)
- Refined, sophisticated composition
- Maximum quality, ultra-realistic

COMPOSITION:
- Product as object of desire
- Use provided image as reference
- Premium elements (metal, crystal, luxury textures)
- Rich, precious color palette (black, gold, burgundy)`
  };

  const basePrompt = tonePrompts[params.tone as keyof typeof tonePrompts] || tonePrompts.professional;

  // Aggiungi logo e motto se richiesti (ENGLISH)
  let brandingInstruction = '';

  if (params.includeLogo && params.logoImage) {
    brandingInstruction += '\n\nLOGO: Add the provided company logo as a small, elegant watermark in the bottom right corner. The logo should be subtle but visible, maintaining professional quality.';
  } else if (params.includeLogo) {
    brandingInstruction += '\n\nLOGO: Add a small, subtle brand logo watermark in the bottom right corner.';
  } else {
    brandingInstruction += '\n\nDO NOT include any text or logos in the image.';
  }

  if (params.companyMotto) {
    brandingInstruction += `\n\nMOTTO: Include the company motto "${params.companyMotto}" as elegant text overlay at the top or bottom of the image, in a professional, readable font.`;
  }

  const fullPrompt = basePrompt + brandingInstruction;

  try {
    // Prepara i contenuti per Gemini
    const contents: any[] = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: params.productImageBase64
        }
      }
    ];

    // Aggiungi logo se fornito
    if (params.logoImage) {
      const cleanLogoBase64 = params.logoImage.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanLogoBase64
        }
      });
    }

    // Aggiungi prompt
    contents.push({ text: fullPrompt });

    // NUOVO SDK - usa generateContent() con gemini-2.5-flash-image
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents
    });

    if (isDev) {
      console.log('[AGENT-IMAGE] Full response structure:', JSON.stringify(response, null, 2));
      console.log('[AGENT-IMAGE] Response parts:', (response as any).parts?.length);
      console.log('[AGENT-IMAGE] Response candidates:', (response as any).candidates?.length);
    }

    // Estrai l'immagine generata - prova diverse strutture
    // Struttura 1: response.parts (usata da copywriting)
    for (const part of (response as any).parts || []) {
      if (part.inlineData && part.inlineData.data) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';

        if (isDev) {
          console.log('[AGENT-IMAGE] ✓ Image generated successfully, size:', imageData.length, 'bytes');
        }

        return {
          data: imageData,
          mimeType,
          dataUrl: `data:${mimeType};base64,${imageData}`
        };
      }
    }

    // Struttura 2: response.candidates[0].content.parts (struttura standard Gemini API)
    const candidates = (response as any).candidates || [];
    if (candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';

          if (isDev) {
            console.log('[AGENT-IMAGE] ✓ Image found in candidates structure, size:', imageData.length, 'bytes');
          }

          return {
            data: imageData,
            mimeType,
            dataUrl: `data:${mimeType};base64,${imageData}`
          };
        }
      }
    }

    console.error('[AGENT-IMAGE] No image found in response');
    if (isDev) {
      console.error('[AGENT-IMAGE] Tried both response.parts and response.candidates[0].content.parts');
    }
    return null;

  } catch (error: any) {
    console.error('[AGENT-IMAGE] Errore:', error.message);
    if (isDev) {
      console.error('[AGENT-IMAGE] Stack:', error.stack);
    }
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
    videoStyle?: string;
    videoDuration?: number;
    includeLogo: boolean;
    logoImage?: string;
    companyMotto?: string;
  }
): Promise<{ operationId: string; status: string; estimatedTime: number } | null> {

  const style = params.videoStyle || 'default';
  const duration = params.videoDuration || 6;

  // Logo e motto instructions (se richiesti)
  let brandingLine = '';

  if (params.includeLogo && params.logoImage) {
    brandingLine += 'Add the provided company logo as a small, elegant watermark in the bottom right corner throughout the video. ';
  } else if (params.includeLogo) {
    brandingLine += 'Add a small, subtle brand logo watermark in the bottom right corner. ';
  }

  if (params.companyMotto) {
    brandingLine += `Include the company motto "${params.companyMotto}" as elegant text at the beginning or end of the video.`;
  }

  // Prompt diversi per ogni stile (INGLESE per migliore qualità)
  // IMPORTANTE: Specifica DURATION in secondi per assicurare video della lunghezza corretta
  const stylePrompts = {
    default: `Create a premium, hyper-realistic ${duration}-second product video for ${params.platform} social media advertising.
DURATION: Exactly ${duration} seconds - pace the movement to fill the entire duration smoothly.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference. The product MUST look identical to the reference photo.
CAMERA: Smooth, natural movement that showcases the product elegantly.
LIGHTING: Professional studio lighting with soft shadows.
STYLE: Clean, premium commercial photography in motion.
${brandingLine}`,

    zoom: `Create a premium ${duration}-second product video with SLOW ZOOM IN effect for ${params.platform}.
DURATION: Exactly ${duration} seconds - adjust zoom speed to fill the entire duration.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference.
CAMERA MOVEMENT: Start with medium shot, slowly zoom in to close-up revealing product details.
The zoom should be smooth, slow, and elegant - like a luxury commercial.
LIGHTING: Professional studio lighting that highlights product features.
STYLE: High-end commercial with emphasis on product details.
${brandingLine}`,

    rotate: `Create a premium ${duration}-second 360-DEGREE ROTATION product video for ${params.platform}.
DURATION: Exactly ${duration} seconds - adjust rotation speed to complete full 360° in this time.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference.
CAMERA MOVEMENT: Smooth 360° horizontal rotation around the product at constant speed.
Professional turntable showcase style - camera orbits the product showing it from all angles.
LIGHTING: Studio lighting with consistent illumination from all angles.
STYLE: Classic product showcase rotation - professional and elegant.
${brandingLine}`,

    dynamic: `Create a DYNAMIC, ENERGETIC ${duration}-second product video for ${params.platform}.
DURATION: Exactly ${duration} seconds - maintain high energy throughout the entire duration.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference.
CAMERA MOVEMENT: Fast, energetic movements - quick zoom in combined with slight rotation.
Dynamic angles that create excitement and grab attention.
LIGHTING: High contrast, vibrant lighting with bold shadows.
STYLE: Modern, high-energy commercial - fast-paced and attention-grabbing.
${brandingLine}`,

    cinematic: `Create a CINEMATIC, HOLLYWOOD-STYLE ${duration}-second product video for ${params.platform}.
DURATION: Exactly ${duration} seconds - slow, deliberate movements that fill the entire duration.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference.
CAMERA MOVEMENT: Professional dolly-in shot with subtle parallax effect.
Slow, controlled push toward product with slight vertical rise - hero angle.
LIGHTING: Dramatic cinematic lighting with rim lights and atmospheric haze.
STYLE: Blockbuster film quality - epic, dramatic product reveal with depth and atmosphere.
${brandingLine}`,

    explosion: `Create a MESMERIZING PRODUCT ASSEMBLY video for ${params.platform}.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference for the final assembled product.
EFFECT: Product REASSEMBLY - starts with floating pieces/components that smoothly come together.
ANIMATION: Individual parts gracefully float and assemble into the complete product.
Start scattered (0-1 sec), converge smoothly (1-4 sec), fully assembled (4-6 sec).
CAMERA: Static or slow push-in to emphasize the assembly magic.
LIGHTING: Dramatic lighting that highlights each component as it moves into place.
STYLE: Cinematic product reveal - Apple-style product showcase with satisfying assembly effect.
${brandingLine}`,

    orbital: `Create a STUNNING ORBITAL 360° product video for ${params.platform}.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference.
PRODUCT POSITION: Product floating elegantly in mid-air, suspended in space.
CAMERA MOVEMENT: Camera orbits in a complete 360° circle around the floating product at constant height.
Smooth, continuous orbital movement - camera flies around the product showing all sides.
SPEED: Moderate orbital speed - complete 360° rotation in 5-6 seconds.
LIGHTING: Professional studio lighting that follows the camera, maintaining consistent illumination.
BACKGROUND: Clean, minimal background - let the product be the star.
STYLE: Premium commercial showcase - elegant orbital reveal like luxury product advertising.
${brandingLine}`,

    reassembly: `Create a SPECTACULAR PRODUCT REASSEMBLY video for ${params.platform}.
PRODUCT: ${params.productName}
Use the provided product image as EXACT visual reference for the final product.
EFFECT: Product RECONSTRUCTION from small fragments - starts with tiny scattered pieces.
ANIMATION: Hundreds of small pieces/particles smoothly converge and fuse together.
Start completely fragmented (0-1 sec), progressive reassembly (1-5 sec), perfect final product (5-6 sec).
VISUAL STYLE: Particle simulation effect - each piece flies into position with precision.
CAMERA: Slow circular movement around the reassembly process to show depth and dimension.
LIGHTING: Bright, high-key lighting with subtle glow effect on moving pieces.
STYLE: High-tech product reveal - futuristic reassembly like sci-fi hologram materialization.
${brandingLine}`
  };

  const fullPrompt = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.default;

  try {
    // Converti l'aspect ratio per Veo (solo 16:9 o 9:16)
    const veoAspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    console.log('[AGENT-VIDEO] Starting image-to-video generation:', {
      product: params.productName,
      platform: params.platform,
      aspectRatio: veoAspectRatio,
      durationSeconds: duration,  // LOG ESPLICITO DELLA DURATA
      style: style,
      imageSize: params.productImageBase64.length
    });

    // NUOVO SDK - usa generateVideos() esattamente come da documentazione ufficiale
    // https://ai.google.dev/gemini-api/docs/video
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: fullPrompt,  // Direct parameter (not wrapped in "source")
      image: {             // Direct parameter (not wrapped in "source")
        imageBytes: params.productImageBase64,
        mimeType: 'image/jpeg'
      },
      config: {
        aspectRatio: veoAspectRatio,
        durationSeconds: duration,  // Usa il parametro dall'utente (6, 12, o 30 secondi)
        resolution: '720p'
      }
    });

    if (!operation || !operation.name) {
      console.warn('[AGENT-VIDEO] No operation returned from Veo API');
      return null;
    }

    if (isDev) {
      console.log('[AGENT-VIDEO] ✓ Video generation started successfully:', operation.name);
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
