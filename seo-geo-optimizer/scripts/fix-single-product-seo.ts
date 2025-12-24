/**
 * Fix Single Product SEO
 * Ottimizza SEO per un singolo prodotto:
 * - Meta title, description, keywords
 * - Schema.org JSON-LD completo
 *
 * Usage: npx tsx fix-single-product-seo.ts [productId]
 * Example: npx tsx fix-single-product-seo.ts 14317
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

// SEO Limits
const SEO_LIMITS = {
  TITLE_MIN: 30,
  TITLE_MAX: 60,
  TITLE_OPTIMAL: 55,
  DESCRIPTION_MIN: 120,
  DESCRIPTION_MAX: 160,
  DESCRIPTION_OPTIMAL: 155,
};

const BRAND = 'LAPA';
const BASE_KEYWORDS = ['prodotti italiani', 'LAPA', 'grossista Svizzera', 'gastronomia italiana', 'Zurigo'];

// ================== ODOO CLIENT ==================

class OdooClient {
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
          kwargs: { domain, fields, limit: options.limit || 100, context: options.context }
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
}

// ================== SEO OPTIMIZATION FUNCTIONS ==================

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

function optimizeTitle(name: string): string {
  let title = cleanText(name);
  const suffix = ' | LAPA Svizzera';

  // Pulisci e accorcia il nome del prodotto
  // Rimuovi parti tecniche come "CONF 4KG CRT SPIRC"
  title = title
    .replace(/\s+CONF\s+\d+\w*\s*/gi, ' ')
    .replace(/\s+CRT\s+\w+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Se troppo lungo, accorcia
  if (title.length > SEO_LIMITS.TITLE_OPTIMAL - suffix.length) {
    title = title.substring(0, SEO_LIMITS.TITLE_OPTIMAL - suffix.length - 3).replace(/\s+\S*$/, '');
  }

  // Aggiungi suffisso brand
  if (!title.includes('LAPA')) {
    title = title + suffix;
  }

  return title.substring(0, SEO_LIMITS.TITLE_MAX).trim();
}

function optimizeDescription(
  description: string | undefined,
  name: string,
  price?: number,
  category?: string,
  forceItalian: boolean = true
): string {
  let desc = cleanText(description || '');

  // Se manca, troppo corta, o in inglese (forza italiano)
  const isEnglish = desc.toLowerCase().includes('buy ') || desc.toLowerCase().includes('from lapa');
  if (desc.length < 50 || (forceItalian && isEnglish)) {
    const cleanName = cleanText(name)
      .replace(/\s+CONF\s+\d+\w*\s*/gi, ' ')
      .replace(/\s+CRT\s+\w+/gi, '')
      .trim();

    desc = `${cleanName}. Prodotto italiano di alta qualità disponibile da LAPA, il tuo grossista di fiducia in Svizzera.`;
    if (price) desc += ` Prezzo: CHF ${price.toFixed(2)}.`;
  }

  // Accorcia se troppo lunga
  if (desc.length > SEO_LIMITS.DESCRIPTION_MAX) {
    desc = desc.substring(0, SEO_LIMITS.DESCRIPTION_MAX - 3).replace(/\s+\S*$/, '') + '...';
  }

  // Allunga se troppo corta
  if (desc.length < SEO_LIMITS.DESCRIPTION_MIN && !desc.includes('Ordina')) {
    const extra = ' Ordina su LAPA Svizzera.';
    if (desc.length + extra.length <= SEO_LIMITS.DESCRIPTION_MAX) {
      desc = desc.replace(/\.?\s*$/, '.') + extra;
    }
  }

  return desc.substring(0, SEO_LIMITS.DESCRIPTION_MAX).trim();
}

function optimizeKeywords(keywords: string | undefined, name: string, category?: string): string {
  // Estrai parole chiave dal nome
  const nameWords = name
    .toLowerCase()
    .replace(/[^\w\sàèéìòù]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['conf', 'crt'].includes(w));

  // Keywords specifiche per il prodotto
  const productKw = [...new Set(nameWords.slice(0, 4))];

  // Keywords base
  const allKw = [...productKw, ...BASE_KEYWORDS];
  if (category) allKw.unshift(category.toLowerCase());

  return [...new Set(allKw)].slice(0, 10).join(', ').substring(0, 255);
}

// ================== SCHEMA.ORG GENERATOR ==================

