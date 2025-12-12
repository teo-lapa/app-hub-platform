/**
 * Debug: vediamo cosa fa Odoo quando salvi una traduzione
 */

import { readFileSync } from 'fs';

const article = JSON.parse(readFileSync('data/new-articles/article-01-zurich.json', 'utf-8'));

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

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

async function call(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
  if (data.error) throw new Error(JSON.stringify(data.error.data?.debug || data.error.message));
  return data.result;
}

async function main() {
  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  const postId = 118;

  // Il metodo update_field_translations vuole:
  // update_field_translations(field_name, translations)
  // dove translations = {source_text: {lang_code: translated_text}}

  // Leggi i blocchi esistenti
  console.log('📖 Leggo blocchi esistenti...');
  const fieldTrans = await call('blog.post', 'get_field_translations', [[postId], 'content'], {});

  // Raggruppa per source
  const sourcesByLang: Record<string, string[]> = {};
  for (const t of fieldTrans[0]) {
    if (!sourcesByLang[t.lang]) sourcesByLang[t.lang] = [];
    if (!sourcesByLang[t.lang].includes(t.source)) {
      sourcesByLang[t.lang].push(t.source);
    }
  }

  const sources = sourcesByLang['it_IT'] || [];
  console.log(`   ${sources.length} blocchi unici`);
  console.log('   Primi 3:');
  sources.slice(0, 3).forEach((s, i) => console.log(`   ${i+1}. "${s.substring(0, 60)}..."`));

  // Ora creo il mapping nel formato corretto
  // {source: {lang: value}}
  const deData = article.translations.de_DE;
  const frData = article.translations.fr_FR;
  const enData = article.translations.en_US;

  // Estrai testi da ciascuna lingua
  function extractTexts(html: string): string[] {
    const texts: string[] = [];
    // Estrai tutto il testo tra tag
    const regex = />([^<]+)</g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text && text.length > 1) {
        texts.push(text);
      }
    }
    return texts;
  }

  const itTexts = extractTexts(article.translations.it_IT.content_html);
  const deTexts = extractTexts(deData.content_html);
  const frTexts = extractTexts(frData.content_html);
  const enTexts = extractTexts(enData.content_html);

  console.log(`\n📊 Testi estratti: IT=${itTexts.length}, DE=${deTexts.length}, FR=${frTexts.length}, EN=${enTexts.length}`);

  // Crea mapping source -> translations
  const translations: Record<string, Record<string, string>> = {};

  // Per ogni source italiano, trova la traduzione corrispondente per posizione
  for (let i = 0; i < Math.min(sources.length, itTexts.length); i++) {
    const src = sources[i];
    // Trova questo source nei testi italiani
    const itIdx = itTexts.indexOf(src);
    if (itIdx >= 0 && deTexts[itIdx] && frTexts[itIdx] && enTexts[itIdx]) {
      translations[src] = {
        'de_CH': deTexts[itIdx],
        'fr_CH': frTexts[itIdx],
        'en_US': enTexts[itIdx],
      };
    }
  }

  console.log(`   Mapping creato per ${Object.keys(translations).length} blocchi`);

  // Mostra un esempio
  const firstKey = Object.keys(translations)[0];
  if (firstKey) {
    console.log(`\n   Esempio:`);
    console.log(`   IT (source): "${firstKey.substring(0, 50)}..."`);
    console.log(`   DE: "${translations[firstKey]['de_CH']?.substring(0, 50)}..."`);
  }

  // Ora prova update_field_translations con questo formato
  console.log('\n📝 Applico traduzioni...');
  try {
    const result = await call('blog.post', 'update_field_translations', [
      [postId],
      'content',
      translations
    ], {});
    console.log('   ✅ Risultato:', result);
  } catch (e: any) {
    console.log('   ❌ Errore:', e.message.substring(0, 300));
  }

  // Verifica
  console.log('\n🔍 Verifica finale...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await call('blog.post', 'read', [[postId]], {
      fields: ['content'],
      context: { lang }
    });
    const h1 = data[0]?.content?.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1] || 'N/A';
    console.log(`   ${lang}: H1="${h1.substring(0, 50)}"`);
  }
}

main().catch(console.error);
