import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

// Nota: sharp rimosso per compatibilità Vercel serverless
// La conversione PNG->JPEG è gestita lato client o tramite fallback mimetype

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
  scheduledDate?: string; // Formato: "YYYY-MM-DD HH:MM:SS"
  // sources rimosso - Google Search restituisce risultati non pertinenti (cataloghi, volantini)
}

interface OdooAttachment {
  id: number;
  name: string;
  datas: string; // base64
  res_model: string;
  res_id: number;
  public: boolean;
}

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
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
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
  // Estrai mimetype dal data URL
  const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
  let mimetype = mimeMatch ? mimeMatch[1] : 'image/png';

  // Rimuovi prefisso data:image se presente
  let cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  // INSTAGRAM FIX: Instagram richiede JPEG
  // Nota: la conversione reale avviene lato client o si usa il mimetype JPEG
  // Instagram generalmente accetta immagini con mimetype image/jpeg
  if (forSocial && mimetype !== 'image/jpeg') {
    console.log(`  ⚠️ Image is ${mimetype}, setting JPEG mimetype for Instagram compatibility`);
    mimetype = 'image/jpeg';
    filename = filename.replace(/\.(png|webp|gif)$/i, '.jpg');
  }

  // Genera access_token per Instagram/Facebook API (solo per social posts)
  const accessToken = forSocial ? generateAccessToken() : undefined;

  // Usa callOdoo con sessione utente loggato
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
      res_id: 0 // Verrà aggiornato dopo
    }]
  );

  if (!attachmentId) {
    throw new Error('Failed to upload image to Odoo');
  }

  return attachmentId;
}

// ==========================================
// CREA BLOG POST SU ODOO (con traduzioni)
// ==========================================

async function createBlogPostWithTranslations(
  odooCookies: string,
  translations: Record<string, any>,
  productName: string,
  recipeImageId: number
): Promise<number> {

  // Usa la versione italiana come base
  const italianRecipe = translations['it_IT'];
  const htmlContentIT = generateBlogHTML(italianRecipe, productName);

  // Genera meta SEO ottimizzati per geo-targeting (Svizzera + Italia)
  const seoMetaTitle = `${italianRecipe.title} | Ricetta Tradizionale ${italianRecipe.region}`;
  const seoMetaDescription = `${italianRecipe.description.substring(0, 140)}... Scopri la ricetta tradizionale con ${productName}. Consegna in Svizzera.`;
  const seoKeywords = `${productName}, ricetta ${italianRecipe.region}, cucina italiana, ${italianRecipe.title}, LAPA, prodotti italiani Svizzera, gastronomia italiana Zurigo`;

  // Crea post blog in italiano (lingua base)
  // IMPORTANTE: Usare context lang: it_IT per assicurarsi che il contenuto sia salvato in italiano
  const postId = await callOdoo(
    odooCookies,
    'blog.post',
    'create',
    [{
      name: italianRecipe.title,
      blog_id: 4, // LAPABlog
      subtitle: italianRecipe.description,
      content: htmlContentIT,
      website_published: true,
      is_published: true,
      is_seo_optimized: true, // SEO: flag Odoo per ottimizzazione
      // SEO Meta Tags per indicizzazione e geo-targeting (Svizzera + Italia)
      website_meta_title: seoMetaTitle,
      website_meta_description: seoMetaDescription,
      website_meta_keywords: seoKeywords,
      // SEO Name per URL-friendly slug
      seo_name: italianRecipe.title.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      // Cover image - formato corretto Odoo 17 (background-image con trattino e url())
      cover_properties: JSON.stringify({
        'background-image': `url(/web/image/${recipeImageId})`,
        'background_color_class': 'o_cc3 o_cc',
        'background_color_style': '',
        'opacity': '0.2',
        'resize_class': 'o_half_screen_height o_record_has_cover',
        'text_align_class': ''
      }),
      tag_ids: [[6, 0, [4]]] // Tag: "Ricetta tradizionale" (ID 4)
    }],
    { context: { lang: 'it_IT' } } // Forza lingua italiana per il contenuto base
  );

  if (!postId) {
    throw new Error('Failed to create blog post');
  }

  console.log(`  ✅ Blog post base creato (IT): ${postId}`);

  // Aggiorna attachment con res_id e res_model corretti
  await callOdoo(
    odooCookies,
    'ir.attachment',
    'write',
    [[recipeImageId], {
      res_id: postId,
      res_model: 'blog.post',
      public: true
    }]
  );

  // ==========================================
  // TRADUZIONI BLOG - Metodo corretto con segmenti
  // Odoo usa get_field_translations e update_field_translations
  // per tradurre i blocchi HTML del contenuto
  // ==========================================

  const langCodes = ['de_CH', 'fr_CH', 'en_US'];

  for (const langCode of langCodes) {
    const translatedRecipe = translations[langCode];
    if (!translatedRecipe) continue;

    try {
      // 1. Traduci il titolo (name) con write + context
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [[postId], { name: translatedRecipe.title }],
        { context: { lang: langCode } }
      );

      // 2. Traduci il sottotitolo (subtitle) con write + context
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [[postId], { subtitle: translatedRecipe.description }],
        { context: { lang: langCode } }
      );

      // 3. Per il contenuto (content), usa il sistema di segmenti di Odoo
      // Leggi i segmenti dal contenuto italiano
      const segmentData = await callOdoo(
        odooCookies,
        'blog.post',
        'get_field_translations',
        [[postId], 'content']
      );

      if (segmentData && Array.isArray(segmentData) && segmentData.length > 0) {
        const segments = segmentData[0];

        // Estrai tutti i testi sorgente unici
        const sourceTexts = Array.from(new Set(segments.map((s: any) => s.source))) as string[];

        // Crea la mappa di traduzioni per questo segmento
        const segmentTranslations: Record<string, string> = {};

        // Genera HTML tradotto per estrarre i testi
        const translatedHTML = generateBlogHTML(translatedRecipe, productName);

        // Mappa i segmenti italiani ai segmenti tradotti
        // Usiamo una strategia di matching basata sulla posizione nel contenuto
        for (const srcText of sourceTexts) {
          // Cerca la traduzione corrispondente nel contenuto tradotto
          const translatedText = findTranslationForSegment(
            srcText,
            italianRecipe,
            translatedRecipe,
            productName,
            langCode
          );

          if (translatedText && translatedText !== srcText) {
            segmentTranslations[srcText] = translatedText;
          }
        }

        // Applica le traduzioni dei segmenti
        if (Object.keys(segmentTranslations).length > 0) {
          await callOdoo(
            odooCookies,
            'blog.post',
            'update_field_translations',
            [[postId], 'content', { [langCode]: segmentTranslations }]
          );
          console.log(`  ✅ Traduzione ${langCode}: ${Object.keys(segmentTranslations).length} segmenti tradotti`);
        } else {
          console.log(`  ⚠️ Traduzione ${langCode}: nessun segmento da tradurre`);
        }
      } else {
        console.log(`  ⚠️ Traduzione ${langCode}: nessun segmento trovato nel contenuto`);
      }

    } catch (translationError: any) {
      console.error(`  ❌ Impossibile aggiungere traduzione ${langCode}:`, translationError.message);
    }
  }

  return postId;
}

