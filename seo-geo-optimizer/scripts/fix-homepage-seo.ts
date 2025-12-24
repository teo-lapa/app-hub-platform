#!/usr/bin/env npx tsx
/**
 * Fix SEO Homepage LAPA
 * Corregge tutti i problemi SEO identificati sulla homepage lapa.ch
 */

import xmlrpc from 'xmlrpc';

// Configurazione Odoo (usa credenziali dev che puntano alla stessa istanza)
const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180',
};

// =====================================================
// SEO FIXES - Dati corretti da applicare
// =====================================================

const SEO_FIXES = {
  // Meta Title ottimizzato (max 60 caratteri)
  title: 'LAPA - Grossista Prodotti Italiani Svizzera | Zero Pensieri',

  // Meta Description pulita (max 160 caratteri, senza JSON)
  description: 'LAPA: il tuo grossista di prodotti alimentari italiani in Svizzera. Oltre 3000 prodotti, consegna rapida 6 giorni su 7, qualità garantita. Fornitura per ristoranti.',

  // Keywords
  keywords: 'grossista prodotti italiani, forniture ristoranti svizzera, mozzarella, prosciutto, pasta italiana, consegna rapida zurigo',

  // Schema.org JSON-LD corretto e completo
  schemaOrg: {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://lapa.ch/#organization",
    "name": "LAPA - Finest Italian Food GmbH",
    "alternateName": "LAPA",
    "url": "https://lapa.ch",
    "logo": "https://lapa.ch/web/image/website/1/logo",
    "telephone": "+41763617021",
    "email": "info@lapa.ch",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Industriestrasse 18",
      "addressLocality": "Embrach",
      "addressRegion": "Zurich",
      "postalCode": "8424",
      "addressCountry": "CH"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 47.5067,
      "longitude": 8.5969
    },
    "areaServed": [
      { "@type": "City", "name": "Zürich" },
      { "@type": "City", "name": "Winterthur" },
      { "@type": "City", "name": "Basel" },
      { "@type": "City", "name": "Bern" },
      { "@type": "Country", "name": "Switzerland" }
    ],
    "description": "LAPA è il grossista di riferimento per prodotti italiani di alta qualità in Svizzera. Offriamo oltre 3000 specialità italiane: mozzarella fior di latte, burrata pugliese, prosciutto di Parma, formaggi DOP, pasta artigianale.",
    "priceRange": "CHF",
    "currenciesAccepted": "CHF, EUR",
    "paymentAccepted": "Cash, Credit Card, Invoice, Bank Transfer",
    "openingHours": "Mo-Fr 08:00-17:00",
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "08:00",
        "closes": "17:00"
      }
    ],
    "sameAs": [
      "https://www.facebook.com/lapa.ch",
      "https://www.instagram.com/lapa.ch",
      "https://www.linkedin.com/company/lapa-ch"
    ]
  }
};

class OdooSEOFixer {
  private uid: number | null = null;
  private commonClient: xmlrpc.Client;
  private objectClient: xmlrpc.Client;

  constructor() {
    const url = new URL(ODOO_CONFIG.url);
    this.commonClient = xmlrpc.createSecureClient({
      host: url.hostname,
      port: 443,
      path: '/xmlrpc/2/common',
    });
    this.objectClient = xmlrpc.createSecureClient({
      host: url.hostname,
      port: 443,
      path: '/xmlrpc/2/object',
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        'authenticate',
        [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
        (error, value) => {
          if (error) reject(new Error(`Auth failed: ${error.message}`));
          else if (!value) reject(new Error('Invalid credentials'));
          else {
            this.uid = value as number;
            resolve(this.uid);
          }
        }
      );
    });
  }

