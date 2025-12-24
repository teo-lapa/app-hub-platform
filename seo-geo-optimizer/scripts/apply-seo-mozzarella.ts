/**
 * Apply PERFECT SEO to Mozzarella di Bufala in ALL LANGUAGES
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

const PRODUCT_ID = 15;

// Perfect SEO for Mozzarella di Bufala Campana DOP
const SEO_BY_LANGUAGE: Record<string, { title: string; description: string; keywords: string }> = {
  'it_IT': {
    title: "Mozzarella di Bufala Campana DOP 125g | LAPA Svizzera",
    description: "Acquista Mozzarella di Bufala Campana DOP autentica, confezione 125g. Formaggio italiano fresco certificato, ideale per pizza e caprese. Consegna refrigerata in Svizzera.",
    keywords: "mozzarella di bufala, bufala campana DOP, mozzarella italiana, formaggio fresco, LAPA, grossista Svizzera, latticini italiani, pizza, caprese, formaggio DOP"
  },
  'de_CH': {
    title: "Büffelmozzarella Campana DOP 125g | LAPA Schweiz",
    description: "Kaufen Sie echte Büffelmozzarella Campana DOP, 125g Packung. Frischer italienischer Käse mit Zertifizierung, ideal für Pizza und Caprese. Gekühlte Lieferung in der Schweiz.",
    keywords: "Büffelmozzarella, Mozzarella di Bufala, Campana DOP, italienischer Käse, LAPA, Grosshändler Schweiz, italienische Milchprodukte, Pizza, Caprese"
  },
  'fr_CH': {
    title: "Mozzarella di Bufala Campana DOP 125g | LAPA Suisse",
    description: "Achetez de la vraie Mozzarella di Bufala Campana DOP, paquet de 125g. Fromage italien frais certifié, idéal pour pizza et caprese. Livraison réfrigérée en Suisse.",
    keywords: "mozzarella di bufala, bufala campana DOP, fromage italien, fromage frais, LAPA, grossiste Suisse, produits laitiers italiens, pizza, caprese"
  },
  'en_US': {
    title: "Buffalo Mozzarella Campana DOP 125g | LAPA Switzerland",
    description: "Buy authentic Buffalo Mozzarella Campana DOP, 125g pack. Fresh certified Italian cheese, perfect for pizza and caprese salad. Refrigerated delivery across Switzerland.",
    keywords: "buffalo mozzarella, mozzarella di bufala, Campana DOP, Italian cheese, LAPA, Switzerland wholesaler, Italian dairy, pizza, caprese, DOP cheese"
  },
  'ro_RO': {
    title: "Mozzarella di Bufala Campana DOP 125g | LAPA Elveția",
    description: "Cumpărați Mozzarella di Bufala Campana DOP autentică, pachet 125g. Brânză italiană proaspătă certificată, ideală pentru pizza și caprese. Livrare refrigerată în Elveția.",
    keywords: "mozzarella di bufala, bufala campana DOP, brânză italiană, LAPA, Elveția, produse lactate italiene, pizza, caprese"
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
  console.log('='.repeat(70));
  console.log('APPLY PERFECT SEO - MOZZARELLA DI BUFALA CAMPANA DOP');
  console.log('='.repeat(70));
  console.log(`\nProduct ID: ${PRODUCT_ID}\n`);

  const odoo = new OdooClient();

  try {
    console.log('Connecting to Odoo...');
    await odoo.authenticate();
    console.log('Connected!\n');

    const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US', 'ro_RO'];
    const flags: Record<string, string> = {
      'it_IT': 'IT',
      'de_CH': 'DE',
      'fr_CH': 'FR',
      'en_US': 'EN',
      'ro_RO': 'RO'
    };

    for (const lang of languages) {
      const seo = SEO_BY_LANGUAGE[lang];
      const flag = flags[lang];

      console.log(`[${flag}] Applying ${lang}...`);
      console.log(`    Title: ${seo.title}`);

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
        console.log(`    OK!\n`);
      } else {
        console.log(`    FAILED!\n`);
      }
    }

    // Verify
    console.log('='.repeat(70));
    console.log('VERIFYING:');
    console.log('='.repeat(70));

    for (const lang of languages) {
      const result = await odoo.read(
        'product.template',
        [PRODUCT_ID],
        ['website_meta_title', 'website_meta_description'],
        lang
      );

      if (result.length > 0) {
        console.log(`\n[${flags[lang]}] ${result[0].website_meta_title}`);
        console.log(`    ${result[0].website_meta_description.substring(0, 80)}...`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('DONE! Mozzarella SEO updated in all languages.');
    console.log('='.repeat(70));
    console.log('\nTest URL: https://www.lapa.ch/shop/mozzarella-di-bufala-campana-dop-125g-1-5kg-crt-sri-15');

  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
