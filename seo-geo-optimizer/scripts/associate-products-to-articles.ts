/**
 * Associate 3-4 relevant products to each article
 * Update both JSON files and Odoo blog posts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || '');

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

// Map article topics to product keywords
const ARTICLE_PRODUCT_MAP: Record<string, string[]> = {
  'fior-di-latte': ['fiordilatte', 'fior di latte', 'mozzarella'],
  'burrata': ['burrata', 'stracciatella'],
  'guanciale': ['guanciale', 'pancetta'],
  'pecorino': ['pecorino', 'formaggio'],
  'fiordilatte': ['fiordilatte', 'fior di latte', 'mozzarella'],
  'pancetta': ['pancetta', 'guanciale'],
  'olive': ['olive', 'olivascolana'],
  'pomodoro': ['pomodoro', 'san marzano'],
  'speck': ['speck', 'affumicato'],
  'capperi': ['capperi', 'pantelleria'],
  'carbonara': ['guanciale', 'pecorino', 'pancetta'],
  'amatriciana': ['guanciale', 'pecorino', 'pomodoro'],
  'pizza': ['mozzarella', 'fiordilatte', 'pomodoro'],
  'pasta': ['pasta', 'spaghetti', 'penne'],
  'formaggio': ['parmigiano', 'pecorino', 'grana'],
  'salumi': ['salame', 'prosciutto', 'mortadella'],
  'wine': ['vino', 'chianti', 'barolo'],
  'coffee': ['caffe', 'espresso'],
  'oil': ['olio', 'extravergine']
};

function findRelevantProducts(articleId: string, products: any[]): any[] {
  // Extract keywords from article ID
  const keywords: string[] = [];

  for (const [topic, topicKeywords] of Object.entries(ARTICLE_PRODUCT_MAP)) {
    if (articleId.includes(topic)) {
      keywords.push(...topicKeywords);
    }
  }

  // If no specific match, use general Italian food keywords
  if (keywords.length === 0) {
    keywords.push('pasta', 'formaggio', 'olio', 'pomodoro');
  }

  // Find products matching keywords
  const matchedProducts: Array<{ product: any; score: number }> = [];

  for (const product of products) {
    let score = 0;
    const productName = product.name.toLowerCase();

    for (const keyword of keywords) {
      if (productName.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }

    // Bonus for DOP/IGP/DOC products
    if (productName.includes('dop') || productName.includes('igp') || productName.includes('doc')) {
      score += 5;
    }

    if (score > 0) {
      matchedProducts.push({ product, score });
    }
  }

  // Sort by score and take top 4
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
      title: 'Produits RecommandÃ©s',
      buyNow: 'Acheter',
      from: 'dÃ¨s'
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
  // Try to insert before conclusion section
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

  // If no conclusion found, append before closing article tag
  if (content.includes('</article>')) {
    return content.replace('</article>', productSection + '\n</article>');
  }

  // Otherwise, append at the end
  return content + '\n' + productSection;
}

async function main() {
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘     ASSOCIA PRODOTTI AGLI ARTICOLI E AGGIORNA ODOO        â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  // Load product catalog
  console.log('ðŸ“¦ Caricamento catalogo prodotti...');
  const products = JSON.parse(readFileSync(join(__dirname, '../data/odoo-products-catalog.json'), 'utf-8'));
  console.log(`   ${products.length} prodotti disponibili\n`);

  // Load articles
  const articlesDir = join(__dirname, '../data/new-articles-2025');
  const files = readdirSync(articlesDir)
    .filter(f => f.endsWith('.json') && f.startsWith('article-'))
    .sort();

  console.log(`ðŸ“„ ${files.length} articoli da aggiornare\n`);

  // Authenticate
  console.log('ðŸ” Autenticazione...');
  await authenticate();
  console.log('âœ…\n');

  const results: Array<{ file: string; productCount: number; error?: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const articlePath = join(articlesDir, file);

    console.log(`\n[${i + 1}/${files.length}] ${file}`);
    console.log('â”€'.repeat(60));

    try {
      const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
      const articleId = article.article_id;
      const title = article.translations.it_IT.name;

      console.log(`ðŸ“ "${title.slice(0, 50)}..."`);

      // Find relevant products
      const relevantProducts = findRelevantProducts(articleId, products);

      if (relevantProducts.length === 0) {
        console.log('âš ï¸  Nessun prodotto trovato, skip');
        results.push({ file, productCount: 0 });
        continue;
      }

      console.log(`ðŸ›’ Trovati ${relevantProducts.length} prodotti rilevanti`);

      // Get blog post ID from Odoo
      const posts = await callOdoo('blog.post', 'search_read', [
        [['name', '=', title]],
        ['id']
      ], { limit: 1 });

      if (!posts || posts.length === 0) {
        console.log('âŒ Articolo non trovato su Odoo');
        results.push({ file, productCount: 0, error: 'Not found on Odoo' });
        continue;
      }

      const postId = posts[0].id;
      console.log(`   Post ID: ${postId}`);

      // Update each language
      for (const [jsonLang, odooLang] of Object.entries(LANG_MAP)) {
        const langData = article.translations[jsonLang];
        if (!langData) continue;

        // Create product section for this language
        const productSection = createProductSection(relevantProducts, jsonLang);

        // Insert product section into content
        const updatedContent = insertProductSection(langData.content_html, productSection);

        // Update article JSON
        article.translations[jsonLang].content_html = updatedContent;

        // Update Odoo
        await callOdoo('blog.post', 'write', [[postId], {
          content: updatedContent
        }], { context: { lang: odooLang } });
      }

      // Save updated JSON
      writeFileSync(articlePath, JSON.stringify(article, null, 2));

      console.log(`âœ… Aggiornato con ${relevantProducts.length} prodotti`);
      results.push({ file, productCount: relevantProducts.length });

      // Delay between updates
      await new Promise(r => setTimeout(r, 1500));

    } catch (e: any) {
      const errorMsg = e.message ? e.message.slice(0, 100) : String(e).slice(0, 100);
      console.log(`âŒ ERRORE: ${errorMsg}`);
      results.push({ file, productCount: 0, error: errorMsg });
    }
  }

  // Summary
  console.log('\n' + 'â•'.repeat(60));
  console.log('ðŸ“Š RIEPILOGO');
  console.log('â•'.repeat(60) + '\n');

  const successes = results.filter(r => r.productCount > 0);
  const errors = results.filter(r => r.error);

  console.log(`âœ… Successi: ${successes.length}/${files.length}`);
  console.log(`âŒ Errori: ${errors.length}/${files.length}\n`);

  if (errors.length > 0) {
    console.log('âŒ ERRORI:\n');
    for (const r of errors) {
      console.log(`  â€¢ ${r.file}: ${r.error}`);
    }
  }

  console.log('\nðŸŽ‰ Associazione prodotti completata!');
}

main().catch(console.error);
