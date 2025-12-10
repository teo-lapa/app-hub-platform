/**
 * Audit SEO completo - lapa.ch
 * Due tabelle: GEO (Odoo) + SEO (Frontend)
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

async function checkPage(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    return {
      status: res.status,
      hasNoindex: html.includes('noindex'),
      hasNofollow: html.includes('nofollow'),
      hasMetaDesc: /<meta name="description"/.test(html),
      hasOG: /<meta property="og:/.test(html),
      hasSchema: /<script[^>]*type="application\/ld\+json"/.test(html),
      title: (html.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || 'N/A'
    };
  } catch (e) {
    return { status: 'ERROR', error: e.message };
  }
}

async function main() {
  console.log('\n🔍 AUDIT SEO COMPLETO - lapa.ch');
  console.log('═'.repeat(100));

  await auth();
  console.log('✅ Connesso a Odoo\n');

  // =============================
  // TABELLA 1: GEO (ODOO CONFIG)
  // =============================
  console.log('\n📊 TABELLA 1: CONFIGURAZIONE GEO (Odoo Backend)');
  console.log('─'.repeat(100));

  const websites = await searchRead('website', [['id', '=', 1]],
    ['id', 'name', 'auth_signup_uninvited', 'specific_user_account', 'robots_txt']);

  const themeConfig = await searchRead('dr.theme.config',
    [['key', '=', 'json_b2b_shop_config'], ['website_id', '=', 1]],
    ['key', 'value']);

  const website = websites[0];
  const b2bConfig = themeConfig.length > 0 ? JSON.parse(themeConfig[0].value) : {};

  const geoData = [
    ['Parametro', 'Valore Attuale', 'Status', 'Note / Azione Richiesta'],
    ['─'.repeat(30), '─'.repeat(25), '─'.repeat(10), '─'.repeat(40)],
    ['Website Name', website.name, '✅ OK', 'LAPA ZERO PENSIERI'],
    ['B2B Mode (Theme Prime)', b2bConfig.dr_enable_b2b ? 'ON ❌' : 'OFF ✅', b2bConfig.dr_enable_b2b ? '❌ FAIL' : '✅ OK', b2bConfig.dr_enable_b2b ? 'DISATTIVARE - Blocca Google' : 'Corretto'],
    ['Pricelist per customer', b2bConfig.dr_only_assigned_pricelist ? 'ON ⚠️' : 'OFF ✅', b2bConfig.dr_only_assigned_pricelist ? '⚠️ WARN' : '✅ OK', b2bConfig.dr_only_assigned_pricelist ? 'DISATTIVARE - Nasconde prezzi' : 'Corretto'],
    ['Auth Signup Mode', website.auth_signup_uninvited, website.auth_signup_uninvited === 'b2c' ? '✅ OK' : '❌ FAIL', website.auth_signup_uninvited === 'b2c' ? 'Pubblico - OK' : 'Richiede login - CAMBIARE a b2c'],
    ['robots.txt blocca /blog', website.robots_txt?.includes('Disallow: /blog') ? 'SI ❌' : 'NO ✅', website.robots_txt?.includes('Disallow: /blog') ? '❌ FAIL' : '✅ OK', website.robots_txt?.includes('Disallow: /blog') ? 'RIMUOVERE Disallow: /blog' : 'Corretto'],
    ['robots.txt blocca /shop', website.robots_txt?.includes('Disallow: /shop') ? 'SI ❌' : 'NO ✅', website.robots_txt?.includes('Disallow: /shop') ? '❌ FAIL' : '✅ OK', website.robots_txt?.includes('Disallow: /shop') ? 'RIMUOVERE Disallow: /shop' : 'Corretto'],
  ];

  geoData.forEach(row => {
    console.log(row.map((cell, i) => {
      const widths = [30, 25, 10, 40];
      return String(cell).padEnd(widths[i]);
    }).join(' │ '));
  });

  // =============================
  // TABELLA 2: SEO (FRONTEND)
  // =============================
  console.log('\n\n📊 TABELLA 2: AUDIT SEO (Frontend - Come Google Vede il Sito)');
  console.log('─'.repeat(100));

  const pages = [
    { name: 'Homepage', url: 'https://www.lapa.ch' },
    { name: 'Shop', url: 'https://www.lapa.ch/shop' },
    { name: 'Blog', url: 'https://www.lapa.ch/blog' },
  ];

  const seoData = [
    ['Pagina', 'HTTP', 'Noindex?', 'Meta Desc', 'OG Tags', 'Schema.org', 'Problema'],
    ['─'.repeat(12), '─'.repeat(6), '─'.repeat(10), '─'.repeat(10), '─'.repeat(9), '─'.repeat(11), '─'.repeat(35)],
  ];

  for (const page of pages) {
    const result = await checkPage(page.url);
    if (result.status === 'ERROR') {
      seoData.push([
        page.name,
        '❌ ERR',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        `Errore: ${result.error}`
      ]);
    } else {
      const problem = result.hasNoindex ? 'BLOCCATO da meta noindex!' :
                     !result.hasMetaDesc ? 'Manca meta description' :
                     !result.hasSchema ? 'Manca Schema.org' :
                     'OK';

      seoData.push([
        page.name,
        result.status === 200 ? '✅ 200' : `❌ ${result.status}`,
        result.hasNoindex ? '❌ SI' : '✅ NO',
        result.hasMetaDesc ? '✅ SI' : '❌ NO',
        result.hasOG ? '✅ SI' : '⚠️ NO',
        result.hasSchema ? '✅ SI' : '⚠️ NO',
        problem
      ]);
    }
  }

  seoData.forEach(row => {
    console.log(row.map((cell, i) => {
      const widths = [12, 6, 10, 10, 9, 11, 35];
      return String(cell).padEnd(widths[i]);
    }).join(' │ '));
  });

  // =============================
  // RISORSE PUBBLICHE
  // =============================
  console.log('\n\n📊 RISORSE SEO PUBBLICHE');
  console.log('─'.repeat(100));

  try {
    const robotsRes = await fetch('https://www.lapa.ch/robots.txt');
    const robotsTxt = await robotsRes.text();
    console.log(`✅ robots.txt: Accessibile (${robotsTxt.length} bytes)`);
    console.log(`   • Blocca /blog: ${robotsTxt.includes('Disallow: /blog') ? '❌ SI - RIMUOVERE!' : '✅ NO'}`);
    console.log(`   • Blocca /shop: ${robotsTxt.includes('Disallow: /shop') ? '❌ SI - RIMUOVERE!' : '✅ NO'}`);
  } catch (e) {
    console.log('❌ robots.txt: Non accessibile');
  }

  try {
    const sitemapRes = await fetch('https://www.lapa.ch/sitemap.xml');
    console.log(`${sitemapRes.status === 200 ? '✅' : '❌'} sitemap.xml: ${sitemapRes.status === 200 ? 'Accessibile' : 'Non accessibile'}`);
  } catch (e) {
    console.log('❌ sitemap.xml: Non accessibile');
  }

  // =============================
  // RIEPILOGO PROBLEMI
  // =============================
  console.log('\n\n🚨 RIEPILOGO PROBLEMI CRITICI');
  console.log('═'.repeat(100));

  const problems = [];

  if (b2bConfig.dr_enable_b2b) {
    problems.push({
      priority: '🔴 CRITICO',
      problema: 'B2B Mode è attivo in Theme Prime',
      impatto: 'Google NON può accedere ai prodotti',
      azione: 'Disattivare in Odoo: Website → Theme Prime → B2B Configuration → B2B Mode → OFF'
    });
  }

  if (website.robots_txt?.includes('Disallow: /blog')) {
    problems.push({
      priority: '🔴 CRITICO',
      problema: 'robots.txt blocca /blog',
      impatto: 'Articoli blog NON indicizzati',
      azione: 'Rimuovere "Disallow: /blog" dal robots.txt'
    });
  }

  const homeResult = await checkPage('https://www.lapa.ch');
  if (homeResult.hasNoindex) {
    problems.push({
      priority: '🔴 CRITICO',
      problema: 'Homepage ha meta noindex',
      impatto: 'Homepage NON indicizzata da Google',
      azione: 'Rimuovere meta noindex dalla homepage'
    });
  }

  if (b2bConfig.dr_only_assigned_pricelist) {
    problems.push({
      priority: '⚠️ IMPORTANTE',
      problema: 'Pricelist per customer è attivo',
      impatto: 'Prezzi potrebbero essere nascosti a Google',
      azione: 'Disattivare in Theme Prime → B2B Configuration'
    });
  }

  if (problems.length === 0) {
    console.log('\n✅✅✅ NESSUN PROBLEMA CRITICO RILEVATO! ✅✅✅');
    console.log('\nIl sito è configurato correttamente per l\'indicizzazione Google.');
  } else {
    console.log(`\n❌ Trovati ${problems.length} problemi:\n`);
    problems.forEach((p, i) => {
      console.log(`${i + 1}. ${p.priority}`);
      console.log(`   Problema: ${p.problema}`);
      console.log(`   Impatto:  ${p.impatto}`);
      console.log(`   Azione:   ${p.azione}`);
      console.log('');
    });
  }

  console.log('\n' + '═'.repeat(100));
  console.log('✅ Audit completato!\n');
}

main().catch(console.error);
