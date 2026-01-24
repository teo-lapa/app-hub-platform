import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

// Nota: sharp rimosso per compatibilità Vercel serverless
// La conversione PNG->JPEG è gestita lato client o tramite fallback mimetype

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
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

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

  // Genera meta SEO ottimizzati per geo-targeting (Svizzera + Italia)
  const seoMetaTitle = `${italianStory.title} | ${italianStory.origin.region} | LAPA`;
  const seoMetaDescription = `${italianStory.introduction.substring(0, 140)}... Scopri la storia e tradizione di ${productName}. Consegna in Svizzera.`;
  const seoKeywords = `${productName}, ${italianStory.origin.region}, prodotti italiani, tradizione italiana, gastronomia, LAPA, prodotti italiani Svizzera, specialità italiane Zurigo`;

  // Crea post blog in italiano (lingua base)
  // IMPORTANTE: Usare context lang: it_IT per assicurarsi che il contenuto sia salvato in italiano
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
      is_published: true,
      is_seo_optimized: true, // SEO: flag Odoo per ottimizzazione
      // SEO Meta Tags per indicizzazione e geo-targeting (Svizzera + Italia)
      website_meta_title: seoMetaTitle,
      website_meta_description: seoMetaDescription,
      website_meta_keywords: seoKeywords,
      // SEO Name per URL-friendly slug
      seo_name: italianStory.title.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      cover_properties: JSON.stringify({
        'background-image': `url(/web/image/${storyImageId})`,
        'background_color_class': 'o_cc3 o_cc',
        'background_color_style': '',
        'opacity': '0.2',
        'resize_class': 'o_half_screen_height o_record_has_cover',
        'text_align_class': ''
      }),
      tag_ids: [[6, 0, [5]]] // Tag: "Storia del prodotto" (ID 5)
    }],
    { context: { lang: 'it_IT' } } // Forza lingua italiana per il contenuto base
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

  // ==========================================
  // TRADUZIONI BLOG - Metodo corretto con segmenti
  // Odoo usa get_field_translations e update_field_translations
  // per tradurre i blocchi HTML del contenuto
  // ==========================================

  const langCodes = ['de_CH', 'fr_CH', 'en_US'];

  for (const langCode of langCodes) {
    const translatedStory = translations[langCode];
    if (!translatedStory) continue;

    try {
      // 1. Traduci il titolo (name) con write + context
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [[postId], { name: translatedStory.title }],
        { context: { lang: langCode } }
      );

      // 2. Traduci il sottotitolo (subtitle) con write + context
      await callOdoo(
        odooCookies,
        'blog.post',
        'write',
        [[postId], { subtitle: translatedStory.subtitle }],
        { context: { lang: langCode } }
      );

      // 3. Per il contenuto (content), usa il sistema di segmenti di Odoo
      const segmentData = await callOdoo(
        odooCookies,
        'blog.post',
        'get_field_translations',
        [[postId], 'content']
      );

      if (segmentData && Array.isArray(segmentData) && segmentData.length > 0) {
        const segments = segmentData[0];
        const sourceTexts = Array.from(new Set(segments.map((s: any) => s.source))) as string[];
        const segmentTranslations: Record<string, string> = {};

        // Mappa i segmenti italiani ai segmenti tradotti
        for (const srcText of sourceTexts) {
          const translatedText = findStoryTranslationForSegment(
            srcText,
            italianStory,
            translatedStory,
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
// HELPER: Trova traduzione per un segmento (Story)
// ==========================================

function findStoryTranslationForSegment(
  italianText: string,
  italianStory: StoryData,
  translatedStory: StoryData,
  productName: string,
  langCode: string
): string | null {
  const cleanText = italianText.trim();

  // Mappa diretta dei campi della storia
  const directMappings: Record<string, string> = {
    [italianStory.title]: translatedStory.title,
    [italianStory.subtitle]: translatedStory.subtitle,
    [italianStory.introduction]: translatedStory.introduction,
    [italianStory.origin.history]: translatedStory.origin.history,
    [italianStory.tradition.description]: translatedStory.tradition.description,
    [italianStory.tradition.culturalSignificance]: translatedStory.tradition.culturalSignificance,
    [italianStory.production.method]: translatedStory.production.method,
  };

  // Controlla mappatura diretta
  if (directMappings[cleanText]) {
    return directMappings[cleanText];
  }

  // Controlla certification
  if (italianStory.certification && translatedStory.certification) {
    if (cleanText === italianStory.certification.description) {
      return translatedStory.certification.description;
    }
  }

  // Controlla quote
  if (italianStory.quote && translatedStory.quote && cleanText === italianStory.quote) {
    return translatedStory.quote;
  }

  // Controlla curiosities
  for (let i = 0; i < (italianStory.curiosities?.length || 0); i++) {
    if (cleanText === italianStory.curiosities[i] && translatedStory.curiosities?.[i]) {
      return translatedStory.curiosities[i];
    }
  }

  // Controlla pairings
  for (let i = 0; i < (italianStory.pairings?.length || 0); i++) {
    if (cleanText === italianStory.pairings[i] && translatedStory.pairings?.[i]) {
      return translatedStory.pairings[i];
    }
  }

  // Controlla uniqueCharacteristics
  for (let i = 0; i < (italianStory.production.uniqueCharacteristics?.length || 0); i++) {
    if (cleanText === italianStory.production.uniqueCharacteristics[i] && translatedStory.production.uniqueCharacteristics?.[i]) {
      return translatedStory.production.uniqueCharacteristics[i];
    }
  }

  // Testi statici comuni
  const staticTranslations: Record<string, Record<string, string>> = {
    'Origine e Storia': { de_CH: 'Herkunft und Geschichte', fr_CH: 'Origine et Histoire', en_US: 'Origin and History' },
    '📍 Origine e Storia': { de_CH: '📍 Herkunft und Geschichte', fr_CH: '📍 Origine et Histoire', en_US: '📍 Origin and History' },
    'Tradizione': { de_CH: 'Tradition', fr_CH: 'Tradition', en_US: 'Tradition' },
    '🏛️ Tradizione': { de_CH: '🏛️ Tradition', fr_CH: '🏛️ Tradition', en_US: '🏛️ Tradition' },
    'Produzione': { de_CH: 'Herstellung', fr_CH: 'Production', en_US: 'Production' },
    '⚙️ Produzione': { de_CH: '⚙️ Herstellung', fr_CH: '⚙️ Production', en_US: '⚙️ Production' },
    'Caratteristiche Uniche:': { de_CH: 'Einzigartige Eigenschaften:', fr_CH: 'Caractéristiques Uniques:', en_US: 'Unique Characteristics:' },
    'Lo Sapevi Che...': { de_CH: 'Wussten Sie, dass...', fr_CH: 'Le saviez-vous...', en_US: 'Did You Know...' },
    '💡 Lo Sapevi Che...': { de_CH: '💡 Wussten Sie, dass...', fr_CH: '💡 Le saviez-vous...', en_US: '💡 Did You Know...' },
    'Abbinamenti Consigliati': { de_CH: 'Empfohlene Kombinationen', fr_CH: 'Accords Recommandés', en_US: 'Recommended Pairings' },
    '🍽️ Abbinamenti Consigliati': { de_CH: '🍽️ Empfohlene Kombinationen', fr_CH: '🍽️ Accords Recommandés', en_US: '🍽️ Recommended Pairings' },
    'Regione:': { de_CH: 'Region:', fr_CH: 'Région:', en_US: 'Region:' },
    'Periodo:': { de_CH: 'Zeitraum:', fr_CH: 'Période:', en_US: 'Period:' },
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

  // Traduci "Scopri [productName]"
  if (cleanText.includes('Scopri') && cleanText.includes(productName)) {
    const discoverTranslations: Record<string, string> = {
      de_CH: `${productName} entdecken`,
      fr_CH: `Découvrir ${productName}`,
      en_US: `Discover ${productName}`
    };
    return `🛍️ ${discoverTranslations[langCode] || cleanText}`;
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

  // Se è programmato, non pubblicare subito
  if (scheduledDate) {
    console.log(`  📅 Social post ${postId} programmato per ${scheduledDate}`);
    return postId;
  }

  // INSTAGRAM FIX: Aspetta che Instagram processi l'immagine allegata
  // Instagram API richiede ~8 secondi per processare il media prima di poter pubblicare
  // Errori comuni: "Media ID is not available", "Only photo or video can be accepted"
  console.log(`  ⏳ Waiting 8s for Instagram to process image attachment...`);
  await delay(8000);

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
    console.warn(`  ⚠️ action_post fallito per ${postId}:`, publishError.message);
  }

  return postId;
}

// ==========================================
// MAIN HANDLER
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const { storyData, productName, productImage, storyImage, scheduledDate } = await request.json() as PublishStoryRequest;

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
    const isScheduled = !!scheduledDate;

    console.log(`[Publish Story] Starting ${isScheduled ? 'scheduling' : 'publication'} process...${isScheduled ? ` for ${scheduledDate}` : ''}`);

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

    const safeProductName = sanitizeFileName(productName);
    const safeTitleName = sanitizeFileName(storyData.title);

    const productImageId = await uploadImageToOdoo(
      odooCookies,
      productImage,
      `${safeProductName}-product.jpg`,
      false // per blog
    );

    const storyImageId = await uploadImageToOdoo(
      odooCookies,
      storyImage,
      `${safeTitleName}-story.jpg`,
      false // per blog
    );

    // Carica immagine separata per i social (con mimetype corretto per Instagram)
    const socialImageId = await uploadImageToOdoo(
      odooCookies,
      storyImage,
      `${safeTitleName}-social.jpg`,
      true // per social
    );

    console.log(`✅ Images uploaded: product=${productImageId}, story=${storyImageId}, social=${socialImageId}`);

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
    console.log(`[6/6] ${isScheduled ? 'Scheduling' : 'Publishing'} to social media...`);

    const FACEBOOK_ID = 2;
    const INSTAGRAM_ID = 4;
    const LINKEDIN_ID = 6;
    const TWITTER_ID = 13;

    const socialCaption = socialPosts['it_IT'];
    const publishedPostIds: number[] = [];

    try {
      // Facebook e LinkedIn
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

      await delay(3000);

      // Instagram (senza link)
      console.log(`  📸 ${isScheduled ? 'Scheduling' : 'Publishing'} to Instagram...`);
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
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId2);
      console.log(`  ✅ Instagram: post ${postId2}`);

      // Twitter
      console.log(`  🐦 ${isScheduled ? 'Scheduling' : 'Publishing'} to Twitter...`);
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
        socialImageId,
        scheduledDate
      );
      publishedPostIds.push(postId3);
      console.log(`  ✅ Twitter: post ${postId3}`);

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
    console.error('[Publish Story] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante pubblicazione' },
      { status: 500 }
    );
  }
}
