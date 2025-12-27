/**
 * Fix Complete SEO Script
 * Corregge automaticamente i meta tag SEO di TUTTO il sito:
 * - Articoli Blog
 * - Prodotti
 * - Categorie
 * - Pagine Website
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

// Limiti SEO
const SEO_LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  TITLE_OPTIMAL: 55,
  DESCRIPTION_MIN: 120,
  DESCRIPTION_MAX: 160,
  DESCRIPTION_OPTIMAL: 155,
};

// Brand e keywords base
const BRAND = 'LAPA';
const BASE_KEYWORDS = ['prodotti italiani', 'LAPA', 'grossista Svizzera', 'gastronomia italiana', 'Zurigo'];

class OdooFixer {
  private uid: number | null = null;
  private cookies: string | null = null;

  async authenticate(): Promise<boolean> {
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
      this.cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
    }

    const data = await response.json();
    if (data.result?.uid) {
      this.uid = data.result.uid;
      if (!this.cookies && data.result.session_id) {
        this.cookies = `session_id=${data.result.session_id}`;
      }
      console.log(`✅ Autenticato come UID: ${this.uid}`);
      return true;
    }
    throw new Error('Authentication failed');
  }

  async searchRead<T>(model: string, domain: any[], fields: string[], options: any = {}): Promise<T[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model, method: 'search_read', args: [],
          kwargs: { domain, fields, limit: options.limit || 5000, context: options.context }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${model}: ${data.error.message}`);
    return data.result || [];
  }

  async write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'write', args: [ids, values], kwargs: { context } },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }

  async getFieldsInfo(model: string): Promise<string[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'fields_get', args: [], kwargs: { attributes: ['type'] } },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) return [];
    return Object.keys(data.result || {});
  }
}

// ================== FUNZIONI DI OTTIMIZZAZIONE SEO ==================

function cleanText(text: string): string {
  return text
    .replace(/Non specificata.*?(?=\.|,|\||$)/gi, '')
    .replace(/\.\.\./g, '.')
    .replace(/\s+/g, ' ')
    .replace(/\| \|/g, '|')
    .replace(/\|\s*$/g, '')
    .replace(/^\s*\|/g, '')
    .trim();
}

function optimizeTitle(name: string, type: 'product' | 'article' | 'category' | 'page', subtitle?: string): string {
  let title = cleanText(name);

  // Suffissi per tipo
  const suffixes: Record<string, string> = {
    product: ' | LAPA Svizzera',
    article: ' | Ricette LAPA',
    category: ' | LAPA Grossista',
    page: ' | LAPA'
  };

  // Se il titolo è troppo lungo, accorcia intelligentemente
  if (title.length > SEO_LIMITS.TITLE_OPTIMAL) {
    // Rimuovi parti dopo | o :
    const sepIndex = title.search(/\s*[\|:]\s*/);
    if (sepIndex > 20 && sepIndex < SEO_LIMITS.TITLE_OPTIMAL) {
      title = title.substring(0, sepIndex);
    } else {
      // Taglia all'ultima parola completa
      title = title.substring(0, SEO_LIMITS.TITLE_OPTIMAL - 15).replace(/\s+\S*$/, '');
    }
  }

  // Aggiungi suffisso se c'è spazio
  const suffix = suffixes[type];
  if (title.length + suffix.length <= SEO_LIMITS.TITLE_MAX && !title.includes('LAPA')) {
    title = title + suffix;
  }

  // Se ancora troppo corto, usa subtitle
  if (title.length < SEO_LIMITS.TITLE_MIN && subtitle) {
    const cleanSubtitle = cleanText(subtitle).substring(0, 30);
    title = `${title} - ${cleanSubtitle}`;
  }

  return title.substring(0, SEO_LIMITS.TITLE_MAX).trim();
}

