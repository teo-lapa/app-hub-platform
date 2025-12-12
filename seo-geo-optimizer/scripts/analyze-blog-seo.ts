/**
 * Analisi SEO/GEO completa degli articoli blog Odoo
 * Verifica traduzioni, meta tags, struttura contenuti
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

function analyzeHtml(html: string) {
  if (!html) return { wordCount: 0, h1: 0, h2: 0, h3: 0, lists: 0, images: 0, links: 0 };
  const text = stripHtml(html);
  return {
    wordCount: text.split(/\s+/).filter(w => w.length > 2).length,
    h1: (html.match(/<h1/gi) || []).length,
    h2: (html.match(/<h2/gi) || []).length,
    h3: (html.match(/<h3/gi) || []).length,
    lists: (html.match(/<ul|<ol/gi) || []).length,
    images: (html.match(/<img/gi) || []).length,
    links: (html.match(/<a\s/gi) || []).length,
  };
}

interface ArticleAnalysis {
  id: number;
  name: string;
  isPublished: boolean;
  translations: {
    [lang: string]: {
      name: string;
      subtitle: string;
      metaTitle: string;
      metaDescription: string;
      metaKeywords: string;
      contentPreview: string;
      contentWordCount: number;
      hasContent: boolean;
    }
  };
  seoIssues: string[];
  geoScore: number;
  translationStatus: {
    [lang: string]: 'complete' | 'partial' | 'missing';
  };
  structure: ReturnType<typeof analyzeHtml>;
}

async function fetchArticleInLang(id: number, lang: string): Promise<any> {
  const result = await callOdoo('blog.post', 'read', [[id], [
    'name', 'subtitle', 'content',
    'website_meta_title', 'website_meta_description', 'website_meta_keywords',
    'is_published'
  ]], { context: { lang } });
  return result[0];
}

async function analyzeArticle(id: number): Promise<ArticleAnalysis> {
  const translations: ArticleAnalysis['translations'] = {};
  const translationStatus: ArticleAnalysis['translationStatus'] = {};
  const seoIssues: string[] = [];
  let baseArticle: any = null;
  let structure: ReturnType<typeof analyzeHtml> = { wordCount: 0, h1: 0, h2: 0, h3: 0, lists: 0, images: 0, links: 0 };

  // Fetch in tutte le lingue
  for (const lang of LANGUAGES) {
    try {
      const article = await fetchArticleInLang(id, lang);
      if (lang === 'it_IT') {
        baseArticle = article;
        structure = analyzeHtml(article.content || '');
      }

      const contentText = stripHtml(article.content || '');
      const wordCount = contentText.split(/\s+/).filter((w: string) => w.length > 2).length;

      translations[lang] = {
        name: article.name || '',
        subtitle: article.subtitle || '',
        metaTitle: article.website_meta_title || '',
        metaDescription: article.website_meta_description || '',
        metaKeywords: article.website_meta_keywords || '',
        contentPreview: contentText.substring(0, 200),
        contentWordCount: wordCount,
        hasContent: wordCount > 50
      };

      // Verifica stato traduzione
      if (lang !== 'it_IT') {
        const itTrans = translations['it_IT'];
        if (!itTrans) {
          translationStatus[lang] = 'missing';
        } else {
          const hasName = article.name !== itTrans.name && article.name?.length > 0;
          const hasContent = contentText !== stripHtml(baseArticle?.content || '') && wordCount > 50;
          const hasMeta = article.website_meta_title !== itTrans.metaTitle;

          if (hasName && hasContent && hasMeta) {
            translationStatus[lang] = 'complete';
          } else if (hasName || hasContent) {
            translationStatus[lang] = 'partial';
          } else {
            translationStatus[lang] = 'missing';
          }
        }
      }
    } catch (e) {
      translations[lang] = {
        name: '', subtitle: '', metaTitle: '', metaDescription: '',
        metaKeywords: '', contentPreview: '', contentWordCount: 0, hasContent: false
      };
      translationStatus[lang] = 'missing';
    }
  }

  // Analisi SEO
  const itTrans = translations['it_IT'];
  if (itTrans) {
    if (!itTrans.metaTitle) seoIssues.push('Meta title mancante');
    else if (itTrans.metaTitle.length < 30) seoIssues.push('Meta title troppo corto (<30 caratteri)');
    else if (itTrans.metaTitle.length > 60) seoIssues.push('Meta title troppo lungo (>60 caratteri)');

    if (!itTrans.metaDescription) seoIssues.push('Meta description mancante');
    else if (itTrans.metaDescription.length < 120) seoIssues.push('Meta description troppo corta (<120 caratteri)');
    else if (itTrans.metaDescription.length > 160) seoIssues.push('Meta description troppo lunga (>160 caratteri)');

    if (!itTrans.metaKeywords) seoIssues.push('Meta keywords mancanti');

    if (itTrans.contentWordCount < 300) seoIssues.push('Contenuto troppo corto (<300 parole)');
    if (structure.h1 === 0) seoIssues.push('Manca H1');
    if (structure.h1 > 1) seoIssues.push('Troppi H1 (dovrebbe essere 1)');
    if (structure.h2 === 0) seoIssues.push('Mancano H2 (sottotitoli)');
    if (structure.lists === 0) seoIssues.push('Nessuna lista (UL/OL)');
    if (structure.images === 0) seoIssues.push('Nessuna immagine');
    if (structure.links === 0) seoIssues.push('Nessun link');
  }

  // Calcola GEO score (0-100)
  let geoScore = 0;
  const content = (itTrans?.contentPreview || '').toLowerCase() + ' ' + (itTrans?.name || '').toLowerCase();

  // Menzioni geografiche svizzere
  const swissTerms = ['svizzera', 'suisse', 'schweiz', 'switzerland', 'zurich', 'zurigo', 'berna', 'bern',
    'ginevra', 'geneva', 'genève', 'lucerna', 'luzern', 'ticino', 'vallese', 'grigioni', 'argovia',
    'basilea', 'basel', 'canton', 'cantone', 'kanton', 'svizzero', 'svizzeri', 'elvetico'];
  const geoMatches = swissTerms.filter(term => content.includes(term)).length;
  geoScore += Math.min(geoMatches * 15, 50);

  // Brand LAPA
  if (content.includes('lapa')) geoScore += 20;

  // Traduzioni complete = buon targeting locale
  const completeTranslations = Object.values(translationStatus).filter(s => s === 'complete').length;
  geoScore += completeTranslations * 10;

  return {
    id,
    name: baseArticle?.name || translations['it_IT']?.name || `Article ${id}`,
    isPublished: baseArticle?.is_published || false,
    translations,
    seoIssues,
    geoScore: Math.min(geoScore, 100),
    translationStatus,
    structure
  };
}

async function main() {
  console.log('🔍 Analisi SEO/GEO Blog LAPA\n');
  console.log('='.repeat(60));

  console.log('\n🔐 Autenticazione...');
  await authenticate();
  console.log('✅ OK\n');

  // Fetch tutti gli articoli
  console.log('📚 Caricamento lista articoli...');
  const articleIds = await callOdoo('blog.post', 'search', [[]], { limit: 500 });
  console.log(`   ${articleIds.length} articoli trovati\n`);

  const analyses: ArticleAnalysis[] = [];

  for (let i = 0; i < articleIds.length; i++) {
    const id = articleIds[i];
    process.stdout.write(`\r📊 Analisi articolo ${i + 1}/${articleIds.length} (ID: ${id})...`);

    try {
      const analysis = await analyzeArticle(id);
      analyses.push(analysis);
    } catch (e: any) {
      console.log(`\n   ❌ Errore ID ${id}: ${e.message}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📊 REPORT SEO/GEO');
  console.log('='.repeat(60));

  // Statistiche generali
  const published = analyses.filter(a => a.isPublished);
  const withSeoIssues = analyses.filter(a => a.seoIssues.length > 0);
  const lowGeoScore = analyses.filter(a => a.geoScore < 30);

  console.log(`\n📈 STATISTICHE GENERALI`);
  console.log(`   Totale articoli: ${analyses.length}`);
  console.log(`   Pubblicati: ${published.length}`);
  console.log(`   Con problemi SEO: ${withSeoIssues.length}`);
  console.log(`   GEO score basso (<30): ${lowGeoScore.length}`);

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
    .slice(0, 10)
    .forEach(([issue, count]) => {
      console.log(`   ${count}x ${issue}`);
    });

  // Articoli critici (pubblicati con molti problemi)
  const critical = published
    .filter(a => a.seoIssues.length >= 3 || a.geoScore < 20)
    .sort((a, b) => b.seoIssues.length - a.seoIssues.length);

  if (critical.length > 0) {
    console.log(`\n🚨 ARTICOLI CRITICI (pubblicati con molti problemi)`);
    critical.slice(0, 15).forEach(a => {
      console.log(`   [${a.id}] ${a.name.substring(0, 40)}...`);
      console.log(`      SEO issues: ${a.seoIssues.length} | GEO score: ${a.geoScore}`);
      console.log(`      Traduzioni: DE=${a.translationStatus['de_CH']} FR=${a.translationStatus['fr_CH']} EN=${a.translationStatus['en_US']}`);
    });
  }

  // Articoli con traduzioni mancanti
  const missingTranslations = analyses.filter(a =>
    a.isPublished &&
    (a.translationStatus['de_CH'] === 'missing' ||
     a.translationStatus['fr_CH'] === 'missing' ||
     a.translationStatus['en_US'] === 'missing')
  );

  if (missingTranslations.length > 0) {
    console.log(`\n❌ ARTICOLI PUBBLICATI CON TRADUZIONI MANCANTI (${missingTranslations.length})`);
    missingTranslations.slice(0, 20).forEach(a => {
      const missing = LANGUAGES.filter(l => l !== 'it_IT' && a.translationStatus[l] === 'missing');
      console.log(`   [${a.id}] ${a.name.substring(0, 45)}... → manca: ${missing.join(', ')}`);
    });
  }

  // Salva report completo
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: analyses.length,
      published: published.length,
      withSeoIssues: withSeoIssues.length,
      lowGeoScore: lowGeoScore.length,
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
    articles: analyses
  };

  writeFileSync('data/seo-geo-report.json', JSON.stringify(report, null, 2));
  console.log(`\n💾 Report completo salvato in: data/seo-geo-report.json`);

  console.log('\n✅ Analisi completata!');
}

main().catch(console.error);
