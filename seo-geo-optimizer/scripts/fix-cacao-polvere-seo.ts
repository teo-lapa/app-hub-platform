/**
 * Script per ottimizzare SEO del prodotto CACAO POLVERE
 * Aggiorna meta tags in tutte le lingue SENZA toccare il nome interno
 */

import { writeFileSync } from 'fs';

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

const PRODUCT_ID = 15311; // CACAO POLVERE 22/24

// Traduzioni SEO per ogni lingua
const SEO_TRANSLATIONS = {
  it_IT: {
    meta_title: 'Cacao in Polvere 22/24 1kg - Alta Qualità | LAPA Grossista',
    meta_description: 'Acquista Cacao in Polvere 22/24 di alta qualità. Ideale per pasticceria professionale. Confezioni da 1kg e 10kg. Consegna rapida in Svizzera.',
    meta_keywords: 'cacao polvere, cacao pasticceria, cacao professionale, cacao svizzera, cacao 22/24',
    description_sale: `**Cacao in Polvere 22/24 - Qualità Premium per Professionisti**

Scopri l'eccellenza del nostro Cacao in Polvere 22/24, selezionato per offrire il massimo in termini di gusto e versatilità. Con un contenuto di cacao del 22-24%, questo prodotto è perfetto per creare dolci, mousse, gelati e bevande dal sapore intenso e avvolgente.

**Caratteristiche:**
- Contenuto cacao: 22-24%
- Colore profondo e ricco
- Aroma intenso e persistente
- Ideale per pasticceria professionale
- Solubilità ottimale

**Formati disponibili:**
- Confezione da 1kg (pratica e maneggevole)
- Cartone da 10kg (per uso professionale intensivo)

**Applicazioni:**
- Torte e dolci al cioccolato
- Mousse e creme
- Gelati artigianali
- Bevande calde e fredde
- Decorazioni e spolverature

Scelto dai migliori pasticceri e chef della Svizzera per la sua qualità costante e il suo sapore autentico. Ideale per chi cerca un prodotto professionale con un ottimo rapporto qualità-prezzo.`
  },

  de_CH: {
    meta_title: 'Kakaopulver 22/24 1kg - Hohe Qualität | LAPA Grosshandel',
    meta_description: 'Kaufen Sie hochwertiges Kakaopulver 22/24. Ideal für professionelles Backen. Packungen 1kg und 10kg. Schnelle Lieferung in der Schweiz.',
    meta_keywords: 'kakaopulver, kakao backen, kakao professionell, kakao schweiz, kakao 22/24',
    description_sale: `**Kakaopulver 22/24 - Premium-Qualität für Profis**

Entdecken Sie unser exquisites Kakaopulver 22/24, ausgewählt für höchste Ansprüche an Geschmack und Vielseitigkeit. Mit einem Kakaogehalt von 22-24% ist dieses Produkt perfekt für die Herstellung von Gebäck, Mousse, Glacé und Getränken mit intensivem, umhüllendem Geschmack.

**Eigenschaften:**
- Kakaogehalt: 22-24%
- Tiefe, satte Farbe
- Intensives, anhaltendes Aroma
- Ideal für professionelles Backen
- Optimale Löslichkeit

**Verfügbare Formate:**
- 1kg Packung (praktisch und handlich)
- 10kg Karton (für intensiven professionellen Einsatz)

**Anwendungen:**
- Kuchen und Schokoladendesserts
- Mousse und Cremes
- Handwerkliches Glacé
- Heisse und kalte Getränke
- Dekorationen und Bestäubungen

Von den besten Konditoren und Köchen der Schweiz ausgewählt für seine konstante Qualität und seinen authentischen Geschmack. Ideal für alle, die ein professionelles Produkt mit ausgezeichnetem Preis-Leistungs-Verhältnis suchen.`
  },

  fr_CH: {
    meta_title: 'Cacao en Poudre 22/24 1kg - Haute Qualité | LAPA Grossiste',
    meta_description: 'Achetez du cacao en poudre 22/24 de haute qualité. Idéal pour pâtisserie professionnelle. Conditionnements 1kg et 10kg. Livraison rapide en Suisse.',
    meta_keywords: 'cacao poudre, cacao pâtisserie, cacao professionnel, cacao suisse, cacao 22/24',
    description_sale: `**Cacao en Poudre 22/24 - Qualité Premium pour Professionnels**

Découvrez l'excellence de notre Cacao en Poudre 22/24, sélectionné pour offrir le maximum en termes de goût et polyvalence. Avec une teneur en cacao de 22-24%, ce produit est parfait pour créer des desserts, mousses, glaces et boissons au goût intense et enveloppant.

**Caractéristiques:**
- Teneur en cacao: 22-24%
- Couleur profonde et riche
- Arôme intense et persistant
- Idéal pour pâtisserie professionnelle
- Solubilité optimale

**Formats disponibles:**
- Conditionnement 1kg (pratique et maniable)
- Carton 10kg (pour usage professionnel intensif)

**Applications:**
- Gâteaux et desserts au chocolat
- Mousses et crèmes
- Glaces artisanales
- Boissons chaudes et froides
- Décorations et saupoudrages

Choisi par les meilleurs pâtissiers et chefs de Suisse pour sa qualité constante et son goût authentique. Idéal pour ceux qui recherchent un produit professionnel avec un excellent rapport qualité-prix.`
  },

  en_US: {
    meta_title: 'Cocoa Powder 22/24 1kg - High Quality | LAPA Wholesaler',
    meta_description: 'Buy high-quality Cocoa Powder 22/24. Perfect for professional baking. Available in 1kg and 10kg packages. Fast delivery in Switzerland.',
    meta_keywords: 'cocoa powder, baking cocoa, professional cocoa, cocoa switzerland, cocoa 22/24',
    description_sale: `**Cocoa Powder 22/24 - Premium Quality for Professionals**

Discover the excellence of our Cocoa Powder 22/24, selected to offer the best in terms of taste and versatility. With a cocoa content of 22-24%, this product is perfect for creating desserts, mousses, ice creams and beverages with an intense, enveloping flavor.

**Features:**
- Cocoa content: 22-24%
- Deep, rich color
- Intense, persistent aroma
- Ideal for professional baking
- Optimal solubility

**Available formats:**
- 1kg package (practical and handy)
- 10kg carton (for intensive professional use)

**Applications:**
- Cakes and chocolate desserts
- Mousses and creams
- Artisan ice creams
- Hot and cold beverages
- Decorations and dustings

Chosen by the best pastry chefs and cooks in Switzerland for its consistent quality and authentic taste. Ideal for those seeking a professional product with excellent value for money.`
  }
};

