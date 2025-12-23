/**
 * Analisi SEO completa dei prodotti e-commerce Odoo
 * Verifica indicizzazione, keywords, meta tags, traduzioni
 */

import { writeFileSync } from 'fs';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

const LANGUAGES = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];

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

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function analyzeKeywords(text: string): string[] {
  if (!text) return [];
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Conta frequenze
  const freq: Record<string, number> = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);

  // Ritorna top keywords
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

interface ProductAnalysis {
  id: number;
  name: string;
  defaultCode: string;
  isPublished: boolean;
  websiteUrl: string;
  categoryName: string;
  translations: {
    [lang: string]: {
      name: string;
      description: string;
      descriptionSale: string;
      metaTitle: string;
      metaDescription: string;
      metaKeywords: string;
      keywords: string[];
      wordCount: number;
      hasContent: boolean;
    }
  };
  seoIssues: string[];
  seoScore: number;
  translationStatus: {
    [lang: string]: 'complete' | 'partial' | 'missing';
  };
  hasImages: boolean;
  imageCount: number;
  price: number;
}

async function fetchProductInLang(id: number, lang: string): Promise<any> {
  const result = await callOdoo('product.template', 'read', [[id], [
    'name', 'default_code', 'description', 'description_sale',
    'website_meta_title', 'website_meta_description', 'website_meta_keywords',
    'is_published', 'website_url', 'categ_id', 'image_1920',
    'list_price', 'product_variant_ids'
  ]], { context: { lang } });
  return result[0];
}

async function getProductImages(productId: number): Promise<number> {
  try {
    // Cerca immagini del prodotto
    const images = await callOdoo('product.image', 'search_count', [[
      ['product_tmpl_id', '=', productId]
    ]]);
    return images;
  } catch {
    return 0;
  }
}

async function analyzeProduct(id: number): Promise<ProductAnalysis> {
  const translations: ProductAnalysis['translations'] = {};
  const translationStatus: ProductAnalysis['translationStatus'] = {};
  const seoIssues: string[] = [];
  let baseProduct: any = null;
  let seoScore = 100;

  // Fetch in tutte le lingue
  for (const lang of LANGUAGES) {
    try {
      const product = await fetchProductInLang(id, lang);
      if (lang === 'it_IT') {
        baseProduct = product;
      }

      const descriptionText = stripHtml(product.description || '');
      const descriptionSaleText = stripHtml(product.description_sale || '');
      const fullText = `${product.name} ${descriptionText} ${descriptionSaleText}`;
      const wordCount = fullText.split(/\s+/).filter((w: string) => w.length > 2).length;

      translations[lang] = {
        name: product.name || '',
        description: descriptionText.substring(0, 200),
        descriptionSale: descriptionSaleText.substring(0, 200),
        metaTitle: product.website_meta_title || '',
        metaDescription: product.website_meta_description || '',
        metaKeywords: product.website_meta_keywords || '',
        keywords: analyzeKeywords(fullText),
        wordCount: wordCount,
        hasContent: wordCount > 20
      };

      // Verifica stato traduzione
      if (lang !== 'it_IT' && baseProduct) {
        const itTrans = translations['it_IT'];
        const hasName = product.name !== baseProduct.name && product.name?.length > 0;
        const hasDescription = descriptionText !== stripHtml(baseProduct.description || '') && descriptionText.length > 20;
        const hasMeta = product.website_meta_title !== itTrans?.metaTitle;

        if (hasName && hasDescription && hasMeta) {
          translationStatus[lang] = 'complete';
        } else if (hasName || hasDescription) {
          translationStatus[lang] = 'partial';
        } else {
          translationStatus[lang] = 'missing';
        }
      }
    } catch (e) {
      translations[lang] = {
        name: '', description: '', descriptionSale: '', metaTitle: '',
        metaDescription: '', metaKeywords: '', keywords: [], wordCount: 0, hasContent: false
      };
      translationStatus[lang] = 'missing';
    }
  }

  // Analisi SEO sulla versione italiana
  const itTrans = translations['it_IT'];
  if (itTrans) {
    // Meta Title
    if (!itTrans.metaTitle) {
      seoIssues.push('Meta title mancante');
      seoScore -= 15;
    } else if (itTrans.metaTitle.length < 30) {
      seoIssues.push('Meta title troppo corto (<30 caratteri)');
      seoScore -= 10;
    } else if (itTrans.metaTitle.length > 60) {
      seoIssues.push('Meta title troppo lungo (>60 caratteri)');
      seoScore -= 10;
    }

    // Meta Description
    if (!itTrans.metaDescription) {
      seoIssues.push('Meta description mancante');
      seoScore -= 15;
    } else if (itTrans.metaDescription.length < 120) {
      seoIssues.push('Meta description troppo corta (<120 caratteri)');
      seoScore -= 10;
    } else if (itTrans.metaDescription.length > 160) {
      seoIssues.push('Meta description troppo lunga (>160 caratteri)');
      seoScore -= 5;
    }

    // Meta Keywords
    if (!itTrans.metaKeywords) {
      seoIssues.push('Meta keywords mancanti');
      seoScore -= 10;
    }

    // Descrizione prodotto
    if (!itTrans.description && !itTrans.descriptionSale) {
      seoIssues.push('Descrizione prodotto completamente mancante');
      seoScore -= 20;
    } else if (itTrans.wordCount < 50) {
      seoIssues.push('Descrizione troppo corta (<50 parole)');
      seoScore -= 15;
    } else if (itTrans.wordCount < 100) {
      seoIssues.push('Descrizione breve (consigliato >100 parole)');
      seoScore -= 5;
    }

    // Keywords nel contenuto
    if (itTrans.keywords.length < 3) {
      seoIssues.push('Poche keywords rilevanti nel contenuto');
      seoScore -= 10;
    }
  }

  // Verifica immagini
  const imageCount = await getProductImages(id);
  const hasMainImage = baseProduct?.image_1920 ? true : false;
  const totalImages = imageCount + (hasMainImage ? 1 : 0);

  if (!hasMainImage) {
    seoIssues.push('Immagine principale mancante');
    seoScore -= 15;
  }
  if (totalImages === 0) {
    seoIssues.push('Nessuna immagine del prodotto');
    seoScore -= 20;
  } else if (totalImages < 3) {
    seoIssues.push('Poche immagini (consigliato almeno 3)');
    seoScore -= 5;
  }

  // Penalizza per traduzioni mancanti
  const missingTranslations = Object.values(translationStatus).filter(s => s === 'missing').length;
  if (missingTranslations > 0) {
    seoIssues.push(`${missingTranslations} traduzione/i mancante/i`);
    seoScore -= missingTranslations * 5;
  }

  return {
    id,
    name: baseProduct?.name || translations['it_IT']?.name || `Product ${id}`,
    defaultCode: baseProduct?.default_code || '',
    isPublished: baseProduct?.is_published || false,
    websiteUrl: baseProduct?.website_url || '',
    categoryName: baseProduct?.categ_id?.[1] || 'N/A',
    translations,
    seoIssues,
    seoScore: Math.max(0, Math.min(100, seoScore)),
    translationStatus,
    hasImages: totalImages > 0,
    imageCount: totalImages,
    price: baseProduct?.list_price || 0
  };
}

