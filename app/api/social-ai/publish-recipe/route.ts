import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti per pubblicazione completa

/**
 * POST /api/social-ai/publish-recipe
 *
 * PUBBLICAZIONE AUTOMATICA RICETTA MULTILINGUA
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
// HELPER: Odoo XML-RPC
// ==========================================

function buildXMLRPC(methodName: string, params: any[]): string {
  const paramsXML = params.map(p => valueToXML(p)).join('');
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXML}
  </params>
</methodCall>`;
}

function valueToXML(value: any): string {
  if (value === null || value === undefined) {
    return '<param><value><boolean>0</boolean></value></param>';
  }
  if (typeof value === 'boolean') {
    return `<param><value><boolean>${value ? '1' : '0'}</boolean></value></param>`;
  }
  if (typeof value === 'number') {
    return `<param><value><int>${value}</int></value></param>`;
  }
  if (typeof value === 'string') {
    return `<param><value><string>${escapeXML(value)}</string></value></param>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<param><value><array><data>${arrayData}</data></array></value></param>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<param><value><struct>${members}</struct></value></param>`;
  }
  return '<param><value><string></string></value></param>';
}

function valueToXMLData(value: any): string {
  if (value === null || value === undefined) {
    return '<value><boolean>0</boolean></value>';
  }
  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? '1' : '0'}</boolean></value>`;
  }
  if (typeof value === 'number') {
    return `<value><int>${value}</int></value>`;
  }
  if (typeof value === 'string') {
    return `<value><string>${escapeXML(value)}</string></value>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<value><array><data>${arrayData}</data></array></value>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return '<value><string></string></value>';
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  odooUrl: string,
  odooDb: string,
  uid: number,
  password: string,
  imageBase64: string,
  filename: string
): Promise<number> {

  // Rimuovi prefisso data:image se presente
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const createAttachmentBody = buildXMLRPC('execute_kw', [
    odooDb,
    uid,
    password,
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
  ]);

  const response = await fetch(`${odooUrl}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: createAttachmentBody
  });

  const responseXML = await response.text();
  const idMatch = responseXML.match(/<int>(\d+)<\/int>/);

  if (!idMatch) {
    throw new Error('Failed to upload image to Odoo');
  }

  return parseInt(idMatch[1]);
}

// ==========================================
// CREA BLOG POST SU ODOO
// ==========================================

async function createBlogPost(
  odooUrl: string,
  odooDb: string,
  uid: number,
  password: string,
  recipeData: any,
  productName: string,
  productImageId: number,
  recipeImageId: number,
  langCode: string,
  sources?: { title: string; url: string }[]
) {

  // Genera HTML contenuto blog
  const htmlContent = generateBlogHTML(recipeData, productName, sources);

  // Crea post blog
  const createPostBody = buildXMLRPC('execute_kw', [
    odooDb,
    uid,
    password,
    'blog.post',
    'create',
    [{
      name: recipeData.title,
      blog_id: 4, // LAPABlog
      subtitle: recipeData.description,
      content: htmlContent,
      website_published: true,
      cover_properties: JSON.stringify({
        background_image: `/web/image/${recipeImageId}`,
        opacity: 0.4,
        resize_class: 'cover'
      }),
      tag_ids: [[6, 0, []]] // Tags vuoti per ora
    }]
  ]);

  const response = await fetch(`${odooUrl}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: createPostBody
  });

  const responseXML = await response.text();
  const postIdMatch = responseXML.match(/<int>(\d+)<\/int>/);

  if (!postIdMatch) {
    throw new Error('Failed to create blog post');
  }

  const postId = parseInt(postIdMatch[1]);

  // Aggiorna attachment con res_id
  const updateAttachmentBody = buildXMLRPC('execute_kw', [
    odooDb,
    uid,
    password,
    'ir.attachment',
    'write',
    [[productImageId, recipeImageId], { res_id: postId }]
  ]);

  await fetch(`${odooUrl}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: updateAttachmentBody
  });

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

    // Credenziali
    const ODOO_URL = process.env.ODOO_URL!;
    const ODOO_DB = process.env.ODOO_DB!;
    const ODOO_USERNAME = process.env.ODOO_USERNAME || 'apphubplatform@lapa.ch';
    const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'apphubplatform2025';
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
    // FASE 1: AUTENTICAZIONE ODOO
    // ==========================================

    console.log('[1/6] Authenticating with Odoo...');
    const authBody = buildXMLRPC('authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]);

    const authResponse = await fetch(`${ODOO_URL}/xmlrpc/2/common`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: authBody
    });

    const authXML = await authResponse.text();
    const uidMatch = authXML.match(/<int>(\d+)<\/int>/);

    if (!uidMatch) {
      throw new Error('Odoo authentication failed');
    }

    const uid = parseInt(uidMatch[1]);
    console.log(`✅ Authenticated! UID: ${uid}`);

    // ==========================================
    // FASE 2: UPLOAD IMMAGINI
    // ==========================================

    console.log('[2/6] Uploading images to Odoo...');

    const productImageId = await uploadImageToOdoo(
      ODOO_URL,
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
      productImage,
      `${productName}-product.jpg`
    );
    console.log(`✅ Product image uploaded: ${productImageId}`);

    const recipeImageId = await uploadImageToOdoo(
      ODOO_URL,
      ODOO_DB,
      uid,
      ODOO_PASSWORD,
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

    for (const lang of languages) {
      console.log(`  Creating blog post in ${lang.name}...`);
      const translatedRecipe = translations[lang.code];

      const postId = await createBlogPost(
        ODOO_URL,
        ODOO_DB,
        uid,
        ODOO_PASSWORD,
        translatedRecipe,
        productName,
        productImageId,
        recipeImageId,
        lang.code,
        sources
      );

      blogPostIds[lang.code] = postId;
      console.log(`  ✅ Blog post created: ${postId}`);
    }

    console.log('✅ All blog posts created!');

    // ==========================================
    // FASE 5: POST SOCIAL ABBREVIATI
    // ==========================================

    console.log('[5/6] Generating social media posts...');

    const socialPosts: Record<string, string> = {};

    for (const lang of languages) {
      const translatedRecipe = translations[lang.code];
      const blogUrl = `https://www.lapa.ch/blog/lapablog/${translatedRecipe.title.toLowerCase().replace(/\s+/g, '-')}`;

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

    console.log('[6/7] Publishing to social media via publish-to-odoo endpoint...');

    const socialPublishResults: Record<string, any> = {};
    const socialPublishFailures: string[] = [];

    // Estrai cookies dalla request originale per forwardarli a publish-to-odoo
    const userCookies = request.headers.get('cookie') || '';

    // Pubblica su Odoo usando l'endpoint esistente publish-to-odoo
    // Nota: publish-to-odoo gestisce automaticamente i 4 social (Facebook, Instagram, LinkedIn, Twitter)
    for (const lang of languages) {
      console.log(`  Publishing social post in ${lang.name}...`);

      const socialCaption = socialPosts[lang.code];
      const recipeImageBase64 = recipeImage.replace(/^data:image\/\w+;base64,/, '');

      try {
        // Converti immagine ricetta da base64 a data URL per publish-to-odoo
        const recipeImageDataUrl = `data:image/jpeg;base64,${recipeImageBase64}`;

        // Chiama l'endpoint publish-to-odoo che gestisce la pubblicazione sui 4 social
        const publishResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/social-ai/publish-to-odoo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cookie': userCookies  // Forward user cookies for Odoo authentication
          },
          body: JSON.stringify({
            caption: socialCaption,
            hashtags: [`#RecipesLAPA`, `#ItalianFood`, `#Cucina${translations[lang.code].region}`],
            cta: `👉 Leggi la ricetta completa su www.lapa.ch`,
            imageUrl: recipeImageDataUrl,
            platform: 'instagram', // Placeholder - publish-to-odoo pubblica su tutti i social
            accountIds: [2, 4, 6, 13] // Facebook, Instagram, LinkedIn, Twitter
          })
        });

        const publishData = await publishResponse.json();

        if (publishData.success) {
          socialPublishResults[lang.code] = publishData;
          console.log(`  ✅ Social post published for ${lang.name}`);
        } else {
          const errorMsg = `${lang.name}: ${publishData.error || 'Unknown error'}`;
          socialPublishFailures.push(errorMsg);
          console.warn(`  ⚠️ Failed to publish social for ${lang.name}:`, publishData.error);
        }
      } catch (error: any) {
        const errorMsg = `${lang.name}: ${error.message}`;
        socialPublishFailures.push(errorMsg);
        console.error(`  ❌ Error publishing social for ${lang.name}:`, error.message);
      }
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
          successfulSocialPublishes: Object.keys(socialPublishResults).length,
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
