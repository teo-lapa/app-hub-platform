/**
 * Script per esplorare il database Odoo e capire la struttura delle ubicazioni furgoni
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';

async function authenticate() {
  console.log('🔐 Tentativo login su Odoo staging...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: 'paul@lapa.ch',
        password: 'lapa201180'
      }
    })
  });

  const data = await response.json();

  if (data.error || !data.result || !data.result.session_id) {
    console.error('❌ Login fallito:', data.error);
    throw new Error('Impossibile autenticarsi');
  }

  console.log('✅ Login effettuato con successo!');
  return data.result.session_id;
}

async function exploreLocations(sessionId) {
  console.log('\n📍 STEP 1: Cerco TUTTE le ubicazioni che contengono "FURGON"...\n');

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'stock.location',
        method: 'search_read',
        args: [[
          ['complete_name', 'ilike', 'FURGON']
        ]],
        kwargs: {
          fields: ['id', 'name', 'complete_name', 'barcode', 'usage', 'location_id', 'parent_path'],
          limit: 50
        }
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ Errore:', data.error);
    return [];
  }

  const locations = data.result || [];
  console.log(`Trovate ${locations.length} ubicazioni:`);
  locations.forEach((loc, i) => {
    console.log(`\n${i + 1}. ID: ${loc.id}`);
    console.log(`   Nome: ${loc.name}`);
    console.log(`   Percorso completo: ${loc.complete_name}`);
    console.log(`   Barcode: ${loc.barcode || 'N/A'}`);
    console.log(`   Usage: ${loc.usage}`);
    console.log(`   Parent ID: ${loc.location_id ? loc.location_id[0] : 'N/A'}`);
    console.log(`   Parent Path: ${loc.parent_path || 'N/A'}`);
  });

  return locations;
}

async function exploreQuantsForLocation(sessionId, locationId, locationName) {
  console.log(`\n📦 STEP 2: Cerco i prodotti (quants) nell'ubicazione "${locationName}" (ID: ${locationId})...\n`);

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'stock.quant',
        method: 'search_read',
        args: [[
          ['location_id', '=', locationId],
          ['quantity', '>', 0]
        ]],
        kwargs: {
          fields: ['id', 'product_id', 'quantity', 'reserved_quantity', 'available_quantity', 'lot_id', 'package_id', 'owner_id'],
          limit: 10
        }
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ Errore:', data.error);
    return;
  }

  const quants = data.result || [];
  console.log(`Trovati ${quants.length} quants (prodotti):`);
  quants.forEach((q, i) => {
    console.log(`\n${i + 1}. Quant ID: ${q.id}`);
    console.log(`   Prodotto: ${q.product_id ? q.product_id[1] : 'N/A'} (ID: ${q.product_id ? q.product_id[0] : 'N/A'})`);
    console.log(`   Quantità: ${q.quantity}`);
    console.log(`   Riservata: ${q.reserved_quantity || 0}`);
    console.log(`   Disponibile: ${q.available_quantity || (q.quantity - (q.reserved_quantity || 0))}`);
    console.log(`   Lotto: ${q.lot_id ? q.lot_id[1] : 'N/A'}`);
    console.log(`   Pacco: ${q.package_id ? q.package_id[1] : 'N/A'}`);
  });
}

async function main() {
  try {
    const sessionId = await authenticate();

    const locations = await exploreLocations(sessionId);

    if (locations.length > 0) {
      // Esplora i quants della prima ubicazione trovata
      await exploreQuantsForLocation(sessionId, locations[0].id, locations[0].name);
    }

    console.log('\n\n✅ Esplorazione completata!');
    console.log('\n💡 PROSSIMI STEP:');
    console.log('   1. Vedi sopra la struttura reale delle ubicazioni furgoni');
    console.log('   2. Ora posso scrivere l\'API corretta basata su questi dati reali');

  } catch (error) {
    console.error('\n❌ Errore fatale:', error.message);
  }
}

main();