async function authenticate(): Promise<number> {
  console.log('🔐 Connessione a Odoo...');
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
  if (!data.result?.uid) throw new Error('Autenticazione fallita');

  console.log('✅ Autenticato con successo\n');
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

async function getCurrentProductData(): Promise<any> {
  console.log('📖 Lettura dati prodotto correnti...');
  const product = await callOdoo('product.template', 'read', [[PRODUCT_ID], [
    'name',
    'website_meta_title',
    'website_meta_description',
    'website_meta_keywords',
    'description_sale'
  ]], { context: { lang: 'it_IT' } });

  console.log(`\n📦 Prodotto trovato: ${product[0].name}`);
  console.log(`   ID: ${PRODUCT_ID}`);
  return product[0];
}

async function updateProductSEO() {
  console.log('\n🔧 INIZIO AGGIORNAMENTO SEO\n');
  console.log('='.repeat(70));

  // Mostra cosa verrà fatto
  console.log('\n📋 PIANO DI AGGIORNAMENTO:');
  console.log('   ✓ Nome prodotto: NON verrà modificato (rimane in italiano)');
  console.log('   ✓ Meta Title: Aggiornato per IT, DE, FR, EN');
  console.log('   ✓ Meta Description: Aggiornato per IT, DE, FR, EN');
  console.log('   ✓ Meta Keywords: Aggiornato per IT, DE, FR, EN');
  console.log('   ✓ Descrizione Vendita: Migliorata per tutte le lingue\n');

  const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];

  for (const lang of languages) {
    const langName = {
      'it_IT': '🇮🇹 ITALIANO',
      'de_CH': '🇩🇪 TEDESCO',
      'fr_CH': '🇫🇷 FRANCESE',
      'en_US': '🇬🇧 INGLESE'
    }[lang];

    console.log(`${langName}`);
    console.log('-'.repeat(70));

    const translation = SEO_TRANSLATIONS[lang as keyof typeof SEO_TRANSLATIONS];

    // IMPORTANTE: NON aggiorniamo il campo "name"!
    const updateData = {
      website_meta_title: translation.meta_title,
      website_meta_description: translation.meta_description,
      website_meta_keywords: translation.meta_keywords,
      description_sale: translation.description_sale
    };

    console.log(`   Meta Title: "${translation.meta_title.substring(0, 60)}..."`);
    console.log(`   Meta Desc:  "${translation.meta_description.substring(0, 60)}..."`);
    console.log(`   Keywords:   "${translation.meta_keywords}"`);

    try {
      await callOdoo('product.template', 'write', [
        [PRODUCT_ID],
        updateData
      ], { context: { lang } });

      console.log('   ✅ Aggiornamento completato\n');
    } catch (error: any) {
      console.log(`   ❌ Errore: ${error.message}\n`);
      throw error;
    }
  }

  console.log('='.repeat(70));
  console.log('\n✅ AGGIORNAMENTO SEO COMPLETATO!\n');
}

