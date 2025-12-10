/**
 * Fetch All Content
 * Scarica articoli e prodotti da Odoo e li salva in JSON per analisi Claude Code
 */

import { config } from 'dotenv';
import xmlrpc from 'xmlrpc';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_CONFIG = {
  url: process.env.ODOO_URL!,
  db: process.env.ODOO_DB!,
  username: process.env.ODOO_USERNAME!,
  password: process.env.ODOO_PASSWORD!,
};

// Crea client XML-RPC
const url = new URL(ODOO_CONFIG.url);
const commonClient = xmlrpc.createSecureClient({
  host: url.hostname,
  port: 443,
  path: '/xmlrpc/2/common',
});
const objectClient = xmlrpc.createSecureClient({
  host: url.hostname,
  port: 443,
  path: '/xmlrpc/2/object',
});

async function authenticate(): Promise<number> {
  return new Promise((resolve, reject) => {
    commonClient.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (error, value) => {
        if (error) reject(error);
        else if (!value) reject(new Error('Auth failed'));
        else resolve(value as number);
      }
    );
  });
}

async function execute<T>(uid: number, model: string, method: string, args: any[], kwargs: any = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    objectClient.methodCall(
      'execute_kw',
      [ODOO_CONFIG.db, uid, ODOO_CONFIG.password, model, method, args, kwargs],
      (error, value) => {
        if (error) reject(error);
        else resolve(value as T);
      }
    );
  });
}

function htmlToText(html: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('script, style').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

function analyzeContent(html: string) {
  if (!html) return { wordCount: 0, hasH1: false, hasH2: false, hasList: false, hasImages: 0 };
  const $ = cheerio.load(html);
  const text = htmlToText(html);
  return {
    wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
    hasH1: $('h1').length > 0,
    h1Count: $('h1').length,
    hasH2: $('h2').length > 0,
    h2Count: $('h2').length,
    hasList: $('ul, ol').length > 0,
    hasImages: $('img').length,
    imagesWithAlt: $('img[alt]').filter((_, el) => $(el).attr('alt')!.length > 0).length,
  };
}

async function main() {
  console.log('🔄 Connessione a Odoo...');
  const uid = await authenticate();
  console.log(`✅ Connesso (UID: ${uid})\n`);

  // Fetch articoli
  console.log('📰 Caricamento articoli blog...');
  const articles = await execute<any[]>(uid, 'blog.post', 'search_read', [[]], {
    fields: ['id', 'name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description',
             'website_meta_keywords', 'is_published', 'create_date', 'write_date'],
    limit: 500,
  });

  const processedArticles = articles.map(article => {
    const contentAnalysis = analyzeContent(article.content || '');
    return {
      id: article.id,
      name: article.name,
      subtitle: article.subtitle || '',
      content_text: htmlToText(article.content || ''),
      content_html: article.content || '',
      meta: {
        title: article.website_meta_title || '',
        description: article.website_meta_description || '',
        keywords: article.website_meta_keywords || '',
      },
      is_published: article.is_published,
      dates: {
        created: article.create_date,
        updated: article.write_date,
      },
      analysis: {
        ...contentAnalysis,
        titleLength: (article.website_meta_title || '').length,
        descriptionLength: (article.website_meta_description || '').length,
        hasMeta: !!(article.website_meta_title && article.website_meta_description),
      },
    };
  });

  console.log(`   Trovati ${processedArticles.length} articoli`);

  // Fetch prodotti
  console.log('📦 Caricamento prodotti...');
  const products = await execute<any[]>(uid, 'product.template', 'search_read', [[['is_published', '=', true]]], {
    fields: ['id', 'name', 'description_sale', 'website_description', 'website_meta_title',
             'website_meta_description', 'website_meta_keywords', 'list_price', 'categ_id'],
    limit: 1000,
  });

  const processedProducts = products.map(product => {
    const description = product.website_description || product.description_sale || '';
    const contentAnalysis = analyzeContent(description);
    return {
      id: product.id,
      name: product.name,
      description_text: htmlToText(description),
      description_html: description,
      meta: {
        title: product.website_meta_title || '',
        description: product.website_meta_description || '',
        keywords: product.website_meta_keywords || '',
      },
      price: product.list_price,
      category: product.categ_id ? product.categ_id[1] : null,
      analysis: {
        ...contentAnalysis,
        titleLength: (product.website_meta_title || '').length,
        descriptionLength: (product.website_meta_description || '').length,
        hasMeta: !!(product.website_meta_title && product.website_meta_description),
      },
    };
  });

  console.log(`   Trovati ${processedProducts.length} prodotti\n`);

  // Salva in JSON
  const dataDir = resolve(__dirname, '..', 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    summary: {
      totalArticles: processedArticles.length,
      publishedArticles: processedArticles.filter(a => a.is_published).length,
      articlesWithMeta: processedArticles.filter(a => a.analysis.hasMeta).length,
      totalProducts: processedProducts.length,
      productsWithMeta: processedProducts.filter(p => p.analysis.hasMeta).length,
    },
    articles: processedArticles,
    products: processedProducts,
  };

  const outputPath = resolve(dataDir, 'content-export.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`💾 Dati salvati in: ${outputPath}`);

  // Stampa sommario
  console.log('\n' + '='.repeat(60));
  console.log('📊 SOMMARIO');
  console.log('='.repeat(60));
  console.log(`\nArticoli: ${output.summary.totalArticles} totali, ${output.summary.publishedArticles} pubblicati`);
  console.log(`  - Con meta SEO: ${output.summary.articlesWithMeta} (${Math.round(output.summary.articlesWithMeta/output.summary.totalArticles*100)}%)`);
  console.log(`\nProdotti: ${output.summary.totalProducts} pubblicati`);
  console.log(`  - Con meta SEO: ${output.summary.productsWithMeta} (${Math.round(output.summary.productsWithMeta/output.summary.totalProducts*100)}%)`);

  // Articoli senza meta
  const articlesNoMeta = processedArticles.filter(a => !a.analysis.hasMeta);
  if (articlesNoMeta.length > 0) {
    console.log(`\n⚠️  Articoli SENZA meta SEO (${articlesNoMeta.length}):`);
    articlesNoMeta.slice(0, 10).forEach(a => {
      console.log(`   - [${a.id}] ${a.name.slice(0, 50)}`);
    });
    if (articlesNoMeta.length > 10) console.log(`   ... e altri ${articlesNoMeta.length - 10}`);
  }

  // Prodotti senza meta
  const productsNoMeta = processedProducts.filter(p => !p.analysis.hasMeta);
  if (productsNoMeta.length > 0) {
    console.log(`\n⚠️  Prodotti SENZA meta SEO (${productsNoMeta.length}):`);
    productsNoMeta.slice(0, 10).forEach(p => {
      console.log(`   - [${p.id}] ${p.name.slice(0, 50)}`);
    });
    if (productsNoMeta.length > 10) console.log(`   ... e altri ${productsNoMeta.length - 10}`);
  }

  console.log('\n✅ Export completato!');
  console.log('📌 Ora chiedi a Claude Code di analizzare: data/content-export.json');
}

main().catch(console.error);
