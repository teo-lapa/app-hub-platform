/**
 * Script per generare un CSV dei prodotti da ricollocare
 */

const fs = require('fs');
const path = require('path');

// Leggi il file JSON generato
const jsonPath = path.join(__dirname, 'ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json');
const analisi = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Genera CSV
const csvLines = [
  'Ordine,Cliente,Data,Sales Order,Autista,Prodotto,Qty,UOM,Da (Furgone),A (Buffer)'
];

analisi.forEach(ordine => {
  ordine.prodotti.forEach(prodotto => {
    const line = [
      `"${ordine.ordine}"`,
      `"${ordine.cliente}"`,
      `"${ordine.data}"`,
      `"${ordine.salesOrder}"`,
      `"${ordine.autista}"`,
      `"${prodotto.nome}"`,
      prodotto.qty,
      `"${prodotto.uom}"`,
      `"${prodotto.ubicazione_attuale}"`,
      `"${prodotto.ubicazione_destinazione}"`
    ].join(',');

    csvLines.push(line);
  });
});

const csvContent = csvLines.join('\n');
const csvPath = path.join(__dirname, 'REPORT_RICOLLOCAZIONE_PRODOTTI.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log('✅ CSV generato con successo!');
console.log(`📄 File: ${csvPath}`);
console.log(`📊 Righe totali: ${csvLines.length - 1} prodotti`);
