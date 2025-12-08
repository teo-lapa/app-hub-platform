import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per pubblicazione completa

/**
 * POST /api/social-ai/publish-story
 *
 * PUBBLICAZIONE AUTOMATICA STORIA PRODOTTO MULTILINGUA
 * USA LA SESSIONE DELL'UTENTE LOGGATO (come tutte le altre app)
 *
 * 1. Traduce storia in 4 lingue (IT, DE, FR, EN)
 * 2. Carica immagini su Odoo
 * 3. Crea blog post con traduzioni
 * 4. Genera post social abbreviati
 * 5. Pubblica su Odoo Social Stream
 */

interface StoryData {
  title: string;
  subtitle: string;
  introduction: string;
  origin: {
    region: string;
    history: string;
    year?: string;
  };
  tradition: {
    description: string;
    culturalSignificance: string;
  };
  production: {
    method: string;
    uniqueCharacteristics: string[];
  };
  certification?: {
    type: string;
    description: string;
  };
  curiosities: string[];
  pairings: string[];
  quote?: string;
}

interface PublishStoryRequest {
  storyData: StoryData;
  productName: string;
  productImage: string; // base64
  storyImage: string; // base64
}

// Helper per delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// TRADUZIONE MULTILINGUA
// ==========================================

async function translateStory(ai: GoogleGenAI, storyData: StoryData, targetLang: string) {
  const langNames: Record<string, string> = {
    'it_IT': 'Italiano',
    'de_CH': 'Tedesco (Svizzera)',
    'fr_CH': 'Francese (Svizzera)',
    'en_US': 'Inglese'
  };

  const prompt = `Traduci questa storia di prodotto in ${langNames[targetLang]}. MANTIENI LA STRUTTURA JSON ESATTA.

STORIA ORIGINALE:
${JSON.stringify(storyData, null, 2)}

REGOLE:
- Traduci TUTTI i testi: title, subtitle, introduction, origin.history, tradition.description, tradition.culturalSignificance, production.method, certification.description, curiosities, pairings, quote
- NON tradurre: origin.region, origin.year, certification.type, production.uniqueCharacteristics (questi sono termini tecnici)
- Mantieni formattazione e punteggiatura originale
- Per Tedesco/Francese: usa variante Svizzera

Rispondi SOLO con JSON valido (no markdown):`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ text: prompt }]
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error('Traduzione fallita');
  }

  let translatedText = rawText.trim();
  translatedText = translatedText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');

  return JSON.parse(translatedText);
}

// ==========================================
// UPLOAD IMMAGINE SU ODOO
// ==========================================

async function uploadImageToOdoo(
  odooCookies: string,
  imageBase64: string,
  filename: string
): Promise<number> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const attachmentId = await callOdoo(
    odooCookies,
    'ir.attachment',
    'create',
    [{
      name: filename,
      type: 'binary',
      datas: cleanBase64,
      public: true,
      res_model: 'blog.post',
      res_id: 0
    }]
  );

  if (!attachmentId) {
    throw new Error('Failed to upload image to Odoo');
  }

  return attachmentId;
}

// ==========================================
// GENERA HTML BLOG STORIA
// ==========================================

function generateStoryBlogHTML(storyData: StoryData, productName: string): string {
  const characteristicsList = storyData.production.uniqueCharacteristics
    .map((char: string) => `<li>${char}</li>`)
    .join('');

  const curiositiesList = storyData.curiosities
    .map((cur: string) => `<li>${cur}</li>`)
    .join('');

  const pairingsList = storyData.pairings
    .map((pair: string) => `<li>${pair}</li>`)
    .join('');

  const certificationSection = storyData.certification && storyData.certification.type !== 'Nessuna'
    ? `<div class="certification-box" style="background: linear-gradient(135deg, #ffd700 0%, #ffed4a 100%); padding: 20px; border-radius: 10px; margin: 30px 0;">
        <h3>🏅 Certificazione ${storyData.certification.type}</h3>
        <p>${storyData.certification.description}</p>
      </div>`
    : '';

  const quoteSection = storyData.quote
    ? `<blockquote style="font-style: italic; border-left: 4px solid #ff6b35; padding-left: 20px; margin: 30px 0; font-size: 1.2em;">
        "${storyData.quote}"
      </blockquote>`
    : '';

  return `
<div class="story-header">
  <p class="lead">${storyData.introduction}</p>
</div>

${quoteSection}

<div class="origin-section" style="background: #f8f9fa; padding: 20px; border-left: 4px solid #28a745; margin: 30px 0;">
  <h2>📍 Origine e Storia</h2>
  <p><strong>Regione:</strong> ${storyData.origin.region}</p>
  ${storyData.origin.year ? `<p><strong>Periodo:</strong> ${storyData.origin.year}</p>` : ''}
  <p>${storyData.origin.history}</p>
</div>

<h2>🏛️ Tradizione</h2>
<p>${storyData.tradition.description}</p>
<p><em>${storyData.tradition.culturalSignificance}</em></p>

${certificationSection}

<h2>⚙️ Produzione</h2>
<p>${storyData.production.method}</p>
<h4>Caratteristiche Uniche:</h4>
<ul>
  ${characteristicsList}
</ul>

<h2>💡 Lo Sapevi Che...</h2>
<ul class="curiosities-list">
  ${curiositiesList}
</ul>

<h2>🍽️ Abbinamenti Consigliati</h2>
<ul class="pairings-list">
  ${pairingsList}
</ul>

<div class="product-cta" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-top: 40px;">
  <h3>🛍️ Scopri ${productName}</h3>
  <p>Questo prodotto è disponibile nel nostro catalogo!</p>
  <a href="https://www.lapa.ch" class="btn btn-light btn-lg" style="margin-top: 15px;">Scopri il Catalogo LAPA</a>
</div>
`;
}

