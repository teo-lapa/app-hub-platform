/**
 * Script per ottimizzare SEO di TUTTI i prodotti pubblicati
 * Aggiorna meta tags in tutte le lingue mantenendo nome interno invariato
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

const LANGUAGES = {
  it_IT: { name: 'Italiano', flag: '🇮🇹' },
  de_CH: { name: 'Tedesco', flag: '🇩🇪' },
  fr_CH: { name: 'Francese', flag: '🇫🇷' },
  en_US: { name: 'Inglese', flag: '🇬🇧' }
};

// File di stato per riprendere da dove si è interrotto
const STATE_FILE = 'data/seo-update-state.json';
const PROGRESS_FILE = 'output/seo-update-progress.json';

interface ProductToUpdate {
  id: number;
  name: string;
  category: string;
  defaultCode: string;
}

interface UpdateState {
  processedIds: number[];
  failedIds: number[];
  lastProcessedId: number | null;
  startTime: string;
  lastUpdateTime: string;
  totalProducts: number;
  processedCount: number;
}

// Dizionario traduzioni per termini comuni
const COMMON_TRANSLATIONS = {
  de_CH: {
    'Acquista': 'Kaufen Sie',
    'da LAPA': 'von LAPA',
    'grossista': 'Großhandel',
    'prodotti italiani': 'italienische Produkte',
    'in Svizzera': 'in der Schweiz',
    'Consegna rapida': 'Schnelle Lieferung',
    'qualità garantita': 'garantierte Qualität',
    'Alta Qualità': 'Hohe Qualität',
    'Qualità Premium': 'Premium-Qualität',
    'per Professionisti': 'für Profis',
    'Ideale per': 'Ideal für',
    'Confezione': 'Packung',
    'Cartone': 'Karton',
    'Disponibile in': 'Verfügbar in'
  },
  fr_CH: {
    'Acquista': 'Achetez',
    'da LAPA': 'de LAPA',
    'grossista': 'grossiste',
    'prodotti italiani': 'produits italiens',
    'in Svizzera': 'en Suisse',
    'Consegna rapida': 'Livraison rapide',
    'qualità garantita': 'qualité garantie',
    'Alta Qualità': 'Haute Qualité',
    'Qualità Premium': 'Qualité Premium',
    'per Professionisti': 'pour Professionnels',
    'Ideale per': 'Idéal pour',
    'Confezione': 'Conditionnement',
    'Cartone': 'Carton',
    'Disponibile in': 'Disponible en'
  },
  en_US: {
    'Acquista': 'Buy',
    'da LAPA': 'from LAPA',
    'grossista': 'wholesaler',
    'prodotti italiani': 'Italian products',
    'in Svizzera': 'in Switzerland',
    'Consegna rapida': 'Fast delivery',
    'qualità garantita': 'guaranteed quality',
    'Alta Qualità': 'High Quality',
    'Qualità Premium': 'Premium Quality',
    'per Professionisti': 'for Professionals',
    'Ideale per': 'Ideal for',
    'Confezione': 'Package',
    'Cartone': 'Box',
    'Disponibile in': 'Available in'
  }
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
    throw new Error(data.error.data?.message || data.error.message);
  }
  return data.result;
}

function translateText(text: string, targetLang: 'de_CH' | 'fr_CH' | 'en_US'): string {
  let translated = text;
  const translations = COMMON_TRANSLATIONS[targetLang];

  for (const [it, tr] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(it, 'g'), tr);
  }

  return translated;
}

function generateMetaTitle(productName: string, category: string, lang: string): string {
  const cleanName = productName
    .replace(/\s+\d+[A-Z]{2,}\s+[A-Z]+$/g, '') // Rimuove codici tipo "10KG CRT MIO"
    .replace(/\s+\(.*?\)/g, '') // Rimuove parentesi
    .substring(0, 50);

  if (lang === 'de_CH') {
    return `${cleanName} - Hohe Qualität | LAPA Grosshandel`;
  } else if (lang === 'fr_CH') {
    return `${cleanName} - Haute Qualité | LAPA Grossiste`;
  } else if (lang === 'en_US') {
    return `${cleanName} - High Quality | LAPA Wholesaler`;
  }

  return `${cleanName} - Alta Qualità | LAPA Grossista`;
}

function generateMetaDescription(productName: string, category: string, lang: string): string {
  const cleanName = productName.substring(0, 60);

  const templates = {
    it_IT: `Acquista ${cleanName} da LAPA, grossista prodotti italiani in Svizzera. ${category}. Consegna rapida, qualità garantita.`,
    de_CH: `Kaufen Sie ${cleanName} von LAPA, Großhandel für italienische Produkte in der Schweiz. ${category}. Schnelle Lieferung, garantierte Qualität.`,
    fr_CH: `Achetez ${cleanName} de LAPA, grossiste produits italiens en Suisse. ${category}. Livraison rapide, qualité garantie.`,
    en_US: `Buy ${cleanName} from LAPA, Italian products wholesaler in Switzerland. ${category}. Fast delivery, guaranteed quality.`
  };

  return templates[lang as keyof typeof templates] || templates.it_IT;
}

function generateKeywords(productName: string, category: string): string {
  const words = productName.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8);

  return [...new Set([...words, 'lapa', 'svizzera', 'grossista'])].join(', ');
}

function loadState(): UpdateState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  }

  return {
    processedIds: [],
    failedIds: [],
    lastProcessedId: null,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString(),
    totalProducts: 0,
    processedCount: 0
  };
}

function saveState(state: UpdateState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function updateProductSEO(product: ProductToUpdate, state: UpdateState): Promise<boolean> {
  try {
    console.log(`\n📦 [${state.processedCount + 1}/${state.totalProducts}] ${product.name.substring(0, 50)}...`);

    for (const [langCode, langInfo] of Object.entries(LANGUAGES)) {
      const metaTitle = generateMetaTitle(product.name, product.category, langCode);
      const metaDescription = generateMetaDescription(product.name, product.category, langCode);
      const keywords = generateKeywords(product.name, product.category);

      await callOdoo('product.template', 'write', [
        [product.id],
        {
          website_meta_title: metaTitle,
          website_meta_description: metaDescription,
          website_meta_keywords: keywords
        }
      ], { context: { lang: langCode } });
    }

    console.log(`   ✅ Aggiornato in 4 lingue`);

    state.processedIds.push(product.id);
    state.lastProcessedId = product.id;
    state.processedCount++;
    state.lastUpdateTime = new Date().toISOString();

    // Salva stato ogni 10 prodotti
    if (state.processedCount % 10 === 0) {
      saveState(state);
      console.log(`\n💾 Progresso salvato: ${state.processedCount}/${state.totalProducts}`);
    }

    return true;

  } catch (error: any) {
    console.log(`   ❌ Errore: ${error.message}`);
    state.failedIds.push(product.id);
    saveState(state);
    return false;
  }
}

async function main() {
  console.log('\n🚀 OTTIMIZZAZIONE SEO MASSIVA - TUTTI I PRODOTTI PUBBLICATI\n');
  console.log('='.repeat(70));

  try {
    // Autenticazione
    console.log('\n🔐 Connessione a Odoo...');
    await authenticate();
    console.log('✅ Autenticato\n');

    // Carica stato precedente
    const state = loadState();

    // Carica lista prodotti pubblicati
    console.log('📋 Caricamento prodotti pubblicati...');
    const productIds = await callOdoo('product.template', 'search', [[
      ['is_published', '=', true]
    ]], { limit: 10000 });

    const products: ProductToUpdate[] = [];

    console.log(`   Trovati ${productIds.length} prodotti pubblicati`);
    console.log('   Caricamento dettagli...\n');

    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i];

      // Salta se già processato
      if (state.processedIds.includes(id)) {
        continue;
      }

      try {
        const product = await callOdoo('product.template', 'read', [[id], [
          'name', 'categ_id', 'default_code'
        ]], { context: { lang: 'it_IT' } });

        if (product && product[0]) {
          products.push({
            id: id,
            name: product[0].name,
            category: product[0].categ_id?.[1] || '',
            defaultCode: product[0].default_code || ''
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Impossibile caricare prodotto ID ${id}`);
      }

      if ((i + 1) % 100 === 0) {
        console.log(`   Caricati ${i + 1}/${productIds.length}...`);
      }
    }

    state.totalProducts = products.length;

    console.log('\n' + '='.repeat(70));
    console.log(`📊 RIEPILOGO:`);
    console.log(`   Prodotti da processare: ${products.length}`);
    console.log(`   Già processati: ${state.processedIds.length}`);
    console.log(`   Falliti in precedenza: ${state.failedIds.length}`);
    console.log('='.repeat(70));

    if (products.length === 0) {
      console.log('\n✅ Tutti i prodotti sono già stati processati!\n');
      return;
    }

    console.log(`\n🔄 Inizio aggiornamento di ${products.length} prodotti...\n`);
    console.log('⏱️  Tempo stimato: ~${Math.ceil(products.length * 0.5)} secondi (~${Math.ceil(products.length * 0.5 / 60)} minuti)\n');

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      const success = await updateProductSEO(product, state);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Piccola pausa per non sovraccaricare Odoo
      await new Promise(r => setTimeout(r, 300));
    }

    // Salva stato finale
    saveState(state);

    // Genera report finale
    const report = {
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(state.startTime).getTime(),
      totalProducts: state.totalProducts,
      successful: successCount,
      failed: failCount,
      processedIds: state.processedIds,
      failedIds: state.failedIds
    };

    const reportPath = 'output/all-products-seo-update-report.json';
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('🎉 AGGIORNAMENTO COMPLETATO!\n');
    console.log(`✅ Prodotti aggiornati con successo: ${successCount}`);
    console.log(`❌ Prodotti con errori: ${failCount}`);
    console.log(`⏱️  Tempo totale: ${Math.ceil(report.duration / 1000 / 60)} minuti`);
    console.log(`\n💾 Report salvato in: ${reportPath}`);
    console.log('='.repeat(70));

    if (failCount > 0) {
      console.log(`\n⚠️  Prodotti con errori (ID): ${state.failedIds.join(', ')}`);
      console.log('   Riesegui lo script per ritentare\n');
    }

    console.log('\n📋 PROSSIMI STEP PER INDICIZZAZIONE GOOGLE:\n');
    console.log('1. 🗺️  Rigenera sitemap Odoo (Sito Web → Configurazione → Sitemap)');
    console.log('2. 🔍 Google Search Console → Sitemaps → Aggiungi sitemap.xml');
    console.log('3. ⚡ (Opzionale) Richiedi indicizzazione per prodotti TOP');
    console.log('4. ⏳ Attendi 1-4 settimane per indicizzazione completa\n');

  } catch (error: any) {
    console.error('\n❌ ERRORE CRITICO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