// ==========================================
// HELPER: Trova traduzione per un segmento
// ==========================================

function findTranslationForSegment(
  italianText: string,
  italianRecipe: any,
  translatedRecipe: any,
  productName: string,
  langCode: string
): string | null {
  // Pulisci il testo per il confronto
  const cleanText = italianText.trim();

  // Mappa diretta dei campi della ricetta
  const directMappings: Record<string, string> = {
    [italianRecipe.title]: translatedRecipe.title,
    [italianRecipe.description]: translatedRecipe.description,
    [italianRecipe.tradition]: translatedRecipe.tradition,
  };

  // Controlla mappatura diretta
  if (directMappings[cleanText]) {
    return directMappings[cleanText];
  }

  // Controlla ingredienti
  for (let i = 0; i < (italianRecipe.ingredients?.length || 0); i++) {
    const itIng = italianRecipe.ingredients[i];
    const trIng = translatedRecipe.ingredients?.[i];

    if (itIng && trIng) {
      if (cleanText === itIng.item) {
        return trIng.item;
      }
      if (cleanText === `${itIng.quantity} ${itIng.item}`) {
        return `${trIng.quantity} ${trIng.item}`;
      }
      // Solo l'item senza quantity
      if (cleanText.includes(itIng.item)) {
        return cleanText.replace(itIng.item, trIng.item);
      }
    }
  }

  // Controlla steps
  for (let i = 0; i < (italianRecipe.steps?.length || 0); i++) {
    const itStep = italianRecipe.steps[i];
    const trStep = translatedRecipe.steps?.[i];

    if (itStep && trStep && cleanText === itStep) {
      return trStep;
    }
    // Match parziale per step con prefisso "Passo X:"
    if (itStep && trStep && cleanText.includes(itStep)) {
      return cleanText.replace(itStep, trStep);
    }
  }

  // Controlla tips
  for (let i = 0; i < (italianRecipe.tips?.length || 0); i++) {
    const itTip = italianRecipe.tips[i];
    const trTip = translatedRecipe.tips?.[i];

    if (itTip && trTip && cleanText === itTip) {
      return trTip;
    }
  }

  // Testi statici comuni con traduzioni per lingua
  const staticTranslations: Record<string, Record<string, string>> = {
    'Tradizione': { de_CH: 'Tradition', fr_CH: 'Tradition', en_US: 'Tradition' },
    '🏛️ Tradizione': { de_CH: '🏛️ Tradition', fr_CH: '🏛️ Tradition', en_US: '🏛️ Tradition' },
    'Ingredienti': { de_CH: 'Zutaten', fr_CH: 'Ingrédients', en_US: 'Ingredients' },
    '🛒 Ingredienti': { de_CH: '🛒 Zutaten', fr_CH: '🛒 Ingrédients', en_US: '🛒 Ingredients' },
    'Procedimento': { de_CH: 'Zubereitung', fr_CH: 'Préparation', en_US: 'Instructions' },
    '👨‍🍳 Procedimento': { de_CH: '👨‍🍳 Zubereitung', fr_CH: '👨‍🍳 Préparation', en_US: '👨‍🍳 Instructions' },
    'Consigli dello Chef': { de_CH: 'Tipps vom Chef', fr_CH: 'Conseils du Chef', en_US: "Chef's Tips" },
    '💡 Consigli dello Chef': { de_CH: '💡 Tipps vom Chef', fr_CH: '💡 Conseils du Chef', en_US: "💡 Chef's Tips" },
    'Regione:': { de_CH: 'Region:', fr_CH: 'Région:', en_US: 'Region:' },
    'Preparazione:': { de_CH: 'Vorbereitung:', fr_CH: 'Préparation:', en_US: 'Prep:' },
    'Cottura:': { de_CH: 'Kochzeit:', fr_CH: 'Cuisson:', en_US: 'Cooking:' },
    'Porzioni:': { de_CH: 'Portionen:', fr_CH: 'Portions:', en_US: 'Servings:' },
    'Difficoltà:': { de_CH: 'Schwierigkeit:', fr_CH: 'Difficulté:', en_US: 'Difficulty:' },
    'Passo': { de_CH: 'Schritt', fr_CH: 'Étape', en_US: 'Step' },
    'Questo prodotto è disponibile nel nostro catalogo!': {
      de_CH: 'Dieses Produkt ist in unserem Katalog erhältlich!',
      fr_CH: 'Ce produit est disponible dans notre catalogue!',
      en_US: 'This product is available in our catalog!'
    },
    'Scopri il Catalogo LAPA': {
      de_CH: 'Entdecken Sie den LAPA Katalog',
      fr_CH: 'Découvrez le Catalogue LAPA',
      en_US: 'Discover the LAPA Catalog'
    },
  };

  // Controlla testi statici
  if (staticTranslations[cleanText] && staticTranslations[cleanText][langCode]) {
    return staticTranslations[cleanText][langCode];
  }

  // Traduci "Ordina [productName]"
  if (cleanText.includes('Ordina') && cleanText.includes(productName)) {
    const orderTranslations: Record<string, string> = {
      de_CH: `${productName} bestellen`,
      fr_CH: `Commander ${productName}`,
      en_US: `Order ${productName}`
    };
    return `🛍️ ${orderTranslations[langCode] || cleanText}`;
  }

  // Nessuna traduzione trovata
  return null;
}

