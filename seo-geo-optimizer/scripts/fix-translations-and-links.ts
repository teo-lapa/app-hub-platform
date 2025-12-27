/**
 * Fix Translations and Links Script
 * 1. Traduce gli articoli mancanti in inglese
 * 2. Aggiunge link interni ai prodotti correlati negli articoli
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
const WEBSITE_URL = 'https://www.lapa.ch';

// Articoli con traduzioni EN mancanti (identificati dall'analisi)
const ARTICLES_MISSING_EN = [114, 111, 110, 109, 108, 107];

class OdooTranslator {
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

  async read(model: string, ids: number[], fields: string[], context?: any): Promise<any[]> {
    if (!this.uid) await this.authenticate();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.cookies || '' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method: 'read', args: [ids, fields], kwargs: { context } },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result || [];
  }
}

// ================== TRADUZIONE IT -> EN ==================

function translateToEnglish(text: string): string {
  // Dizionario traduzioni comuni per LAPA
  const translations: Record<string, string> = {
    // Titoli e frasi comuni
    'Ricetta Tradizionale': 'Traditional Recipe',
    'ricetta tradizionale': 'traditional recipe',
    'Scopri': 'Discover',
    'scopri': 'discover',
    'Consegna in Svizzera': 'Delivery in Switzerland',
    'consegna in Svizzera': 'delivery in Switzerland',
    'prodotti italiani': 'Italian products',
    'Prodotti Italiani': 'Italian Products',
    'cucina italiana': 'Italian cuisine',
    'Cucina Italiana': 'Italian Cuisine',
    'gastronomia italiana': 'Italian gastronomy',
    'grossista': 'wholesaler',
    'Grossista': 'Wholesaler',
    'il tuo': 'your',
    'Il tuo': 'Your',
    'di alta qualità': 'high quality',
    'Alta Qualità': 'High Quality',
    'tradizione': 'tradition',
    'Tradizione': 'Tradition',
    'autentico': 'authentic',
    'Autentico': 'Authentic',
    'genuino': 'genuine',
    'Genuino': 'Genuine',

    // Regioni
    'Campania': 'Campania',
    'Sicilia': 'Sicily',
    'Toscana': 'Tuscany',
    'Emilia-Romagna': 'Emilia-Romagna',
    'Lombardia': 'Lombardy',
    'Piemonte': 'Piedmont',
    'Veneto': 'Veneto',
    'Calabria': 'Calabria',
    'Puglia': 'Puglia',
    'Sardegna': 'Sardinia',

    // Ingredienti comuni
    'mozzarella': 'mozzarella',
    'prosciutto': 'prosciutto',
    'parmigiano': 'parmesan',
    'olio d\'oliva': 'olive oil',
    'pomodoro': 'tomato',
    'pomodori': 'tomatoes',
    'basilico': 'basil',
    'aglio': 'garlic',
    'cipolla': 'onion',
    'peperoncino': 'chili pepper',
    'funghi': 'mushrooms',
    'porcini': 'porcini mushrooms',
    'tartufo': 'truffle',
    'acciughe': 'anchovies',
    'tonno': 'tuna',
    'pasta': 'pasta',
    'riso': 'rice',
    'risotto': 'risotto',
    'pane': 'bread',
    'pangrattato': 'breadcrumbs',
    'uova': 'eggs',
    'uovo': 'egg',
    'formaggio': 'cheese',
    'burro': 'butter',
    'latte': 'milk',
    'panna': 'cream',

    // Piatti
    'cornetto': 'croissant',
    'Cornetto': 'Croissant',
    'brioche': 'brioche',
    'spaghetti': 'spaghetti',
    'Spaghetti': 'Spaghetti',
    'arancini': 'arancini',
    'Arancini': 'Arancini',

    // Verbi e frasi
    'Preparazione': 'Preparation',
    'preparazione': 'preparation',
    'Cottura': 'Cooking',
    'cottura': 'cooking',
    'Ingredienti': 'Ingredients',
    'ingredienti': 'ingredients',
    'Procedimento': 'Instructions',
    'procedimento': 'instructions',
    'minuti': 'minutes',
    'ore': 'hours',
    'persone': 'servings',
    'porzioni': 'portions',

    // LAPA specifico
    'LAPA': 'LAPA',
    'Zurigo': 'Zurich',
    'Svizzera': 'Switzerland',
    'svizzera': 'Switzerland',
  };

  let result = text;

  // Applica traduzioni (ordinate per lunghezza decrescente per evitare sostituzioni parziali)
  const sortedKeys = Object.keys(translations).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    result = result.replace(new RegExp(key, 'g'), translations[key]);
  }

  return result;
}

function generateEnglishMeta(italianMeta: { title?: string; description?: string; keywords?: string; name: string; subtitle?: string }): {
  title: string;
  description: string;
  keywords: string;
} {
  // Genera meta inglesi basati sui contenuti italiani
  const name = translateToEnglish(italianMeta.name);
  const subtitle = italianMeta.subtitle ? translateToEnglish(italianMeta.subtitle) : '';

  // Title
  let title = italianMeta.title ? translateToEnglish(italianMeta.title) : '';
  if (!title || title.length < 30) {
    title = `${name} | LAPA Switzerland`;
  }
  if (title.length > 60) {
    title = title.substring(0, 57) + '...';
  }

  // Description
  let description = italianMeta.description ? translateToEnglish(italianMeta.description) : '';
  if (!description || description.length < 100) {
    description = subtitle || `Discover ${name}. Premium Italian products from LAPA, your trusted wholesaler in Switzerland. Fast delivery.`;
  }
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }
  if (description.length < 120 && !description.includes('LAPA')) {
    description += ' Available at LAPA Switzerland.';
  }

  // Keywords
  let keywords = italianMeta.keywords ? translateToEnglish(italianMeta.keywords) : '';
  if (!keywords || keywords.length < 20) {
    const nameWords = name.toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 3);
    keywords = [...nameWords, 'Italian products', 'LAPA', 'Switzerland', 'Italian cuisine', 'Zurich'].join(', ');
  }

  return { title, description, keywords };
}

// ================== AGGIUNTA LINK ==================

interface Product {
  id: number;
  name: string;
  website_url?: string;
  categ_id?: [number, string];
}

function findRelatedProducts(articleName: string, articleContent: string, products: Product[]): Product[] {
  const related: Product[] = [];
  const contentLower = (articleName + ' ' + articleContent).toLowerCase();

  // Cerca prodotti menzionati nel contenuto
  for (const product of products) {
    const productNameLower = product.name.toLowerCase();
    const productWords = productNameLower.split(/\s+/).filter(w => w.length > 4);

    // Controlla se almeno 2 parole del prodotto sono nel contenuto
    const matches = productWords.filter(word => contentLower.includes(word));
    if (matches.length >= 2 || contentLower.includes(productNameLower)) {
      related.push(product);
    }
  }

  // Limita a 5 prodotti più rilevanti
  return related.slice(0, 5);
}

function generateProductLinksHtml(products: Product[]): string {
  if (products.length === 0) return '';

  const links = products.map(p => {
    const url = p.website_url || `/shop/product/${p.id}`;
    return `<li><a href="${url}" title="${p.name}">${p.name}</a></li>`;
  }).join('\n    ');

  return `
<div class="related-products">
  <h3>Prodotti Correlati LAPA</h3>
  <ul>
    ${links}
  </ul>
</div>`;
}

function addLinksToContent(content: string, linksHtml: string): string {
  if (!linksHtml || content.includes('related-products') || content.includes('Prodotti Correlati')) {
    return content;
  }

  // Aggiungi prima della chiusura del contenuto o alla fine
  if (content.includes('</div>')) {
    // Inserisci prima dell'ultimo </div>
    const lastDivIndex = content.lastIndexOf('</div>');
    return content.substring(0, lastDivIndex) + linksHtml + content.substring(lastDivIndex);
  } else {
    return content + linksHtml;
  }
}

// ================== MAIN ==================

async function main() {
  console.log('═'.repeat(80));
  console.log('🌍 LAPA - Traduzioni EN + Link Interni');
  console.log('═'.repeat(80));
  console.log('');

  const odoo = new OdooTranslator();
  const stats = {
    translationsFixed: 0,
    linksAdded: 0,
    errors: 0
  };

  try {
    console.log('🔐 Autenticazione...');
    await odoo.authenticate();
    console.log('✅ Connesso\n');

    // ==================== CARICA PRODOTTI ====================
    console.log('📦 Caricamento prodotti per link...');
    const products = await odoo.searchRead<Product>(
      'product.template',
      [['is_published', '=', true]],
      ['id', 'name', 'website_url', 'categ_id'],
      { limit: 5000 }
    );
    console.log(`   ${products.length} prodotti caricati\n`);

    // ==================== CARICA ARTICOLI ====================
    console.log('📝 Caricamento articoli...');
    const articles = await odoo.searchRead<any>(
      'blog.post',
      [['website_published', '=', true]],
      ['id', 'name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
      { limit: 1000 }
    );
    console.log(`   ${articles.length} articoli caricati\n`);

    // ==================== TRADUZIONI EN ====================
    console.log('🌍 FASE 1: Traduzioni Inglese Mancanti');
    console.log('─'.repeat(60));

    for (const articleId of ARTICLES_MISSING_EN) {
      const article = articles.find(a => a.id === articleId);
      if (!article) {
        console.log(`   ⚠️ Articolo ID ${articleId} non trovato`);
        continue;
      }

      console.log(`\n   📝 ID ${articleId}: ${article.name.substring(0, 50)}...`);

      try {
        // Leggi versione italiana
        const [itVersion] = await odoo.read('blog.post', [articleId],
          ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'],
          { lang: 'it_IT' }
        );

        // Genera meta EN
        const enMeta = generateEnglishMeta({
          title: itVersion.website_meta_title,
          description: itVersion.website_meta_description,
          keywords: itVersion.website_meta_keywords,
          name: itVersion.name,
          subtitle: itVersion.subtitle
        });

        // Traduci nome e subtitle
        const enName = translateToEnglish(itVersion.name);
        const enSubtitle = itVersion.subtitle ? translateToEnglish(itVersion.subtitle) : '';

        // Scrivi versione EN
        await odoo.write('blog.post', [articleId], {
          name: enName,
          subtitle: enSubtitle,
          website_meta_title: enMeta.title,
          website_meta_description: enMeta.description,
          website_meta_keywords: enMeta.keywords
        }, { lang: 'en_US' });

        console.log(`      ✅ Tradotto: ${enName.substring(0, 40)}...`);
        stats.translationsFixed++;

      } catch (err) {
        console.log(`      ❌ Errore: ${err instanceof Error ? err.message : 'sconosciuto'}`);
        stats.errors++;
      }
    }

    // ==================== LINK INTERNI ====================
    console.log('\n\n🔗 FASE 2: Aggiunta Link Interni');
    console.log('─'.repeat(60));

    let processedLinks = 0;
    for (const article of articles) {
      // Salta se già ha link (controlla nel content)
      if (article.content && (article.content.includes('<a href') || article.content.includes('related-products'))) {
        continue;
      }

      // Trova prodotti correlati
      const relatedProducts = findRelatedProducts(article.name, article.content || '', products);

      if (relatedProducts.length === 0) {
        continue;
      }

      // Genera HTML link
      const linksHtml = generateProductLinksHtml(relatedProducts);
      const newContent = addLinksToContent(article.content || '', linksHtml);

      if (newContent === article.content) {
        continue;
      }

      try {
        await odoo.write('blog.post', [article.id], { content: newContent });
        stats.linksAdded++;
        processedLinks++;

        if (processedLinks <= 10) {
          console.log(`   ✅ ID ${article.id}: Aggiunti ${relatedProducts.length} link`);
        } else if (processedLinks === 11) {
          console.log(`   ... (elaborazione altri articoli)`);
        }

        // Rate limiting
        if (processedLinks % 20 === 0) {
          await new Promise(r => setTimeout(r, 500));
        }

      } catch (err) {
        stats.errors++;
      }
    }

    // ==================== RIEPILOGO ====================
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 RIEPILOGO');
    console.log('═'.repeat(80));
    console.log(`
   🌍 Traduzioni EN completate:  ${stats.translationsFixed}
   🔗 Articoli con nuovi link:   ${stats.linksAdded}
   ❌ Errori:                    ${stats.errors}
`);

    // Salva report
    const dataDir = resolve(__dirname, '..', 'data');
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      translationsFixed: stats.translationsFixed,
      linksAdded: stats.linksAdded,
      errors: stats.errors,
      articlesWithMissingEN: ARTICLES_MISSING_EN
    };

    writeFileSync(resolve(dataDir, 'translations-links-report.json'), JSON.stringify(report, null, 2));
    console.log('📄 Report salvato in data/translations-links-report.json');

    console.log('\n✨ Completato!');

  } catch (error) {
    console.error('\n❌ Errore fatale:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