  private async execute<T>(model: string, method: string, args: any[], kwargs: Record<string, any> = {}): Promise<T> {
    await this.authenticate();
    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        'execute_kw',
        [ODOO_CONFIG.db, this.uid, ODOO_CONFIG.password, model, method, args, kwargs],
        (error, value) => {
          if (error) reject(new Error(`Odoo error ${model}.${method}: ${error.message}`));
          else resolve(value as T);
        }
      );
    });
  }

  async getModelFields(model: string): Promise<any> {
    return this.execute<any>(
      model,
      'fields_get',
      [],
      { attributes: ['string', 'type'] }
    );
  }

  async getWebsitePages(): Promise<any[]> {
    // Prima otteniamo i campi disponibili
    const fields = await this.getModelFields('website.page');
    const seoFields = Object.keys(fields).filter(f =>
      f.includes('meta') || f.includes('seo') || f.includes('title') || f.includes('description')
    );
    console.log('   Campi SEO disponibili in website.page:', seoFields);

    return this.execute<any[]>(
      'website.page',
      'search_read',
      [[]],
      { fields: ['id', 'name', 'url', ...seoFields] }
    );
  }

  async getWebsiteConfig(): Promise<any[]> {
    // Prima otteniamo i campi disponibili
    const fields = await this.getModelFields('website');
    const seoFields = Object.keys(fields).filter(f =>
      f.includes('meta') || f.includes('seo') || f.includes('title') || f.includes('description') ||
      f.includes('social') || f.includes('logo') || f.includes('name')
    );
    console.log('   Campi SEO disponibili in website:', seoFields);

    return this.execute<any[]>(
      'website',
      'search_read',
      [[]],
      { fields: ['id', 'name', ...seoFields] }
    );
  }

  async updateWebsiteSEO(websiteId: number, data: any): Promise<boolean> {
    return this.execute<boolean>(
      'website',
      'write',
      [[websiteId], data]
    );
  }

  async updatePageSEO(pageId: number, data: any): Promise<boolean> {
    return this.execute<boolean>(
      'website.page',
      'write',
      [[pageId], data]
    );
  }

  async fixHomepageSEO(): Promise<void> {
    console.log('🔧 LAPA SEO Fix - Homepage\n');
    console.log('='.repeat(60));

    // 1. Get current website config
    console.log('\n📥 Recupero configurazione attuale...');
    const websites = await this.getWebsiteConfig();

    if (websites.length === 0) {
      console.log('❌ Nessun website trovato!');
      return;
    }

    const website = websites[0];
    console.log(`\n📍 Website: ${website.name} (ID: ${website.id})`);
    console.log(`   Dati attuali:`, JSON.stringify(website, null, 2));

    // 2. Get homepage
    console.log('\n📥 Recupero homepage...');
    const pages = await this.getWebsitePages();
    const homepage = pages.find(p => p.url === '/' || p.url === '/homepage' || p.name?.toLowerCase().includes('home'));

    if (homepage) {
      console.log(`📍 Homepage trovata: "${homepage.name}" (ID: ${homepage.id})`);
      console.log(`   Dati attuali:`, JSON.stringify(homepage, null, 2));
    } else {
      console.log('⚠️  Homepage non trovata nelle pagine');
      console.log('   Pagine disponibili:');
      pages.slice(0, 10).forEach(p => console.log(`   - ${p.name} (${p.url})`));
    }

    // 3. Try to find correct fields and update
    console.log('\n📝 Analisi campi e preparazione correzioni...');

    // Determina quali campi sono disponibili per l'update
    const websiteFields = await this.getModelFields('website');
    const pageFields = await this.getModelFields('website.page');

    // Costruisci l'oggetto di update basato sui campi disponibili
    const websiteUpdate: any = {};
    const pageUpdate: any = {};

    // Mappa dei possibili nomi di campi per meta title
    const titleFieldNames = ['website_meta_title', 'meta_title', 'seo_name', 'title'];
    const descFieldNames = ['website_meta_description', 'meta_description', 'seo_description', 'description'];
    const keywordsFieldNames = ['website_meta_keywords', 'meta_keywords', 'seo_keywords', 'keywords'];

    // Trova il campo corretto per il title
    for (const fieldName of titleFieldNames) {
      if (pageFields[fieldName]) {
        pageUpdate[fieldName] = SEO_FIXES.title;
        console.log(`   ✅ Campo title trovato: ${fieldName}`);
        break;
      }
    }

    // Trova il campo corretto per la description
    for (const fieldName of descFieldNames) {
      if (pageFields[fieldName]) {
        pageUpdate[fieldName] = SEO_FIXES.description;
        console.log(`   ✅ Campo description trovato: ${fieldName}`);
        break;
      }
    }

    // Trova il campo corretto per le keywords
    for (const fieldName of keywordsFieldNames) {
      if (pageFields[fieldName]) {
        pageUpdate[fieldName] = SEO_FIXES.keywords;
        console.log(`   ✅ Campo keywords trovato: ${fieldName}`);
        break;
      }
    }

    // 4. Apply fixes
    if (homepage && Object.keys(pageUpdate).length > 0) {
      console.log('\n🔄 Applicazione correzioni alla Homepage...');
      console.log('   Update:', JSON.stringify(pageUpdate, null, 2));
      try {
        await this.updatePageSEO(homepage.id, pageUpdate);
        console.log('✅ Homepage SEO aggiornata con successo!');
      } catch (error) {
        console.log(`❌ Errore aggiornamento homepage: ${error}`);
      }
    } else {
      console.log('\n⚠️  Nessun campo SEO trovato per l\'aggiornamento automatico');
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO:');
    console.log('='.repeat(60));
    console.log(`
I meta tag SEO in Odoo Website sono gestiti direttamente
nel backend Odoo. Per correggere i problemi identificati:

1. Vai su: ${ODOO_CONFIG.url}/web#action=website.action_website_configuration
2. Modifica i seguenti campi:

   📌 Website Meta Title:
   ${SEO_FIXES.title}

   📌 Website Meta Description:
   ${SEO_FIXES.description}

   📌 Keywords:
   ${SEO_FIXES.keywords}

3. Per lo Schema.org JSON-LD, vai su:
   Website → Configuration → Settings → SEO
   E aggiungi il seguente codice nel campo "Website Schema":
`);
    console.log('```json');
    console.log(JSON.stringify(SEO_FIXES.schemaOrg, null, 2));
    console.log('```');

    console.log(`
📋 PROBLEMI DA CORREGGERE MANUALMENTE IN ODOO:

1. ❌ Title troncato → Cambiarlo a max 60 caratteri
2. ❌ Meta description contiene JSON → Pulire il campo
3. ❌ H1 vuoto → Aggiungere testo nel page builder
4. ❌ H2 nested → Correggere struttura heading
5. ⚠️  Hreflang → Aggiungere se sito multilingua

URL Odoo Editor: ${ODOO_CONFIG.url}/@/
`);
  }
}

// Main
async function main() {
  const fixer = new OdooSEOFixer();
  try {
    await fixer.fixHomepageSEO();
  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();