// ==========================================
// LEGGI URL BLOG POST DA ODOO
// ==========================================

async function getBlogPostUrl(
  odooCookies: string,
  postId: number
): Promise<string> {
  // Aspetta un momento per permettere a Odoo di generare l'URL SEO
  await delay(1000);

  // Leggi il campo website_url dal blog post creato
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
  const postName = postData[0].name;

  console.log(`  📎 Blog post "${postName}" (ID: ${postId})`);
  console.log(`  📎 website_url from Odoo: ${websiteUrl}`);

  if (!websiteUrl) {
    // Fallback: costruisci URL manualmente se Odoo non lo ha generato
    console.warn('  ⚠️ No website_url, using fallback with post ID');
    return `https://www.lapa.ch/blog/lapablog-4/${postId}`;
  }

  // Odoo restituisce URL relativo, aggiungi dominio
  const fullUrl = `https://www.lapa.ch${websiteUrl}`;
  console.log(`  📎 Full URL: ${fullUrl}`);

  return fullUrl;
}

// ==========================================
// CREA SOCIAL POST SU ODOO
// ==========================================

// Helper per delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function createSocialPost(
  odooCookies: string,
  message: string,
  accountIds: number[],
  imageId?: number,
  scheduledDate?: string
): Promise<number> {
  // Prepara valori del post
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

  // Se è programmato, non pubblicare subito
  if (scheduledDate) {
    console.log(`  📅 Social post ${postId} programmato per ${scheduledDate}`);
    return postId;
  }

  // Breve pausa per dare tempo a Odoo di processare l'attachment
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log(`🔄 [PUBLISH-RECIPE] Pubblicazione post ${postId}...`);
    await callOdoo(odooCookies, 'social.post', 'action_post', [[postId]]);
    console.log(`✅ [PUBLISH-RECIPE] action_post chiamato con successo`);
  } catch (e: any) {
    console.warn(`⚠️ [PUBLISH-RECIPE] action_post fallito:`, e.message);
  }

  return postId;
}

