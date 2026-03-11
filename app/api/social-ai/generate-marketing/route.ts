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
 * - tone?: 'random' | 'professional' | 'casual' | 'fun' | 'luxury'
 * - targetAudience?: string - Descrizione target
 */

interface GenerateMarketingRequest {
  productImage: string;
  productName?: string;
  productDescription?: string;
  socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  contentType: 'image' | 'video' | 'both';
  tone?: 'random' | 'professional' | 'casual' | 'fun' | 'luxury';
  targetAudience?: string;
  videoStyle?: 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic' | 'explosion' | 'orbital' | 'reassembly';
  videoDuration?: 4 | 6 | 8;  // Durata video in secondi - Veo 3.1 supporta solo 4, 6, 8s (default: 6)
  videoPrompt?: string;

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
      tone: rawTone = 'professional',
      targetAudience = 'pubblico generale',
      videoStyle = 'default',
      videoDuration = 6,    // Default: 6 secondi (Veo 3.1: solo 4, 6, 8s supportati)
      videoPrompt,
      includeLogo = false,
      logoImage,        // Logo aziendale (base64) - opzionale
      companyMotto,     // Slogan/Motto aziendale - opzionale
      // Geo-Targeting & RAG
      productCategory,
      targetCanton,
      targetCity,
      targetLanguage
    } = body;

    // Se tone è "random", scegli casualmente tra professional, casual, fun, luxury
    const availableTones = ['professional', 'casual', 'fun', 'luxury'] as const;
    const tone = rawTone === 'random'
      ? availableTones[Math.floor(Math.random() * availableTones.length)]
      : rawTone;

    if (rawTone === 'random') {
      console.log(`🎲 [GENERATE-MARKETING] Tone casuale selezionato: ${tone}`);
    }

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
          videoPrompt,
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
          ${JSON.stringify(copywritingResult.hashtags)},
          ${copywritingResult.cta},
          ${tone},
          ${videoStyle},
          ${videoDuration && [4, 6, 8].includes(videoDuration) ? videoDuration : 6},
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

  const prompt = `Sei un SENIOR COPYWRITER CREATIVO di un'agenzia di marketing premium, specializzato in content strategy per social media.

📊 CONTESTO DI BUSINESS:
- Prodotto: ${params.productName}
- Descrizione: ${params.productDescription || 'Analizza l\'immagine fornita'}
- Piattaforma: ${params.platform}
- Tone of Voice: ${params.tone}
- Target Audience: ${params.targetAudience}${ragInsights}

🎯 OBIETTIVO PRINCIPALE:
Crea un post marketing AD-READY che CONVERTA visualizzazioni in azioni concrete.
Il copy deve essere PERSUASIVO, MEMORABILE e ottimizzato per massimizzare engagement e conversioni.

📝 OUTPUT RICHIESTO (formato JSON):
{
  "caption": "Hook potente + Value proposition + Emotional trigger (max 140 caratteri per ${params.platform})",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6"],
  "cta": "Call-to-Action irresistibile con urgency/scarcity"
}

🎨 REGOLE DI COPYWRITING PROFESSIONALE:

CAPTION (Max 140 caratteri):
- INIZIA con un HOOK irresistibile (domanda provocatoria, dato sorprendente, o beneficio chiave)
- Comunica il VALORE UNICO del prodotto in modo chiaro e conciso
- Usa TRIGGER EMOTIVI (curiosità, desiderio, FOMO, aspirazione)
- Linguaggio SENSORIALE e SPECIFICO (no frasi generiche!)
- Per ${params.tone === 'professional' ? 'PROFESSIONAL: Tono autorevole, credibile, orientato ai risultati' : params.tone === 'luxury' ? 'LUXURY: Linguaggio esclusivo, sofisticato, aspirazionale' : params.tone === 'fun' ? 'FUN: Energico, giocoso, pieno di personalità 🎉' : 'CASUAL: Conversazionale, autentico, relatable'}
- EVITA cliché marketing ("Scopri", "Non perdere", "Il migliore", etc.)

HASHTAGS (6-8 strategici):
- MIX: 2 popolari + 3 mid-tier + 2 niche/branded
- RILEVANZA: Hashtags specifici del prodotto/settore per ${params.platform}${ragInsights ? '\n- ⚡ PRIORITÀ: USA gli hashtags ad alta performance dai dati RAG forniti' : ''}
- Combina: #branded #category #trending #location
- Per ${params.platform === 'linkedin' ? 'LinkedIn: Professional hashtags (#B2B, #Innovation, settore specifico)' : params.platform === 'instagram' ? 'Instagram: Visual + Lifestyle hashtags' : params.platform === 'tiktok' ? 'TikTok: Trending + Discovery hashtags' : 'Facebook: Community + Interest hashtags'}

CTA (Call-to-Action POTENTE):
- URGENZA: Usa scarcity/urgency ("Solo oggi", "Ultimi pezzi", "Offerta limitata")
- SPECIFICO: Dì ESATTAMENTE cosa fare ("Ordina ora su www.lapa.ch", "Prenota il tuo su www.lapa.ch", "Richiedi campione su www.lapa.ch")
- BENEFICIO: Rinforza il valore ("Ricevi consegna gratuita su www.lapa.ch", "Risparmia 20% su www.lapa.ch")
- DEVE contenere "www.lapa.ch" in modo naturale e strategico
- Evita CTA deboli ("Scopri di più", "Clicca qui")

EMOJI STRATEGY:
${params.tone === 'professional' ? '❌ NO EMOJI - Mantieni tono formale e autorevole' : params.tone === 'luxury' ? '✨ Usa emoji minimalisti di lusso (💎🌟✨🥂) - MAX 1-2' : params.tone === 'fun' ? '🎉 USA EMOJI CREATIVI! - Rendi il post vivace e coinvolgente 🚀💥✨' : '👍 USA emoji conversazionali per rendere il post friendly e approachable 😊🌟'}

⚡ BEST PRACTICES FINALI:
- Analizza ATTENTAMENTE l'immagine del prodotto prima di scrivere
- Il copy deve RIFLETTERE ciò che si vede nell'immagine
- Focus su BENEFICI, non features
- Crea DESIDERIO attraverso storytelling visivo
- Ottimizza per MOBILE (frasi brevi, impatto immediato)

Rispondi ESCLUSIVAMENTE con il JSON, SENZA markdown backticks, SENZA spiegazioni.`;

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

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must be indistinguishable from a real professional photograph
- SHARP DETAILS: Every element crisp and in perfect focus
- The product in the generated image must look IDENTICAL to the provided reference photo

