/**
 * ANALISI APPROFONDITA CONTO 1001 CASH
 *
 * SCOPERTA PRINCIPALE:
 * - Saldo REALE attuale: CHF 386,336.67 (non CHF 286,580.51 come riportato)
 * - Movimenti trovati: 1062 (non 498)
 * - Due rettifiche sospette: CHF 87,884.43 + CHF 86,405.83 = CHF 174,290.26
 */

const fs = require('fs');

// Carica report
const report = JSON.parse(fs.readFileSync('C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report-conto-1001-cash.json', 'utf8'));

const formatCHF = (amount) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount);
};

console.log('🔍 ANALISI APPROFONDITA CONTO 1001 CASH');
console.log('═'.repeat(80));

// 1. CORREZIONE DATI INIZIALI
console.log('\n📊 SCOPERTA CRITICA:');
console.log('   Saldo REALE Odoo:     ', formatCHF(report.analisi.saldoCalcolato));
console.log('   Saldo comunicato:     ', formatCHF(report.saldoAttuale));
console.log('   Differenza report:    ', formatCHF(report.analisi.saldoCalcolato - report.saldoAttuale));

// 2. ANALISI RETTIFICHE SOSPETTE
console.log('\n🚨 RETTIFICHE SOSPETTE (IL PROBLEMA PRINCIPALE):');
console.log('═'.repeat(80));

const rettifiche = report.anomalie.movimentiElevati;
let totalRettifiche = 0;

rettifiche.forEach((rett, idx) => {
  console.log(`\n${idx + 1}. ${rett.descrizione}`);
  console.log(`   Data:      ${rett.data}`);
  console.log(`   Importo:   ${formatCHF(rett.dare)}`);
  console.log(`   Giornale:  ${rett.giornale}`);
  console.log(`   ID:        ${rett.id}`);
  totalRettifiche += rett.dare;
});

console.log(`\n   TOTALE RETTIFICHE: ${formatCHF(totalRettifiche)}`);
console.log(`   Questo spiega quasi completamente l'eccesso!`);

// 3. ANALISI DUPLICATI
console.log('\n\n🔄 DUPLICATI IDENTIFICATI:');
console.log('═'.repeat(80));

// Trova i duplicati nel dataset completo
const duplicatiDettaglio = [];
const grouped = new Map();

report.movimentiCompleti.forEach(mov => {
  const key = `${mov.data}_${mov.partner}_${mov.dare}_${mov.avere}`;
  if (!grouped.has(key)) {
    grouped.set(key, []);
  }
  grouped.get(key).push(mov);
});

let totalDuplicati = 0;
let idx = 1;

grouped.forEach((movs, key) => {
  if (movs.length > 1) {
    const first = movs[0];
    console.log(`\n${idx}. Duplicato trovato:`);
    console.log(`   Data:        ${first.data}`);
    console.log(`   Descrizione: ${first.descrizione}`);
    console.log(`   Partner:     ${first.partner || 'N/A'}`);
    console.log(`   Importo:     ${formatCHF(first.dare || first.avere)}`);
    console.log(`   Occorrenze:  ${movs.length}`);
    console.log(`   IDs:         ${movs.map(m => m.id).join(', ')}`);

    const duplicateAmount = (first.dare - first.avere) * (movs.length - 1);
    totalDuplicati += duplicateAmount;

    duplicatiDettaglio.push({
      data: first.data,
      descrizione: first.descrizione,
      partner: first.partner,
      importo: first.dare || first.avere,
      occorrenze: movs.length,
      ids: movs.map(m => m.id),
      importoDuplicato: duplicateAmount
    });

    idx++;
  }
});

console.log(`\n   TOTALE DUPLICATI: ${formatCHF(totalDuplicati)}`);

// 4. ANALISI GIORNALI
console.log('\n\n📖 MOVIMENTI SU GIORNALI NON-CASSA:');
console.log('═'.repeat(80));

const giornaliNonCassa = ['Miscellaneous Operations', 'UBS EUR 08760A (EUR)', 'Rettifiche Chiusura 2023'];

giornaliNonCassa.forEach(giornale => {
  const movimenti = report.movimentiCompleti.filter(m => m.giornale === giornale);
  if (movimenti.length > 0) {
    const totale = movimenti.reduce((sum, m) => sum + (m.dare - m.avere), 0);
    console.log(`\n${giornale}:`);
    console.log(`   Movimenti: ${movimenti.length}`);
    console.log(`   Saldo:     ${formatCHF(totale)}`);

    movimenti.forEach(m => {
      console.log(`   - ${m.data}: ${m.descrizione} - ${formatCHF(m.dare - m.avere)}`);
    });
  }
});

// 5. CALCOLO SALDO CORRETTO
console.log('\n\n💡 CALCOLO SALDO CORRETTO:');
console.log('═'.repeat(80));

const saldoAttuale = report.analisi.saldoCalcolato;
const correzioneDuplicati = -totalDuplicati;
const correzioneRettifiche = -totalRettifiche;
const saldoCorretto = saldoAttuale + correzioneDuplicati + correzioneRettifiche;

