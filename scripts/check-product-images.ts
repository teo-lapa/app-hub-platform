/**
 * Verifica immagini prodotto e alt text
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

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
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Connesso come ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

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
        kwargs: { fields, limit: limit || 10 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log('🔍 VERIFICA IMMAGINI PRODOTTO');
  console.log('='.repeat(60));

  await authenticate();

  // Cerca il prodotto mozzarella ciuffo
  const products = await searchRead('product.template',
    [['name', 'ilike', 'ciuffo']],
    ['id', 'name', 'website_url', 'image_1920', 'image_256', 'image_128',
     'product_variant_ids', 'website_meta_og_img'],
    5
  );

  console.log(`\n📦 Prodotti "ciuffo" trovati: ${products.length}`);

  for (const p of products) {
    console.log('\n' + '─'.repeat(60));
    console.log(`📦 ${p.name}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   URL: ${p.website_url}`);
    console.log(`   Ha immagine principale: ${p.image_1920 ? '✅ Sì' : '❌ No'}`);
    console.log(`   OG Image (social): ${p.website_meta_og_img || '❌ Non impostata'}`);
    console.log(`   URL immagine: https://www.lapa.ch/web/image/product.template/${p.id}/image_1920`);

    // Verifica varianti prodotto
    if (p.product_variant_ids && p.product_variant_ids.length > 0) {
      console.log(`   Varianti: ${p.product_variant_ids.length}`);

      const variants = await searchRead('product.product',
        [['id', 'in', p.product_variant_ids]],
        ['id', 'name', 'image_1920', 'default_code'],
        5
      );

      for (const v of variants) {
        console.log(`      - Variante ${v.id}: ${v.default_code || 'no SKU'} - Immagine: ${v.image_1920 ? '✅' : '❌'}`);
      }
    }
  }

  // Verifica anche gli attachment delle immagini
  console.log('\n\n🔍 VERIFICA ATTACHMENT IMMAGINI...');

  const attachments = await searchRead('ir.attachment',
    [['res_model', '=', 'product.template'], ['res_field', '=', 'image_1920']],
    ['id', 'name', 'res_id', 'mimetype', 'file_size'],
    10
  );

  console.log(`\n📎 Attachment immagini prodotti: ${attachments.length} (primi 10)`);
  for (const a of attachments) {
    console.log(`   - ID ${a.res_id}: ${a.name} (${a.mimetype}, ${Math.round(a.file_size/1024)}KB)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 SOLUZIONE:');
  console.log('='.repeat(60));
  console.log(`
Per correggere l'immagine su Google:

1. **Open Graph Image** - Imposta website_meta_og_img per ogni prodotto
   Questo dice a Google quale immagine usare per i social/ricerca

2. **Alt Text** - Assicurati che le immagini abbiano alt text descrittivi

3. **Forza reindicizzazione** - In Google Search Console:
   - Vai su "Controllo URL"
   - Inserisci l'URL del prodotto
   - Clicca "Richiedi indicizzazione"

4. **Attendi** - Google ci mette giorni/settimane per aggiornare le immagini
`);
}

main();
