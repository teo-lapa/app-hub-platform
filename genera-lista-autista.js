/**
 * Script per generare liste stampabili per ogni autista
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'ANALISI_UBICAZIONI_SCARICHI_PARZIALI.json');
const analisi = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const autisti = [...new Set(analisi.map(o => o.autista))].sort();

let output = '';

autisti.forEach(autista => {
  output += '\n' + '═'.repeat(80) + '\n';
  output += `CHECK LIST RICOLLOCAZIONE - FURGONE ${autista.toUpperCase()}\n`;
  output += '═'.repeat(80) + '\n\n';

  const ordiniAutista = analisi.filter(o => o.autista === autista);
  const totaleProdotti = ordiniAutista.reduce((sum, o) => sum + o.prodotti.length, 0);

  output += `Data: ${new Date().toLocaleDateString('it-IT')}\n`;
  output += `Ordini: ${ordiniAutista.length}\n`;
  output += `Prodotti da ricollocare: ${totaleProdotti}\n\n`;

  const perBuffer = { Frigo: [], Pingu: [], Sopra: [] };

  ordiniAutista.forEach(ordine => {
    ordine.prodotti.forEach(p => {
      const buffer = p.ubicazione_destinazione.split('/')[1];
      perBuffer[buffer].push({
        ...p,
        ordine: ordine.ordine,
        cliente: ordine.cliente
      });
    });
  });

  ['Frigo', 'Pingu', 'Sopra'].forEach(buffer => {
    if (perBuffer[buffer].length > 0) {
      const icon = buffer === 'Frigo' ? '❄️' : buffer === 'Pingu' ? '🧊' : '📦';
      output += `\n${icon} BUFFER ${buffer.toUpperCase()} (${perBuffer[buffer].length} prodotti)\n`;
      output += '─'.repeat(80) + '\n';

      perBuffer[buffer].forEach((p, i) => {
        output += `\n${String(i + 1).padStart(2)}. □ ${p.nome}\n`;
        output += `    Qty: ${p.qty} ${p.uom}\n`;
        output += `    Ordine: ${p.ordine}\n`;
        output += `    Cliente: ${p.cliente.substring(0, 60)}\n`;
      });
    }
  });

  output += '\n' + '─'.repeat(80) + '\n';
  output += 'Note:\n';
  output += '─'.repeat(80) + '\n\n\n\n';
  output += '─'.repeat(80) + '\n';
  output += 'Firma autista: ___________________________  Data: _______________\n';
  output += '─'.repeat(80) + '\n\n\n\n';
});

// Aggiungi riepilogo finale
output += '\n' + '═'.repeat(80) + '\n';
output += 'RIEPILOGO GENERALE\n';
output += '═'.repeat(80) + '\n\n';

const stats = {
  totaleOrdini: analisi.length,
  totaleProdotti: analisi.reduce((sum, o) => sum + o.prodotti.length, 0),
  perAutista: {},
  perBuffer: {}
};

analisi.forEach(ordine => {
  stats.perAutista[ordine.autista] = (stats.perAutista[ordine.autista] || 0) + ordine.prodotti.length;

  ordine.prodotti.forEach(p => {
    const buffer = p.ubicazione_destinazione.split('/')[1];
    stats.perBuffer[buffer] = (stats.perBuffer[buffer] || 0) + 1;
  });
});

output += `Totale ordini da completare: ${stats.totaleOrdini}\n`;
output += `Totale prodotti da ricollocare: ${stats.totaleProdotti}\n\n`;

output += 'Distribuzione per autista:\n';
Object.entries(stats.perAutista)
  .sort((a, b) => b[1] - a[1])
  .forEach(([autista, count]) => {
    const percent = ((count / stats.totaleProdotti) * 100).toFixed(1);
    output += `  - ${autista}: ${count} prodotti (${percent}%)\n`;
  });

output += '\nDistribuzione per buffer:\n';
Object.entries(stats.perBuffer)
  .sort((a, b) => b[1] - a[1])
  .forEach(([buffer, count]) => {
    const percent = ((count / stats.totaleProdotti) * 100).toFixed(1);
    const icon = buffer === 'Frigo' ? '❄️' : buffer === 'Pingu' ? '🧊' : '📦';
    output += `  ${icon} ${buffer}: ${count} prodotti (${percent}%)\n`;
  });

output += '\n' + '═'.repeat(80) + '\n';

// Salva il file
const outputPath = path.join(__dirname, 'LISTA_RICOLLOCAZIONE_AUTISTI.txt');
fs.writeFileSync(outputPath, output, 'utf8');

console.log('✅ Lista stampabile generata con successo!');
console.log(`📄 File: ${outputPath}`);
console.log(`\n📊 Contenuto:`);
console.log(`   - ${autisti.length} liste per autista`);
console.log(`   - ${stats.totaleOrdini} ordini totali`);
console.log(`   - ${stats.totaleProdotti} prodotti da ricollocare`);
console.log(`\n💡 Puoi stampare questo file e dare una copia a ogni autista`);