console.log(`   Saldo attuale Odoo:           ${formatCHF(saldoAttuale)}`);
console.log(`   Correzione duplicati:         ${formatCHF(correzioneDuplicati)}`);
console.log(`   Correzione rettifiche:        ${formatCHF(correzioneRettifiche)}`);
console.log(`   ─────────────────────────────────────────────`);
console.log(`   SALDO CORRETTO STIMATO:       ${formatCHF(saldoCorretto)}`);

// 6. ANALISI TEMPORALE
console.log('\n\n📅 ANALISI TEMPORALE MOVIMENTI:');
console.log('═'.repeat(80));

const byYear = {};
report.movimentiCompleti.forEach(m => {
  const year = m.data ? m.data.substring(0, 4) : 'SENZA_DATA';
  if (!byYear[year]) {
    byYear[year] = { count: 0, dare: 0, avere: 0 };
  }
  byYear[year].count++;
  byYear[year].dare += m.dare;
  byYear[year].avere += m.avere;
});

Object.keys(byYear).sort().forEach(year => {
  const data = byYear[year];
  const saldo = data.dare - data.avere;
  console.log(`   ${year}: ${data.count} movimenti, Saldo: ${formatCHF(saldo)}`);
});

// 7. GENERAZIONE REPORT FINALE
console.log('\n\n📋 GENERAZIONE REPORT COMMERCIALISTA...');

const reportCommercialista = {
  data: new Date().toISOString(),
  titolo: 'ANALISI CONTO 1001 CASH - RETTIFICHE NECESSARIE',

  situazioneAttuale: {
    saldoOdoo: saldoAttuale,
    movimentiTotali: report.analisi.totalMovimenti,
    dare: report.analisi.totalDebit,
    avere: report.analisi.totalCredit
  },

  problemiIdentificati: {
    rettificheSospette: {
      descrizione: 'Due rettifiche manuali senza documentazione chiara',
      importo: totalRettifiche,
      dettaglio: rettifiche.map(r => ({
        data: r.data,
        descrizione: r.descrizione,
        importo: r.dare,
        id: r.id
      }))
    },

    duplicati: {
      descrizione: 'Movimenti potenzialmente duplicati',
      numeroGruppi: duplicatiDettaglio.length,
      importo: totalDuplicati,
      dettaglio: duplicatiDettaglio
    },

    giornaliSospetti: {
      descrizione: 'Movimenti registrati su giornali non-cassa',
      importo: totalRettifiche // Coincide con le rettifiche
    }
  },

  proposteRettifica: [
    {
      tipo: 'STORNO_RETTIFICHE',
      descrizione: 'Stornare le due rettifiche manuali sospette del 31.12.2023 e 31.01.2024',
      importo: -totalRettifiche,
      contoId: 1001,
      giustificazione: 'Rettifiche senza documentazione adeguata che gonflano artificialmente il saldo cassa'
    },
    {
      tipo: 'STORNO_DUPLICATI',
      descrizione: 'Stornare i movimenti duplicati mantenendo solo un\'occorrenza per gruppo',
      importo: -totalDuplicati,
      contoId: 1001,
      giustificazione: 'Eliminazione doppi inserimenti'
    }
  ],

  saldoPropostoDopoRettifiche: saldoCorretto,

  raccomandazioni: [
    'Verificare manualmente le rettifiche del 31.12.2023 e 31.01.2024',
    'Controllare se esistono documenti giustificativi per le rettifiche',
    'Analizzare i duplicati con il team contabile',
    'Implementare controlli per prevenire futuri duplicati',
    'Rivedere il processo di migrazione dati del 2023'
  ]
};

const reportPath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\REPORT_COMMERCIALISTA_CONTO_1001.json';
fs.writeFileSync(reportPath, JSON.stringify(reportCommercialista, null, 2));

console.log(`✅ Report salvato: ${reportPath}`);

// 8. RIEPILOGO ESECUTIVO
console.log('\n\n🎯 RIEPILOGO ESECUTIVO:');
console.log('═'.repeat(80));
console.log('\n📌 PROBLEMA PRINCIPALE:');
console.log(`   Due rettifiche manuali per un totale di ${formatCHF(totalRettifiche)}`);
console.log(`   senza apparente documentazione giustificativa.`);
console.log(`\n📌 IMPATTO:`);
console.log(`   Saldo gonfiato del ${((totalRettifiche / saldoAttuale) * 100).toFixed(1)}%`);
console.log(`\n📌 AZIONE CONSIGLIATA:`);
console.log(`   1. Verificare con commercialista le rettifiche del 31.12.2023 e 31.01.2024`);
console.log(`   2. Se non giustificate, procedere con storno`);
console.log(`   3. Eliminare i ${duplicatiDettaglio.length} duplicati identificati`);
console.log(`   4. Saldo finale atteso: ${formatCHF(saldoCorretto)}`);

console.log('\n✅ ANALISI COMPLETATA');
console.log('═'.repeat(80));
