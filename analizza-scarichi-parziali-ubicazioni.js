/**
 * Script per analizzare gli scarichi parziali e trovare le ubicazioni dei prodotti nei furgoni
 *
 * Per ogni ordine residuo:
 * 1. Trova i prodotti non scaricati
 * 2. Trova in quale ubicazione FURGONE si trova ora (stock.quant)
 * 3. Determina il buffer corretto in base alla categoria del prodotto
 */

const fs = require('fs');
const path = require('path');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';

// Leggi il report degli scarichi parziali
const reportPath = path.join(__dirname, 'REPORT_SCARICHI_PARZIALI_2025-11-08.json');
const scarchiParziali = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

async function authenticate() {
  console.log('🔐 Login su Odoo staging...');

  try {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
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

    console.log('✅ Login effettuato\n');
    return data.result.session_id;
  } catch (error) {
    console.error('❌ Errore durante l\'autenticazione:', error.message);
    if (error.cause) {
      console.error('   Causa:', error.cause.message || error.cause);
    }
    throw error;
  }
}

async function odooCall(sessionId, model, method, args = [[]], kwargs = {}) {
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
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error(`❌ Errore chiamata Odoo (${model}.${method}):`, data.error);
    return null;
  }

  return data.result;
}

async function findProductByName(sessionId, productName) {
  console.log(`   🔍 Cerco prodotto: "${productName}"`);

  const products = await odooCall(sessionId, 'product.product', 'search_read', [[
    ['name', '=', productName]
  ]], {
    fields: ['id', 'name', 'categ_id'],
    limit: 1
  });

  if (!products || products.length === 0) {
    console.log(`   ⚠️  Prodotto non trovato: "${productName}"`);
    return null;
  }

  const product = products[0];
  console.log(`   ✓ Trovato prodotto ID: ${product.id} | Categoria: ${product.categ_id ? product.categ_id[1] : 'N/A'}`);

  return product;
}

async function findProductLocation(sessionId, productId) {
  console.log(`   📍 Cerco ubicazione per prodotto ID: ${productId}`);

  // Cerca in tutte le ubicazioni FURGONE
  const quants = await odooCall(sessionId, 'stock.quant', 'search_read', [[
    ['product_id', '=', productId],
    ['quantity', '>', 0],
    ['location_id.complete_name', 'ilike', 'FURGON']
  ]], {
    fields: ['id', 'product_id', 'quantity', 'location_id'],
    limit: 1
  });

  if (!quants || quants.length === 0) {
    console.log(`   ⚠️  Nessun quant trovato nei furgoni per prodotto ID: ${productId}`);
    return null;
  }

  const quant = quants[0];
  const location = quant.location_id ? quant.location_id[1] : 'N/A';
  console.log(`   ✓ Trovato in: ${location} (Qty: ${quant.quantity})`);

  return location;
}

function determineBuffer(categoryName) {
  if (!categoryName) return 'Sopra';

  const cat = categoryName.toLowerCase();

  // Prodotti refrigerati
  if (cat.includes('frigo') || cat.includes('refrigerat') || cat.includes('fresc')) {
    return 'Frigo';
  }

  // Prodotti surgelati
  if (cat.includes('surgel') || cat.includes('congelat') || cat.includes('frozen')) {
    return 'Pingu';
  }

  // Altri prodotti
  return 'Sopra';
}

