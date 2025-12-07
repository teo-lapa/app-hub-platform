import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per pubblicazione completa

/**
 * POST /api/social-ai/publish-recipe
 *
 * PUBBLICAZIONE AUTOMATICA RICETTA MULTILINGUA
 * USA LA SESSIONE DELL'UTENTE LOGGATO (come tutte le altre app)
 *
 * 1. Traduce ricetta in 4 lingue (IT, DE, FR, EN)
 * 2. Carica immagini su Odoo
 * 3. Crea 4 blog post (uno per lingua)
 * 4. Genera post social abbreviati
 * 5. Pubblica su Odoo Social Stream
 */

interface PublishRecipeRequest {
  recipeData: {
    title: string;
    description: string;
    region: string;
    tradition: string;
    ingredients: { item: string; quantity: string }[];
    steps: string[];
    prepTime: string;
    cookTime: string;
    servings: string;
    difficulty: string;
    tips: string[];
  };
  productName: string;
  productImage: string; // base64
  recipeImage: string; // base64
  sources?: { title: string; url: string }[];
}

interface OdooAttachment {
  id: number;
  name: string;
  datas: string; // base64
  res_model: string;
  res_id: number;
  public: boolean;
}

// ==========================================
// TRADUZIONE MULTILINGUA
// ==========================================

async function translateRecipe(ai: GoogleGenAI, recipeData: any, targetLang: string) {
  const langNames: Record<string, string> = {
    'it_IT': 'Italiano',
    'de_CH': 'Tedesco (Svizzera)',
    'fr_CH': 'Francese (Svizzera)',
    'en_US': 'Inglese'
  };

  const prompt = `Traduci questa ricetta in ${langNames[targetLang]}. MANTIENI LA STRUTTURA JSON ESATTA.

RICETTA ORIGINALE:
${JSON.stringify(recipeData, null, 2)}

REGOLE:
- Traduci TUTTI i testi: title, description, tradition, ingredients.item, steps, tips
- NON tradurre: quantities, prepTime, cookTime, servings, difficulty, region
- Mantieni formattazione e punteggiatura originale
- Per Tedesco/Francese: usa variante Svizzera (es: "Teigwaren" non "Nudeln")

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

  // Rimuovi prefisso data:image se presente
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // Usa callOdoo con sessione utente loggato
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
      res_id: 0 // Verrà aggiornato dopo
    }]
  );

  if (!attachmentId) {
    throw new Error('Failed to upload image to Odoo');
  }

  return attachmentId;
}

// ==========================================
// CREA BLOG POST SU ODOO
// ==========================================

async function createBlogPost(
  odooCookies: string,
  recipeData: any,
  productName: string,
  productImageId: number,
  recipeImageId: number,
  langCode: string,
  sources?: { title: string; url: string }[]
): Promise<number> {

  // Genera HTML contenuto blog
  const htmlContent = generateBlogHTML(recipeData, productName, sources);

  // Crea post blog usando callOdoo
  const postId = await callOdoo(
    odooCookies,
    'blog.post',
    'create',
    [{
      name: recipeData.title,
      blog_id: 4, // LAPABlog
      subtitle: recipeData.description,
      content: htmlContent,
      website_published: true,
      cover_image_id: recipeImageId, // ID immagine cover
      cover_properties: JSON.stringify({
        background_image: `/web/image/${recipeImageId}`,
        opacity: 0.4,
        resize_class: 'cover'
      }),
      tag_ids: [[6, 0, []]] // Tags vuoti per ora
    }]
  );

  if (!postId) {
    throw new Error('Failed to create blog post');
  }

  // Aggiorna attachment con res_id
  await callOdoo(
    odooCookies,
    'ir.attachment',
    'write',
    [[productImageId, recipeImageId], { res_id: postId }]
  );

  return postId;
}

// ==========================================
// LEGGI URL BLOG POST DA ODOO
// ==========================================

async function getBlogPostUrl(
  odooCookies: string,
  postId: number
): Promise<string> {
  // Leggi il campo website_url dal blog post creato
  const postData = await callOdoo(
    odooCookies,
    'blog.post',
    'read',
    [[postId], ['website_url']]
  );

  if (!postData || !Array.isArray(postData) || postData.length === 0) {
    throw new Error('Failed to read blog post URL');
  }

  const websiteUrl = postData[0].website_url;

  if (!websiteUrl) {
    throw new Error('Blog post has no website_url');
  }

  // Odoo restituisce URL relativo, aggiungi dominio
  return `https://www.lapa.ch${websiteUrl}`;
}

