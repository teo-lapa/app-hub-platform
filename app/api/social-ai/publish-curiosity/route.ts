import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minuti

/**
 * POST /api/social-ai/publish-curiosity
 *
 * PUBBLICAZIONE CURIOSITÀ SUI SOCIAL
 * Pubblica la curiosità selezionata su tutti i social media
 *
 * Body:
 * - curiosity: CuriosityItem - La curiosità selezionata
 * - generateImage: boolean - Se generare immagine con AI
 * - customImage?: string - Immagine custom base64 (opzionale)
 */

interface CuriosityItem {
  id: string;
  title: string;
  summary: string;
  fullContent: string;
  source?: string;
  tags: string[];
  imagePrompt: string;
  socialCaption: string;
  hashtags: string[];
}

interface PublishCuriosityRequest {
  curiosity: CuriosityItem;
  generateImage: boolean;
  customImage?: string;
  scheduledDate?: string; // Formato: "YYYY-MM-DD HH:MM:SS"
}

// Helper per delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// UPLOAD IMMAGINE SU ODOO
// ==========================================

async function uploadImageToOdoo(
  odooCookies: string,
  imageBase64: string,
  filename: string
): Promise<number> {
  // Estrai mimetype dal data URL
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  let mimetype = mimeMatch ? mimeMatch[1] : 'image/png';

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // INSTAGRAM FIX: Instagram accetta SOLO image/jpeg
  // Forza il mimetype a JPEG per evitare errori
  if (mimetype !== 'image/jpeg') {
    console.log(`  ⚠️ Instagram requires JPEG. Converting from ${mimetype} to image/jpeg`);
    mimetype = 'image/jpeg';
    filename = filename.replace(/\.(png|webp|gif)$/i, '.jpg');
  }

  const attachmentId = await callOdoo(
    odooCookies,
    'ir.attachment',
    'create',
    [{
      name: filename,
      type: 'binary',
      datas: cleanBase64,
      mimetype: mimetype,
      public: true,
      res_model: 'social.post',
      res_id: 0
    }]
  );

  if (!attachmentId) {
    throw new Error('Failed to upload image to Odoo');
  }

  return attachmentId;
}

// ==========================================
// CREA SOCIAL POST
// ==========================================

async function createSocialPost(
  odooCookies: string,
  message: string,
  accountIds: number[],
  imageId?: number,
  scheduledDate?: string,
  retryCount: number = 0
): Promise<number> {
  const postValues: Record<string, any> = {
    message: message,
    account_ids: [[6, 0, accountIds]],
  };

  // Se è programmato, usa 'scheduled', altrimenti 'now'
  if (scheduledDate) {
    postValues.post_method = 'scheduled';
    postValues.scheduled_date = scheduledDate;
  } else {
    postValues.post_method = 'now';
  }

  if (imageId) {
    postValues.image_ids = [[6, 0, [imageId]]];
  }

  const postId = await callOdoo(
    odooCookies,
    'social.post',
    'create',
    [postValues]
  );

  if (!postId) {
    throw new Error('Failed to create social post');
  }

  // Se è programmato, non pubblicare subito (Odoo lo farà alla data programmata)
  if (scheduledDate) {
    console.log(`  📅 Social post ${postId} programmato per ${scheduledDate}`);
    return postId;
  }

  // INSTAGRAM FIX: Aspetta che Instagram processi l'immagine allegata
  // Senza questo delay, Instagram restituisce "Only photo or video can be accepted as media"
  console.log(`  ⏳ Waiting 3s for Instagram to process image attachment...`);
  await delay(3000);

  // Pubblica subito se non è programmato
  try {
    await callOdoo(
      odooCookies,
      'social.post',
      'action_post',
      [[postId]]
    );
    console.log(`  ✅ Social post ${postId} pubblicato`);
  } catch (publishError: any) {
    const errorMsg = publishError.message || '';

    if (errorMsg.includes('Media ID') || errorMsg.includes('Instagram')) {
      if (retryCount < 3) {
        const waitTime = (retryCount + 1) * 5000;
        console.warn(`  ⚠️ Instagram error, waiting ${waitTime / 1000}s before retry...`);
        await delay(waitTime);

        try {
          await callOdoo(
            odooCookies,
            'social.post',
            'action_post',
            [[postId]]
          );
          console.log(`  ✅ Social post ${postId} pubblicato dopo retry`);
        } catch (retryError: any) {
          console.warn(`  ⚠️ Retry fallito:`, retryError.message);
        }
      }
    } else {
      console.warn(`  ⚠️ action_post fallito:`, errorMsg);
    }
  }

  return postId;
}

