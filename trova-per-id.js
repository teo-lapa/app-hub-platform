/**
 * Script per cercare prodotti per ID specifici
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

const IDS_NUOVI = [24446, 24447, 24448, 24449, 24450];
const IDS_VECCHI = [24258, 24248, 24260, 24261, 24259];

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD } })
  });

  const data = await response.json();
  if (data.error) throw new Error('Autenticazione fallita');

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
  if (!sessionMatch) throw new Error('Nessun session_id');

  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(`Errore ${model}.${method}: ${data.error.data?.message || 'unknown'}`);
  return data.result;
}

async function main() {
  try {
    console.log('🔐 Autenticazione...');
    const cookies = await authenticate();
    console.log('✅ Autenticato\n');

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🆕 PRODOTTI NUOVI (appena creati)');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const id of IDS_NUOVI) {
      try {
        const products = await callOdoo(cookies, 'product.template', 'read', [[id]], {
          fields: ['id', 'name', 'default_code', 'active', 'uom_id', 'uom_po_id']
        });

        if (products.length > 0) {
          const p = products[0];
          console.log(`✅ ID ${p.id}: ${p.name.substring(0, 50)}`);
          console.log(`   Codice: ${p.default_code || 'N/A'}`);
          console.log(`   Active: ${p.active}`);
          console.log(`   UoM V: ${p.uom_id[1]}`);
          console.log(`   UoM A: ${p.uom_po_id[1]}\n`);
        }
      } catch (error) {
        console.log(`❌ ID ${id}: NON ESISTE\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📦 PRODOTTI VECCHI (dovrebbero essere archiviati)');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const id of IDS_VECCHI) {
      const products = await callOdoo(cookies, 'product.template', 'read', [[id]], {
        fields: ['id', 'name', 'default_code', 'active']
      });

      if (products.length > 0) {
        const p = products[0];
        const status = p.active ? '⚠️  ATTIVO' : '✅ ARCHIVIATO';
        console.log(`${status} - ID ${p.id}: ${p.name.substring(0, 50)}`);
        console.log(`   Codice: ${p.default_code || 'N/A'}\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
