/**
 * Script per mostrare un riepilogo visuale degli scarichi parziali
 */

const fs = require('fs');
const path = require('path');

// Leggi il file JSON generato
const jsonPath = path.join(__dirname, 'ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json');
const analisi = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log('\n' + '═'.repeat(100));
console.log('📊 RIEPILOGO COMPLETO SCARICHI PARZIALI - RICOLLOCAZIONE PRODOTTI');
console.log('═'.repeat(100) + '\n');

// Raggruppa per autista
const perAutista = {};
analisi.forEach(ordine => {
  if (!perAutista[ordine.autista]) {
    perAutista[ordine.autista] = {
      ordini: [],
      prodotti: []
    };
  }
  perAutista[ordine.autista].ordini.push(ordine);
  perAutista[ordine.autista].prodotti.push(...ordine.prodotti);
});

// Mostra per ogni autista
Object.keys(perAutista).sort().forEach(autista => {
  const data = perAutista[autista];

  console.log(`\n${'─'.repeat(100)}`);
  console.log(`🚚 FURGONE: ${autista.toUpperCase()}`);
  console.log(`${'─'.repeat(100)}`);
  console.log(`   Ordini: ${data.ordini.length}`);
  console.log(`   Prodotti da ricollocare: ${data.prodotti.length}\n`);

  // Raggruppa per buffer
  const perBuffer = {};
  data.prodotti.forEach(p => {
    const buffer = p.ubicazione_destinazione.split('/')[1];
    if (!perBuffer[buffer]) {
      perBuffer[buffer] = [];
    }
    perBuffer[buffer].push(p);
  });

  // Mostra per buffer
  ['Frigo', 'Pingu', 'Sopra'].forEach(buffer => {
    if (perBuffer[buffer] && perBuffer[buffer].length > 0) {
      const icon = buffer === 'Frigo' ? '❄️' : buffer === 'Pingu' ? '🧊' : '📦';
      console.log(`   ${icon} ${buffer.toUpperCase()} (${perBuffer[buffer].length} prodotti):`);

      perBuffer[buffer].forEach((p, i) => {
        const ordine = data.ordini.find(o => o.prodotti.includes(p));
        console.log(`      ${i + 1}. ${p.nome}`);
        console.log(`         └─ ${p.qty} ${p.uom} | Ordine: ${ordine.ordine} | Cliente: ${ordine.cliente.substring(0, 40)}...`);
      });
      console.log('');
    }
  });
});

// Statistiche generali
console.log('\n' + '═'.repeat(100));
console.log('📈 STATISTICHE GENERALI');
console.log('═'.repeat(100) + '\n');

const stats = {
  totaleOrdini: analisi.length,
  totaleProdotti: analisi.reduce((sum, o) => sum + o.prodotti.length, 0),
  perBuffer: {},
  perUom: {},
  perAutista: {}
};

analisi.forEach(ordine => {
  // Conta per autista
  stats.perAutista[ordine.autista] = (stats.perAutista[ordine.autista] || 0) + ordine.prodotti.length;

  ordine.prodotti.forEach(p => {
    // Conta per buffer
    const buffer = p.ubicazione_destinazione.split('/')[1];
    stats.perBuffer[buffer] = (stats.perBuffer[buffer] || 0) + 1;

    // Conta per UOM
    stats.perUom[p.uom] = (stats.perUom[p.uom] || 0) + 1;
  });
});

console.log('📦 TOTALI:');
console.log(`   Ordini da elaborare: ${stats.totaleOrdini}`);
console.log(`   Prodotti da ricollocare: ${stats.totaleProdotti}\n`);

console.log('👥 PER AUTISTA:');
Object.entries(stats.perAutista)
  .sort((a, b) => b[1] - a[1])
  .forEach(([autista, count]) => {
    const percent = ((count / stats.totaleProdotti) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`   ${autista.padEnd(15)} ${bar} ${count} prodotti (${percent}%)`);
  });

console.log('\n🗂️  PER BUFFER:');
Object.entries(stats.perBuffer)
  .sort((a, b) => b[1] - a[1])
  .forEach(([buffer, count]) => {
    const percent = ((count / stats.totaleProdotti) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    const icon = buffer === 'Frigo' ? '❄️' : buffer === 'Pingu' ? '🧊' : '📦';
    console.log(`   ${icon} ${buffer.padEnd(12)} ${bar} ${count} prodotti (${percent}%)`);
  });

console.log('\n📏 PER UNITÀ DI MISURA:');
Object.entries(stats.perUom)
  .sort((a, b) => b[1] - a[1])
  .forEach(([uom, count]) => {
    const percent = ((count / stats.totaleProdotti) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`   ${uom.padEnd(15)} ${bar} ${count} prodotti (${percent}%)`);
  });

console.log('\n' + '═'.repeat(100));
console.log('📋 AZIONI NECESSARIE');
console.log('═'.repeat(100) + '\n');

console.log('Per completare la ricollocazione:\n');
console.log('1. ✅ Aprire il file CSV in Excel:');
console.log('   📄 REPORT_RICOLLOCAZIONE_PRODOTTI.csv\n');

console.log('2. 📋 Stampare il report per furgone:');
Object.keys(perAutista).sort().forEach(autista => {
  console.log(`   - Lista per ${autista}: ${perAutista[autista].prodotti.length} prodotti`);
});

console.log('\n3. 🔄 Creare i trasferimenti in Odoo:');
console.log('   - Da: Furgone/{Autista}');
console.log('   - A: Buffer/{Frigo|Pingu|Sopra}');
console.log('   - Validare i picking creati\n');

console.log('4. ✔️  Verificare che tutti i prodotti siano stati ricollocati\n');

console.log('═'.repeat(100) + '\n');
