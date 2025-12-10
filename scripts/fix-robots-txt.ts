/**
 * Script per modificare il robots.txt in Odoo
 * Rimuove il blocco /shop e sblocca i bot AI
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
        kwargs: { fields, limit: limit || 100 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore: ${data.error.data?.message || data.error.message}`);
    return [];
  }
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

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore write: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

async function main() {
  console.log('🔧 FIX ROBOTS.TXT - SBLOCCO /SHOP');
  console.log('='.repeat(60));

  await authenticate();

  // 1. Cerca le configurazioni del sito web
  console.log('\n🔍 Cerco configurazione website...');
  const websites = await searchRead('website', [], [
    'id', 'name', 'robots_txt', 'domain'
  ]);

  if (websites.length === 0) {
    console.log('❌ Nessun sito trovato');
    return;
  }

  const website = websites[0];
  console.log(`\n📄 Sito trovato: ${website.name} (${website.domain})`);
  console.log(`\n📜 ROBOTS.TXT ATTUALE:`);
  console.log('─'.repeat(60));
  console.log(website.robots_txt || '(vuoto - usa default Odoo)');
  console.log('─'.repeat(60));

  // 2. Nuovo robots.txt ottimizzato
  const newRobotsTxt = `# LAPA - Robots.txt ottimizzato per SEO
# Aggiornato: ${new Date().toISOString().split('T')[0]}

User-agent: *
Allow: /
Allow: /shop
Allow: /shop/
Allow: /prodotti-e-cataloghi
Disallow: /web/login
Disallow: /my
Disallow: /my/
Disallow: /signup
Disallow: /profile/users
Disallow: /customers
Disallow: /contactus-thank-you
Disallow: /your-ticket-has-been-submitted
Disallow: /job-thank-you
Disallow: /grazie-per-aver-inviato-la-tua-richiesta-fb
Disallow: /grazie-per-aver-inviato-la-tua-richiesta-gg

# Sitemap
Sitemap: https://www.lapa.ch/sitemap.xml

# Permettiamo i bot AI per visibilità
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /
`;

  console.log('\n📝 NUOVO ROBOTS.TXT:');
  console.log('─'.repeat(60));
  console.log(newRobotsTxt);
  console.log('─'.repeat(60));

  // 3. Aggiorna il robots.txt
  console.log('\n🚀 Aggiornamento in corso...');
  const success = await write('website', [website.id], {
    robots_txt: newRobotsTxt
  });

  if (success) {
    console.log('\n✅ ROBOTS.TXT AGGIORNATO CON SUCCESSO!');
    console.log('\n📋 Modifiche effettuate:');
    console.log('   ✅ Rimosso blocco /shop - ora Google può indicizzare i prodotti');
    console.log('   ✅ Sbloccato GPTBot - ChatGPT può leggere il sito');
    console.log('   ✅ Sbloccato ClaudeBot - Claude può leggere il sito');
    console.log('   ✅ Sbloccato Google-Extended - Google AI può leggere il sito');
    console.log('\n⏰ Le modifiche saranno attive entro pochi minuti.');
    console.log('   Poi torna su Google Search Console e re-invia la sitemap!');
  } else {
    console.log('\n❌ Errore durante l\'aggiornamento');
    console.log('   Potrebbe essere necessario modificarlo manualmente in Odoo.');
  }
}

main();
