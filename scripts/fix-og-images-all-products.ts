/**
 * Imposta Open Graph Image per tutti i prodotti
 * Questo fa sì che Google e social media mostrino l'immagine corretta
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

async function searchRead(model: string, domain: any[], fields: string[], limit?: number, offset?: number): Promise<any[]> {
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
        kwargs: { fields, limit: limit || 100, offset: offset || 0 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function searchCount(model: string, domain: any[]): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_count`, {
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
        method: 'search_count',
        args: [domain],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || 0;
}

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
    return false;
  }
  return data.result === true;
}

async function main() {
  console.log('🖼️  IMPOSTAZIONE OG IMAGE PER TUTTI I PRODOTTI');
  console.log('='.repeat(60));

  await authenticate();

  // Conta prodotti senza OG image
  const domain = [
    ['website_published', '=', true],
    '|',
    ['website_meta_og_img', '=', false],
    ['website_meta_og_img', '=', '']
  ];

  const totalCount = await searchCount('product.template', domain);
  console.log(`\n📊 Prodotti senza OG Image: ${totalCount}`);

  if (totalCount === 0) {
    console.log('✅ Tutti i prodotti hanno già l\'OG Image impostata!');
    return;
  }

  const BATCH_SIZE = 100;
  let processed = 0;
  let updated = 0;
  let errors = 0;

  const startTime = Date.now();

  for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
    // Leggi batch di prodotti
    const products = await searchRead('product.template', domain,
      ['id', 'name', 'image_1920'],
      BATCH_SIZE, offset
    );

    for (const product of products) {
      processed++;

      // Salta se non ha immagine principale
      if (!product.image_1920) {
        errors++;
        continue;
      }

      // Imposta OG Image con l'URL dell'immagine prodotto
      const ogImageUrl = `/web/image/product.template/${product.id}/image_1920`;

      const success = await write('product.template', [product.id], {
        website_meta_og_img: ogImageUrl
      });

      if (success) {
        updated++;
      } else {
        errors++;
      }

      // Progress ogni 100 prodotti
      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (totalCount - processed) / rate;
        console.log(`📈 ${processed}/${totalCount} (${updated} aggiornati, ${errors} errori) - ${Math.round(remaining)}s rimanenti`);
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETATO!');
  console.log('='.repeat(60));
  console.log(`📊 Totale processati: ${processed}`);
  console.log(`✅ OG Image impostate: ${updated}`);
  console.log(`❌ Errori/Senza immagine: ${errors}`);
  console.log(`⏱️  Tempo totale: ${totalTime} secondi`);
  console.log('\n💡 Ora Google e i social mostreranno l\'immagine corretta del prodotto!');
  console.log('   Potrebbero volerci alcuni giorni per l\'aggiornamento nelle ricerche.');
}

main();
