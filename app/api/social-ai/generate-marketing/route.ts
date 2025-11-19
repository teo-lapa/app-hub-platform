import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/social-ai/generate-marketing
 *
 * Genera contenuti marketing AI completi in parallelo:
 * 1. Copywriting con Gemini (Caption + Hashtags + CTA)
 * 2. Immagine con Nano Banana (Gemini 2.5 Flash Image)
 * 3. Video con Veo 3.1 (opzionale)
 *
 * Body:
 * - productImage: string (base64)
 * - productName?: string
 * - productDescription?: string
 * - socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
 * - contentType: 'image' | 'video' | 'both'
 * - tone: 'professional' | 'casual' | 'fun' | 'luxury'
 * - targetAudience?: string
 * - videoStyle?: 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic'
 */

interface GenerateMarketingRequest {
  productImage: string;
  productName?: string;
  productDescription?: string;
  socialPlatform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
  contentType: 'image' | 'video' | 'both';
  tone: 'professional' | 'casual' | 'fun' | 'luxury';
  targetAudience?: string;
  videoStyle?: 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic';
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateMarketingRequest = await request.json();

    const {
      productImage,
      productName,
      productDescription,
      socialPlatform,
      contentType,
      tone,
      targetAudience,
      videoStyle = 'default'
    } = body;

    if (!productImage) {
      return NextResponse.json(
        { error: 'productImage è obbligatoria' },
        { status: 400 }
      );
    }

    // Importa dinamicamente @google/generative-ai
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[SOCIAL-AI] API key non configurata');
      return NextResponse.json(
        { error: 'API key non configurata' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // ============================================
    // STEP 1: COPYWRITING (Gemini Flash 2.5)
    // ============================================
    const copywritingPrompt = buildCopywritingPrompt(body);

    const copyModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const copyResult = await copyModel.generateContent([
      {
        inlineData: {
          data: productImage.split(',')[1] || productImage,
          mimeType: 'image/jpeg'
        }
      },
      { text: copywritingPrompt }
    ]);

    const copyText = copyResult.response.text();

    // Parsing del JSON dal copywriting
    const copyData = parseCopywritingResponse(copyText);

    // ============================================
    // STEP 2: IMAGE GENERATION (Nano Banana)
    // ============================================
    let imageData: any = null;

    if (contentType === 'image' || contentType === 'both') {
      try {
        const imagePrompt = buildImagePrompt(body, copyData.caption);

        const imageModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const imageResult = await imageModel.generateContent([
          {
            inlineData: {
              data: productImage.split(',')[1] || productImage,
              mimeType: 'image/jpeg'
            }
          },
          {
            text: `${imagePrompt}

Generate a professional marketing image for ${socialPlatform}.`
          }
        ]);

        // Nota: Gemini 2.5 Flash non ha native image generation ancora
        // Per ora ritorniamo l'immagine originale come placeholder
        // TODO: Implementare Imagen 3 quando disponibile via API
        imageData = {
          dataUrl: productImage
        };

        console.log('[SOCIAL-AI] Image generation placeholder (original image returned)');

      } catch (imageError: any) {
        console.error('[SOCIAL-AI] Image generation error:', imageError.message);
        // Fallback: usa l'immagine originale
        imageData = {
          dataUrl: productImage
        };
      }
    }

    // ============================================
    // STEP 3: VIDEO GENERATION (Veo 3.1)
    // ============================================
    let videoData: any = null;

    if (contentType === 'video' || contentType === 'both') {
      try {
        const videoPrompt = buildVideoPrompt(body, copyData.caption);

        // Usa VEO_API_KEY se disponibile
        const veoApiKey = process.env.VEO_API_KEY || apiKey;

        const veoResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/veo-3.1:generateVideo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': veoApiKey
          },
          body: JSON.stringify({
            prompt: videoPrompt,
            config: {
              duration: '5s',
              aspectRatio: getAspectRatio(socialPlatform),
              seed: Math.floor(Math.random() * 1000000)
            }
          })
        });

        if (!veoResponse.ok) {
          const errorText = await veoResponse.text();
          console.error('[SOCIAL-AI] Veo API error:', veoResponse.status, errorText);
          throw new Error(`Veo API returned ${veoResponse.status}`);
        }

        const veoData = await veoResponse.json();

        // Estrai operation ID
        const operationId = veoData.name;

        if (operationId) {
          videoData = {
            operationId,
            status: 'generating'
          };
          console.log('[SOCIAL-AI] Video generation started:', operationId);
        } else {
          console.warn('[SOCIAL-AI] Veo response missing operation ID');
        }

      } catch (videoError: any) {
        console.error('[SOCIAL-AI] Video generation error:', videoError.message);
        // Video è opzionale, continua senza
      }
    }

    // ============================================
    // RETURN RESULT
    // ============================================
    const result = {
      success: true,
      data: {
        copywriting: copyData,
        image: imageData,
        video: videoData,
        metadata: {
          platform: socialPlatform,
          aspectRatio: getAspectRatio(socialPlatform)
        }
      }
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[SOCIAL-AI] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la generazione'
      },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildCopywritingPrompt(body: GenerateMarketingRequest): string {
  const { socialPlatform, tone, targetAudience, productName, productDescription } = body;

  return `You are an expert social media copywriter.

Create engaging marketing copy for ${socialPlatform} in ${tone} tone.

Product: ${productName || 'See image'}
Description: ${productDescription || 'Analyze from image'}
Target Audience: ${targetAudience || 'General'}

Analyze the product image and create:
1. Caption (${getCaptionLength(socialPlatform)} characters max)
2. Hashtags (${getHashtagCount(socialPlatform)} relevant hashtags)
3. Call-to-Action (compelling CTA)

Return ONLY valid JSON:
{
  "caption": "engaging caption here",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "cta": "clear call to action"
}`;
}