STYLE:
- Professional studio photography by award-winning commercial photographer
- Soft, uniform three-point lighting setup
- Clean white/gray elegant seamless background
- Balanced, formal composition following golden ratio
- Ultra high quality, photorealistic rendering

COMPOSITION:
- Product is the main focus, perfectly centered or rule-of-thirds positioned
- Use provided image as EXACT reference - product must look identical
- Corporate, professional environment suitable for B2B marketing
- Sober, refined color palette (whites, grays, subtle accent colors)
- Subtle reflection on surface for depth
- Negative space for potential text overlay

TECHNICAL:
- Commercial advertising quality (Apple/Samsung product shot level)
- Perfect white balance and color accuracy
- No noise, no artifacts, no blur
- Professional color grading`,

    casual: `Create a CASUAL, NATURAL marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must look like a real lifestyle photograph
- SHARP DETAILS: Product and key elements in crisp focus
- The product must look IDENTICAL to the provided reference photo

STYLE:
- Natural lifestyle photography by professional Instagram photographer
- Soft natural light streaming through window (golden hour feel)
- Everyday, relaxed environment that feels authentic
- Spontaneous yet curated composition
- Photorealistic with warm, friendly atmosphere

COMPOSITION:
- Product integrated naturally in real-life context
- Use provided image as EXACT reference for product appearance
- Natural elements: wooden surfaces, linen fabrics, green plants
- Warm, welcoming color palette (earth tones, soft pastels)
- Lifestyle context that tells a story
- Subtle depth of field for professional look

TECHNICAL:
- High-end lifestyle blog quality
- Natural color grading (warm, inviting)
- No artificial or CGI appearance
- Mobile-optimized composition`,

    fun: `Create a FUN, COLORFUL marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must look like a real photograph, not CGI or illustration
- SHARP DETAILS: Crisp focus throughout, vibrant without being oversaturated
- The product must look IDENTICAL to the provided reference photo