// ==========================================
// MAIN HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const { curiosity, generateImage, customImage, scheduledDate } = await request.json() as PublishCuriosityRequest;

    if (!curiosity) {
      return NextResponse.json(
        { success: false, error: 'Curiosità non fornita' },
        { status: 400 }
      );
    }

    const isScheduled = !!scheduledDate;
    console.log(`[Publish Curiosity] ${isScheduled ? 'Scheduling' : 'Publishing'}: ${curiosity.title}${isScheduled ? ` for ${scheduledDate}` : ''}`);

    // AUTENTICAZIONE ODOO
    const userCookies = request.headers.get('cookie');
    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'Devi essere loggato per pubblicare. Effettua il login.'
      }, { status: 401 });
    }

    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);
    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Sessione Odoo non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log(`✅ Odoo session obtained! User UID: ${uid}`);

    // ==========================================
    // GENERA O USA IMMAGINE
    // ==========================================

    let imageId: number | undefined;

    if (customImage) {
      // Usa immagine fornita
      console.log('[Publish Curiosity] Uploading custom image...');
      imageId = await uploadImageToOdoo(
        odooCookies,
        customImage,
        `curiosity-${curiosity.id}.jpg`
      );
    } else if (generateImage) {
      // Genera immagine con AI
      console.log('[Publish Curiosity] Generating image with AI...');

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });

        const imagePrompt = `${curiosity.imagePrompt}

STYLE: Modern food photography, vibrant colors, Instagram-worthy, professional quality.
COMPOSITION: Clean background, good lighting, appetizing presentation.
MOOD: Engaging, informative, social media friendly.`;

        try {
          const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: [{ text: imagePrompt }],
            config: {
              responseModalities: ['Text', 'Image']
            }
          });

          let imageDataUrl: string | null = null;

          // Estrai immagine dalla struttura candidates (formato standard)
          for (const part of (imageResponse as any).candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
            }
          }

          // Fallback: prova struttura alternativa .parts
          if (!imageDataUrl) {
            for (const part of (imageResponse as any).parts || []) {
              if (part.inlineData?.data) {
                imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                break;
              }
            }
          }

          if (imageDataUrl) {
            imageId = await uploadImageToOdoo(
              odooCookies,
              imageDataUrl,
              `curiosity-${curiosity.id}-ai.jpg`
            );
            console.log(`✅ AI image generated and uploaded: ${imageId}`);
          }
        } catch (imageError: any) {
          console.warn('[Publish Curiosity] Image generation failed:', imageError.message);
        }
      }
    }

    // ==========================================
    // PUBBLICAZIONE SOCIAL
    // ==========================================

    console.log('[Publish Curiosity] Publishing to social media...');

    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;

    const publishedPostIds: number[] = [];

    // Prepara messaggi per ogni piattaforma

    // Facebook/LinkedIn - Messaggio completo
    const fbLinkedinMessage = `💡 ${curiosity.title}

${curiosity.fullContent}

${curiosity.source ? `📚 Fonte: ${curiosity.source}` : ''}

${curiosity.hashtags.join(' ')}

🌐 www.lapa.ch`;

    // Instagram - Senza link, con più hashtag
    const instagramMessage = `💡 ${curiosity.title}

${curiosity.fullContent}

${curiosity.source ? `📚 ${curiosity.source}` : ''}

${curiosity.hashtags.join(' ')} #FoodFacts #LoSapeviChe #CuriositàFood #ItalianFood #MediterraneanDiet #FoodCulture #LAPA`;

    // Twitter - Max 280 caratteri
    let twitterMessage = `💡 ${curiosity.title}

${curiosity.summary}

${curiosity.hashtags.slice(0, 3).join(' ')}`;

    if (twitterMessage.length > 280) {
      twitterMessage = `💡 ${curiosity.title.substring(0, 100)}...

${curiosity.hashtags.slice(0, 2).join(' ')}`;
    }

    try {
      // POST 1: Facebook e LinkedIn
      console.log(`  📘 ${isScheduled ? 'Scheduling' : 'Publishing'} to Facebook & LinkedIn...`);
      const postId1 = await createSocialPost(
        odooCookies,
        fbLinkedinMessage,
        [FACEBOOK_ID, LINKEDIN_ID],
        imageId,
        scheduledDate
      );
      publishedPostIds.push(postId1);

      await delay(3000);

      // POST 2: Instagram
      console.log(`  📸 ${isScheduled ? 'Scheduling' : 'Publishing'} to Instagram...`);
      const postId2 = await createSocialPost(
        odooCookies,
        instagramMessage,
        [INSTAGRAM_ID],
        imageId,
        scheduledDate
      );
      publishedPostIds.push(postId2);

      // POST 3: Twitter
      console.log(`  🐦 ${isScheduled ? 'Scheduling' : 'Publishing'} to Twitter...`);
      const postId3 = await createSocialPost(
        odooCookies,
        twitterMessage,
        [TWITTER_ID],
        imageId,
        scheduledDate
      );
      publishedPostIds.push(postId3);

    } catch (error: any) {
      console.error('Social publishing error:', error.message);
    }

    console.log(`✅ ${isScheduled ? 'Scheduling' : 'Publication'} completed!`);

    return NextResponse.json({
      success: true,
      data: {
        curiosityId: curiosity.id,
        socialPostIds: publishedPostIds,
        imageId,
        platforms: ['Facebook', 'LinkedIn', 'Instagram', 'Twitter'],
        scheduled: isScheduled,
        scheduledDate: scheduledDate || null
      }
    });

  } catch (error: any) {
    console.error('[Publish Curiosity] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante pubblicazione' },
      { status: 500 }
    );
  }
}