// ==========================================
// CREA BLOG POST CON TRADUZIONI
// ==========================================

async function createBlogPostWithTranslations(
  odooCookies: string,
  translations: Record<string, StoryData>,
  productName: string,
  storyImageId: number
): Promise<number> {
  const italianStory = translations['it_IT'];
  const htmlContentIT = generateStoryBlogHTML(italianStory, productName);

  // Crea post blog in italiano (lingua base)
  const postId = await callOdoo(
    odooCookies,
    'blog.post',
    'create',
    [{
      name: italianStory.title,
      blog_id: 4, // LAPABlog
      subtitle: italianStory.subtitle,
      content: htmlContentIT,
      website_published: true,
      cover_properties: JSON.stringify({
        'background-image': `url(/web/image/${storyImageId})`,
        'background_color_class': 'o_cc3 o_cc',
        'background_color_style': '',
        'opacity': '0.2',
        'resize_class': 'o_half_screen_height o_record_has_cover',
        'text_align_class': ''
      }),
      tag_ids: [[6, 0, []]]
    }]
  );

  if (!postId) {
    throw new Error('Failed to create blog post');
  }

  console.log(`  ✅ Blog post base creato (IT): ${postId}`);

  // Aggiorna attachment
  await callOdoo(
    odooCookies,
    'ir.attachment',
    'write',
    [[storyImageId], {
      res_id: postId,
      res_model: 'blog.post',
      public: true
    }]
  );

  // Aggiungi traduzioni
  const langCodes = ['de_CH', 'fr_CH', 'en_US'];

  for (const langCode of langCodes) {
    const translatedStory = translations[langCode];
    if (!translatedStory) continue;

    const htmlContentTranslated = generateStoryBlogHTML(translatedStory, productName);

    try {
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [
          [postId],
          {
            name: translatedStory.title,
            subtitle: translatedStory.subtitle,
            content: htmlContentTranslated
          }
        ],
        { context: { lang: langCode } }
      );
      console.log(`  ✅ Traduzione ${langCode} aggiunta`);
    } catch (translationError: any) {
      console.error(`  ❌ Impossibile aggiungere traduzione ${langCode}:`, translationError.message);
    }
  }

  return postId;
}

// ==========================================
// LEGGI URL BLOG POST
// ==========================================

async function getBlogPostUrl(odooCookies: string, postId: number): Promise<string> {
  await delay(1000);

  const postData = await callOdoo(
    odooCookies,
    'blog.post',
    'read',
    [[postId], ['website_url', 'name']]
  );

  if (!postData || !Array.isArray(postData) || postData.length === 0) {
    throw new Error('Failed to read blog post URL');
  }

  const websiteUrl = postData[0].website_url;

  if (!websiteUrl) {
    return `https://www.lapa.ch/blog/lapablog-4/${postId}`;
  }

  return `https://www.lapa.ch${websiteUrl}`;
}

// ==========================================
// CREA SOCIAL POST
// ==========================================

async function createSocialPost(
  odooCookies: string,
  message: string,
  accountIds: number[],
  imageId?: number
): Promise<number> {
  const postValues: Record<string, any> = {
    message: message,
    account_ids: [[6, 0, accountIds]],
    post_method: 'now'
  };

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

  try {
    await callOdoo(
      odooCookies,
      'social.post',
      'action_post',
      [[postId]]
    );
    console.log(`  ✅ Social post ${postId} pubblicato`);
  } catch (publishError: any) {
    console.warn(`  ⚠️ action_post fallito per ${postId}:`, publishError.message);
  }

  return postId;
}