STYLE:
- Vibrant, playful commercial photography (Coca-Cola/McDonald's campaign level)
- Bright, energetic studio lighting with colored gels
- Vivid, eye-catching POP colors that demand attention
- Dynamic, creative composition with movement feel
- Young, fun, Gen-Z friendly atmosphere

COMPOSITION:
- Product as protagonist in playful, energetic scene
- Use provided image as EXACT reference for product
- Colorful elements: confetti, geometric shapes, bold patterns
- Bold, festive color palette (primary colors, neon accents)
- Dynamic angles that create energy
- Perfect for social media scroll-stopping

TECHNICAL:
- High-energy commercial advertising quality
- Punchy, vibrant color grading
- Sharp contrast and saturation
- Clean, professional execution despite playful theme`,

    luxury: `Create a LUXURY, EXCLUSIVE marketing image for ${params.platform}.

PRODUCT: ${params.productName}
${params.productDescription ? `Description: ${params.productDescription}` : ''}

CRITICAL REQUIREMENTS:
- ASPECT RATIO: MUST be EXACTLY 1:1 SQUARE format (1024x1024 pixels) - THIS IS MANDATORY FOR INSTAGRAM
- ULTRA HIGH RESOLUTION: Maximum possible resolution (1024x1024 pixels minimum)
- PHOTOREALISTIC: Must be indistinguishable from a $50,000 luxury brand photoshoot
- SHARP DETAILS: Every texture visible - marble veins, gold reflections, fabric threads
- The product must look IDENTICAL to the provided reference photo, elevated to luxury context

STYLE:
- High-end premium magazine photography (Vogue, Harper's Bazaar level)
- Dramatic Rembrandt lighting with elegant rim light
- Elegant background: black marble, deep velvet, brushed gold accents
- Refined, sophisticated composition with perfect balance
- Maximum quality, hyper-realistic rendering

COMPOSITION:
- Product as object of desire, hero positioning
- Use provided image as EXACT reference - product must be identical
- Premium elements: brushed metal, crystal, silk, leather
- Rich, precious color palette: deep black, gold, burgundy, champagne
- Dramatic shadows for depth and mystery
- Aspirational lifestyle elements in background

TECHNICAL:
- Luxury brand advertising quality (Cartier/Louis Vuitton level)
- Rich, moody color grading with lifted blacks
- Perfect highlight control on reflective surfaces
- Cinematic depth of field
- No imperfections - absolute perfection required`
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

    // NUOVO SDK - usa generateContent() con Nano Banana 2 (gemini-3.1-flash-image-preview)
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents,
      config: {
        responseModalities: ['Text', 'Image']
      }
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
    videoPrompt?: string;
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

  // Prompt per IMAGE-TO-VIDEO: descrivono AZIONE e MOVIMENTO, non la scena
  // Veo 3.1 best practices: camera come frase separata, 1 azione per clip,
  // specificare luce e audio, 100-150 parole max
  const stylePrompts = {
    default: `The camera slowly dollies in toward the product. The ${params.productName} sits elegantly, with soft light catching its details. Smooth, steady movement. Professional studio lighting, warm 3200K key light from camera-right, soft fill from left. Clean background. Ambient soft hum, no music. ${brandingLine}`,

    zoom: `Slow, steady zoom-in from medium shot to extreme close-up. The ${params.productName} gradually fills the frame, revealing fine texture and details. The camera pushes forward smoothly over ${duration} seconds. Warm studio key light from above-right, soft shadows underneath. Gentle ambient sound. ${brandingLine}`,

    rotate: `The camera orbits smoothly around the ${params.productName} in a complete 360-degree rotation at constant speed. The product stays centered and still. Even studio lighting from all angles, consistent illumination throughout the orbit. Clean minimal background. Soft ambient sound. ${brandingLine}`,

    dynamic: `Fast dolly-in with a quick whip-pan around the ${params.productName}. Energetic, punchy movement with sharp angle changes. High-contrast lighting, bold shadows, vibrant rim light from behind. The product stays sharp and centered throughout. Upbeat ambient energy. ${brandingLine}`,

    cinematic: `Slow dolly-in with subtle vertical crane-up revealing the ${params.productName} as a hero shot. Shallow depth of field, 85mm lens feel. Dramatic Rembrandt lighting from camera-right, atmospheric haze, warm 3000K key with cool 5600K rim light from behind. Deep shadows. Cinematic ambient tone, no dialogue. ${brandingLine}`,

    explosion: `The ${params.productName} starts as scattered floating pieces suspended in mid-air. Over ${duration} seconds the pieces gracefully converge and assemble into the complete product. Camera holds steady with slow push-in. Dramatic top lighting, each piece catches light as it moves. Satisfying mechanical assembly sounds. ${brandingLine}`,

    orbital: `The ${params.productName} floats in mid-air. The camera flies in a smooth complete 360-degree orbit around it at constant height and speed. Professional studio lighting follows the camera angle, keeping the product evenly lit. Clean dark background. Soft ambient whoosh. ${brandingLine}`,

    reassembly: `Hundreds of tiny fragments swirl in space, then smoothly converge and fuse together to form the complete ${params.productName}. Start fragmented, progressive assembly over ${duration} seconds, final product perfect at the end. Camera slowly circles during reassembly. Bright high-key lighting with subtle glow on moving pieces. Futuristic assembly sound effects. ${brandingLine}`
  };

  const stylePrompt = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.default;
  // Se c'è un videoPrompt custom, usare SOLO quello (non concatenare col template)
  const fullPrompt = params.videoPrompt ? params.videoPrompt : stylePrompt;

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
        durationSeconds: [4, 6, 8].includes(duration) ? duration : 6,
        resolution: '720p',
        generateAudio: true,
        negativePrompt: 'blurry, distorted, low quality, watermark, text overlay, subtitles, split screen, collage, multiple frames'
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
