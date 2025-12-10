/**
 * Script per aggiornare automaticamente i Meta Tag SEO di tutti i prodotti
 *
 * Genera:
 * - Meta Title: "[Nome Prodotto] | LAPA Grossista Italiano"
 * - Meta Description: "Acquista [Nome Prodotto] da LAPA, il tuo grossista di prodotti italiani in Svizzera. Consegna rapida, qualità garantita."
 * - Meta Keywords: basate sul nome e categoria
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

// Autenticazione
async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Auth failed');
  if (!data.result?.uid) throw new Error('Auth failed: Invalid credentials');

  console.log(`✅ Connesso a Odoo come ${ODOO_CONFIG.username} (UID: ${data.result.uid})`);
  return data.result.uid;
}

// Leggere records
async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: limit || 5000 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore query ${model}: ${data.error.data?.message || data.error.message}`);
    return [];
  }
  return data.result || [];
}

// Aggiornare records
async function write(model: string, ids: number[], values: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'write',
        args: [ids, values],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore write ${model}: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Formatta il nome prodotto per SEO (prima lettera maiuscola, resto minuscolo)
function formatProductName(name: string): string {
  // Rimuovi codici prodotto alla fine (es. "123ABC", "CRT", "KG", ecc.)
  let cleanName = name
    .replace(/\s+(CRT|KG|GR|LT|ML|PZ|CONF|FREDD|AF|MUS|PR)\s*$/gi, '')
    .replace(/\s+\d+(\.\d+)?(KG|GR|LT|ML|PZ)?\s*$/gi, '')
    .trim();

  // Converti in title case
  return cleanName
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Genera meta title (max 60 caratteri)
function generateMetaTitle(name: string): string {
  const formattedName = formatProductName(name);
  const suffix = ' | LAPA Grossista';

  // Se il nome è troppo lungo, tronca
  const maxNameLength = 60 - suffix.length;
  const truncatedName = formattedName.length > maxNameLength
    ? formattedName.substring(0, maxNameLength - 3) + '...'
    : formattedName;

  return truncatedName + suffix;
}

// Genera meta description (max 160 caratteri)
function generateMetaDescription(name: string, category?: string): string {
  const formattedName = formatProductName(name);

  let description = `Acquista ${formattedName} da LAPA, grossista prodotti italiani in Svizzera. `;

  if (category) {
    description += `${category}. `;
  }

  description += 'Consegna rapida, qualità garantita.';

  // Tronca se troppo lungo
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }

  return description;
}

// Genera keywords
function generateKeywords(name: string, category?: string): string {
  const words = formatProductName(name).toLowerCase().split(' ').filter(w => w.length > 2);
  const keywords = [
    ...words,
    'grossista',
    'italiano',
    'svizzera',
    'lapa',
    'ristoranti'
  ];

  if (category) {
    keywords.push(category.toLowerCase());
  }

  return [...new Set(keywords)].slice(0, 10).join(', ');
}

// ==================== MAIN ====================

async function main() {
  console.log('🔧 FIX SEO - AGGIORNAMENTO META TAG PRODOTTI');
  console.log('='.repeat(60));
  console.log(`📅 Data: ${new Date().toLocaleString('it-IT')}`);
  console.log('='.repeat(60));

  try {
    await authenticate();

    // 1. Carica tutti i prodotti pubblicati SENZA meta tag SEO
    console.log('\n📦 Caricamento prodotti senza SEO...');
    const products = await searchRead('product.template',
      [
        ['is_published', '=', true],
        '|',
        ['website_meta_title', '=', false],
        ['website_meta_description', '=', false]
      ],
      ['id', 'name', 'public_categ_ids'],
      5000
    );

    console.log(`📊 Trovati ${products.length} prodotti da aggiornare`);

    if (products.length === 0) {
      console.log('✅ Tutti i prodotti hanno già i meta tag SEO!');
      return;
    }

    // 2. Carica le categorie per avere i nomi
    const categories = await searchRead('product.public.category', [], ['id', 'name']);
    const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

    // 3. Aggiorna i prodotti in batch
    console.log('\n🚀 Inizio aggiornamento...\n');

    let updated = 0;
    let errors = 0;
    const batchSize = 50; // Aggiorna 50 prodotti alla volta

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      for (const product of batch) {
        // Trova la categoria principale
        const categoryId = product.public_categ_ids?.[0];
        const categoryName = categoryId ? categoryMap.get(categoryId) : undefined;

        // Genera i meta tag
        const metaTitle = generateMetaTitle(product.name);
        const metaDescription = generateMetaDescription(product.name, categoryName);
        const metaKeywords = generateKeywords(product.name, categoryName);

        // Aggiorna il prodotto
        const success = await write('product.template', [product.id], {
          website_meta_title: metaTitle,
          website_meta_description: metaDescription,
          website_meta_keywords: metaKeywords
        });

        if (success) {
          updated++;
          if (updated <= 5 || updated % 100 === 0) {
            console.log(`✅ [${updated}/${products.length}] ${product.name.substring(0, 40)}...`);
            console.log(`   Title: ${metaTitle}`);
          }
        } else {
          errors++;
        }
      }

      // Progress
      const progress = Math.round((i + batch.length) / products.length * 100);
      console.log(`📊 Progresso: ${progress}% (${i + batch.length}/${products.length})`);

      // Piccola pausa per non sovraccaricare il server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Report finale
    console.log('\n');
    console.log('='.repeat(60));
    console.log('📋 REPORT FINALE');
    console.log('='.repeat(60));
    console.log(`✅ Prodotti aggiornati: ${updated}`);
    console.log(`❌ Errori: ${errors}`);
    console.log(`📊 Percentuale successo: ${Math.round(updated / products.length * 100)}%`);

  } catch (error: any) {
    console.error('💥 Errore:', error.message);
  }
}

main();
