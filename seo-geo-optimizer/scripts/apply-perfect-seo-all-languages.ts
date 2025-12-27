/**
 * Apply PERFECT SEO to Friarielli in ALL LANGUAGES
 * Languages: IT, DE, FR, EN (+ RO)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const ODOO_URL = process.env.ODOO_URL!;
const ODOO_DB = process.env.ODOO_DB!;
const ODOO_USERNAME = process.env.ODOO_USERNAME!;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD!;

const PRODUCT_ID = 14317;

// Perfect SEO for each language
const SEO_BY_LANGUAGE: Record<string, { title: string; description: string; keywords: string }> = {
  'it_IT': {
    title: "Friarielli di Campo Surgelati 4kg | LAPA Svizzera",
    description: "Acquista friarielli di campo surgelati Spirito Contadino, confezione da 4kg. Verdura italiana autentica dal sapore amarognolo. Consegna rapida in tutta la Svizzera.",
    keywords: "friarielli, friarielli di campo, friarielli surgelati, cime di rapa, verdure surgelate italiane, grossista svizzera, LAPA, Spirito Contadino, broccoli di rapa, gastronomia italiana"
  },
  'de_CH': {
    title: "Stängelkohl Friarielli Tiefgefroren 4kg | LAPA Schweiz",
    description: "Kaufen Sie Friarielli Stängelkohl tiefgefroren von Spirito Contadino, 4kg Packung. Authentisches italienisches Gemüse. Schnelle Lieferung in die ganze Schweiz.",
    keywords: "Stängelkohl, Friarielli, Cime di Rapa, tiefgefrorenes Gemüse, italienische Spezialitäten, Grosshändler Schweiz, LAPA, Spirito Contadino, Rübstiel, italienisches Gemüse"
  },
  'fr_CH': {
    title: "Brocoli-rave Friarielli Surgelés 4kg | LAPA Suisse",
    description: "Achetez des friarielli (brocoli-rave) surgelés Spirito Contadino, paquet de 4kg. Légume italien authentique au goût amer. Livraison rapide dans toute la Suisse.",
    keywords: "brocoli-rave, friarielli, cime di rapa, légumes surgelés italiens, grossiste Suisse, LAPA, Spirito Contadino, rapini, légumes italiens, gastronomie italienne"
  },
  'en_US': {
    title: "Broccoli Rabe Friarielli Frozen 4kg | LAPA Switzerland",
    description: "Buy frozen friarielli (broccoli rabe) by Spirito Contadino, 4kg pack. Authentic Italian vegetable with distinctive bitter taste. Fast delivery across Switzerland.",
    keywords: "broccoli rabe, friarielli, rapini, cime di rapa, frozen Italian vegetables, Switzerland wholesaler, LAPA, Spirito Contadino, Italian greens, Italian gastronomy"
  },
  'ro_RO': {
    title: "Friarielli Congelat 4kg | LAPA Elveția",
    description: "Cumpărați friarielli (broccoli rabe) congelat de la Spirito Contadino, pachet 4kg. Legumă italiană autentică. Livrare rapidă în toată Elveția.",
    keywords: "friarielli, broccoli rabe, legume italiene congelate, LAPA, Elveția, Spirito Contadino, legume italiene, gastronomie italiană"
  }
};

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
    if (data.error) {
      console.error(`Error for ${lang}:`, data.error.message);
      return false;
    }
    return true;
  }

  async read(model: string, ids: number[], fields: string[], lang?: string): Promise<any[]> {
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
          method: 'read',
          args: [ids, fields],
          kwargs: { context }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    return data.result || [];
  }
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🌍 APPLY PERFECT SEO - ALL LANGUAGES');
  console.log('═'.repeat(70));
  console.log(`\n📦 Product ID: ${PRODUCT_ID}\n`);

  const odoo = new OdooClient();

  try {
    console.log('🔐 Connecting to Odoo...');
    await odoo.authenticate();
    console.log('✅ Connected\n');

    const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US', 'ro_RO'];
    const flags: Record<string, string> = {
      'it_IT': '🇮🇹',
      'de_CH': '🇩🇪',
      'fr_CH': '🇫🇷',
      'en_US': '🇬🇧',
      'ro_RO': '🇷🇴'
    };

    for (const lang of languages) {
      const seo = SEO_BY_LANGUAGE[lang];
      const flag = flags[lang];

      console.log(`\n${flag} Applying ${lang}...`);
      console.log(`   Title: ${seo.title}`);
      console.log(`   Desc:  ${seo.description.substring(0, 60)}...`);

      const success = await odoo.write(
        'product.template',
        [PRODUCT_ID],
        {
          website_meta_title: seo.title,
          website_meta_description: seo.description,
          website_meta_keywords: seo.keywords
        },
        lang
      );

      if (success) {
        console.log(`   ✅ ${lang} updated!`);
      } else {
        console.log(`   ❌ ${lang} failed!`);
      }
    }

    // Verify all languages
    console.log('\n' + '═'.repeat(70));
    console.log('🔍 VERIFYING ALL LANGUAGES:');
    console.log('═'.repeat(70));

    for (const lang of languages) {
      const flag = flags[lang];
      const result = await odoo.read(
        'product.template',
        [PRODUCT_ID],
        ['website_meta_title', 'website_meta_description'],
        lang
      );

      if (result.length > 0) {
        console.log(`\n${flag} ${lang}:`);
        console.log(`   Title: ${result[0].website_meta_title || '(empty)'}`);
        console.log(`   Desc:  ${(result[0].website_meta_description || '(empty)').substring(0, 70)}...`);
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ ALL LANGUAGES UPDATED!');
    console.log('═'.repeat(70));
    console.log(`\n🌐 Test URLs:`);
    console.log(`   IT: https://www.lapa.ch/it/shop/friarielli-di-campo-1kg-conf-4kg-crt-spirc-14317`);
    console.log(`   DE: https://www.lapa.ch/de/shop/friarielli-di-campo-1kg-conf-4kg-crt-spirc-14317`);
    console.log(`   FR: https://www.lapa.ch/fr/shop/friarielli-di-campo-1kg-conf-4kg-crt-spirc-14317`);
    console.log(`   EN: https://www.lapa.ch/en/shop/friarielli-di-campo-1kg-conf-4kg-crt-spirc-14317`);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
