/**
 * Apply PERFECT SEO to Friarielli product (ID 14317)
 * Based on Google keyword research
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || (process.env.ODOO_PASSWORD || '');

// ========== PERFECT SEO FOR FRIARIELLI ==========
// Based on Google keyword research for:
// - friarielli, cime di rapa, broccoli di rapa
// - StÃ¤ngelkohl (German)
// - brocoli-rave (French)
// - broccoli rabe, rapini (English)

const PERFECT_SEO = {
  // Italian - Primary language
  it: {
    title: "Friarielli di Campo Surgelati 4kg | LAPA Svizzera",
    description: "Acquista friarielli di campo surgelati Spirito Contadino, confezione da 4kg. Verdura italiana autentica dal sapore amarognolo. Consegna rapida in tutta la Svizzera.",
    keywords: "friarielli, friarielli di campo, friarielli surgelati, cime di rapa, verdure surgelate italiane, grossista svizzera, LAPA, Spirito Contadino, broccoli di rapa, gastronomia italiana"
  },
  // German
  de: {
    title: "StÃ¤ngelkohl Friarielli Tiefgefroren 4kg | LAPA Schweiz",
    description: "Kaufen Sie Friarielli StÃ¤ngelkohl tiefgefroren von Spirito Contadino, 4kg Packung. Authentisches italienisches GemÃ¼se. Schnelle Lieferung in die ganze Schweiz.",
    keywords: "StÃ¤ngelkohl, Friarielli, Cime di Rapa, tiefgefrorenes GemÃ¼se, italienische SpezialitÃ¤ten, GrosshÃ¤ndler Schweiz, LAPA, Spirito Contadino, RÃ¼bstiel, italienisches GemÃ¼se"
  },
  // French
  fr: {
    title: "Brocoli-rave Friarielli SurgelÃ©s 4kg | LAPA Suisse",
    description: "Achetez des friarielli (brocoli-rave) surgelÃ©s Spirito Contadino, paquet de 4kg. LÃ©gume italien authentique au goÃ»t amer. Livraison rapide dans toute la Suisse.",
    keywords: "brocoli-rave, friarielli, cime di rapa, lÃ©gumes surgelÃ©s italiens, grossiste Suisse, LAPA, Spirito Contadino, rapini, lÃ©gumes italiens, gastronomie italienne"
  },
  // English
  en: {
    title: "Broccoli Rabe Friarielli Frozen 4kg | LAPA Switzerland",
    description: "Buy frozen friarielli (broccoli rabe) by Spirito Contadino, 4kg pack. Authentic Italian vegetable with distinctive bitter taste. Fast delivery across Switzerland.",
    keywords: "broccoli rabe, friarielli, rapini, cime di rapa, frozen Italian vegetables, Switzerland wholesaler, LAPA, Spirito Contadino, Italian greens, Italian gastronomy"
  }
};

// Odoo Client
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

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'write', args: [ids, values], kwargs: {} },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || false;
  }

  async searchRead<T>(model: string, domain: any[], fields: string[]): Promise<T[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model, method: 'search_read', args: [],
          kwargs: { domain, fields, limit: 1 }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }
}

async function main() {
  const productId = 14317;

  console.log('â•'.repeat(70));
  console.log('ðŸŽ¯ APPLY PERFECT SEO - FRIARIELLI DI CAMPO');
  console.log('â•'.repeat(70));
  console.log(`\nðŸ“¦ Product ID: ${productId}\n`);

  const odoo = new OdooClient();

  try {
    console.log('ðŸ” Connecting to Odoo...');
    await odoo.authenticate();
    console.log('âœ… Connected\n');

    // Show current state
    console.log('ðŸ“¥ Fetching current SEO...');
    const products = await odoo.searchRead<any>(
      'product.template',
      [['id', '=', productId]],
      ['name', 'website_meta_title', 'website_meta_description', 'website_meta_keywords']
    );

    if (products.length === 0) {
      throw new Error('Product not found!');
    }

    const product = products[0];
    console.log('\n' + 'â”€'.repeat(70));
    console.log('ðŸ“‹ CURRENT STATE:');
    console.log('â”€'.repeat(70));
    console.log(`Name:        ${product.name}`);
    console.log(`Title:       ${product.website_meta_title || '(empty)'}`);
    console.log(`Description: ${product.website_meta_description || '(empty)'}`);
    console.log(`Keywords:    ${product.website_meta_keywords || '(empty)'}`);

    // Apply PERFECT SEO (Italian version for Odoo)
    const seo = PERFECT_SEO.it;

    console.log('\n' + 'â”€'.repeat(70));
    console.log('âœ¨ PERFECT SEO TO APPLY:');
    console.log('â”€'.repeat(70));
    console.log(`\nðŸ‡®ðŸ‡¹ Title (${seo.title.length} chars):`);
    console.log(`   ${seo.title}`);
    console.log(`\nðŸ‡®ðŸ‡¹ Description (${seo.description.length} chars):`);
    console.log(`   ${seo.description}`);
    console.log(`\nðŸ‡®ðŸ‡¹ Keywords:`);
    console.log(`   ${seo.keywords}`);

    // Update Odoo
    console.log('\nðŸ“¤ Updating Odoo...');
    await odoo.write('product.template', [productId], {
      website_meta_title: seo.title,
      website_meta_description: seo.description,
      website_meta_keywords: seo.keywords
    });

    console.log('âœ… SEO updated successfully!\n');

    // Show all language versions
    console.log('â•'.repeat(70));
    console.log('ðŸŒ ALL LANGUAGE VERSIONS (for reference):');
    console.log('â•'.repeat(70));

    for (const [lang, data] of Object.entries(PERFECT_SEO)) {
      const flag = { it: 'ðŸ‡®ðŸ‡¹', de: 'ðŸ‡©ðŸ‡ª', fr: 'ðŸ‡«ðŸ‡·', en: 'ðŸ‡¬ðŸ‡§' }[lang];
      console.log(`\n${flag} ${lang.toUpperCase()}:`);
      console.log(`   Title:       ${data.title}`);
      console.log(`   Description: ${data.description}`);
      console.log(`   Keywords:    ${data.keywords}`);
    }

    console.log('\n' + 'â•'.repeat(70));
    console.log('âœ… PERFECT SEO APPLIED!');
    console.log('â•'.repeat(70));
    console.log(`\nðŸŒ Product URL: https://www.lapa.ch/shop/friarielli-di-campo-1kg-conf-4kg-crt-spirc-14317`);
    console.log(`\nðŸ“‹ Verify in Odoo "Ottimizza SEO" panel to see the changes.`);

  } catch (error) {
    console.error('\nâŒ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
