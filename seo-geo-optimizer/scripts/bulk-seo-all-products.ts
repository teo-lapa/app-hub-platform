/**
 * BULK SEO OPTIMIZER - All Products
 * Applies perfect SEO to ALL products in all languages (IT, DE, FR, EN, RO)
 *
 * Usage: npx tsx bulk-seo-all-products.ts [--dry-run] [--limit=100]
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL!;
const ODOO_DB = process.env.ODOO_DB!;
const ODOO_USERNAME = process.env.ODOO_USERNAME!;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD!;

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 0; // 0 = no limit

// Language configurations
interface LangConfig {
  code: string;
  country: string;
  buy: string;
  authentic: string;
  quality: string;
  delivery: string;
  wholesaler: string;
}

const LANGUAGES: Record<string, LangConfig> = {
  'it_IT': {
    code: 'it',
    country: 'Svizzera',
    buy: 'Acquista',
    authentic: 'Prodotto italiano autentico',
    quality: 'Alta qualità garantita',
    delivery: 'Consegna rapida in tutta la Svizzera',
    wholesaler: 'grossista'
  },
  'de_CH': {
    code: 'de',
    country: 'Schweiz',
    buy: 'Kaufen Sie',
    authentic: 'Authentisches italienisches Produkt',
    quality: 'Garantierte Qualität',
    delivery: 'Schnelle Lieferung in die ganze Schweiz',
    wholesaler: 'Grosshändler'
  },
  'fr_CH': {
    code: 'fr',
    country: 'Suisse',
    buy: 'Achetez',
    authentic: 'Produit italien authentique',
    quality: 'Qualité garantie',
    delivery: 'Livraison rapide dans toute la Suisse',
    wholesaler: 'grossiste'
  },
  'en_US': {
    code: 'en',
    country: 'Switzerland',
    buy: 'Buy',
    authentic: 'Authentic Italian product',
    quality: 'Guaranteed quality',
    delivery: 'Fast delivery across Switzerland',
    wholesaler: 'wholesaler'
  },
  'ro_RO': {
    code: 'ro',
    country: 'Elveția',
    buy: 'Cumpărați',
    authentic: 'Produs italian autentic',
    quality: 'Calitate garantată',
    delivery: 'Livrare rapidă în toată Elveția',
    wholesaler: 'angrosist'
  }
};

// Category-specific keywords
const CATEGORY_KEYWORDS: Record<string, Record<string, string[]>> = {
  'Formaggi': {
    it: ['formaggio italiano', 'latticini', 'formaggi DOP'],
    de: ['italienischer Käse', 'Milchprodukte', 'DOP Käse'],
    fr: ['fromage italien', 'produits laitiers', 'fromages DOP'],
    en: ['Italian cheese', 'dairy products', 'DOP cheese'],
    ro: ['brânză italiană', 'lactate', 'brânzeturi DOP']
  },
  'Salumi': {
    it: ['salumi italiani', 'prosciutto', 'affettati'],
    de: ['italienische Wurst', 'Schinken', 'Aufschnitt'],
    fr: ['charcuterie italienne', 'jambon', 'salaisons'],
    en: ['Italian cured meats', 'prosciutto', 'cold cuts'],
    ro: ['mezeluri italiene', 'jambon', 'preparate din carne']
  },
  'Pasta': {
    it: ['pasta italiana', 'pasta secca', 'pasta fresca'],
    de: ['italienische Pasta', 'Nudeln', 'Teigwaren'],
    fr: ['pâtes italiennes', 'pâtes sèches', 'pâtes fraîches'],
    en: ['Italian pasta', 'dried pasta', 'fresh pasta'],
    ro: ['paste italiene', 'paste uscate', 'paste proaspete']
  },
  'Surgelati': {
    it: ['surgelati italiani', 'prodotti surgelati', 'congelati'],
    de: ['italienische Tiefkühlkost', 'Tiefkühlprodukte', 'gefroren'],
    fr: ['surgelés italiens', 'produits surgelés', 'congelés'],
    en: ['Italian frozen food', 'frozen products', 'frozen'],
    ro: ['congelate italiene', 'produse congelate', 'înghețate']
  },
  'Verdura': {
    it: ['verdure italiane', 'ortaggi', 'vegetali'],
    de: ['italienisches Gemüse', 'Gemüse', 'Grünzeug'],
    fr: ['légumes italiens', 'légumes', 'végétaux'],
    en: ['Italian vegetables', 'vegetables', 'greens'],
    ro: ['legume italiene', 'legume', 'verdeturi']
  },
  'default': {
    it: ['prodotti italiani', 'gastronomia italiana', 'qualità italiana'],
    de: ['italienische Produkte', 'italienische Gastronomie', 'italienische Qualität'],
    fr: ['produits italiens', 'gastronomie italienne', 'qualité italienne'],
    en: ['Italian products', 'Italian gastronomy', 'Italian quality'],
    ro: ['produse italiene', 'gastronomie italiană', 'calitate italiană']
  }
};

// Clean product name from technical codes
function cleanProductName(name: string): string {
  return name
    .replace(/\s+CONF\s+\d+\w*\s*/gi, ' ')
    .replace(/\s+CRT\s+\w+/gi, '')
    .replace(/\s+PZ\s*\d*/gi, '')
    .replace(/\s+VASCH?\s+\w*/gi, '')
    .replace(/\s+BG\s*$/gi, '')
    .replace(/\s+FERR?\s*$/gi, '')
    .replace(/\s+\d+KG\s*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract weight/quantity from product name
function extractWeight(name: string): string {
  const match = name.match(/(\d+(?:[.,]\d+)?)\s*(KG|G|L|ML|PZ|GR)/i);
  if (match) {
    return match[1] + match[2].toUpperCase();
  }
  return '';
}

// Detect category from product category path
function detectCategoryType(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('formaggi') || cat.includes('lattic') || cat.includes('mozzarella')) return 'Formaggi';
  if (cat.includes('salumi') || cat.includes('prosciutto') || cat.includes('affettati')) return 'Salumi';
  if (cat.includes('pasta')) return 'Pasta';
  if (cat.includes('surgel') || cat.includes('frozen') || cat.includes('pingu')) return 'Surgelati';
  if (cat.includes('verdur') || cat.includes('frutta') || cat.includes('ortaggi')) return 'Verdura';
  return 'default';
}

