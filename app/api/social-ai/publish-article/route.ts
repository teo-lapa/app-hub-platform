import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per pubblicazione completa

/**
 * POST /api/social-ai/publish-article
 *
 * PUBBLICAZIONE AUTOMATICA ARTICOLO MULTILINGUA
 * USA LA SESSIONE DELL'UTENTE LOGGATO (come tutte le altre app)
 *
 * 1. Traduce articolo in 4 lingue (IT, DE, FR, EN)
 * 2. Carica immagini su Odoo
 * 3. Crea blog post con traduzioni
 * 4. Pubblica post social sui vari canali
 */

interface ArticleSection {
  title: string;
  content: string;
}

interface ArticleData {
  title: string;
  subtitle: string;
  introduction: string;
  sections: ArticleSection[];
  conclusion: string;
  seoKeywords: string[];
  socialSuggestions: {
    instagram: string;
    facebook: string;
    linkedin: string;
    hashtags: string[];
  };
}

interface PublishArticleRequest {
  articleData: ArticleData;
  articleImage: string; // base64
  productName?: string;
  productImage?: string; // base64
  scheduledDate?: string; // Formato: "YYYY-MM-DD HH:MM:SS"
}

// Helper per delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sanitizza il nome del file per renderlo sicuro per le API social (Instagram, Twitter, etc.)
 * Rimuove caratteri speciali che causano errori di upload
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]/g, '-') // Sostituisce tutto ciò che non è alfanumerico con -
    .replace(/-+/g, '-')        // Rimuove trattini multipli
    .replace(/^-|-$/g, '')      // Rimuove trattini iniziali/finali
    .substring(0, 50);          // Limita a 50 caratteri
}

// ==========================================
// TRADUZIONE MULTILINGUA
// ==========================================

