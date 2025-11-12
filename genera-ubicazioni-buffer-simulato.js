/**
 * Script per generare un report delle ubicazioni e buffer per prodotti non scaricati
 *
 * NOTA: Questo script genera dati SIMULATI basati su logiche di business.
 * Per dati reali è necessaria la connessione a Odoo staging.
 */

const fs = require('fs');
const path = require('path');

// Leggi il report degli scarichi parziali
const reportPath = path.join(__dirname, 'REPORT_SCARICHI_PARZIALI_2025-11-08.json');
const scarchiParziali = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

/**
 * Determina il buffer corretto basandosi sul nome del prodotto
 */
function determineBuffer(productName) {
  const name = productName.toLowerCase();

  // Prodotti SURGELATI → Pingu
  if (name.includes('sg') || // Codice SG
      name.includes('surgel') ||
      name.includes('congelat') ||
      name.includes('gelato') ||
      name.includes('frozen')) {
    return 'Pingu';
  }

  // Prodotti REFRIGERATI → Frigo
  if (name.includes('fresco') ||
      name.includes('fresc') ||
      name.includes('s.v.') || // Sottovuoto
      name.includes('sv ') ||
      name.includes('mozzarella') ||
      name.includes('fiordilatte') ||
      name.includes('burrata') ||
      name.includes('guanciale') ||
      name.includes('culatta') ||
      name.includes('mortadella') ||
      name.includes('prosciutto') ||
      name.includes('salame') ||
      name.includes('pancetta') ||
      name.includes('bresaola') ||
      name.includes('formaggio') ||
      name.includes('grana') ||
      name.includes('parmigiano') ||
      name.includes('pecorino') ||
      name.includes('ricotta') ||
      name.includes('mascarpone')) {
    return 'Frigo';
  }

  // Tutti gli altri prodotti → Sopra
  return 'Sopra';
}

/**
 * Determina l'autista/furgone basandosi sui messaggi di scarico parziale
 */
function determineDriver(ordine) {
  if (ordine.messaggiScaricoParziale && ordine.messaggiScaricoParziale.length > 0) {
    const autore = ordine.messaggiScaricoParziale[0].autore;

    if (autore.includes('Stefan')) return 'Stefan';
    if (autore.includes('Zamfir') || autore.includes('Liviu')) return 'Liviu';
    if (autore.includes('Alexandru') || autore.includes('Dominte')) return 'Alexandru';
    if (autore.includes('Domingos')) return 'Domingos';
    if (autore.includes('Ionut')) return 'Ionut';
  }

  return 'Sconosciuto';
}

/**
 * Analizza un ordine e i suoi prodotti non scaricati
 */
function analyzeOrder(ordine) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ORDINE: ${ordine.numeroOrdineResiduo}`);
  console.log(`   Cliente: ${ordine.cliente}`);
  console.log(`   Data: ${ordine.dataPrevisita}`);
  console.log(`   Sales Order: ${ordine.salesOrder}`);
  console.log(`   Prodotti non scaricati: ${ordine.prodottiNonScaricati.length}`);

  if (ordine.prodottiNonScaricati.length === 0) {
    console.log(`   ℹ️  Nessun prodotto da analizzare (lista vuota)`);
    return null;
  }

  const driver = determineDriver(ordine);
  console.log(`   👤 Autista: ${driver}`);

  const prodottiAnalizzati = [];

  for (const prodotto of ordine.prodottiNonScaricati) {
    const buffer = determineBuffer(prodotto.nome);

    console.log(`\n   → ${prodotto.nome}`);
    console.log(`      Qty: ${prodotto.quantitaRichiesta} ${prodotto.uom}`);
    console.log(`      Buffer: ${buffer}`);

    prodottiAnalizzati.push({
      id: null, // Non disponibile senza connessione Odoo
      nome: prodotto.nome,
      qty: prodotto.quantitaRichiesta,
      uom: prodotto.uom,
      ubicazione_attuale: `Furgone/${driver}`,
      ubicazione_destinazione: `Buffer/${buffer}`
    });
  }

  return {
    ordine: ordine.numeroOrdineResiduo,
    cliente: ordine.cliente,
    data: ordine.dataPrevisita,
    salesOrder: ordine.salesOrder,
    autista: driver,
    prodotti: prodottiAnalizzati
  };
}

function main() {
  console.log(`📊 ANALISI DI ${scarchiParziali.length} ORDINI CON SCARICHI PARZIALI\n`);
  console.log(`⚠️  NOTA: Dati simulati (Odoo non raggiungibile)`);

  const risultati = [];

  for (const ordine of scarchiParziali) {
    const analisi = analyzeOrder(ordine);
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

  // Statistiche autisti
  const driverStats = {};
  risultati.forEach(r => {
    driverStats[r.autista] = (driverStats[r.autista] || 0) + 1;
  });

  console.log(`\n👥 ORDINI PER AUTISTA:`);
  Object.entries(driverStats).sort((a, b) => b[1] - a[1]).forEach(([driver, count]) => {
    console.log(`   - ${driver}: ${count} ordini`);
  });

  // Statistiche buffer
  const bufferStats = {};
  risultati.forEach(r => {
    r.prodotti.forEach(p => {
      const buffer = p.ubicazione_destinazione.split('/')[1];
      bufferStats[buffer] = (bufferStats[buffer] || 0) + 1;
    });
  });

  console.log(`\n📦 DISTRIBUZIONE BUFFER:`);
  Object.entries(bufferStats).sort((a, b) => b[1] - a[1]).forEach(([buffer, count]) => {
    console.log(`   - ${buffer}: ${count} prodotti`);
  });

  // Statistiche UOM
  const uomStats = {};
  risultati.forEach(r => {
    r.prodotti.forEach(p => {
      uomStats[p.uom] = (uomStats[p.uom] || 0) + 1;
    });
  });

  console.log(`\n📏 UNITÀ DI MISURA:`);
  Object.entries(uomStats).sort((a, b) => b[1] - a[1]).forEach(([uom, count]) => {
    console.log(`   - ${uom}: ${count} prodotti`);
  });

  console.log(`\n\n💡 ESEMPIO OUTPUT:`);
  if (risultati.length > 0 && risultati[0].prodotti.length > 0) {
    console.log(JSON.stringify(risultati[0], null, 2));
  }
}

main();