function optimizeDescription(
  description: string | undefined,
  name: string,
  type: 'product' | 'article' | 'category' | 'page',
  subtitle?: string,
  price?: number
): string {
  let desc = cleanText(description || subtitle || '');

  // Se manca descrizione, genera una base
  if (desc.length < 50) {
    switch (type) {
      case 'product':
        desc = `${name}. Prodotto italiano di alta qualità disponibile da LAPA, il tuo grossista di fiducia in Svizzera.`;
        if (price) desc += ` Prezzo: CHF ${price.toFixed(2)}.`;
        break;
      case 'article':
        desc = `${name}. Scopri ricette e tradizioni italiane con LAPA, il grossista di prodotti italiani in Svizzera.`;
        break;
      case 'category':
        desc = `Scopri i migliori ${name.toLowerCase()} italiani. LAPA offre prodotti di qualità superiore con consegna in tutta la Svizzera.`;
        break;
      case 'page':
        desc = `${name}. LAPA - Il tuo partner per prodotti alimentari italiani in Svizzera. Qualità, tradizione, consegna rapida.`;
        break;
    }
  }

  // Accorcia se troppo lunga
  if (desc.length > SEO_LIMITS.DESCRIPTION_MAX) {
    desc = desc.substring(0, SEO_LIMITS.DESCRIPTION_MAX - 3).replace(/\s+\S*$/, '') + '...';
  }

  // Allunga se troppo corta
  if (desc.length < SEO_LIMITS.DESCRIPTION_MIN && !desc.includes('LAPA')) {
    const extra = ' Ordina su LAPA Svizzera.';
    if (desc.length + extra.length <= SEO_LIMITS.DESCRIPTION_MAX) {
      desc = desc.replace(/\.?\s*$/, '.') + extra;
    }
  }

  return desc.substring(0, SEO_LIMITS.DESCRIPTION_MAX).trim();
}

