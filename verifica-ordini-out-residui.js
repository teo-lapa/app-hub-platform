/**
 * Script per verificare TUTTI gli ordini OUT (picking) residui in Odoo
 * Analizza lo stato di tutti gli ordini di consegna
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticazione riuscita!\n');
  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function verificaOrdiniOutResidui(cookies) {
  console.log('📋 Ricerca TUTTI gli ordini OUT (picking)...\n');

  // Data di oggi - FORZIAMO 08/11/2025
  const oggiStr = '2025-11-08';

  console.log(`⚠️  ESCLUDENDO ordini con data prevista di OGGI: ${oggiStr}\n`);

  // Cerca tutti i picking di tipo OUT (consegna)
  const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [[
    ['picking_type_code', '=', 'outgoing'],
    ['scheduled_date', '<', oggiStr]  // Solo ordini con data PRIMA di oggi
  ]], {
    fields: [
      'name',
      'partner_id',
      'scheduled_date',
      'state',
      'origin',
      'location_dest_id',
      'move_ids_without_package',
      'date_done'
    ],
    order: 'scheduled_date desc'
  });

  console.log(`✅ Trovati ${pickings.length} ordini OUT totali\n`);

  // Raggruppa per stato
  const byState = {};
  pickings.forEach(p => {
    if (!byState[p.state]) {
      byState[p.state] = [];
    }
    byState[p.state].push(p);
  });

  // Mostra statistiche
  console.log('📊 RIEPILOGO PER STATO:');
  console.log('═══════════════════════════════════════════');

  const stateLabels = {
    'draft': 'Bozza',
    'waiting': 'In attesa',
    'confirmed': 'Confermato',
    'assigned': 'Pronto',
    'done': 'Completato',
    'cancel': 'Annullato'
  };

  Object.keys(byState).sort().forEach(state => {
    const count = byState[state].length;
    const label = stateLabels[state] || state;
    console.log(`${label.padEnd(20)}: ${count.toString().padStart(5)} ordini`);
  });

  // Analizza gli ordini NON completati (residui)
  const residui = pickings.filter(p => p.state !== 'done' && p.state !== 'cancel');

  console.log('\n\n🔍 ORDINI RESIDUI (non completati):');
  console.log('═══════════════════════════════════════════');
  console.log(`Totale: ${residui.length} ordini\n`);

  if (residui.length > 0) {
    // Raggruppa residui per stato
    const residuiByState = {};
    residui.forEach(p => {
      if (!residuiByState[p.state]) {
        residuiByState[p.state] = [];
      }
      residuiByState[p.state].push(p);
    });

    for (const state of Object.keys(residuiByState).sort()) {
      const items = residuiByState[state];
      const label = stateLabels[state] || state;

      console.log(`\n📌 STATO: ${label.toUpperCase()} (${items.length} ordini)`);
      console.log('───────────────────────────────────────────');

      items.forEach((picking, idx) => {
        const scheduledDate = picking.scheduled_date ?
          new Date(picking.scheduled_date).toLocaleDateString('it-IT') : 'N/A';
        const partner = picking.partner_id ? picking.partner_id[1] : 'N/A';
        const origin = picking.origin || 'N/A';

        console.log(`\n${idx + 1}. ${picking.name}`);
        console.log(`   Cliente: ${partner}`);
        console.log(`   Data prevista: ${scheduledDate}`);
        console.log(`   Origine: ${origin}`);
        console.log(`   Prodotti: ${picking.move_ids_without_package.length} articoli`);
      });
    }

    // Analizza i dettagli dei prodotti per gli ordini "Pronto"
    const ordiniPronti = residui.filter(p => p.state === 'assigned');

    if (ordiniPronti.length > 0) {
      console.log('\n\n📦 DETTAGLIO ORDINI PRONTI PER LA CONSEGNA:');
      console.log('═══════════════════════════════════════════');

      for (const picking of ordiniPronti) {
        console.log(`\n🚚 ${picking.name} - ${picking.partner_id[1]}`);

        if (picking.move_ids_without_package.length > 0) {
          // Leggi i dettagli dei prodotti
          const moves = await callOdoo(cookies, 'stock.move', 'read', [
            picking.move_ids_without_package
          ], {
            fields: ['product_id', 'product_uom_qty', 'quantity', 'product_uom', 'state']
          });

          moves.forEach(move => {
            console.log(`   • ${move.product_id[1]}`);
            console.log(`     Quantità richiesta: ${move.product_uom_qty} ${move.product_uom[1]}`);
            console.log(`     Quantità effettiva: ${move.quantity} ${move.product_uom[1]}`);
          });
        }
      }
    }
  }

  console.log('\n\n📊 RIEPILOGO FINALE:');
  console.log('═══════════════════════════════════════════');
  console.log(`Totale ordini OUT:        ${pickings.length}`);
  console.log(`Ordini completati:        ${byState['done']?.length || 0}`);
  console.log(`Ordini annullati:         ${byState['cancel']?.length || 0}`);
  console.log(`ORDINI RESIDUI:           ${residui.length}`);
  console.log('═══════════════════════════════════════════\n');

  return {
    totali: pickings.length,
    residui: residui.length,
    completati: byState['done']?.length || 0,
    annullati: byState['cancel']?.length || 0,
    byState,
    residuiDettaglio: residui
  };
}

async function main() {
  try {
    const cookies = await authenticate();
    const risultato = await verificaOrdiniOutResidui(cookies);

    console.log('✅ Analisi completata!');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