// ==========================================
// CREA SOCIAL POST SU ODOO
// ==========================================

async function createSocialPost(
  odooCookies: string,
  message: string,
  accountIds: number[],
  imageId?: number
): Promise<number> {
  // Prepara valori del post
  const postValues: Record<string, any> = {
    message: message,
    account_ids: [[6, 0, accountIds]],
    post_method: 'now' // Pubblica immediatamente
  };

  // Aggiungi immagine se presente
  if (imageId) {
    postValues.image_ids = [[6, 0, [imageId]]];
  }

  // Crea social.post usando callOdoo
  const postId = await callOdoo(
    odooCookies,
    'social.post',
    'create',
    [postValues]
  );

  if (!postId) {
    throw new Error('Failed to create social post');
  }

  // Pubblica immediatamente con action_post
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
    // Il post è comunque creato, solo non pubblicato automaticamente
  }

  return postId;
}

// ==========================================
// GENERA HTML BLOG
// ==========================================

function generateBlogHTML(recipeData: any, productName: string, sources?: { title: string; url: string }[]): string {
  const ingredientsList = recipeData.ingredients
    .map((ing: any) => `<li><strong>${ing.quantity}</strong> ${ing.item}</li>`)
    .join('');

  const stepsList = recipeData.steps
    .map((step: string, idx: number) => `<li><strong>Passo ${idx + 1}:</strong> ${step}</li>`)
    .join('');

  const tipsList = recipeData.tips && recipeData.tips.length > 0
    ? `<h3>💡 Consigli dello Chef</h3><ul>${recipeData.tips.map((tip: string) => `<li>${tip}</li>`).join('')}</ul>`
    : '';

  const sourcesList = sources && sources.length > 0
    ? `<h3>📚 Fonti</h3><ul>${sources.map(s => `<li><a href="${s.url}" target="_blank">${s.title}</a></li>`).join('')}</ul>`
    : '';

  return `
<div class="recipe-header">
  <p class="lead">${recipeData.description}</p>
  <div class="recipe-meta">
    <span>📍 <strong>Regione:</strong> ${recipeData.region}</span> |
    <span>⏱️ <strong>Preparazione:</strong> ${recipeData.prepTime}</span> |
    <span>🔥 <strong>Cottura:</strong> ${recipeData.cookTime}</span> |
    <span>🍽️ <strong>Porzioni:</strong> ${recipeData.servings}</span> |
    <span>📊 <strong>Difficoltà:</strong> ${recipeData.difficulty}</span>
  </div>
</div>

<div class="tradition-box" style="background: #f8f9fa; padding: 20px; border-left: 4px solid #ff6b35; margin: 30px 0;">
  <h3>🏛️ Tradizione</h3>
  <p>${recipeData.tradition}</p>
</div>

<h2>🛒 Ingredienti</h2>
<ul class="ingredients-list">
  ${ingredientsList}
</ul>

<h2>👨‍🍳 Procedimento</h2>
<ol class="steps-list">
  ${stepsList}
</ol>

${tipsList}

${sourcesList}

<div class="product-cta" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-top: 40px;">
  <h3>🛍️ Ordina ${productName}</h3>
  <p>Questo prodotto è disponibile nel nostro catalogo!</p>
  <a href="https://www.lapa.ch" class="btn btn-light btn-lg" style="margin-top: 15px;">Scopri il Catalogo LAPA</a>
</div>
`;
}

