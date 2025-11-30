/**
 * Analisi Fornitore via API App
 *
 * Usa l'API /api/smart-ordering-v2/suppliers della tua app
 * per analizzare LATTICINI MOLISANI TAMBURRO SRL
 */

const https = require('https');

// Configurazione
const APP_URL = 'https://staging.hub.lapa.ch';
const SUPPLIER_NAME = 'LATTICINI MOLISANI TAMBURRO';

// Agent che ignora SSL
const agent = new https.Agent({
  rejectUnauthorized: false
});

async function analyzeSupplier() {
  try {
    console.log('🔍 Caricamento dati da API...\n');

    // Nota: questo richiede una sessione Odoo valida nei cookie
    // Se non funziona, dobbiamo usare il browser
    const response = await fetch(`${APP_URL}/api/smart-ordering-v2/suppliers`, {
      agent
    });

    const data = await response.json();

    if (!data.success) {
      console.log('❌ Errore API:', data.error);
      console.log('\n💡 SUGGERIMENTO:');
      console.log('   Per analizzare il fornitore, vai su:');
      console.log(`   ${APP_URL}/ordini-smart-v2`);
      console.log('   E clicca sul fornitore "LATTICINI MOLISANI TAMBURRO SRL"');
      return;
    }

    console.log(`✅ Caricati ${data.suppliers.length} fornitori\n`);

    // Trova il fornitore
    const supplier = data.suppliers.find(s =>
      s.name.toUpperCase().includes(SUPPLIER_NAME.toUpperCase())
    );

    if (!supplier) {
      console.log(`❌ Fornitore "${SUPPLIER_NAME}" non trovato`);
      console.log('\nFornitori disponibili:');
      data.suppliers.slice(0, 10).forEach(s => {
        console.log(`   - ${s.name}`);
      });
      return;
    }

    // Analisi dettagliata
    console.log('='.repeat(80));
    console.log(`📦 FORNITORE: ${supplier.name}`);
    console.log('='.repeat(80));
    console.log(`\nID Odoo: ${supplier.id}`);
    console.log(`Lead Time: ${supplier.leadTime} giorni`);
    console.log(`Totale Prodotti: ${supplier.totalProducts}`);
    console.log(`Prodotti Critici: ${supplier.criticalCount}`);
    console.log(`Prodotti High: ${supplier.highCount}`);
    console.log(`Prodotti Medium: ${supplier.mediumCount}`);
    console.log(`Prodotti Low: ${supplier.lowCount}`);

    console.log('\n💰 VALORI STIMATI:');
    console.log(`Totale KG da ordinare: ${supplier.totalKg.toFixed(1)} KG`);
    console.log(`Totale PZ da ordinare: ${supplier.totalPz} PZ`);
    console.log(`Valore stimato ordine: CHF ${supplier.estimatedValue.toFixed(2)}`);

    if (supplier.nextOrderDate) {
      console.log(`\n📅 Prossimo ordine programmato: ${new Date(supplier.nextOrderDate).toLocaleDateString('it-IT')}`);
      console.log(`Cadenza: ogni ${supplier.cadenceDays} giorni`);
    }

    // Prodotti
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALISI PRODOTTI');
    console.log('='.repeat(80));

    // Ordina per urgenza
    const sortedProducts = [...supplier.products].sort((a, b) => {
      const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });

    let totalOrderValue = 0;

    sortedProducts.forEach((product, index) => {
      const urgencyEmoji = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢'
      }[product.urgencyLevel];

      console.log(`\n${index + 1}. ${urgencyEmoji} ${product.urgencyLevel} - ${product.name}`);
      console.log(`   Stock attuale: ${product.currentStock.toFixed(1)} ${product.uom}`);

      if (product.incomingQty && product.incomingQty > 0) {
        const dateStr = product.incomingDate ? new Date(product.incomingDate).toLocaleDateString('it-IT') : 'N/A';
        console.log(`   🚚 In arrivo: ${product.incomingQty.toFixed(1)} ${product.uom} (previsto: ${dateStr})`);
        console.log(`   Stock effettivo: ${product.effectiveStock.toFixed(1)} ${product.uom}`);
      }

      console.log(`   Media vendite: ${product.avgDailySales.toFixed(2)} ${product.uom}/giorno`);
      console.log(`   Giorni rimanenti: ${product.daysRemaining.toFixed(1)} giorni`);
      console.log(`   📊 Suggerimento AI: ${product.suggestedQty} ${product.uom}`);

      if (product.avgPrice && product.suggestedQty > 0) {
        const orderValue = product.suggestedQty * product.avgPrice;
        console.log(`   💰 Valore: CHF ${orderValue.toFixed(2)}`);
        totalOrderValue += orderValue;
      }

      console.log(`   Venduto 3 mesi: ${product.totalSold3Months.toFixed(1)} ${product.uom}`);
      console.log('   ' + '-'.repeat(76));
    });

    // Riepilogo
    console.log('\n' + '='.repeat(80));
    console.log('📋 COSA ORDINARE DOMANI');
    console.log('='.repeat(80));

    console.log('\n🔴 PRIORITÀ 1 - CRITICI (stock < 2 giorni):');
    const critical = sortedProducts.filter(p => p.urgencyLevel === 'CRITICAL' && p.suggestedQty > 0);

    if (critical.length === 0) {
      console.log('   Nessun prodotto critico');
    } else {
      critical.forEach(p => {
        console.log(`   ✓ ${p.name}`);
        console.log(`     Ordina: ${p.suggestedQty} ${p.uom}`);
        console.log(`     Motivo: Stock ${p.currentStock.toFixed(1)} ${p.uom}, durata ${p.daysRemaining.toFixed(1)} giorni`);
      });
    }

    console.log('\n🟠 PRIORITÀ 2 - HIGH (stock < 5 giorni):');
    const high = sortedProducts.filter(p => p.urgencyLevel === 'HIGH' && p.suggestedQty > 0);

    if (high.length === 0) {
      console.log('   Nessun prodotto HIGH');
    } else {
      high.forEach(p => {
        console.log(`   ✓ ${p.name}`);
        console.log(`     Ordina: ${p.suggestedQty} ${p.uom}`);
        console.log(`     Motivo: Stock ${p.currentStock.toFixed(1)} ${p.uom}, durata ${p.daysRemaining.toFixed(1)} giorni`);
      });
    }

    console.log('\n💰 RIEPILOGO ORDINE:');
    const productsToOrder = sortedProducts.filter(p => ['CRITICAL', 'HIGH'].includes(p.urgencyLevel) && p.suggestedQty > 0);
    console.log(`   Prodotti da ordinare: ${productsToOrder.length}`);
    console.log(`   Valore totale: CHF ${totalOrderValue.toFixed(2)}`);

    if (totalOrderValue < 2000) {
      console.log(`   ⚠️  Ordine sotto CHF 2000 - considera di aggiungere prodotti MEDIUM`);
    }

    // Raccomandazioni
    console.log('\n' + '='.repeat(80));
    console.log('💡 RACCOMANDAZIONI');
    console.log('='.repeat(80));

    if (critical.length > 0) {
      console.log('\n⚠️  AZIONE IMMEDIATA:');
      console.log(`   ${critical.length} prodotti CRITICI - ORDINA OGGI!`);
      console.log('   Lead time 3 giorni: se ordini oggi, arriva tra 3 giorni');
    }

    if (supplier.nextOrderDate) {
      const daysUntil = Math.ceil((new Date(supplier.nextOrderDate) - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`\n📅 CADENZA PROGRAMMATA:`);
      console.log(`   Prossimo ordine previsto tra ${daysUntil} giorni`);
      if (daysUntil <= 1 && critical.length > 0) {
        console.log('   ✓ È il momento giusto per ordinare!');
      }
    }

    const productsWithIncoming = sortedProducts.filter(p => p.incomingQty && p.incomingQty > 0);
    if (productsWithIncoming.length > 0) {
      console.log(`\n🚚 MERCE IN ARRIVO:`);
      console.log(`   ${productsWithIncoming.length} prodotti hanno già merce ordinata`);
      console.log('   Controlla le date prima di riordinare:');
      productsWithIncoming.forEach(p => {
        const dateStr = p.incomingDate ? new Date(p.incomingDate).toLocaleDateString('it-IT') : 'Data N/A';
        console.log(`   - ${p.name}: ${p.incomingQty.toFixed(1)} ${p.uom} (${dateStr})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analisi completata!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Errore:', error.message);
    console.log('\n💡 SOLUZIONE ALTERNATIVA:');
    console.log('   1. Apri il browser e vai su https://staging.hub.lapa.ch/ordini-smart-v2');
    console.log('   2. Fai login se necessario');
    console.log('   3. Clicca su "LATTICINI MOLISANI TAMBURRO SRL"');
    console.log('   4. Vedrai i prodotti con suggerimenti AI già calcolati\n');
  }
}

// Run
analyzeSupplier();