function optimizeKeywords(keywords: string | undefined, name: string, category?: string): string {
  let kw = cleanText(keywords || '');

  // Estrai keywords dal nome
  const nameWords = name
    .toLowerCase()
    .replace(/[^\w\sàèéìòù]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Keywords base
  const baseKw = [...nameWords.slice(0, 3), ...BASE_KEYWORDS];
  if (category) baseKw.unshift(category.toLowerCase());

  // Se mancano keywords, genera
  if (kw.length < 20) {
    kw = baseKw.join(', ');
  } else {
    // Pulisci keywords esistenti e aggiungi mancanti
    const existing = kw.split(',').map(k => k.trim().toLowerCase());
    for (const bk of BASE_KEYWORDS) {
      if (!existing.some(e => e.includes(bk.toLowerCase()))) {
        existing.push(bk);
      }
    }
    kw = existing.filter(k => k.length > 0).slice(0, 10).join(', ');
  }

  return kw.substring(0, 255);
}

function needsFix(item: any, type: string): { title: boolean; desc: boolean; kw: boolean } {
  const title = item.website_meta_title || '';
  const desc = item.website_meta_description || '';
  const kw = item.website_meta_keywords || '';

  return {
    title: !title || title.length < SEO_LIMITS.TITLE_MIN || title.length > SEO_LIMITS.TITLE_MAX ||
           title.includes('Non specificata') || title.includes(' | | ') ||
           (type === 'product' && !title.includes('LAPA') && title.length < 50),
    desc: !desc || desc.length < SEO_LIMITS.DESCRIPTION_MIN || desc.length > SEO_LIMITS.DESCRIPTION_MAX ||
          desc.includes('Non specificata'),
    kw: !kw || kw.length < 20 || kw.includes('Non specificata')
  };
}

// ================== MAIN ==================

interface FixResult {
  type: string;
  id: number;
  name: string;
  fieldsUpdated: string[];
  success: boolean;
  error?: string;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔧 LAPA SEO FIXER - Correzione Completa Sito');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooFixer();
  const results: FixResult[] = [];
  const stats = {
    products: { total: 0, fixed: 0, errors: 0 },
    articles: { total: 0, fixed: 0, errors: 0 },
    categories: { total: 0, fixed: 0, errors: 0 },
    pages: { total: 0, fixed: 0, errors: 0 }
  };

  try {
    console.log('🔐 Autenticazione...');
    await odoo.authenticate();
    console.log('');

    // ==================== PRODOTTI ====================
    console.log('📦 Analisi PRODOTTI...');
    const products = await odoo.searchRead<any>(
      'product.template',
      [['is_published', '=', true]],
      ['id', 'name', 'description_sale', 'website_description', 'website_meta_title',
       'website_meta_description', 'website_meta_keywords', 'list_price', 'categ_id'],
      { limit: 5000 }
    );
    stats.products.total = products.length;
    console.log(`   Trovati: ${products.length} prodotti pubblicati`);

    for (const product of products) {
      const needs = needsFix(product, 'product');
      if (needs.title || needs.desc || needs.kw) {
        const changes: any = {};
        const category = product.categ_id?.[1] || '';

        if (needs.title) {
          changes.website_meta_title = optimizeTitle(product.name, 'product');
        }
        if (needs.desc) {
          changes.website_meta_description = optimizeDescription(
            product.website_meta_description || product.description_sale,
            product.name, 'product', undefined, product.list_price
          );
        }
        if (needs.kw) {
          changes.website_meta_keywords = optimizeKeywords(
            product.website_meta_keywords, product.name, category
          );
        }

        try {
          await odoo.write('product.template', [product.id], changes);
          stats.products.fixed++;
          results.push({
            type: 'product', id: product.id, name: product.name,
            fieldsUpdated: Object.keys(changes), success: true
          });
        } catch (err) {
          stats.products.errors++;
          results.push({
            type: 'product', id: product.id, name: product.name,
            fieldsUpdated: [], success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
    }
    console.log(`   ✅ Corretti: ${stats.products.fixed}, ❌ Errori: ${stats.products.errors}`);

    // ==================== ARTICOLI BLOG ====================
    console.log('\n📝 Analisi ARTICOLI BLOG...');
    const articles = await odoo.searchRead<any>(
      'blog.post',
      [['website_published', '=', true]],
      ['id', 'name', 'subtitle', 'content', 'website_meta_title',
       'website_meta_description', 'website_meta_keywords'],
      { limit: 1000 }
    );
    stats.articles.total = articles.length;
    console.log(`   Trovati: ${articles.length} articoli pubblicati`);

    for (const article of articles) {
      const needs = needsFix(article, 'article');
      if (needs.title || needs.desc || needs.kw) {
        const changes: any = {};

        if (needs.title) {
          changes.website_meta_title = optimizeTitle(article.name, 'article', article.subtitle);
        }
        if (needs.desc) {
          changes.website_meta_description = optimizeDescription(
            article.website_meta_description, article.name, 'article', article.subtitle
          );
        }
        if (needs.kw) {
          changes.website_meta_keywords = optimizeKeywords(
            article.website_meta_keywords, article.name
          );
        }

        try {
          await odoo.write('blog.post', [article.id], changes);
          stats.articles.fixed++;
          results.push({
            type: 'article', id: article.id, name: article.name,
            fieldsUpdated: Object.keys(changes), success: true
          });
        } catch (err) {
          stats.articles.errors++;
          results.push({
            type: 'article', id: article.id, name: article.name,
            fieldsUpdated: [], success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
    }
    console.log(`   ✅ Corretti: ${stats.articles.fixed}, ❌ Errori: ${stats.articles.errors}`);

    // ==================== CATEGORIE ====================
    console.log('\n📂 Analisi CATEGORIE...');
    const categories = await odoo.searchRead<any>(
      'product.public.category',
      [],
      ['id', 'name', 'display_name', 'website_meta_title', 'website_meta_description'],
      { limit: 500 }
    );
    stats.categories.total = categories.length;
    console.log(`   Trovate: ${categories.length} categorie`);

    for (const cat of categories) {
      const needs = needsFix(cat, 'category');
      if (needs.title || needs.desc) {
        const changes: any = {};

        if (needs.title) {
          changes.website_meta_title = optimizeTitle(cat.display_name || cat.name, 'category');
        }
        if (needs.desc) {
          changes.website_meta_description = optimizeDescription(
            cat.website_meta_description, cat.display_name || cat.name, 'category'
          );
        }

        try {
          await odoo.write('product.public.category', [cat.id], changes);
          stats.categories.fixed++;
          results.push({
            type: 'category', id: cat.id, name: cat.name,
            fieldsUpdated: Object.keys(changes), success: true
          });
        } catch (err) {
          stats.categories.errors++;
          results.push({
            type: 'category', id: cat.id, name: cat.name,
            fieldsUpdated: [], success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
    }
    console.log(`   ✅ Corretti: ${stats.categories.fixed}, ❌ Errori: ${stats.categories.errors}`);

    // ==================== PAGINE WEBSITE ====================
    console.log('\n🌐 Analisi PAGINE WEBSITE...');
    try {
      const pages = await odoo.searchRead<any>(
        'website.page',
        [['is_published', '=', true]],
        ['id', 'name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
        { limit: 500 }
      );
      stats.pages.total = pages.length;
      console.log(`   Trovate: ${pages.length} pagine`);

      for (const page of pages) {
        const needs = needsFix(page, 'page');
        if (needs.title || needs.desc || needs.kw) {
          const changes: any = {};

          if (needs.title) {
            changes.website_meta_title = optimizeTitle(page.name, 'page');
          }
          if (needs.desc) {
            changes.website_meta_description = optimizeDescription(
              page.website_meta_description, page.name, 'page'
            );
          }
          if (needs.kw) {
            changes.website_meta_keywords = optimizeKeywords(
              page.website_meta_keywords, page.name
            );
          }

          try {
            await odoo.write('website.page', [page.id], changes);
            stats.pages.fixed++;
            results.push({
              type: 'page', id: page.id, name: page.name,
              fieldsUpdated: Object.keys(changes), success: true
            });
          } catch (err) {
            stats.pages.errors++;
            results.push({
              type: 'page', id: page.id, name: page.name,
              fieldsUpdated: [], success: false,
              error: err instanceof Error ? err.message : 'Unknown error'
            });
          }
        }
      }
      console.log(`   ✅ Corretti: ${stats.pages.fixed}, ❌ Errori: ${stats.pages.errors}`);
    } catch (err) {
      console.log(`   ⚠️ Impossibile accedere alle pagine website: ${err instanceof Error ? err.message : 'errore'}`);
    }

    // ==================== RIEPILOGO ====================
    console.log('\n' + '═'.repeat(80));
    console.log('📊 RIEPILOGO FINALE');
    console.log('═'.repeat(80));
    console.log(`
┌─────────────────┬──────────┬──────────┬──────────┐
│ Tipo            │ Totale   │ Corretti │ Errori   │
├─────────────────┼──────────┼──────────┼──────────┤
│ Prodotti        │ ${String(stats.products.total).padStart(8)} │ ${String(stats.products.fixed).padStart(8)} │ ${String(stats.products.errors).padStart(8)} │
│ Articoli Blog   │ ${String(stats.articles.total).padStart(8)} │ ${String(stats.articles.fixed).padStart(8)} │ ${String(stats.articles.errors).padStart(8)} │
│ Categorie       │ ${String(stats.categories.total).padStart(8)} │ ${String(stats.categories.fixed).padStart(8)} │ ${String(stats.categories.errors).padStart(8)} │
│ Pagine Website  │ ${String(stats.pages.total).padStart(8)} │ ${String(stats.pages.fixed).padStart(8)} │ ${String(stats.pages.errors).padStart(8)} │
├─────────────────┼──────────┼──────────┼──────────┤
│ TOTALE          │ ${String(stats.products.total + stats.articles.total + stats.categories.total + stats.pages.total).padStart(8)} │ ${String(stats.products.fixed + stats.articles.fixed + stats.categories.fixed + stats.pages.fixed).padStart(8)} │ ${String(stats.products.errors + stats.articles.errors + stats.categories.errors + stats.pages.errors).padStart(8)} │
└─────────────────┴──────────┴──────────┴──────────┘
`);

    // Salva report dettagliato
    const dataDir = resolve(__dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      stats,
      totalFixed: stats.products.fixed + stats.articles.fixed + stats.categories.fixed + stats.pages.fixed,
      totalErrors: stats.products.errors + stats.articles.errors + stats.categories.errors + stats.pages.errors,
      details: results
    };

    const reportPath = resolve(dataDir, 'complete-seo-fix-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report dettagliato salvato: ${reportPath}`);

    console.log('\n✨ Ottimizzazione SEO completa!');

  } catch (error) {
    console.error('\n❌ Errore fatale:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