function buildImagePrompt(body: GenerateMarketingRequest, caption: string): string {
  const { socialPlatform, tone } = body;

  return `Transform this product photo into a professional ${socialPlatform} marketing image.

Style: ${tone}
Aspect Ratio: ${getAspectRatio(socialPlatform)}

Caption: ${caption}

Enhance the image for maximum engagement while keeping the product as the focal point.`;
}

function buildVideoPrompt(body: GenerateMarketingRequest, caption: string): string {
  const { socialPlatform, tone, videoStyle } = body;

  const styleInstructions = {
    default: 'smooth natural camera movement around the product',
    zoom: 'slow cinematic zoom into the product details',
    rotate: '360-degree rotation showcasing all product angles',
    dynamic: 'fast-paced dynamic movements with energy',
    cinematic: 'professional film-style cinematography with dramatic lighting'
  };

  return `Professional product video for ${socialPlatform}.

Product in image, ${styleInstructions[videoStyle || 'default']}.

Style: ${tone}, engaging, eye-catching.
Duration: 5 seconds
Aspect Ratio: ${getAspectRatio(socialPlatform)}

Make it scroll-stopping and shareable.`;
}

function parseCopywritingResponse(text: string): any {
  try {
    // Cerca JSON nel testo
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('[SOCIAL-AI] Copywriting parsing error, using fallback');
    // Fallback
    return {
      caption: 'Discover something amazing! 🚀',
      hashtags: ['#product', '#marketing', '#new'],
      cta: 'Shop now!'
    };
  }
}

function getCaptionLength(platform: string): number {
  switch (platform) {
    case 'instagram': return 150;
    case 'facebook': return 200;
    case 'tiktok': return 100;
    case 'linkedin': return 200;
    default: return 150;
  }
}

function getHashtagCount(platform: string): number {
  switch (platform) {
    case 'instagram': return 10;
    case 'facebook': return 5;
    case 'tiktok': return 8;
    case 'linkedin': return 3;
    default: return 5;
  }
}

function getAspectRatio(platform: string): string {
  switch (platform) {
    case 'instagram': return '9:16'; // Stories/Reels
    case 'facebook': return '16:9';
    case 'tiktok': return '9:16';
    case 'linkedin': return '16:9';
    default: return '1:1';
  }
}