// ==========================================
// MAIN HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const { recipeData, productName, productImage, recipeImage, sources } = await request.json() as PublishRecipeRequest;

    // Validazione
    if (!recipeData || !productName || !productImage || !recipeImage) {
      return NextResponse.json(
        { success: false, error: 'Dati mancanti' },
        { status: 400 }
      );
    }

    // GEMINI API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY non configurato' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    console.log('[Publish Recipe] Starting publication process...');

    // ==========================================
    // FASE 1: AUTENTICAZIONE ODOO CON UTENTE LOGGATO
    // ==========================================

    console.log('[1/7] Getting Odoo session from logged-in user...');

    // Estrai cookies dalla request (utente loggato nell'app)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        success: false,
        error: 'Devi essere loggato per pubblicare. Effettua il login.'
      }, { status: 401 });
    }

    // Ottieni sessione Odoo dell'utente loggato
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    if (!odooCookies) {
      return NextResponse.json({
        success: false,
        error: 'Sessione Odoo non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log(`✅ Odoo session obtained! User UID: ${uid}`);

    // DEBUG: Verifica quale utente è autenticato e quali gruppi ha
    try {
      const userInfo = await callOdoo(
        odooCookies,
        'res.users',
        'read',
        [[uid], ['name', 'login', 'groups_id']]
      );
      console.log(`👤 [DEBUG] Utente autenticato:`, userInfo);

      if (userInfo && userInfo[0] && userInfo[0].groups_id) {
        const groupIds = userInfo[0].groups_id;
        const groupsInfo = await callOdoo(
          odooCookies,
          'res.groups',
          'read',
          [groupIds, ['name']]
        );
        console.log(`🔐 [DEBUG] Gruppi utente:`, groupsInfo.map((g: any) => g.name));
      }
    } catch (debugError: any) {
      console.error(`❌ [DEBUG] Errore verifica utente:`, debugError.message);
    }

    // ==========================================
    // FASE 2: UPLOAD IMMAGINI
    // ==========================================

    console.log('[2/7] Uploading images to Odoo...');

    const productImageId = await uploadImageToOdoo(
      odooCookies,
      productImage,
      `${productName}-product.jpg`
    );
    console.log(`✅ Product image uploaded: ${productImageId}`);

    const recipeImageId = await uploadImageToOdoo(
      odooCookies,
      recipeImage,
      `${recipeData.title}-dish.jpg`
    );
    console.log(`✅ Recipe image uploaded: ${recipeImageId}`);

    // ==========================================
    // FASE 3: TRADUZIONI
    // ==========================================

    console.log('[3/6] Translating recipe to 4 languages...');

    const languages = [
      { code: 'it_IT', name: 'Italiano' },
      { code: 'de_CH', name: 'Tedesco' },
      { code: 'fr_CH', name: 'Francese' },
      { code: 'en_US', name: 'Inglese' }
    ];

    const translations: Record<string, any> = {
      'it_IT': recipeData // Italiano è l'originale
    };

    for (const lang of languages.slice(1)) { // Skip italiano
      console.log(`  Translating to ${lang.name}...`);
      translations[lang.code] = await translateRecipe(ai, recipeData, lang.code);
    }

    console.log('✅ All translations completed!');

    // ==========================================
    // FASE 4: CREAZIONE BLOG POSTS
    // ==========================================

    console.log('[4/6] Creating blog posts...');

    const blogPostIds: Record<string, number> = {};
    const blogPostUrls: Record<string, string> = {};

    for (const lang of languages) {
      console.log(`  Creating blog post in ${lang.name}...`);
      const translatedRecipe = translations[lang.code];

      const postId = await createBlogPost(
        odooCookies,
        translatedRecipe,
        productName,
        productImageId,
        recipeImageId,
        lang.code,
        sources
      );

      blogPostIds[lang.code] = postId;
      console.log(`  ✅ Blog post created: ${postId}`);

      // Leggi URL reale da Odoo
      const postUrl = await getBlogPostUrl(odooCookies, postId);
      blogPostUrls[lang.code] = postUrl;
      console.log(`  📍 URL: ${postUrl}`);
    }

    console.log('✅ All blog posts created!');

    // ==========================================
    // FASE 5: POST SOCIAL ABBREVIATI
    // ==========================================

    console.log('[5/6] Generating social media posts...');

    const socialPosts: Record<string, string> = {};

    for (const lang of languages) {
      const translatedRecipe = translations[lang.code];
      const blogUrl = blogPostUrls[lang.code]; // USA URL REALE da Odoo!

      // Post breve per social
      socialPosts[lang.code] = `${translatedRecipe.title}

${translatedRecipe.description.substring(0, 100)}...

📍 ${translatedRecipe.region}
⏱️ ${translatedRecipe.prepTime} | 🔥 ${translatedRecipe.cookTime}

👉 Leggi la ricetta completa: ${blogUrl}

#RecipesLAPA #ItalianFood #Cucina${translatedRecipe.region}`;
    }

    console.log('✅ Social posts generated!');

    // ==========================================
    // FASE 6: PUBBLICAZIONE SUI SOCIAL MEDIA
    // ==========================================

    console.log('[6/7] Publishing to social media directly via XML-RPC...');

    let socialPublishResults: any = null;
    const socialPublishFailures: string[] = [];

    // Account IDs social
    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;
    const OTHER_ACCOUNTS = [FACEBOOK_ID, INSTAGRAM_ID, LINKEDIN_ID]; // FB, IG, LI insieme

    // Usa il post ITALIANO per i social (UN SOLO POST sui 4 account!)
    const socialCaption = socialPosts['it_IT'];

    try {
      console.log('  Creating social post for 4 accounts (FB, IG, LI, Twitter)...');

      // POST 1: Facebook, Instagram, LinkedIn (messaggio completo)
      const postId1 = await createSocialPost(
        odooCookies,
        socialCaption,
        OTHER_ACCOUNTS,
        recipeImageId
      );

      console.log(`  ✅ Social post ${postId1} created for Facebook/Instagram/LinkedIn`);

      // POST 2: Twitter (messaggio abbreviato max 280 caratteri)
      let twitterMessage = socialCaption;
      if (twitterMessage.length > 280) {
        // Abbrevia per Twitter
        twitterMessage = twitterMessage.substring(0, 250) + '... 👉 www.lapa.ch';
      }

      const postId2 = await createSocialPost(
        odooCookies,
        twitterMessage,
        [TWITTER_ID],
        recipeImageId
      );

      console.log(`  ✅ Social post ${postId2} created for Twitter`);

      socialPublishResults = {
        success: true,
        postIds: [postId1, postId2],
        accounts: ['Facebook', 'Instagram', 'LinkedIn', 'Twitter']
      };

    } catch (error: any) {
      const errorMsg = `Social publishing failed: ${error.message}`;
      socialPublishFailures.push(errorMsg);
      console.error(`  ❌ Error publishing social posts:`, error.message);
    }

    console.log('✅ Social media publication completed!');

    // ==========================================
    // FASE 7: RISULTATO FINALE
    // ==========================================

    console.log('[7/7] Publication completed successfully!');

    // Determina successo globale: successo completo solo se non ci sono failures
    const hasFailures = socialPublishFailures.length > 0;
    const isFullSuccess = !hasFailures;

    return NextResponse.json({
      success: isFullSuccess,
      data: {
        blogPosts: blogPostIds,
        socialPosts: socialPosts,
        socialPublishResults, // Risultati pubblicazione social
        socialPublishFailures: hasFailures ? socialPublishFailures : undefined, // Include failures se presenti
        images: {
          productImageId,
          recipeImageId
        },
        translations: Object.keys(translations),
        stats: {
          totalLanguages: languages.length,
          successfulSocialPublishes: socialPublishResults ? 1 : 0, // 1 post social pubblicato (su 4 account)
          failedSocialPublishes: socialPublishFailures.length
        }
      },
      warning: hasFailures ? 'Blog posts creati ma alcune pubblicazioni social sono fallite' : undefined
    });

  } catch (error: any) {
    console.error('[Publish Recipe] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante pubblicazione'
      },
      { status: 500 }
    );
  }
}
