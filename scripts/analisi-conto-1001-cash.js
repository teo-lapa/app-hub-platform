/**
 * ANALISI CONTO 1001 CASH - Odoo Data Modeler
 *
 * Obiettivo: Identificare errori che causano saldo eccessivo di CHF 195,686
 * Saldo attuale: CHF 286,580.51
 * Saldo atteso: ~CHF 90,894.22
 *
 * Credenziali Odoo:
 * - URL: https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com
 * - DB: lapadevadmin-lapa-v2-staging-2406-25408900
 * - User: paul@lapa.ch
 */

const Odoo = require('odoo-xmlrpc');

// Configurazione connessione Odoo
const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
});

// Utility per formattare valute
const formatCHF = (amount) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount);
};

// Utility per formattare date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('de-CH');
};

async function connect() {
  return new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) {
        console.error('❌ Errore connessione Odoo:', err);
        reject(err);
      } else {
        console.log('✅ Connesso a Odoo');
        resolve();
      }
    });
  });
}

async function searchRead(model, domain, fields) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'search_read', [[domain], { fields: fields }], (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function getConto1001() {
  console.log('\n📋 Ricerca conto 1001 Cash...');

  const accounts = await searchRead('account.account', [
    ['code', '=', '1001']
  ], ['id', 'code', 'name', 'currency_id', 'current_balance']);

  if (accounts.length === 0) {
    throw new Error('Conto 1001 non trovato');
  }

  const account = accounts[0];
  console.log(`✅ Trovato: ${account.code} - ${account.name}`);
  console.log(`   Saldo attuale: ${formatCHF(account.current_balance)}`);

  return account;
}

async function getMovimentiConto1001(accountId) {
  console.log('\n📊 Estrazione movimenti contabili...');

  // Estrai tutte le righe contabili (account.move.line) del conto 1001
  const moveLines = await searchRead('account.move.line', [
    ['account_id', '=', accountId]
  ], [
    'id',
    'name',
    'date',
    'move_id',
    'partner_id',
    'debit',
    'credit',
    'balance',
    'amount_currency',
    'currency_id',
    'ref',
    'journal_id',
    'company_id'
  ]);

  console.log(`✅ Estratti ${moveLines.length} movimenti`);

  return moveLines;
}

async function analyzeMovimenti(moveLines) {
  console.log('\n🔍 ANALISI MOVIMENTI CONTO 1001 CASH');
  console.log('═'.repeat(80));

  // 1. Calcolo saldo totale
  let totalDebit = 0;
  let totalCredit = 0;
  let saldoCalcolato = 0;

  moveLines.forEach(line => {
    totalDebit += line.debit || 0;
    totalCredit += line.credit || 0;
    saldoCalcolato += (line.debit || 0) - (line.credit || 0);
  });

  console.log(`\n💰 RIEPILOGO SALDO:`);
  console.log(`   Totale Dare:  ${formatCHF(totalDebit)}`);
  console.log(`   Totale Avere: ${formatCHF(totalCredit)}`);
  console.log(`   Saldo:        ${formatCHF(saldoCalcolato)}`);

  // 2. Raggruppa per data
  const byDate = {};
  moveLines.forEach(line => {
    const date = line.date || 'NO_DATE';
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(line);
  });

  console.log(`\n📅 DISTRIBUZIONE PER DATA:`);
  console.log(`   Periodi diversi: ${Object.keys(byDate).length}`);

  // Ordina date
  const sortedDates = Object.keys(byDate).sort();

  // 3. Identifica date con molti movimenti (possibili duplicati)
  console.log(`\n⚠️  DATE CON MOLTI MOVIMENTI (possibili anomalie):`);
  const suspiciousDates = [];

  sortedDates.forEach(date => {
    const count = byDate[date].length;
    if (count > 10) {
      const dateTotal = byDate[date].reduce((sum, line) =>
        sum + (line.debit || 0) - (line.credit || 0), 0);

      console.log(`   ${formatDate(date)}: ${count} movimenti, Saldo: ${formatCHF(dateTotal)}`);
      suspiciousDates.push({ date, count, total: dateTotal, lines: byDate[date] });
    }
  });

  // 4. Verifica movimento del 31.01.2024 (correzione CHF 86,405.83)
  console.log(`\n🎯 VERIFICA CORREZIONE 31.01.2024:`);
  const jan2024 = byDate['2024-01-31'] || [];
  if (jan2024.length > 0) {
    console.log(`   Trovati ${jan2024.length} movimenti del 31.01.2024:`);
    jan2024.forEach(line => {
      console.log(`   - ${line.name || line.ref || 'N/A'}: Dare ${formatCHF(line.debit)} Avere ${formatCHF(line.credit)}`);
    });
  } else {
    console.log(`   ⚠️  Nessun movimento trovato per il 31.01.2024`);
  }

  // 5. Raggruppa per journal
  const byJournal = {};
  moveLines.forEach(line => {
    const journalId = line.journal_id ? line.journal_id[0] : 'NO_JOURNAL';
    if (!byJournal[journalId]) {
      byJournal[journalId] = {
        name: line.journal_id ? line.journal_id[1] : 'Nessun giornale',
        lines: [],
        debit: 0,
        credit: 0
      };
    }
    byJournal[journalId].lines.push(line);
    byJournal[journalId].debit += line.debit || 0;
    byJournal[journalId].credit += line.credit || 0;
  });

  console.log(`\n📖 DISTRIBUZIONE PER GIORNALE:`);
  Object.values(byJournal).forEach(journal => {
    const saldo = journal.debit - journal.credit;
    console.log(`   ${journal.name}: ${journal.lines.length} mov., Saldo: ${formatCHF(saldo)}`);
  });

  // 6. Cerca duplicati (stesso importo, stessa data, stesso partner)
  console.log(`\n🔄 RICERCA DUPLICATI:`);
  const duplicates = [];
  const seen = new Map();

  moveLines.forEach(line => {
    const key = `${line.date}_${line.partner_id ? line.partner_id[0] : 'NO_PARTNER'}_${line.debit}_${line.credit}`;

    if (seen.has(key)) {
      seen.get(key).push(line);
    } else {
      seen.set(key, [line]);
    }
  });

  seen.forEach((lines, key) => {
    if (lines.length > 1) {
      duplicates.push({ key, lines });
    }
  });

  if (duplicates.length > 0) {
    console.log(`   ⚠️  Trovati ${duplicates.length} gruppi di possibili duplicati:`);
    duplicates.slice(0, 10).forEach(dup => {
      const firstLine = dup.lines[0];
      console.log(`   - ${formatDate(firstLine.date)}: ${dup.lines.length} movimenti identici`);
      console.log(`     Importo: Dare ${formatCHF(firstLine.debit)} Avere ${formatCHF(firstLine.credit)}`);
    });
    if (duplicates.length > 10) {
      console.log(`   ... e altri ${duplicates.length - 10} gruppi`);
    }
  } else {
    console.log(`   ✅ Nessun duplicato evidente trovato`);
  }

  // 7. Movimenti di importo elevato (> CHF 10,000)
  console.log(`\n💎 MOVIMENTI DI IMPORTO ELEVATO (> CHF 10,000):`);
  const highValue = moveLines.filter(line =>
    (line.debit > 10000 || line.credit > 10000)
  ).sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit));

  if (highValue.length > 0) {
    console.log(`   Trovati ${highValue.length} movimenti:`);
    highValue.slice(0, 15).forEach(line => {
      console.log(`   - ${formatDate(line.date)}: ${line.name || line.ref || 'N/A'}`);
      console.log(`     Dare: ${formatCHF(line.debit)}, Avere: ${formatCHF(line.credit)}`);
    });
    if (highValue.length > 15) {
      console.log(`   ... e altri ${highValue.length - 15} movimenti`);
    }
  }

  // 8. Movimenti post-migrazione (2023+)
  console.log(`\n🚀 MOVIMENTI POST-MIGRAZIONE (2023+):`);
  const post2023 = moveLines.filter(line => {
    const year = line.date ? new Date(line.date).getFullYear() : 0;
    return year >= 2023;
  });

  if (post2023.length > 0) {
    const post2023Saldo = post2023.reduce((sum, line) =>
      sum + (line.debit || 0) - (line.credit || 0), 0);

    console.log(`   Movimenti: ${post2023.length}`);
    console.log(`   Saldo:     ${formatCHF(post2023Saldo)}`);
  }

  return {
    totalMovimenti: moveLines.length,
    totalDebit,
    totalCredit,
    saldoCalcolato,
    suspiciousDates,
    duplicates,
    highValue,
    byJournal,
    post2023
  };
}