async function analyzeOrder(sessionId, ordine) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ORDINE: ${ordine.numeroOrdineResiduo}`);
  console.log(`   Cliente: ${ordine.cliente}`);
  console.log(`   Data: ${ordine.dataPrevisita}`);
  console.log(`   Prodotti non scaricati: ${ordine.prodottiNonScaricati.length}`);

  if (ordine.prodottiNonScaricati.length === 0) {
    console.log(`   ℹ️  Nessun prodotto da analizzare (lista vuota)`);
    return null;
  }

  const prodottiAnalizzati = [];

  for (const prodotto of ordine.prodottiNonScaricati) {
    console.log(`\n   → Prodotto: ${prodotto.nome}`);

    // 1. Trova il prodotto in Odoo
    const productData = await findProductByName(sessionId, prodotto.nome);

    if (!productData) {
      prodottiAnalizzati.push({
        nome: prodotto.nome,
        qty: prodotto.quantitaRichiesta,
        uom: prodotto.uom,
        id: null,
        ubicazione_attuale: 'NON TROVATO IN ODOO',
        ubicazione_destinazione: 'N/A'
      });
      continue;
    }

    // 2. Trova l'ubicazione attuale (furgone)
    const ubicazioneAttuale = await findProductLocation(sessionId, productData.id);

    // 3. Determina il buffer corretto
    const categoryName = productData.categ_id ? productData.categ_id[1] : null;
    const bufferDestinazione = determineBuffer(categoryName);

    console.log(`   ✓ Buffer destinazione: ${bufferDestinazione} (basato su categoria: ${categoryName || 'N/A'})`);

    prodottiAnalizzati.push({
      id: productData.id,
      nome: prodotto.nome,
      qty: prodotto.quantitaRichiesta,
      uom: prodotto.uom,
      ubicazione_attuale: ubicazioneAttuale || 'NON TROVATO NEI FURGONI',
      ubicazione_destinazione: `Buffer/${bufferDestinazione}`
    });
  }

  return {
    ordine: ordine.numeroOrdineResiduo,
    cliente: ordine.cliente,
    data: ordine.dataPrevisita,
    salesOrder: ordine.salesOrder,
    prodotti: prodottiAnalizzati
  };
}

async function main() {
  try {
    const sessionId = await authenticate();

    console.log(`📊 ANALISI DI ${scarchiParziali.length} ORDINI CON SCARICHI PARZIALI\n`);

    const risultati = [];

    for (const ordine of scarchiParziali) {
      const analisi = await analyzeOrder(sessionId, ordine);
      if (analisi) {
        risultati.push(analisi);
      }
    }

    // Salva il risultato in un file JSON
    const outputPath = path.join(__dirname, 'ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json');
    fs.writeFileSync(outputPath, JSON.stringify(risultati, null, 2), 'utf8');

    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`✅ ANALISI COMPLETATA!`);
    console.log(`\n📄 Report salvato in: ${outputPath}`);
    console.log(`\n📊 RIEPILOGO:`);
    console.log(`   - Ordini analizzati: ${risultati.length}`);

    const totalProdotti = risultati.reduce((sum, r) => sum + r.prodotti.length, 0);
    console.log(`   - Prodotti totali: ${totalProdotti}`);

    const trovatiInFurgone = risultati.reduce((sum, r) =>
      sum + r.prodotti.filter(p => p.ubicazione_attuale.includes('Furgon')).length, 0);
    console.log(`   - Prodotti trovati nei furgoni: ${trovatiInFurgone}`);

    const nonTrovati = risultati.reduce((sum, r) =>
      sum + r.prodotti.filter(p => p.ubicazione_attuale.includes('NON TROVATO')).length, 0);
    console.log(`   - Prodotti non trovati: ${nonTrovati}`);

    // Statistiche buffer
    const bufferStats = {};
    risultati.forEach(r => {
      r.prodotti.forEach(p => {
        const buffer = p.ubicazione_destinazione.split('/')[1] || 'N/A';
        bufferStats[buffer] = (bufferStats[buffer] || 0) + 1;
      });
    });

    console.log(`\n📦 DISTRIBUZIONE BUFFER:`);
    Object.entries(bufferStats).forEach(([buffer, count]) => {
      console.log(`   - ${buffer}: ${count} prodotti`);
    });

  } catch (error) {
    console.error('\n❌ Errore fatale:', error.message);
    console.error(error.stack);
  }
}

main();
