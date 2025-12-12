/**
 * Fix Translations - Corregge le traduzioni mancanti negli articoli esistenti
 *
 * Per ogni articolo con traduzioni parziali:
 * 1. Legge il contenuto italiano (base)
 * 2. Verifica quali lingue hanno traduzioni mancanti
 * 3. Traduce usando OpenAI
 * 4. Applica le traduzioni con update_field_translations
 */

import OpenAI from 'openai';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let cookies = '';

const LANG_MAP: Record<string, { code: string; name: string }> = {
  'de_CH': { code: 'de_CH', name: 'German (Swiss)' },
  'fr_CH': { code: 'fr_CH', name: 'French (Swiss)' },
  'en_US': { code: 'en_US', name: 'English' }
};

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }
  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function translateText(text: string, targetLang: string): Promise<string> {
  const langNames: Record<string, string> = {
    'de_CH': 'German (Swiss German style)',
    'fr_CH': 'French (Swiss French style)',
    'en_US': 'English'
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a professional translator. Translate the following Italian text to ${langNames[targetLang]}.
Keep the same tone and style. Do not add or remove content.
Return ONLY the translation, nothing else.`
      },
      { role: 'user', content: text }
    ],
    temperature: 0.3
  });

  return response.choices[0].message.content?.trim() || text;
}

async function getArticle(id: number, lang: string): Promise<any> {
  const result = await callOdoo('blog.post', 'read', [[id], [
    'name', 'subtitle', 'content',
    'website_meta_title', 'website_meta_description', 'website_meta_keywords'
  ]], { context: { lang } });
  return result[0];
}

async function fixArticleTranslations(articleId: number): Promise<{ fixed: string[]; errors: string[] }> {
  const fixed: string[] = [];
  const errors: string[] = [];

  // 1. Leggi articolo in italiano
  const itArticle = await getArticle(articleId, 'it_IT');
  if (!itArticle) {
    errors.push('Articolo non trovato');
    return { fixed, errors };
  }

  console.log(`\n📝 [${articleId}] ${itArticle.name?.substring(0, 50)}...`);

  // 2. Per ogni lingua, verifica e correggi
  for (const [langCode, langInfo] of Object.entries(LANG_MAP)) {
    const targetArticle = await getArticle(articleId, langCode);

    // Verifica se i campi sono tradotti
    const updates: Record<string, string> = {};

    // Nome
    if (!targetArticle.name || targetArticle.name === itArticle.name) {
      try {
        const translated = await translateText(itArticle.name, langCode);
        updates.name = translated;
        console.log(`   ${langCode} name: ✓`);
      } catch (e: any) {
        errors.push(`${langCode} name: ${e.message}`);
      }
    }

    // Subtitle
    if (itArticle.subtitle && (!targetArticle.subtitle || targetArticle.subtitle === itArticle.subtitle)) {
      try {
        const translated = await translateText(itArticle.subtitle, langCode);
        updates.subtitle = translated;
        console.log(`   ${langCode} subtitle: ✓`);
      } catch (e: any) {
        errors.push(`${langCode} subtitle: ${e.message}`);
      }
    }

    // Meta title
    if (itArticle.website_meta_title && (!targetArticle.website_meta_title || targetArticle.website_meta_title === itArticle.website_meta_title)) {
      try {
        const translated = await translateText(itArticle.website_meta_title, langCode);
        updates.website_meta_title = translated;
        console.log(`   ${langCode} meta_title: ✓`);
      } catch (e: any) {
        errors.push(`${langCode} meta_title: ${e.message}`);
      }
    }

    // Meta description
    if (itArticle.website_meta_description && (!targetArticle.website_meta_description || targetArticle.website_meta_description === itArticle.website_meta_description)) {
      try {
        const translated = await translateText(itArticle.website_meta_description, langCode);
        updates.website_meta_description = translated;
        console.log(`   ${langCode} meta_desc: ✓`);
      } catch (e: any) {
        errors.push(`${langCode} meta_desc: ${e.message}`);
      }
    }

    // Meta keywords
    if (itArticle.website_meta_keywords && (!targetArticle.website_meta_keywords || targetArticle.website_meta_keywords === itArticle.website_meta_keywords)) {
      try {
        const translated = await translateText(itArticle.website_meta_keywords, langCode);
        updates.website_meta_keywords = translated;
        console.log(`   ${langCode} keywords: ✓`);
      } catch (e: any) {
        errors.push(`${langCode} keywords: ${e.message}`);
      }
    }

    // Applica aggiornamenti campi
    if (Object.keys(updates).length > 0) {
      try {
        await callOdoo('blog.post', 'write', [[articleId], updates], { context: { lang: langCode } });
        fixed.push(`${langCode} fields`);
      } catch (e: any) {
        errors.push(`${langCode} write: ${e.message}`);
      }
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Gestisci content segments
  try {
    const segmentData = await callOdoo('blog.post', 'get_field_translations', [[articleId], 'content']);

    if (segmentData?.[0]?.length) {
      const segments = segmentData[0];
      const sources = [...new Set(segments.map((s: any) => s.source))] as string[];

      console.log(`   Content: ${sources.length} segmenti`);

      // Per ogni lingua, traduci i segmenti mancanti
      for (const [langCode] of Object.entries(LANG_MAP)) {
        // Trova segmenti non tradotti per questa lingua
        const langSegments = segments.filter((s: any) => s.lang === langCode);
        const untranslated = langSegments.filter((s: any) => !s.value || s.value === s.source);

        if (untranslated.length > 0) {
          console.log(`   ${langCode}: ${untranslated.length} segmenti da tradurre`);

          const translations: Record<string, string> = {};

          for (const seg of untranslated.slice(0, 50)) { // Limita a 50 per evitare timeout
            try {
              const translated = await translateText(seg.source, langCode);
              if (translated && translated !== seg.source) {
                translations[seg.source] = translated;
              }
            } catch (e) {
              // Ignora errori singoli
            }
            await new Promise(r => setTimeout(r, 100));
          }

          if (Object.keys(translations).length > 0) {
            try {
              await callOdoo('blog.post', 'update_field_translations', [
                [articleId], 'content', { [langCode]: translations }
              ]);
              fixed.push(`${langCode} content (${Object.keys(translations).length})`);
              console.log(`   ${langCode}: ✓ ${Object.keys(translations).length} segmenti`);
            } catch (e: any) {
              errors.push(`${langCode} content: ${e.message.substring(0, 50)}`);
            }
          }
        }
      }
    }
  } catch (e: any) {
    errors.push(`segments: ${e.message.substring(0, 50)}`);
  }

  return { fixed, errors };
}

async function main() {
  // BATCH 2: Articoli rimanenti (esclusi batch 1 e i nuovi 135-144)
  const articlesToFix = [
    // Articoli con traduzioni mancanti o parziali
    56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37,
    36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17,
    16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5
  ];

  console.log('🔧 Fix Translations - Correzione articoli\n');
  console.log('='.repeat(60));

  console.log('\n🔐 Autenticazione Odoo...');
  await authenticate();
  console.log('✅ OK');

  const results: { id: number; fixed: string[]; errors: string[] }[] = [];

  for (const articleId of articlesToFix) {
    try {
      const result = await fixArticleTranslations(articleId);
      results.push({ id: articleId, ...result });
    } catch (e: any) {
      console.log(`\n❌ [${articleId}] Errore: ${e.message}`);
      results.push({ id: articleId, fixed: [], errors: [e.message] });
    }

    // Rate limiting tra articoli
    await new Promise(r => setTimeout(r, 1000));
  }

  // Riepilogo
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 RIEPILOGO');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.fixed.length > 0 && r.errors.length === 0).length;
  const partialCount = results.filter(r => r.fixed.length > 0 && r.errors.length > 0).length;
  const failedCount = results.filter(r => r.fixed.length === 0).length;

  console.log(`\n✅ Successo completo: ${successCount}`);
  console.log(`⚠️  Parziale: ${partialCount}`);
  console.log(`❌ Falliti: ${failedCount}`);

  if (results.some(r => r.errors.length > 0)) {
    console.log('\n❌ Errori:');
    results.filter(r => r.errors.length > 0).forEach(r => {
      console.log(`   [${r.id}]: ${r.errors.join(', ')}`);
    });
  }

  console.log('\n✅ Completato!');
}

main().catch(console.error);
