/**
 * Script per verificare gli arrivi processati in Odoo
 *
 * Uso: node scripts/check-odoo-arrivals.js
 */

const https = require('https');

const ODOO_URL = 'lapa.ch';
const ODOO_DB = 'lapa-main';
const ODOO_USER = 'paul@lapa.ch';
const ODOO_PASSWORD = 'Lapa2025!';

let sessionCookie = '';
let uid = null;

async function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);

    const options = {
      hostname: ODOO_URL,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      // Salva il cookie di sessione
      const cookies = res.headers['set-cookie'] || [];
      const sessionId = cookies.find(c => c.includes('session_id'));
      if (sessionId) {
        sessionCookie = sessionId.split(';')[0];
      }

      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.error) {
            reject(new Error(result.error.message || JSON.stringify(result.error)));
          } else {
            resolve(result.result);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(jsonData);
    req.end();
  });
}

async function authenticate() {
  console.log('🔐 Autenticazione su', ODOO_URL, '...');

  const result = await makeRequest('/web/session/authenticate', {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      db: ODOO_DB,
      login: ODOO_USER,
      password: ODOO_PASSWORD
    },
    id: 1
  });

  uid = result.uid;
  console.log('✅ Autenticato come UID:', uid);
  return result;
}

async function callOdoo(model, method, args, kwargs = {}) {
  const result = await makeRequest('/web/dataset/call_kw', {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model,
      method,
      args,
      kwargs
    },
    id: 2
  });

  return result;
}

async function main() {
  try {
    // 1. Autenticazione
    await authenticate();

    // 2. Cerca i picking di oggi
    console.log('\n📦 Cerco arrivi di oggi...');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const pickings = await callOdoo('stock.picking', 'search_read', [
      [
        ['picking_type_code', '=', 'incoming'],
        ['scheduled_date', '>=', `${todayStr} 00:00:00`],
        ['scheduled_date', '<=', `${todayStr} 23:59:59`],
        ['name', 'not ilike', '%RET%']
      ],
      ['id', 'name', 'partner_id', 'state', 'origin']
    ], { limit: 20 });

    console.log(`\n📋 Trovati ${pickings.length} arrivi oggi:`);
    for (const p of pickings) {
      console.log(`  - ${p.name} | ${p.partner_id?.[1] || 'N/A'} | Stato: ${p.state} | Origin: ${p.origin || 'N/A'}`);
    }

    // 3. Cerca fatture bozza create oggi
    console.log('\n📄 Cerco fatture bozza create oggi...');

    const invoices = await callOdoo('account.move', 'search_read', [
      [
        ['move_type', '=', 'in_invoice'],
        ['state', '=', 'draft'],
        ['create_date', '>=', `${todayStr} 00:00:00`]
      ],
      ['id', 'name', 'ref', 'partner_id', 'invoice_origin', 'amount_total', 'create_date']
    ], { limit: 20 });

    console.log(`\n💰 Trovate ${invoices.length} fatture bozza create oggi:`);
    for (const inv of invoices) {
      console.log(`  - ${inv.name} | ${inv.partner_id?.[1] || 'N/A'} | Origin: ${inv.invoice_origin || 'N/A'} | €${inv.amount_total}`);

      // Cerca allegati di questa fattura
      const attachments = await callOdoo('ir.attachment', 'search_read', [
        [
          ['res_model', '=', 'account.move'],
          ['res_id', '=', inv.id]
        ],
        ['id', 'name', 'mimetype', 'file_size']
      ]);

      if (attachments.length > 0) {
        console.log(`    📎 Allegati:`);
        for (const att of attachments) {
          console.log(`       - ${att.name} (${att.mimetype})`);

          // Se è un JSON, leggi il contenuto
          if (att.mimetype === 'application/json') {
            const attData = await callOdoo('ir.attachment', 'read', [
              [att.id],
              ['datas']
            ]);
            if (attData[0]?.datas) {
              const content = Buffer.from(attData[0].datas, 'base64').toString('utf-8');
              console.log(`       📝 Contenuto JSON:`);
              try {
                const json = JSON.parse(content);
                console.log(JSON.stringify(json, null, 2).split('\n').map(l => '          ' + l).join('\n'));
              } catch (e) {
                console.log(`          ${content.substring(0, 500)}`);
              }
            }
          }
        }
      }
    }

    // 4. Controlla i picking specifici menzionati
    console.log('\n🔍 Controllo picking specifici WH/IN/04980 e WH/IN/04987...');

    const specificPickings = await callOdoo('stock.picking', 'search_read', [
      [['name', 'in', ['WH/IN/04980', 'WH/IN/04987']]],
      ['id', 'name', 'partner_id', 'state', 'origin']
    ]);

    for (const p of specificPickings) {
      console.log(`\n📦 ${p.name}:`);
      console.log(`   Fornitore: ${p.partner_id?.[1]}`);
      console.log(`   Stato: ${p.state}`);
      console.log(`   Origin: ${p.origin}`);

      // Cerca le move lines
      const moveLines = await callOdoo('stock.move.line', 'search_read', [
        [['picking_id', '=', p.id]],
        ['id', 'product_id', 'qty_done', 'lot_name', 'expiration_date']
      ]);

      console.log(`   📋 Move Lines (${moveLines.length}):`);
      for (const ml of moveLines.slice(0, 5)) {
        console.log(`      - ${ml.product_id?.[1]?.substring(0, 40) || 'N/A'} | qty_done: ${ml.qty_done} | lotto: ${ml.lot_name || 'N/A'}`);
      }
      if (moveLines.length > 5) {
        console.log(`      ... e altre ${moveLines.length - 5} righe`);
      }
    }

    console.log('\n✅ Controllo completato!');

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

main();