async function main() {
  console.log('🔍 Analisi SEO Prodotti E-commerce LAPA\n');
  console.log('='.repeat(70));

  console.log('\n🔐 Autenticazione...');
  await authenticate();
  console.log('✅ OK\n');

  // Fetch tutti i prodotti
  console.log('📦 Caricamento lista prodotti...');
  const productIds = await callOdoo('product.template', 'search', [[]], { limit: 2000 });
  console.log(`   ${productIds.length} prodotti trovati\n`);

  const analyses: ProductAnalysis[] = [];

  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i];
    process.stdout.write(`\r📊 Analisi prodotto ${i + 1}/${productIds.length} (ID: ${id})...`);

    try {
      const analysis = await analyzeProduct(id);
      analyses.push(analysis);
    } catch (e: any) {
      console.log(`\n   ❌ Errore ID ${id}: ${e.message}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 REPORT SEO PRODOTTI');
  console.log('='.repeat(70));

  // Statistiche generali
  const published = analyses.filter(a => a.isPublished);
  const withIssues = analyses.filter(a => a.seoIssues.length > 0);
  const lowScore = analyses.filter(a => a.seoScore < 50);
  const noImages = analyses.filter(a => !a.hasImages);

  console.log(`\n📈 STATISTICHE GENERALI`);
  console.log(`   Totale prodotti: ${analyses.length}`);
  console.log(`   Pubblicati: ${published.length}`);
  console.log(`   Con problemi SEO: ${withIssues.length}`);
  console.log(`   SEO score basso (<50): ${lowScore.length}`);
  console.log(`   Senza immagini: ${noImages.length}`);

  // Score medio
  const avgScore = analyses.reduce((sum, a) => sum + a.seoScore, 0) / analyses.length;
  console.log(`   SEO score medio: ${avgScore.toFixed(1)}/100`);

  // Stato traduzioni
  console.log(`\n🌍 STATO TRADUZIONI`);
  for (const lang of LANGUAGES.filter(l => l !== 'it_IT')) {
    const complete = analyses.filter(a => a.translationStatus[lang] === 'complete').length;
    const partial = analyses.filter(a => a.translationStatus[lang] === 'partial').length;
    const missing = analyses.filter(a => a.translationStatus[lang] === 'missing').length;
    console.log(`   ${lang}: ✅ ${complete} complete | ⚠️ ${partial} parziali | ❌ ${missing} mancanti`);
  }

  // Problemi SEO più comuni
  console.log(`\n🔧 PROBLEMI SEO PIÙ COMUNI`);
  const issueCount: Record<string, number> = {};
  analyses.forEach(a => {
    a.seoIssues.forEach(issue => {
      issueCount[issue] = (issueCount[issue] || 0) + 1;
    });
  });
  Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([issue, count]) => {
      console.log(`   ${count}x ${issue}`);
    });

  // Prodotti critici (pubblicati con score basso)
  const critical = published
    .filter(a => a.seoScore < 50 || a.seoIssues.length >= 5)
    .sort((a, b) => a.seoScore - b.seoScore);

  if (critical.length > 0) {
    console.log(`\n🚨 PRODOTTI CRITICI (pubblicati con SEO score basso)`);
    critical.slice(0, 20).forEach(a => {
      console.log(`   [${a.id}] ${a.name.substring(0, 45)}... (${a.defaultCode})`);
      console.log(`      SEO score: ${a.seoScore}/100 | Problemi: ${a.seoIssues.length} | Immagini: ${a.imageCount}`);
      console.log(`      Issues: ${a.seoIssues.slice(0, 3).join(', ')}${a.seoIssues.length > 3 ? '...' : ''}`);
    });
  }

  // Prodotti senza descrizione
  const noDescription = published.filter(a =>
    a.seoIssues.some(i => i.includes('Descrizione'))
  );

  if (noDescription.length > 0) {
    console.log(`\n📝 PRODOTTI SENZA DESCRIZIONE ADEGUATA (${noDescription.length})`);
    noDescription.slice(0, 15).forEach(a => {
      console.log(`   [${a.id}] ${a.name.substring(0, 50)}... (${a.defaultCode})`);
    });
  }

  // Prodotti con traduzioni mancanti
  const missingTranslations = published.filter(a =>
    Object.values(a.translationStatus).some(s => s === 'missing')
  );

  if (missingTranslations.length > 0) {
    console.log(`\n❌ PRODOTTI PUBBLICATI CON TRADUZIONI MANCANTI (${missingTranslations.length})`);
    missingTranslations.slice(0, 20).forEach(a => {
      const missing = LANGUAGES.filter(l => l !== 'it_IT' && a.translationStatus[l] === 'missing');
      console.log(`   [${a.id}] ${a.name.substring(0, 45)}... → manca: ${missing.join(', ')}`);
    });
  }

  // Top prodotti per SEO
  const topProducts = published
    .filter(a => a.seoScore >= 80)
    .sort((a, b) => b.seoScore - a.seoScore)
    .slice(0, 10);

  if (topProducts.length > 0) {
    console.log(`\n✅ TOP 10 PRODOTTI PER SEO (esempi da seguire)`);
    topProducts.forEach(a => {
      console.log(`   [${a.id}] ${a.name.substring(0, 50)}... - Score: ${a.seoScore}/100`);
    });
  }

  // Salva report completo
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: analyses.length,
      published: published.length,
      withIssues: withIssues.length,
      lowScore: lowScore.length,
      noImages: noImages.length,
      avgSeoScore: avgScore,
      translationStats: {
        de_CH: {
          complete: analyses.filter(a => a.translationStatus['de_CH'] === 'complete').length,
          partial: analyses.filter(a => a.translationStatus['de_CH'] === 'partial').length,
          missing: analyses.filter(a => a.translationStatus['de_CH'] === 'missing').length,
        },
        fr_CH: {
          complete: analyses.filter(a => a.translationStatus['fr_CH'] === 'complete').length,
          partial: analyses.filter(a => a.translationStatus['fr_CH'] === 'partial').length,
          missing: analyses.filter(a => a.translationStatus['fr_CH'] === 'missing').length,
        },
        en_US: {
          complete: analyses.filter(a => a.translationStatus['en_US'] === 'complete').length,
          partial: analyses.filter(a => a.translationStatus['en_US'] === 'partial').length,
          missing: analyses.filter(a => a.translationStatus['en_US'] === 'missing').length,
        }
      }
    },
    commonIssues: issueCount,
    products: analyses
  };

  writeFileSync('data/products-seo-report.json', JSON.stringify(report, null, 2));
  console.log(`\n💾 Report completo salvato in: data/products-seo-report.json`);

  console.log('\n✅ Analisi completata!');
}

main().catch(console.error);