async function generateReport(analysis, moveLines) {
  console.log('\n📄 GENERAZIONE REPORT...');

  const report = {
    dataAnalisi: new Date().toISOString(),
    saldoAttuale: 286580.51,
    saldoAtteso: 90894.22,
    differenza: 195686.29,

    analisi: {
      totalMovimenti: analysis.totalMovimenti,
      totalDebit: analysis.totalDebit,
      totalCredit: analysis.totalCredit,
      saldoCalcolato: analysis.saldoCalcolato
    },

    anomalie: {
      dateConMoltiMovimenti: analysis.suspiciousDates.map(d => ({
        data: d.date,
        numeroMovimenti: d.count,
        saldo: d.total
      })),

      possibiliDuplicati: analysis.duplicates.length,

      movimentiElevati: analysis.highValue.slice(0, 20).map(line => ({
        id: line.id,
        data: line.date,
        descrizione: line.name || line.ref,
        dare: line.debit,
        avere: line.credit,
        partner: line.partner_id ? line.partner_id[1] : null,
        giornale: line.journal_id ? line.journal_id[1] : null
      }))
    },

    movimentiCompleti: moveLines.map(line => ({
      id: line.id,
      data: line.date,
      descrizione: line.name || line.ref,
      dare: line.debit,
      avere: line.credit,
      saldo: (line.debit || 0) - (line.credit || 0),
      partner: line.partner_id ? line.partner_id[1] : null,
      giornale: line.journal_id ? line.journal_id[1] : null,
      moveId: line.move_id ? line.move_id[0] : null
    }))
  };

  // Salva report JSON
  const fs = require('fs');
  const reportPath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\report-conto-1001-cash.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Report salvato: ${reportPath}`);

  // Salva CSV per analisi Excel
  const csvPath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\movimenti-1001-cash.csv';
  const csvLines = ['Data;Descrizione;Dare;Avere;Saldo;Partner;Giornale;ID'];

  report.movimentiCompleti.forEach(mov => {
    csvLines.push([
      mov.data || '',
      (mov.descrizione || '').replace(/;/g, ','),
      mov.dare.toFixed(2),
      mov.avere.toFixed(2),
      mov.saldo.toFixed(2),
      (mov.partner || '').replace(/;/g, ','),
      (mov.giornale || '').replace(/;/g, ','),
      mov.id
    ].join(';'));
  });

  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  console.log(`✅ CSV salvato: ${csvPath}`);

  return report;
}

async function proposteRettifica(analysis, moveLines) {
  console.log('\n🔧 PROPOSTE DI RETTIFICA');
  console.log('═'.repeat(80));

  const proposte = [];

  // Proposta 1: Verifica duplicati
  if (analysis.duplicates.length > 0) {
    const totalDuplicati = analysis.duplicates.reduce((sum, dup) => {
      const firstLine = dup.lines[0];
      const amount = (firstLine.debit || 0) - (firstLine.credit || 0);
      return sum + (amount * (dup.lines.length - 1));
    }, 0);

    proposte.push({
      tipo: 'DUPLICATI',
      descrizione: `Verificare ed eliminare ${analysis.duplicates.length} gruppi di possibili duplicati`,
      importoPotenziale: totalDuplicati,
      azione: 'Stornare i movimenti duplicati mantenendo solo uno per gruppo'
    });

    console.log(`\n1️⃣  DUPLICATI:`);
    console.log(`   Gruppi trovati: ${analysis.duplicates.length}`);
    console.log(`   Impatto potenziale: ${formatCHF(totalDuplicati)}`);
    console.log(`   Azione: Verificare manualmente e stornare duplicati`);
  }

  // Proposta 2: Movimenti elevati sospetti
  const highValueSuspicious = analysis.highValue.filter(line => {
    const year = line.date ? new Date(line.date).getFullYear() : 0;
    return year >= 2023 && (line.debit > 50000 || line.credit > 50000);
  });

  if (highValueSuspicious.length > 0) {
    proposte.push({
      tipo: 'MOVIMENTI_ELEVATI',
      descrizione: `Verificare ${highValueSuspicious.length} movimenti post-2023 di importo > CHF 50,000`,
      azione: 'Controllare se sono pagamenti da spostare su conto bancario'
    });

    console.log(`\n2️⃣  MOVIMENTI ELEVATI POST-2023:`);
    console.log(`   Numero: ${highValueSuspicious.length}`);
    console.log(`   Azione: Verificare se sono erroneamente registrati su Cash invece che Banca`);
  }

  // Proposta 3: Analisi giornali
  const cashJournals = ['Cassa', 'Cash', 'CASH'];
  const suspiciousJournals = Object.values(analysis.byJournal).filter(j =>
    !cashJournals.some(cj => j.name.toUpperCase().includes(cj.toUpperCase()))
  );

  if (suspiciousJournals.length > 0) {
    const totalSuspicious = suspiciousJournals.reduce((sum, j) =>
      sum + (j.debit - j.credit), 0);

    proposte.push({
      tipo: 'GIORNALI_SOSPETTI',
      descrizione: `Movimenti registrati su giornali non-cassa: ${suspiciousJournals.map(j => j.name).join(', ')}`,
      importoPotenziale: totalSuspicious,
      azione: 'Verificare e spostare su conti corretti'
    });

    console.log(`\n3️⃣  GIORNALI SOSPETTI:`);
    suspiciousJournals.forEach(j => {
      console.log(`   - ${j.name}: ${j.lines.length} mov., Saldo: ${formatCHF(j.debit - j.credit)}`);
    });
  }

  return proposte;
}

// MAIN EXECUTION
async function main() {
  try {
    console.log('🏗️  ODOO DATA MODELER - Analisi Conto 1001 Cash');
    console.log('═'.repeat(80));

    await connect();

    const account = await getConto1001();
    const moveLines = await getMovimentiConto1001(account.id);
    const analysis = await analyzeMovimenti(moveLines);
    const report = await generateReport(analysis, moveLines);
    const proposte = await proposteRettifica(analysis, moveLines);

    console.log('\n✅ ANALISI COMPLETATA');
    console.log('═'.repeat(80));
    console.log(`\n📊 File generati:`);
    console.log(`   - report-conto-1001-cash.json`);
    console.log(`   - movimenti-1001-cash.csv`);
    console.log(`\n💡 Prossimi passi:`);
    console.log(`   1. Analizzare i duplicati identificati`);
    console.log(`   2. Verificare movimenti elevati post-2023`);
    console.log(`   3. Controllare giornali sospetti`);
    console.log(`   4. Preparare registrazioni di rettifica`);

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
