/**
 * Fix problemi SEO critici
 * 1. Rimuove noindex dalla homepage
 * 2. Cambia auth_signup_uninvited da b2b a b2c
 */

const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let cookies = null;

async function auth() {
  const res = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { db: ODOO_CONFIG.db, login: ODOO_CONFIG.username, password: ODOO_CONFIG.password },
      id: 1
    })
  });
  const cookieHeader = res.headers.get('set-cookie');
  if (cookieHeader) cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const data = await res.json();
  if (!cookies) cookies = `session_id=${data.result.session_id}`;
}

async function searchRead(model, domain, fields) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { model, method: 'search_read', args: [], kwargs: { domain, fields } },
      id: 2
    })
  });
  const data = await res.json();
  return data.result || [];
}

async function write(model, ids, values) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { model, method: 'write', args: [ids, values], kwargs: {} },
      id: 3
    })
  });
  const data = await res.json();
  if (data.error) {
    console.log(`❌ Errore: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

async function main() {
  console.log('\n🔧 FIX PROBLEMI SEO CRITICI');
  console.log('═'.repeat(80));

  await auth();
  console.log('✅ Connesso a Odoo\n');

  // ========================================
  // 1. CAMBIA AUTH DA B2B A B2C
  // ========================================
  console.log('📋 PROBLEMA 1: Auth Signup Mode = b2b');
  console.log('─'.repeat(80));

  const websites = await searchRead('website', [['id', '=', 1]],
    ['id', 'name', 'auth_signup_uninvited']);

  if (websites.length > 0) {
    const website = websites[0];
    console.log(`Website: ${website.name} (ID: ${website.id})`);
    console.log(`Auth attuale: ${website.auth_signup_uninvited}`);

    if (website.auth_signup_uninvited === 'b2b') {
      console.log('\n🚀 Cambio da "b2b" a "b2c"...');
      const success = await write('website', [website.id], {
        auth_signup_uninvited: 'b2c'
      });

      if (success) {
        console.log('✅ FATTO! Auth cambiato a "b2c" (pubblico)');
      } else {
        console.log('❌ ERRORE durante il cambio');
      }
    } else if (website.auth_signup_uninvited === 'b2c') {
      console.log('✅ GIÀ CORRETTO! Auth è già "b2c"');
    }
  }

  // ========================================
  // 2. RIMUOVE NOINDEX DALLA HOMEPAGE
  // ========================================
  console.log('\n\n📋 PROBLEMA 2: Homepage ha meta noindex');
  console.log('─'.repeat(80));

  // Cerca la homepage (di solito è la view "website.homepage")
  const homepages = await searchRead('website.page',
    [['url', '=', '/']],
    ['id', 'name', 'url', 'website_indexed', 'is_published', 'view_id']);

  console.log(`Trovate ${homepages.length} homepage`);

  if (homepages.length > 0) {
    for (const page of homepages) {
      console.log(`\nPagina: ${page.name}`);
      console.log(`  URL: ${page.url}`);
      console.log(`  Indexed: ${page.website_indexed}`);
      console.log(`  Published: ${page.is_published}`);

      // Se website_indexed è false, mettilo a true
      if (page.website_indexed === false) {
        console.log('\n🚀 Rimuovo noindex...');
        const success = await write('website.page', [page.id], {
          website_indexed: true
        });

        if (success) {
          console.log('✅ FATTO! Noindex rimosso dalla homepage');
        } else {
          console.log('❌ ERRORE durante la rimozione');
        }
      } else {
        console.log('✅ GIÀ CORRETTO! Homepage NON ha noindex nel database');
        console.log('\n⚠️ NOTA: Se il sito mostra ancora noindex nel frontend,');
        console.log('   potrebbe essere nel template HTML. Controlla:');
        console.log('   - Website → Views → Homepage template');
        console.log('   - Cerca <meta name="robots" content="noindex">');
      }
    }
  } else {
    console.log('⚠️ Homepage non trovata come "website.page"');
    console.log('\nProvo a cercare nelle views...');

    // Cerca nella view
    const views = await searchRead('ir.ui.view',
      ['|', ['name', '=', 'Homepage'], ['key', 'ilike', 'homepage']],
      ['id', 'name', 'key', 'arch_db']);

    if (views.length > 0) {
      console.log(`\nTrovate ${views.length} view homepage:`);
      for (const view of views) {
        console.log(`  - ${view.name} (${view.key})`);

        if (view.arch_db && view.arch_db.includes('noindex')) {
          console.log('    ⚠️ ATTENZIONE: Contiene "noindex" nel template!');
          console.log('    → Da rimuovere manualmente nel backend Odoo');
        }
      }
    }
  }

  // ========================================
  // VERIFICA FINALE
  // ========================================
  console.log('\n\n📊 VERIFICA FINALE');
  console.log('═'.repeat(80));

  const finalWebsite = await searchRead('website', [['id', '=', 1]],
    ['id', 'name', 'auth_signup_uninvited']);

  if (finalWebsite.length > 0) {
    const site = finalWebsite[0];
    console.log(`\n✅ Website: ${site.name}`);
    console.log(`   Auth: ${site.auth_signup_uninvited} ${site.auth_signup_uninvited === 'b2c' ? '✅' : '❌'}`);
  }

  const finalHomepage = await searchRead('website.page',
    [['url', '=', '/']],
    ['id', 'name', 'website_indexed']);

  if (finalHomepage.length > 0) {
    const page = finalHomepage[0];
    console.log(`\n✅ Homepage: ${page.name}`);
    console.log(`   Indexed: ${page.website_indexed !== false ? 'SI ✅' : 'NO ❌'}`);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Fix completato!');
  console.log('\n📌 PROSSIMI PASSI:');
  console.log('   1. Verifica il sito in incognito: https://www.lapa.ch');
  console.log('   2. Controlla che NON ci sia più <meta name="robots" content="noindex">');
  console.log('   3. Vai su Google Search Console e richiedi indicizzazione');
  console.log('   4. Purga cache Cloudflare se necessario\n');
}

main().catch(console.error);