// ==========================================
// MAIN HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const { storyData, productName, productImage, storyImage } = await request.json() as PublishStoryRequest;

    if (!storyData || !productName || !productImage || !storyImage) {
      return NextResponse.json(
        { success: false, error: 'Dati mancanti' },
        { status: 400 }
      );
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    console.log('[Publish Story] Starting publication process...');

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

    // UPLOAD IMMAGINI
    console.log('[2/6] Uploading images to Odoo...');

    const productImageId = await uploadImageToOdoo(
      odooCookies,
      productImage,
      `${productName}-product.jpg`
    );

    const storyImageId = await uploadImageToOdoo(
      odooCookies,
      storyImage,
      `${storyData.title}-story.jpg`
    );

    console.log(`✅ Images uploaded: product=${productImageId}, story=${storyImageId}`);

    // TRADUZIONI
    console.log('[3/6] Translating story to 4 languages...');

    const languages = [
      { code: 'it_IT', name: 'Italiano' },
      { code: 'de_CH', name: 'Tedesco' },
      { code: 'fr_CH', name: 'Francese' },
      { code: 'en_US', name: 'Inglese' }
    ];

    const translations: Record<string, StoryData> = {
      'it_IT': storyData
    };

    for (const lang of languages.slice(1)) {
      console.log(`  Translating to ${lang.name}...`);
      translations[lang.code] = await translateStory(ai, storyData, lang.code);
    }

    console.log('✅ All translations completed!');

    // CREAZIONE BLOG POST
    console.log('[4/6] Creating blog post with translations...');

    const postId = await createBlogPostWithTranslations(
      odooCookies,
      translations,
      productName,
      storyImageId
    );

    const blogPostUrl = await getBlogPostUrl(odooCookies, postId);
    console.log(`  📍 URL: ${blogPostUrl}`);

    const blogPostUrls: Record<string, string> = {
      'it_IT': blogPostUrl,
      'de_CH': blogPostUrl.replace('/blog/', '/de_CH/blog/'),
      'fr_CH': blogPostUrl.replace('/blog/', '/fr_CH/blog/'),
      'en_US': blogPostUrl.replace('/blog/', '/en_US/blog/')
    };

    // SOCIAL POSTS
    console.log('[5/6] Generating social media posts...');

    const socialPosts: Record<string, string> = {};

    for (const lang of languages) {
      const story = translations[lang.code];
      const blogUrl = blogPostUrls[lang.code];

      socialPosts[lang.code] = `${story.title}

${story.introduction.substring(0, 100)}...

📍 ${story.origin.region}
${story.certification?.type && story.certification.type !== 'Nessuna' ? `🏅 ${story.certification.type}` : ''}

👉 Leggi la storia completa: ${blogUrl}

#LAPA #ItalianFood #Tradizione${story.origin.region.replace(/[^a-zA-Z]/g, '')}`;
    }

    // PUBBLICAZIONE SOCIAL
    console.log('[6/6] Publishing to social media...');

    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;

    const socialCaption = socialPosts['it_IT'];
    const publishedPostIds: number[] = [];

    try {
      // Facebook e LinkedIn
      const postId1 = await createSocialPost(
        odooCookies,
        socialCaption,
        [FACEBOOK_ID, LINKEDIN_ID],
        storyImageId
      );
      publishedPostIds.push(postId1);

      await delay(3000);

      // Instagram (senza link)
      const igStory = translations['it_IT'];
      const instagramMessage = `${igStory.title}

${igStory.introduction}

📍 ${igStory.origin.region}
${igStory.certification?.type && igStory.certification.type !== 'Nessuna' ? `🏅 Certificazione ${igStory.certification.type}` : ''}

🔗 Storia completa in bio!

#LAPA #ItalianFood #Tradizione #FoodHistory #MadeInItaly #FoodCulture`;

      const postId2 = await createSocialPost(
        odooCookies,
        instagramMessage,
        [INSTAGRAM_ID],
        storyImageId
      );
      publishedPostIds.push(postId2);

      // Twitter
      const blogUrl = blogPostUrls['it_IT'];
      let twitterMessage = `${igStory.title}

📍 ${igStory.origin.region}

👉 ${blogUrl}

#LAPA #ItalianFood`;

      if (twitterMessage.length > 280) {
        twitterMessage = `${igStory.title.substring(0, 100)}...

👉 ${blogUrl}

#LAPA`;
      }

      const postId3 = await createSocialPost(
        odooCookies,
        twitterMessage,
        [TWITTER_ID],
        storyImageId
      );
      publishedPostIds.push(postId3);

    } catch (error: any) {
      console.error('Social publishing error:', error.message);
    }

    console.log('✅ Publication completed!');

    return NextResponse.json({
      success: true,
      data: {
        blogPostId: postId,
        blogPostUrl,
        socialPostIds: publishedPostIds,
        translations: Object.keys(translations)
      }
    });

  } catch (error: any) {
    console.error('[Publish Story] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante pubblicazione' },
      { status: 500 }
    );
  }
}