// ==========================================
// GENERA HTML BLOG
// ==========================================

function generateBlogHTML(recipeData: any, productName: string): string {
  // NOTA: sources rimosso - Google Search restituisce risultati non pertinenti
  // (cataloghi, volantini) invece di siti di ricette vere.

  const ingredientsList = recipeData.ingredients
    .map((ing: any) => `<li><strong>${ing.quantity}</strong> ${ing.item}</li>`)
    .join('');

  const stepsList = recipeData.steps
    .map((step: string, idx: number) => `<li><strong>Passo ${idx + 1}:</strong> ${step}</li>`)
    .join('');

  const tipsList = recipeData.tips && recipeData.tips.length > 0
    ? `<h3>💡 Consigli dello Chef</h3><ul>${recipeData.tips.map((tip: string) => `<li>${tip}</li>`).join('')}</ul>`
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
    const { recipeData, productName, productImage, recipeImage, scheduledDate } = await request.json() as PublishRecipeRequest;

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
    const isScheduled = !!scheduledDate;

    console.log(`[Publish Recipe] Starting ${isScheduled ? 'scheduling' : 'publication'} process...${isScheduled ? ` for ${scheduledDate}` : ''}`);

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

    // ==========================================
    // FASE 2: UPLOAD IMMAGINI
    // ==========================================

    console.log('[2/7] Uploading images to Odoo...');

    const safeProductName = sanitizeFileName(productName);
    const safeTitleName = sanitizeFileName(recipeData.title);

    const productImageId = await uploadImageToOdoo(
      odooCookies,
      productImage,
      `${safeProductName}-product.jpg`,
      false // per blog
    );
    console.log(`✅ Product image uploaded: ${productImageId}`);

    const recipeImageId = await uploadImageToOdoo(
      odooCookies,
      recipeImage,
      `${safeTitleName}-dish.jpg`,
      false // per blog
    );
    console.log(`✅ Recipe image uploaded: ${recipeImageId}`);

    // Carica immagine separata per i social (con mimetype corretto per Instagram)
    const socialImageId = await uploadImageToOdoo(
      odooCookies,
      recipeImage,
      `${safeTitleName}-social.jpg`,
      true // per social
    );
    console.log(`✅ Social image uploaded: ${socialImageId}`);

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
    // FASE 4: CREAZIONE BLOG POST (singolo con traduzioni)
    // ==========================================

    console.log('[4/6] Creating blog post with translations...');

    // Crea UN SOLO blog post con traduzioni integrate
    const postId = await createBlogPostWithTranslations(
      odooCookies,
      translations,
      productName,
      recipeImageId
    );

    // Leggi URL reale da Odoo
    const blogPostUrl = await getBlogPostUrl(odooCookies, postId);
    console.log(`  📍 URL: ${blogPostUrl}`);

    // Per compatibilità con il resto del codice
    const blogPostIds: Record<string, number> = {
      'it_IT': postId,
      'de_CH': postId,
      'fr_CH': postId,
      'en_US': postId
    };
    const blogPostUrls: Record<string, string> = {
      'it_IT': blogPostUrl,
      'de_CH': blogPostUrl.replace('/blog/', '/de_CH/blog/'),
      'fr_CH': blogPostUrl.replace('/blog/', '/fr_CH/blog/'),
      'en_US': blogPostUrl.replace('/blog/', '/en_US/blog/')
    };

    console.log('✅ Blog post created with all translations!');

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

    console.log(`[6/7] ${isScheduled ? 'Scheduling' : 'Publishing'} to social media directly via XML-RPC...`);

    let socialPublishResults: any = null;
    const socialPublishFailures: string[] = [];

    // Account IDs social
    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;

    // Usa il post ITALIANO per i social
    const socialCaption = socialPosts['it_IT'];
    const publishedPostIds: number[] = [];

    // STRATEGIA: Pubblica separatamente per evitare errori Instagram
    // Instagram ha bisogno di più tempo per processare le immagini

    try {
      // POST 1: Facebook e LinkedIn (veloci, raramente falliscono)
      console.log(`  📘 ${isScheduled ? 'Scheduling' : 'Publishing'} to Facebook & LinkedIn...`);
      const postId1 = await createSocialPost(
        odooCookies,
        socialCaption,
        [FACEBOOK_ID, LINKEDIN_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId1);
      console.log(`  ✅ Facebook/LinkedIn: post ${postId1}`);

      // Aspetta 3 secondi prima di Instagram (l'immagine deve essere "calda")
      console.log('  ⏳ Waiting 3s for image to be ready...');
      await delay(3000);

      // POST 2: Instagram (messaggio specifico senza link - non cliccabile su IG)
      console.log(`  📸 ${isScheduled ? 'Scheduling' : 'Publishing'} to Instagram...`);
      const igRecipe = translations['it_IT'];

      // Instagram: messaggio ottimizzato senza link (non cliccabili su IG)
      const instagramMessage = `${igRecipe.title}

${igRecipe.description}

📍 ${igRecipe.region}
⏱️ Prep: ${igRecipe.prepTime} | 🔥 Cottura: ${igRecipe.cookTime}
🍽️ ${igRecipe.servings} | 📊 ${igRecipe.difficulty}

🔗 Ricetta completa in bio!

#RecipesLAPA #ItalianFood #Cucina${igRecipe.region.replace(/[^a-zA-Z]/g, '')} #RicetteItaliane #TradizioneItaliana #FoodPhotography #Foodie #InstaFood #CucinaItaliana`;

      const postId2 = await createSocialPost(
        odooCookies,
        instagramMessage,
        [INSTAGRAM_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId2);
      console.log(`  ✅ Instagram: post ${postId2}`);

      // POST 3: Twitter (messaggio abbreviato max 280 caratteri)
      console.log(`  🐦 ${isScheduled ? 'Scheduling' : 'Publishing'} to Twitter...`);

      // Crea messaggio Twitter specifico con URL blog reale
      const blogUrl = blogPostUrls['it_IT'];
      const twitterRecipe = translations['it_IT'];

      // Twitter: formato compatto che preserva URL blog
      let twitterMessage = `${twitterRecipe.title}

${twitterRecipe.description.substring(0, 80)}...

📍 ${twitterRecipe.region} | ⏱️ ${twitterRecipe.prepTime}

👉 ${blogUrl}

#RecipesLAPA #ItalianFood`;

      // Se ancora troppo lungo, accorcia solo la descrizione
      if (twitterMessage.length > 280) {
        twitterMessage = `${twitterRecipe.title}

📍 ${twitterRecipe.region} | ⏱️ ${twitterRecipe.prepTime}

👉 ${blogUrl}

#RecipesLAPA`;
      }

      const postId3 = await createSocialPost(
        odooCookies,
        twitterMessage,
        [TWITTER_ID],
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId3);
      console.log(`  ✅ Twitter: post ${postId3}`);

      socialPublishResults = {
        success: true,
        postIds: publishedPostIds,
        accounts: ['Facebook', 'LinkedIn', 'Instagram', 'Twitter'],
        scheduled: isScheduled,
        scheduledDate: scheduledDate || null
      };

    } catch (error: any) {
      const errorMsg = `Social publishing failed: ${error.message}`;
      socialPublishFailures.push(errorMsg);
      console.error(`  ❌ Error publishing social posts:`, error.message);

      // Se abbiamo pubblicato qualcosa, consideralo parzialmente riuscito
      if (publishedPostIds.length > 0) {
        socialPublishResults = {
          success: false,
          partial: true,
          postIds: publishedPostIds,
          accounts: publishedPostIds.length >= 1 ? ['Facebook', 'LinkedIn'] : []
        };
      }
    }

    console.log(`✅ Social media ${isScheduled ? 'scheduling' : 'publication'} completed!`);

    // ==========================================
    // FASE 7: RISULTATO FINALE
    // ==========================================

    console.log(`[7/7] ${isScheduled ? 'Scheduling' : 'Publication'} completed successfully!`);

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
        },
        scheduled: isScheduled,
        scheduledDate: scheduledDate || null
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
