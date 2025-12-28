/**
 * Associate products to articles - V2
 * Improved: Fetch all posts from Odoo first, then match by similarity
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

const LANG_MAP: Record<string, string> = {
  'it_IT': 'it_IT',
  'de_DE': 'de_CH',
  'fr_FR': 'fr_CH',
  'en_US': 'en_US'
};

async function authenticate(): Promise<number> {
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
  if (!data.result?.uid) throw new Error('Auth failed');
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

const ARTICLE_PRODUCT_MAP: Record<string, string[]> = {
  'fior-di-latte': ['fiordilatte', 'fior di latte', 'mozzarella'],
  'fiordilatte': ['fiordilatte', 'fior di latte', 'mozzarella'],
  'burrata': ['burrata', 'stracciatella'],
  'guanciale': ['guanciale', 'pancetta'],
  'pecorino': ['pecorino', 'formaggio'],
  'pancetta': ['pancetta', 'guanciale'],
  'olive': ['olive', 'olivascolana'],
  'pomodoro': ['pomodoro', 'san marzano'],
  'speck': ['speck', 'affumicato'],
  'capperi': ['capperi', 'pantelleria'],
  'carbonara': ['guanciale', 'pecorino', 'pancetta'],
  'amatriciana': ['guanciale', 'pecorino', 'pomodoro'],
  'gricia': ['guanciale', 'pecorino'],
  'cacio': ['pecorino', 'formaggio'],
  'pizza': ['mozzarella', 'fiordilatte', 'pomodoro'],
  'margherita': ['mozzarella', 'pomodoro', 'basilico'],
  'formaggio': ['parmigiano', 'pecorino', 'grana'],
  'formaggi': ['parmigiano', 'pecorino', 'grana'],
  'salumi': ['salame', 'prosciutto', 'mortadella'],
  'wine': ['vino', 'chianti', 'barolo'],
  'vino': ['vino', 'chianti', 'barolo'],
  'caffe': ['caffe', 'espresso'],
  'coffee': ['caffe', 'espresso'],
  'olio': ['olio', 'extravergine'],
  'oil': ['olio', 'extravergine'],
  'pasta': ['pasta', 'spaghetti'],
  'antipasto': ['salumi', 'formaggio', 'olive']
};

function findRelevantProducts(articleId: string, products: any[]): any[] {
  const keywords: string[] = [];

  for (const [topic, topicKeywords] of Object.entries(ARTICLE_PRODUCT_MAP)) {
    if (articleId.includes(topic)) {
      keywords.push(...topicKeywords);
    }
  }

  if (keywords.length === 0) {
    keywords.push('pasta', 'formaggio', 'olio', 'pomodoro');
  }

  const matchedProducts: Array<{ product: any; score: number }> = [];

  for (const product of products) {
    let score = 0;
    const productName = product.name.toLowerCase();

    for (const keyword of keywords) {
      if (productName.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    if (productName.includes('dop') || productName.includes('igp') || productName.includes('doc')) {
      score += 5;
    }

    if (score > 0) {
      matchedProducts.push({ product, score });
    }
  }

  matchedProducts.sort((a, b) => b.score - a.score);
  return matchedProducts.slice(0, 4).map(m => m.product);
}

function createProductSection(products: any[], lang: string): string {
  const translations: Record<string, any> = {
    it_IT: {
      title: 'Prodotti Consigliati',
      buyNow: 'Acquista Ora',
      from: 'da'
    },
    de_DE: {
      title: 'Empfohlene Produkte',
      buyNow: 'Jetzt Kaufen',
      from: 'ab'
    },
    fr_FR: {
      title: 'Produits Recommandés',
      buyNow: 'Acheter',
      from: 'dès'
    },
    en_US: {
      title: 'Recommended Products',
      buyNow: 'Buy Now',
      from: 'from'
    }
  };

  const t = translations[lang];

  let html = `
<section class="recommended-products" style="margin: 3rem 0; padding: 2rem; background-color: #f8f9fa; border-radius: 8px;">
  <h2 style="font-size: 2rem; font-weight: bold; margin-bottom: 2rem; text-align: center;">${t.title}</h2>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;">
`;

  for (const product of products) {
    const productName = product.name.length > 60 ? product.name.slice(0, 60) + '...' : product.name;
    const price = product.list_price ? product.list_price.toFixed(2) : '0.00';
    const imageUrl = product.image_512 ? `data:image/jpeg;base64,${product.image_512}` : '';

    html += `
    <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s;">
      ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="width: 100%; height: 200px; object-fit: cover;" />` : ''}
      <div style="padding: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; min-height: 2.5rem;">${productName}</h3>
        <p style="font-size: 1.5rem; font-weight: bold; color: #e74c3c; margin-bottom: 1rem;">${t.from} CHF ${price}</p>
        <a href="${ODOO_URL}${product.website_url}" target="_blank" rel="noopener" style="display: block; text-align: center; background-color: #e74c3c; color: white; padding: 0.75rem 1.5rem; border-radius: 4px; text-decoration: none; font-weight: 600; transition: background-color 0.2s;">${t.buyNow}</a>
      </div>
    </div>
`;
  }

  html += `
  </div>
</section>
`;

  return html;
}

function insertProductSection(content: string, productSection: string): string {
  const conclusionPatterns = [
    '<h2>Conclusione</h2>',
    '<h2>Conclusion</h2>',
    '<h2>Fazit</h2>',
    '</section>\n</article>',
    '</article>'
  ];

  for (const pattern of conclusionPatterns) {
    if (content.includes(pattern)) {
      return content.replace(pattern, productSection + '\n' + pattern);
    }
  }

  if (content.includes('</article>')) {
    return content.replace('</article>', productSection + '\n</article>');
  }

  return content + '\n' + productSection;
}

function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().trim().slice(0, 30);
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  if (aNorm === bNorm) return 100;
  if (bNorm.includes(aNorm) || aNorm.includes(bNorm)) return 80;

  const aWords = aNorm.split(/\s+/);
  const bWords = bNorm.split(/\s+/);
  let matchCount = 0;

  for (const word of aWords) {
    if (bWords.some(w => w.includes(word) || word.includes(w))) {
      matchCount++;
    }
  }

  return Math.floor((matchCount / Math.max(aWords.length, bWords.length)) * 100);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ASSOCIA PRODOTTI AGLI ARTICOLI (V2 - IMPROVED)        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Load product catalog
  console.log('📦 Caricamento catalogo prodotti...');
  const products = JSON.parse(readFileSync(join(__dirname, '../data/odoo-products-catalog.json'), 'utf-8'));
  console.log(`   ${products.length} prodotti disponibili\n`);

  // Authenticate
  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Get ALL blog posts from Odoo
  console.log('📋 Recupero tutti i post da Odoo (blog_id = 4)...');
  const allPosts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]],
    ['id', 'name']
  ], { context: { lang: 'it_IT' } });

  console.log(`   Trovati ${allPosts.length} post su Odoo\n`);

  // Load articles
  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.json') && f.startsWith('article-'))
    .sort();

  console.log(`📄 ${files.length} articoli da aggiornare\n`);

  const results: Array<{ file: string; postId?: number; productCount: number; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${i + 1}/${files.length}] ${file}`);
    console.log('─'.repeat(60));

    try {
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const articleId = article.article_id;
      const title = article.translations.it_IT.name;

      console.log(`📝 "${title.slice(0, 50)}..."`);

      // Find relevant products
      const relevantProducts = findRelevantProducts(articleId, products);

      if (relevantProducts.length === 0) {
        console.log('⚠️  Nessun prodotto trovato, skip');
        results.push({ file, productCount: 0 });
        continue;
      }

      console.log(`🛒 Trovati ${relevantProducts.length} prodotti rilevanti`);

      // Find matching post on Odoo by title similarity
      let bestMatch: any = null;
      let bestScore = 0;

      for (const post of allPosts) {
        const score = titleSimilarity(title, post.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = post;
        }
      }

      if (!bestMatch || bestScore < 50) {
        console.log(`❌ Nessun post corrispondente trovato su Odoo (best match: ${bestScore}%)`);
        results.push({ file, productCount: 0, error: 'No matching post found' });
        continue;
      }

      const postId = bestMatch.id;
      console.log(`   Post ID: ${postId} (match: ${bestScore}%)`);

      // Update each language
      for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
        const langData = article.translations[jsonLang];
        if (!langData) continue;

        const productSection = createProductSection(relevantProducts, jsonLang);
        const updatedContent = insertProductSection(langData.content_html, productSection);

        article.translations[jsonLang].content_html = updatedContent;

        await callOdoo('blog.post', 'write', [[postId], {
          content: updatedContent
        }], { context: { lang: odooLang } });
      }

      writeFileSync(articlePath, JSON.stringify(article, null, 2));

      console.log(`✅ Aggiornato con ${relevantProducts.length} prodotti`);
      results.push({ file, postId, productCount: relevantProducts.length });

      await new Promise(r => setTimeout(r, 1500));

    } catch (e: any) {
      const errorMsg = e.message ? e.message.slice(0, 100) : String(e).slice(0, 100);
      console.log(`❌ ERRORE: ${errorMsg}`);
      results.push({ file, productCount: 0, error: errorMsg });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO');
  console.log('═'.repeat(60) + '\n');

  const successes = results.filter(r => r.productCount > 0);
  const errors = results.filter(r => r.error);

  console.log(`✅ Successi: ${successes.length}/${files.length}`);
  console.log(`❌ Errori: ${errors.length}/${files.length}\n`);

  if (errors.length > 0 && errors.length <= 10) {
    console.log('❌ ERRORI:\n');
    for (const r of errors) {
      console.log(`  • ${r.file}: ${r.error}`);
    }
  }

  console.log('\n🎉 Associazione prodotti completata!');
}

main().catch(console.error);