async function verifyUpdates() {
  console.log('🔍 VERIFICA AGGIORNAMENTI\n');
  console.log('='.repeat(70));

  const languages = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];
  const verification: any = {};

  for (const lang of languages) {
    const product = await callOdoo('product.template', 'read', [[PRODUCT_ID], [
      'name',
      'website_meta_title',
      'website_meta_description',
      'website_meta_keywords'
    ]], { context: { lang } });

    verification[lang] = product[0];
  }

  // Mostra comparazione
  console.log('\n📊 COMPARAZIONE NOME PRODOTTO (deve essere uguale in tutte le lingue):');
  for (const lang of languages) {
    const langName = { 'it_IT': 'IT', 'de_CH': 'DE', 'fr_CH': 'FR', 'en_US': 'EN' }[lang];
    console.log(`   ${langName}: ${verification[lang].name}`);
  }

  console.log('\n📊 META TITLE (deve essere diverso per ogni lingua):');
  for (const lang of languages) {
    const langName = { 'it_IT': 'IT', 'de_CH': 'DE', 'fr_CH': 'FR', 'en_US': 'EN' }[lang];
    console.log(`   ${langName}: ${verification[lang].website_meta_title}`);
  }

  console.log('\n📊 META DESCRIPTION (deve essere diverso per ogni lingua):');
  for (const lang of languages) {
    const langName = { 'it_IT': 'IT', 'de_CH': 'DE', 'fr_CH': 'FR', 'en_US': 'EN' }[lang];
    console.log(`   ${langName}: ${verification[lang].website_meta_description?.substring(0, 80)}...`);
  }

  // Salva report
  const reportPath = 'output/cacao-polvere-seo-update-report.json';
  writeFileSync(reportPath, JSON.stringify(verification, null, 2));
  console.log(`\n💾 Report completo salvato in: ${reportPath}`);

  console.log('\n='.repeat(70));
  console.log('✅ VERIFICA COMPLETATA!\n');
}

async function main() {
  console.log('\n🚀 OTTIMIZZAZIONE SEO: CACAO POLVERE 22/24\n');
  console.log('='.repeat(70));

  try {
    // 1. Autenticazione
    await authenticate();

    // 2. Leggi dati correnti
    const currentData = await getCurrentProductData();

    // 3. Mostra preview
    console.log('\n📝 ANTEPRIMA MODIFICHE:\n');
    console.log('PRIMA (Italiano):');
    console.log(`   Meta Title: ${currentData.website_meta_title || 'NON PRESENTE'}`);
    console.log(`   Meta Desc:  ${currentData.website_meta_description?.substring(0, 80) || 'NON PRESENTE'}...\n`);

    console.log('DOPO (Tedesco):');
    console.log(`   Meta Title: ${SEO_TRANSLATIONS.de_CH.meta_title}`);
    console.log(`   Meta Desc:  ${SEO_TRANSLATIONS.de_CH.meta_description.substring(0, 80)}...\n`);

    // 4. Aggiorna SEO
    await updateProductSEO();

    // 5. Verifica
    await verifyUpdates();

    console.log('🎉 TUTTO COMPLETATO CON SUCCESSO!\n');
    console.log('💡 Il prodotto è ora ottimizzato per Google in 4 lingue!');
    console.log('💡 Il nome interno rimane invariato per le ricerche in Odoo!\n');

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
