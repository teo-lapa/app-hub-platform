/**
 * Script per rimuovere "Disallow: /blog" dal robots.txt
 * Permette l'indicizzazione degli articoli blog
 */

const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
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

  const data: any = await response.json();
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

  const data: any = await response.json();
  return data.result || [];
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

  const data: any = await response.json();
  if (data.error) {
    console.log(`❌ Errore: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

async function main() {
  console.log('🔧 RIMOZIONE BLOCCO /BLOG DAL ROBOTS.TXT');
  console.log('='.repeat(60));

  await authenticate();

  // 1. Leggi il robots.txt attuale del website ID 1 (LAPA ZERO PENSIERI)
  const websites = await searchRead('website', [['id', '=', 1]], ['id', 'name', 'robots_txt']);

  if (websites.length === 0) {
    console.log('❌ Nessun sito trovato');
    return;
  }

  const website = websites[0];
  const currentRobots = website.robots_txt || '';

  console.log(`\n🌐 Website: ${website.name} (ID: ${website.id})`);
  console.log('\n📜 ROBOTS.TXT PRIMA:');
  console.log('─'.repeat(40));
  console.log(currentRobots);
  console.log('─'.repeat(40));

  // 2. Rimuovi SOLO la riga "Disallow: /blog"
  const newRobots = currentRobots
    .split('\n')
    .filter((line: string) => !line.trim().match(/^Disallow:\s*\/blog\s*$/i))
    .join('\n');

  console.log('\n📜 ROBOTS.TXT DOPO (rimosso /blog):');
  console.log('─'.repeat(40));
  console.log(newRobots);
  console.log('─'.repeat(40));

  // 3. Aggiorna
  console.log('\n🚀 Aggiornamento...');
  const success = await write('website', [website.id], {
    robots_txt: newRobots
  });

  if (success) {
    console.log('\n✅ FATTO! Rimosso "Disallow: /blog"');
    console.log('\n📋 Ora Google può indicizzare gli articoli del blog!');
    console.log('   1. Vai su Google Search Console');
    console.log('   2. Richiedi indicizzazione degli articoli blog');
    console.log('   3. Attendi qualche ora per vedere gli effetti');
  } else {
    console.log('\n❌ Errore durante l\'aggiornamento');
  }
}

main();