// Generate SEO for a product in a specific language
function generateSEO(product: any, langCode: string): { title: string; description: string; keywords: string } {
  const lang = LANGUAGES[langCode];
  const cleanName = cleanProductName(product.name);
  const weight = extractWeight(product.name);
  const category = product.categ_id?.[1] || '';
  const categoryType = detectCategoryType(category);

  // Title: "[Clean Name] [Weight] | LAPA [Country]"
  let title = cleanName;
  if (weight && !title.includes(weight)) {
    title += ` ${weight}`;
  }
  const suffix = ` | LAPA ${lang.country}`;

  // Ensure title fits within 60 chars
  const maxTitleLen = 60 - suffix.length;
  if (title.length > maxTitleLen) {
    title = title.substring(0, maxTitleLen - 3).replace(/\s+\S*$/, '...');
  }
  title += suffix;

  // Description: "[Buy] [name]. [Authentic]. [Delivery]."
  let description = `${lang.buy} ${cleanName}`;
  if (weight) description += ` ${weight}`;
  description += `. ${lang.authentic}. ${lang.delivery}.`;

  // Ensure description is 120-160 chars
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }
  if (description.length < 120) {
    description = description.replace(/\.$/, `. ${lang.quality}.`);
  }

  // Keywords
  const categoryKw = CATEGORY_KEYWORDS[categoryType]?.[lang.code] || CATEGORY_KEYWORDS['default'][lang.code];
  const nameWords = cleanName.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
  const allKeywords = [
    ...nameWords,
    'LAPA',
    `${lang.wholesaler} ${lang.country}`,
    ...categoryKw
  ];
  const keywords = [...new Set(allKeywords)].slice(0, 10).join(', ');

  return { title, description, keywords };
}

// Odoo Client
class OdooClient {
  private cookies: string | null = null;

  async authenticate(): Promise<void> {
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
    if (!data.result?.uid) throw new Error('Authentication failed');
  }

  async searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'search_read',
          args: [],
          kwargs: { domain, fields, limit: limit || 5000 }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }

  async write(model: string, ids: number[], values: any, lang?: string): Promise<boolean> {
    const context: any = {};
    if (lang) context.lang = lang;

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'write',
          args: [ids, values],
          kwargs: { context }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) return false;
    return true;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('BULK SEO OPTIMIZER - ALL PRODUCTS');
  console.log('='.repeat(70));
  console.log(`\nMode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT} products`);
  console.log('');

  const odoo = new OdooClient();
  const startTime = Date.now();

  try {
    console.log('Connecting to Odoo...');
    await odoo.authenticate();
    console.log('Connected!\n');

    // Fetch all published products
    console.log('Fetching products...');
    const products = await odoo.searchRead(
      'product.template',
      [['is_published', '=', true]],
      ['id', 'name', 'categ_id', 'list_price'],
      LIMIT || 5000
    );
    console.log(`Found ${products.length} products\n`);

    const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US', 'ro_RO'];
    let updated = 0;
    let failed = 0;
    const report: any[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const progress = `[${i + 1}/${products.length}]`;

      console.log(`${progress} ID ${product.id}: ${product.name.substring(0, 50)}...`);

      const productReport: any = {
        id: product.id,
        name: product.name,
        seo: {}
      };

      for (const lang of languages) {
        const seo = generateSEO(product, lang);
        productReport.seo[lang] = seo;

        if (!DRY_RUN) {
          const success = await odoo.write(
            'product.template',
            [product.id],
            {
              website_meta_title: seo.title,
              website_meta_description: seo.description,
              website_meta_keywords: seo.keywords
            },
            lang
          );

          if (!success) {
            console.log(`    [${lang}] FAILED`);
            failed++;
          }
        }
      }

      if (!DRY_RUN) {
        console.log(`    Updated all languages`);
      } else {
        console.log(`    [IT] ${productReport.seo['it_IT'].title}`);
      }

      report.push(productReport);
      updated++;

      // Small delay to avoid overwhelming the server
      if (!DRY_RUN && i > 0 && i % 50 === 0) {
        console.log(`    --- Pause 1s ---`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Save report
    const dataDir = resolve(__dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const reportPath = resolve(dataDir, `bulk-seo-report-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: DRY_RUN ? 'dry-run' : 'live',
      totalProducts: products.length,
      updated,
      failed,
      elapsedSeconds: elapsed,
      products: report
    }, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('COMPLETED!');
    console.log('='.repeat(70));
    console.log(`\nTotal products: ${products.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log(`Time: ${elapsed}s`);
    console.log(`\nReport saved: ${reportPath}`);

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
