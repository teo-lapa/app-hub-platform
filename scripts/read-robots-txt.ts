/**
 * Script per LEGGERE il robots.txt attuale in Odoo (SOLA LETTURA)
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

async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
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
        kwargs: { fields }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  console.log('🔍 LETTURA ROBOTS.TXT DA ODOO');
  console.log('='.repeat(60));

  await authenticate();

  // Leggi configurazione website
  const websites = await searchRead('website', [], [
    'id', 'name', 'robots_txt', 'domain'
  ]);

  if (websites.length === 0) {
    console.log('❌ Nessun sito trovato');
    return;
  }

  const website = websites[0];
  console.log(`\n📄 Sito: ${website.name}`);
  console.log(`🌐 Dominio: ${website.domain}`);
  console.log(`🆔 ID: ${website.id}`);

  console.log('\n📜 ROBOTS.TXT SALVATO IN ODOO:');
  console.log('═'.repeat(60));

  if (website.robots_txt) {
    console.log(website.robots_txt);
  } else {
    console.log('(VUOTO - Odoo usa un default o viene gestito da Cloudflare)');
  }

  console.log('═'.repeat(60));

  console.log('\n💡 NOTA: Il robots.txt che vedi sul sito potrebbe essere');
  console.log('   generato da Cloudflare, non da Odoo direttamente.');
}

main();