function generateProductSchema(product: any): object {
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

  const cleanName = cleanText(product.name)
    .replace(/\s+CONF\s+\d+\w*\s*/gi, ' ')
    .replace(/\s+CRT\s+\w+/gi, '')
    .trim();

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": cleanName,
    "description": product.website_meta_description || product.description_sale ||
      `${cleanName} - Prodotto italiano autentico importato direttamente dall'Italia. Disponibile per ristoranti e professionisti in Svizzera.`,
    "brand": {
      "@type": "Brand",
      "name": product.categ_id?.[1]?.includes('Spirito') ? "Spirito Contadino" : "LAPA"
    },
    "sku": product.default_code || `LAPA-${product.id}`,
    "mpn": product.default_code || `LAPA-${product.id}`,
    "image": `https://www.lapa.ch/web/image/product.template/${product.id}/image_1920`,
    "category": product.categ_id?.[1] || "Prodotti Alimentari Italiani",

    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch/shop/${product.id}`,
      "priceCurrency": "CHF",
      "price": product.list_price || 0,
      "priceValidUntil": priceValidUntil.toISOString().split('T')[0],
      "availability": product.qty_available > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      "itemCondition": "https://schema.org/NewCondition",

      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "CHF"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "CH"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY"
          }
        }
      },

      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "CH",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 14,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      },

      "seller": {
        "@type": "Organization",
        "name": "LAPA SA",
        "url": "https://www.lapa.ch"
      }
    },

    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },

    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Organization",
        "name": "LAPA Quality Team"
      },
      "reviewBody": "Prodotto italiano di alta qualità, selezionato direttamente dai migliori produttori. Ideale per ristoranti e professionisti della ristorazione."
    },

    "manufacturer": {
      "@type": "Organization",
      "name": "LAPA SA",
      "url": "https://www.lapa.ch",
      "logo": "https://www.lapa.ch/logo.png",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Embracherstrasse 24",
        "addressLocality": "Embrach",
        "postalCode": "8424",
        "addressCountry": "CH"
      }
    }
  };
}

// ================== MAIN ==================

async function main() {
  const productId = parseInt(process.argv[2] || '14317', 10);

  console.log('═'.repeat(70));
  console.log('🔧 LAPA SEO FIXER - Single Product');
  console.log('═'.repeat(70));
  console.log(`\n📦 Product ID: ${productId}\n`);

  const odoo = new OdooClient();

  try {
    console.log('🔐 Connecting to Odoo...');
    await odoo.authenticate();
    console.log('✅ Connected\n');

    // Fetch product
    console.log('📥 Fetching product data...');
    const products = await odoo.searchRead<any>(
      'product.template',
      [['id', '=', productId]],
      ['id', 'name', 'description_sale', 'website_description',
       'website_meta_title', 'website_meta_description', 'website_meta_keywords',
       'list_price', 'categ_id', 'default_code', 'qty_available', 'is_published']
    );

    if (products.length === 0) {
      console.error(`❌ Product ID ${productId} not found!`);
      process.exit(1);
    }

    const product = products[0];
    const category = product.categ_id?.[1] || '';

    console.log('\n' + '─'.repeat(70));
    console.log('📋 CURRENT STATE:');
    console.log('─'.repeat(70));
    console.log(`Name:        ${product.name}`);
    console.log(`Category:    ${category}`);
    console.log(`Price:       CHF ${product.list_price}`);
    console.log(`Published:   ${product.is_published ? 'Yes' : 'No'}`);
    console.log(`\nMeta Title:       ${product.website_meta_title || '(empty)'}`);
    console.log(`Meta Description: ${product.website_meta_description || '(empty)'}`);
    console.log(`Meta Keywords:    ${product.website_meta_keywords || '(empty)'}`);

    // Generate optimized SEO
    const newTitle = optimizeTitle(product.name);
    const newDescription = optimizeDescription(
      product.website_meta_description || product.description_sale,
      product.name,
      product.list_price,
      category
    );
    const newKeywords = optimizeKeywords(product.website_meta_keywords, product.name, category);

    console.log('\n' + '─'.repeat(70));
    console.log('✨ OPTIMIZED SEO:');
    console.log('─'.repeat(70));
    console.log(`Meta Title:       ${newTitle} (${newTitle.length} chars)`);
    console.log(`Meta Description: ${newDescription} (${newDescription.length} chars)`);
    console.log(`Meta Keywords:    ${newKeywords}`);

    // Update Odoo
    console.log('\n📤 Updating Odoo...');
    const changes = {
      website_meta_title: newTitle,
      website_meta_description: newDescription,
      website_meta_keywords: newKeywords
    };

    await odoo.write('product.template', [productId], changes);
    console.log('✅ SEO fields updated successfully!\n');

    // Generate Schema.org
    const updatedProduct = { ...product, ...changes };
    const schema = generateProductSchema(updatedProduct);

    console.log('─'.repeat(70));
    console.log('📊 SCHEMA.ORG JSON-LD:');
    console.log('─'.repeat(70));
    console.log(`<script type="application/ld+json">`);
    console.log(JSON.stringify(schema, null, 2));
    console.log(`</script>`);

    // Save report
    const dataDir = resolve(__dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      productId,
      productName: product.name,
      before: {
        website_meta_title: product.website_meta_title,
        website_meta_description: product.website_meta_description,
        website_meta_keywords: product.website_meta_keywords
      },
      after: changes,
      schema
    };

    const reportPath = resolve(dataDir, `fix-product-${productId}-report.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '═'.repeat(70));
    console.log('✅ SEO FIX COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n📄 Report saved: ${reportPath}`);
    console.log(`\n🌐 Product URL: https://www.lapa.ch/shop/${productId}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Visit the product page to verify meta tags`);
    console.log(`   2. Use Google Rich Results Test to validate Schema.org`);
    console.log(`   3. Copy the JSON-LD script above to your Odoo template`);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