async function translateArticle(ai: GoogleGenAI, articleData: ArticleData, targetLang: string) {
  const langNames: Record<string, string> = {
    'it_IT': 'Italiano',
    'de_CH': 'Tedesco (Svizzera)',
    'fr_CH': 'Francese (Svizzera)',
    'en_US': 'Inglese'
  };

  const prompt = `Traduci questo articolo in ${langNames[targetLang]}. MANTIENI LA STRUTTURA JSON ESATTA.

ARTICOLO ORIGINALE:
${JSON.stringify(articleData, null, 2)}

REGOLE:
- Traduci TUTTI i testi: title, subtitle, introduction, sections (title e content), conclusion, socialSuggestions
- NON tradurre: seoKeywords (mantieni in italiano per SEO)
- Mantieni formattazione e punteggiatura originale
- Per Tedesco/Francese: usa variante Svizzera
- Adatta gli hashtag alla lingua target

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

/**
 * Genera un access_token casuale per gli attachment Odoo
 * Necessario per rendere le immagini accessibili pubblicamente a Instagram/Facebook API
 */
function generateAccessToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ==========================================
// UPLOAD IMMAGINE SU ODOO
// ==========================================

async function uploadImageToOdoo(
  odooCookies: string,
  imageBase64: string,
  filename: string,
  forSocial: boolean = false
): Promise<number> {
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  let mimetype = mimeMatch ? mimeMatch[1] : 'image/png';

  let cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  if (forSocial && mimetype !== 'image/jpeg') {
    console.log(`  ⚠️ Image is ${mimetype}, setting JPEG mimetype for Instagram compatibility`);
    mimetype = 'image/jpeg';
    filename = filename.replace(/\.(png|webp|gif)$/i, '.jpg');
  }

  // Genera access_token per Instagram/Facebook API (solo per social posts)
  const accessToken = forSocial ? generateAccessToken() : undefined;

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
      access_token: accessToken,  // ✅ FIX: Token per accesso pubblico Instagram
      res_model: forSocial ? 'social.post' : 'blog.post',
      res_id: 0
    }]
  );

  if (!attachmentId) {
    throw new Error('Failed to upload image to Odoo');
  }

  return attachmentId;
}

// ==========================================
// GENERA HTML BLOG ARTICOLO
// ==========================================

function generateArticleBlogHTML(articleData: ArticleData): string {
  const sectionsHTML = articleData.sections
    .map((section: ArticleSection) => `
<h2>${section.title}</h2>
<p>${section.content.replace(/\n/g, '</p><p>')}</p>
`)
    .join('\n');

  return `
<div class="article-header">
  <p class="lead">${articleData.introduction.replace(/\n/g, '</p><p>')}</p>
</div>

${sectionsHTML}

<div class="article-conclusion" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-top: 40px;">
  <h3>🎯 Conclusione</h3>
  <p>${articleData.conclusion.replace(/\n/g, '</p><p>')}</p>
  <a href="https://www.lapa.ch" class="btn btn-light btn-lg" style="margin-top: 15px;">Scopri il Catalogo LAPA</a>
</div>
`;
}

// ==========================================
// CREA BLOG POST CON TRADUZIONI
// ==========================================

async function createBlogPostWithTranslations(
  odooCookies: string,
  translations: Record<string, ArticleData>,
  articleImageId: number
): Promise<number> {
  const italianArticle = translations['it_IT'];
  const htmlContentIT = generateArticleBlogHTML(italianArticle);

  const seoMetaTitle = `${italianArticle.title} | LAPA`;
  const seoMetaDescription = `${italianArticle.introduction.substring(0, 140)}...`;
  const seoKeywords = italianArticle.seoKeywords.join(', ');

  const postId = await callOdoo(
    odooCookies,
    'blog.post',
    'create',
    [{
      name: italianArticle.title,
      blog_id: 4, // LAPABlog
      subtitle: italianArticle.subtitle,
      content: htmlContentIT,
      website_published: true,
      is_published: true,
      is_seo_optimized: true,
      website_meta_title: seoMetaTitle,
      website_meta_description: seoMetaDescription,
      website_meta_keywords: seoKeywords,
      seo_name: italianArticle.title.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      cover_properties: JSON.stringify({
        'background-image': `url(/web/image/${articleImageId})`,
        'background_color_class': 'o_cc3 o_cc',
        'background_color_style': '',
        'opacity': '0.2',
        'resize_class': 'o_half_screen_height o_record_has_cover',
        'text_align_class': ''
      }),
      tag_ids: [[6, 0, [1]]] // Tag: "Articolo" (ID 1)
    }],
    { context: { lang: 'it_IT' } }
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
    [[articleImageId], {
      res_id: postId,
      res_model: 'blog.post',
      public: true
    }]
  );

  // ==========================================
  // TRADUZIONI BLOG (METODO DIRETTO)
  // ==========================================

  const langCodes = ['de_CH', 'fr_CH', 'en_US'];

  for (const langCode of langCodes) {
    const translatedArticle = translations[langCode];
    if (!translatedArticle) continue;

    try {
      // Genera HTML tradotto completo
      const translatedHTML = generateArticleBlogHTML(translatedArticle);

      // Scrivi TUTTI i campi tradotti in un'unica chiamata
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [[postId], {
          name: translatedArticle.title,
          subtitle: translatedArticle.subtitle,
          content: translatedHTML
        }],
        { context: { lang: langCode } }
      );

      console.log(`  ✅ Traduzione ${langCode}: titolo, sottotitolo e contenuto completo`);

    } catch (translationError: any) {
      console.error(`  ❌ Impossibile aggiungere traduzione ${langCode}:`, translationError.message);
    }
  }

  return postId;
}

// ==========================================
// HELPER: Trova traduzione per un segmento
// ==========================================

function findArticleTranslationForSegment(
  italianText: string,
  italianArticle: ArticleData,
  translatedArticle: ArticleData
): string | null {
  const cleanText = italianText.trim();

  // Mappa diretta
  const directMappings: Record<string, string> = {
    [italianArticle.title]: translatedArticle.title,
    [italianArticle.subtitle]: translatedArticle.subtitle,
    [italianArticle.introduction]: translatedArticle.introduction,
    [italianArticle.conclusion]: translatedArticle.conclusion,
  };

  if (directMappings[cleanText]) {
    return directMappings[cleanText];
  }

  // Controlla sezioni
  for (let i = 0; i < (italianArticle.sections?.length || 0); i++) {
    if (cleanText === italianArticle.sections[i].title && translatedArticle.sections?.[i]) {
      return translatedArticle.sections[i].title;
    }
    if (cleanText === italianArticle.sections[i].content && translatedArticle.sections?.[i]) {
      return translatedArticle.sections[i].content;
    }
  }

  // Testi statici
  const staticTranslations: Record<string, Record<string, string>> = {
    'Conclusione': { de_CH: 'Fazit', fr_CH: 'Conclusion', en_US: 'Conclusion' },
    '🎯 Conclusione': { de_CH: '🎯 Fazit', fr_CH: '🎯 Conclusion', en_US: '🎯 Conclusion' },
    'Scopri il Catalogo LAPA': {
      de_CH: 'Entdecken Sie den LAPA Katalog',
      fr_CH: 'Découvrez le Catalogue LAPA',
      en_US: 'Discover the LAPA Catalog'
    },
  };

  for (const [italian, translations] of Object.entries(staticTranslations)) {
    if (cleanText === italian) {
      const langCode = Object.keys(translations).find(lang => translations[lang]);
      if (langCode) {
        return translations[langCode as keyof typeof translations];
      }
    }
  }

  return null;
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
  imageId?: number,
  scheduledDate?: string
): Promise<number> {
  const postValues: Record<string, any> = {
    message: message,
    account_ids: [[6, 0, accountIds]],
  };

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

  if (scheduledDate) {
    console.log(`  📅 Social post ${postId} programmato per ${scheduledDate}`);
    return postId;
  }

  // INSTAGRAM FIX: Aspetta che Instagram processi l'immagine allegata
  const INSTAGRAM_ACCOUNT_ID = 4;
  const isInstagram = accountIds.includes(INSTAGRAM_ACCOUNT_ID);
  const initialDelay = isInstagram ? 12000 : 3000;
  console.log(`  ⏳ Waiting ${initialDelay/1000}s for media processing...`);
  await delay(initialDelay);

  // Pubblica con retry e reset stato per Instagram
  let published = false;
  for (let attempt = 1; attempt <= 3 && !published; attempt++) {
    try {
      // Reset social.live.post state before retry (Instagram gets stuck in "failed")
      if (isInstagram && attempt > 1) {
        try {
          const livePosts = await callOdoo(
            odooCookies, 'social.live.post', 'search_read',
            [[['post_id', '=', postId], ['account_id', '=', INSTAGRAM_ACCOUNT_ID]]],
            { fields: ['id', 'state'] }
          );
          if (livePosts?.[0]?.state === 'failed') {
            console.log(`  🔧 Resetting live_post ${livePosts[0].id} from "failed" to "ready"...`);
            await callOdoo(odooCookies, 'social.live.post', 'write',
              [[livePosts[0].id], { state: 'ready', failure_reason: false }]);
          }
        } catch (resetErr: any) {
          console.warn(`  ⚠️ Reset live_post error:`, resetErr.message);
        }
      }

      await callOdoo(odooCookies, 'social.post', 'action_post', [[postId]]);

      // Verify Instagram actually published
      if (isInstagram) {
        await delay(3000);
        const livePostsAfter = await callOdoo(
          odooCookies, 'social.live.post', 'search_read',
          [[['post_id', '=', postId], ['account_id', '=', INSTAGRAM_ACCOUNT_ID]]],
          { fields: ['id', 'state', 'instagram_post_id'] }
        );
        if (livePostsAfter?.[0]?.state === 'posted' && livePostsAfter[0].instagram_post_id) {
          console.log(`  ✅ Social post ${postId} pubblicato (IG ID: ${livePostsAfter[0].instagram_post_id})`);
          published = true;
        } else if (livePostsAfter?.[0]?.state === 'failed') {
          throw new Error('Live post in stato failed');
        } else {
          published = true;
        }
      } else {
        console.log(`  ✅ Social post ${postId} pubblicato`);
        published = true;
      }
    } catch (publishError: any) {
      console.warn(`  ⚠️ action_post attempt ${attempt}/3 failed:`, publishError.message);
      if (attempt < 3) {
        const retryDelay = isInstagram ? (attempt + 1) * 4000 : 2000;
        console.log(`  ⏳ Waiting ${retryDelay/1000}s before retry...`);
        await delay(retryDelay);
      }
    }
  }

  return postId;
}

// ==========================================
// MAIN HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const { articleData, articleImage, productName, productImage, scheduledDate } = await request.json() as PublishArticleRequest;

    if (!articleData || !articleImage) {
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
    const isScheduled = !!scheduledDate;

    console.log(`[Publish Article] Starting ${isScheduled ? 'scheduling' : 'publication'} process...`);

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

    const safeFileName = sanitizeFileName(articleData.title);

    const articleImageId = await uploadImageToOdoo(
      odooCookies,
      articleImage,
      `${safeFileName}-article.jpg`,
      false
    );

    const socialImageId = await uploadImageToOdoo(
      odooCookies,
      articleImage,
      `${safeFileName}-social.jpg`,
      true
    );

    console.log(`✅ Images uploaded: article=${articleImageId}, social=${socialImageId}`);

    // TRADUZIONI
    console.log('[3/6] Translating article to 4 languages...');

    const languages = [
      { code: 'it_IT', name: 'Italiano' },
      { code: 'de_CH', name: 'Tedesco' },
      { code: 'fr_CH', name: 'Francese' },
      { code: 'en_US', name: 'Inglese' }
    ];

    const translations: Record<string, ArticleData> = {
      'it_IT': articleData
    };

    for (const lang of languages.slice(1)) {
      console.log(`  Translating to ${lang.name}...`);
      translations[lang.code] = await translateArticle(ai, articleData, lang.code);
    }

    console.log('✅ All translations completed!');

    // CREAZIONE BLOG POST
    console.log('[4/6] Creating blog post with translations...');

    const postId = await createBlogPostWithTranslations(
      odooCookies,
      translations,
      articleImageId
    );

    const blogPostUrl = await getBlogPostUrl(odooCookies, postId);
    console.log(`  📍 URL: ${blogPostUrl}`);

    // SOCIAL POSTS
    console.log('[5/6] Publishing to social media...');

    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;

    const publishedPostIds: number[] = [];

    try {
      // Facebook
      console.log(`  📘 ${isScheduled ? 'Scheduling' : 'Publishing'} to Facebook...`);
      const facebookMessage = `${articleData.socialSuggestions.facebook}\n\n👉 ${blogPostUrl}\n\n${articleData.socialSuggestions.hashtags.slice(0, 5).join(' ')}`;
      const postId1 = await createSocialPost(
        odooCookies,
        facebookMessage,
        [FACEBOOK_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId1);

      await delay(2000);

      // LinkedIn
      console.log(`  💼 ${isScheduled ? 'Scheduling' : 'Publishing'} to LinkedIn...`);
      const linkedinMessage = `${articleData.socialSuggestions.linkedin}\n\n🔗 ${blogPostUrl}\n\n${articleData.socialSuggestions.hashtags.slice(0, 3).join(' ')}`;
      const postId2 = await createSocialPost(
        odooCookies,
        linkedinMessage,
        [LINKEDIN_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId2);

      await delay(2000);

      // Instagram (senza link)
      console.log(`  📸 ${isScheduled ? 'Scheduling' : 'Publishing'} to Instagram...`);
      const instagramMessage = `${articleData.socialSuggestions.instagram}\n\n🔗 Link in bio!\n\n${articleData.socialSuggestions.hashtags.join(' ')}`;
      const postId3 = await createSocialPost(
        odooCookies,
        instagramMessage,
        [INSTAGRAM_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId3);

      await delay(2000);

      // Twitter
      console.log(`  🐦 ${isScheduled ? 'Scheduling' : 'Publishing'} to Twitter...`);
      let twitterMessage = `${articleData.title.substring(0, 100)}\n\n👉 ${blogPostUrl}\n\n${articleData.socialSuggestions.hashtags.slice(0, 2).join(' ')}`;
      if (twitterMessage.length > 280) {
        twitterMessage = `${articleData.title.substring(0, 80)}...\n\n👉 ${blogPostUrl}`;
      }
      const postId4 = await createSocialPost(
        odooCookies,
        twitterMessage,
        [TWITTER_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId4);

    } catch (error: any) {
      console.error('Social publishing error:', error.message);
    }

    console.log(`✅ ${isScheduled ? 'Scheduling' : 'Publication'} completed!`);

    return NextResponse.json({
      success: true,
      data: {
        blogPostId: postId,
        blogPostUrl,
        socialPostIds: publishedPostIds,
        translations: Object.keys(translations),
        scheduled: isScheduled,
        scheduledDate: scheduledDate || null
      }
    });

  } catch (error: any) {
    console.error('[Publish Article] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante pubblicazione' },
      { status: 500 }
    );
  }
}
