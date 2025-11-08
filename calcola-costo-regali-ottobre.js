/**
 * CALCOLO COSTO PRODOTTI REGALATI - OTTOBRE 2025
 *
 * Analizza tutti i prodotti con fatturato €0 per calcolare
 * il costo reale di tutti gli omaggi/regali fatti
 */

const fs = require('fs');

// Leggi il file JSON generato dall'analisi precedente
const data = JSON.parse(fs.readFileSync('margini-ottobre-2025.json', 'utf-8'));

console.log('\n🎁 ANALISI PRODOTTI REGALATI - OTTOBRE 2025\n');
console.log('='.repeat(100));

// Filtra prodotti con fatturato = 0 (quindi regalati)
const prodottiRegalati = data.products.filter(p => p.totalRevenue === 0);

// Ordina per costo totale decrescente
prodottiRegalati.sort((a, b) => b.totalCost - a.totalCost);

console.log(`\n📦 Trovati ${prodottiRegalati.length} prodotti regalati (fatturato €0)\n`);
console.log('='.repeat(100));

// Calcola totale costo regali
const costoTotaleRegali = prodottiRegalati.reduce((sum, p) => sum + p.totalCost, 0);

console.log('\n💰 COSTO TOTALE PRODOTTI REGALATI: €' + costoTotaleRegali.toFixed(2));
console.log('='.repeat(100));

console.log('\n📋 DETTAGLIO PRODOTTI REGALATI:\n');
console.log(
  'Qtà'.padStart(6) + '  ' +
  'Nome Prodotto'.padEnd(50) +
  'Costo Tot'.padStart(12) +
  'Costo Unit'.padStart(12)
);
console.log('-'.repeat(100));

prodottiRegalati.forEach(p => {
  const costoUnitario = p.totalCost / p.quantitySold;
  console.log(
    p.quantitySold.toFixed(0).padStart(6) + '  ' +
    p.name.substring(0, 49).padEnd(50) +
    `€${p.totalCost.toFixed(2)}`.padStart(12) +
    `€${costoUnitario.toFixed(2)}`.padStart(12)
  );
});

console.log('='.repeat(100));
console.log('\n📊 STATISTICHE REGALI:\n');

// Raggruppa per fasce di costo
const fasceCosto = {
  'Sotto €5': prodottiRegalati.filter(p => p.totalCost < 5).length,
  '€5 - €20': prodottiRegalati.filter(p => p.totalCost >= 5 && p.totalCost < 20).length,
  '€20 - €50': prodottiRegalati.filter(p => p.totalCost >= 20 && p.totalCost < 50).length,
  '€50 - €100': prodottiRegalati.filter(p => p.totalCost >= 50 && p.totalCost < 100).length,
  'Oltre €100': prodottiRegalati.filter(p => p.totalCost >= 100).length
};

console.log('Distribuzione per fasce di costo:');
Object.entries(fasceCosto).forEach(([fascia, count]) => {
  console.log(`   ${fascia.padEnd(15)}: ${count} prodotti`);
});

// TOP 10 prodotti regalati per costo
console.log('\n🔝 TOP 10 PRODOTTI REGALATI PER COSTO:\n');
console.log(
  'Qtà'.padStart(6) + '  ' +
  'Nome Prodotto'.padEnd(50) +
  'Costo Tot'.padStart(12)
);
console.log('-'.repeat(100));

prodottiRegalati.slice(0, 10).forEach(p => {
  console.log(
    p.quantitySold.toFixed(0).padStart(6) + '  ' +
    p.name.substring(0, 49).padEnd(50) +
    `€${p.totalCost.toFixed(2)}`.padStart(12)
  );
});

console.log('='.repeat(100));

// Calcola percentuale sul fatturato totale
const fatturatoTotale = data.summary.totalRevenue;
const percRegaliSuFatturato = (costoTotaleRegali / fatturatoTotale * 100);

console.log('\n📈 IMPATTO SUL BUSINESS:\n');
console.log(`   Fatturato Totale Ottobre:     €${fatturatoTotale.toFixed(2)}`);
console.log(`   Costo Prodotti Regalati:      €${costoTotaleRegali.toFixed(2)}`);
console.log(`   Impatto sui Margini:          -${percRegaliSuFatturato.toFixed(2)}%`);
console.log(`   Margine con Regali:           €${data.summary.totalMargin.toFixed(2)} (${data.summary.globalMarginPercentage}%)`);
console.log(`   Margine senza Regali:         €${(data.summary.totalMargin + costoTotaleRegali).toFixed(2)} (${((data.summary.totalMargin + costoTotaleRegali) / fatturatoTotale * 100).toFixed(2)}%)`);

console.log('\n✅ ANALISI COMPLETATA!\n');

// Salva report regali
const reportRegali = {
  periodo: 'Ottobre 2025',
  costoTotaleRegali: costoTotaleRegali.toFixed(2),
  numeroArticoliRegalati: prodottiRegalati.length,
  distribuzioneCosti: fasceCosto,
  top10: prodottiRegalati.slice(0, 10).map(p => ({
    nome: p.name,
    quantita: p.quantitySold,
    costoTotale: p.totalCost.toFixed(2),
    costoUnitario: (p.totalCost / p.quantitySold).toFixed(2)
  })),
  prodottiCompleti: prodottiRegalati.map(p => ({
    codice: p.default_code,
    nome: p.name,
    categoria: p.category,
    quantita: p.quantitySold,
    costoTotale: p.totalCost.toFixed(2),
    costoUnitario: (p.totalCost / p.quantitySold).toFixed(2)
  }))
};

fs.writeFileSync('report-regali-ottobre-2025.json', JSON.stringify(reportRegali, null, 2), 'utf-8');
console.log('💾 Report salvato in: report-regali-ottobre-2025.json\n');
