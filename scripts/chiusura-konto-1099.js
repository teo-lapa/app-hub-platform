/**
 * AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO
 *
 * Chiude il conto 1099 (CHF -60,842.41) su Patrimonio Netto
 * Movimenti del 31.01.2024 - Correzioni post-migrazione 2023
 *
 * @author Process Automator
 * @date 2025-11-15
 */

const Odoo = require('odoo-xmlrpc');
const fs = require('fs');

// ============================================================================
// CONFIGURAZIONE ODOO
// ============================================================================

const odoo = new Odoo({
  url: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180',
  secure: true  // Forza HTTPS
});

let uid = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function connect() {
  return new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) reject(err);
      else {
        uid = odoo.uid;
        resolve(uid);
      }
    });
  });
}

function executeKw(model, method, params = [], kwargs = {}) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, method, params, kwargs, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

async function searchRead(model, domain, fields) {
  return await executeKw(model, 'search_read', [domain], { fields, limit: 1000 });
}

async function create(model, values) {
  return await executeKw(model, 'create', [values]);
}

async function read(model, ids, fields) {
  return await executeKw(model, 'read', [ids], { fields });
}

// ============================================================================
// STEP 1: ANALISI KONTO 1099
// ============================================================================

async function analizzaKonto1099() {
  console.log('\n📊 STEP 1: Analisi Konto 1099 Transferkonto\n');
  console.log('='.repeat(60));

  // Cerca il conto 1099
  const accounts = await searchRead(
    'account.account',
    [['code', '=', '1099']],
    ['id', 'name', 'code', 'account_type', 'current_balance']
  );

  if (accounts.length === 0) {
    throw new Error('❌ Conto 1099 non trovato!');
  }

  const konto1099 = accounts[0];
  console.log(`\n✅ Conto trovato:`);
  console.log(`   ID: ${konto1099.id}`);
  console.log(`   Codice: ${konto1099.code}`);
  console.log(`   Nome: ${konto1099.name}`);
  console.log(`   Tipo: ${konto1099.account_type}`);

  // Cerca tutti i movimenti
  const allMoves = await searchRead(
    'account.move.line',
    [['account_id', '=', konto1099.id]],
    ['id', 'date', 'name', 'debit', 'credit', 'balance', 'move_id', 'ref']
  );

  console.log(`\n📋 Movimenti totali: ${allMoves.length}`);

  // Filtra quelli del 31.01.2024
  const movesJan = allMoves.filter(m => m.date === '2024-01-31');
  console.log(`   di cui del 31.01.2024: ${movesJan.length}`);
  console.log('-'.repeat(60));

  let totalDebit = 0;
  let totalCredit = 0;

  movesJan.forEach((line, idx) => {
    console.log(`\n${idx + 1}. Move Line ID: ${line.id}`);
    console.log(`   Data: ${line.date}`);
    console.log(`   Descrizione: ${line.name || 'N/A'}`);
    console.log(`   Dare: CHF ${line.debit.toFixed(2)}`);
    console.log(`   Avere: CHF ${line.credit.toFixed(2)}`);
    console.log(`   Saldo: CHF ${line.balance.toFixed(2)}`);

    totalDebit += line.debit;
    totalCredit += line.credit;
  });

  const netBalance = totalDebit - totalCredit;
  const currentBalance = konto1099.current_balance || netBalance;

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RIEPILOGO (31.01.2024):`);
  console.log(`   Totale Dare: CHF ${totalDebit.toFixed(2)}`);
  console.log(`   Totale Avere: CHF ${totalCredit.toFixed(2)}`);
  console.log(`   Saldo Netto: CHF ${netBalance.toFixed(2)}`);
  console.log(`\n💡 Saldo attuale conto: CHF ${currentBalance.toFixed(2)}`);
  console.log('='.repeat(60));

  return {
    account: konto1099,
    moves: movesJan,
    allMoves,
    totalDebit,
    totalCredit,
    netBalance,
    currentBalance
  };
}

// ============================================================================
// STEP 2: TROVA CONTO PATRIMONIO NETTO
// ============================================================================

async function trovaContoPatrimonioNetto() {
  console.log('\n💰 STEP 2: Identifica Conto Patrimonio Netto\n');
  console.log('='.repeat(60));

  // Cerca conti equity
  const equityAccounts = await searchRead(
    'account.account',
    [['account_type', 'in', ['equity', 'equity_unaffected']]],
    ['id', 'name', 'code', 'account_type']
  );

  console.log(`\n📋 Conti Equity disponibili: ${equityAccounts.length}`);

  if (equityAccounts.length === 0) {
    throw new Error('❌ Nessun conto Equity trovato!');
  }

  // Mostra i primi 10
  equityAccounts.slice(0, 10).forEach((acc, idx) => {
    console.log(`   ${idx + 1}. [${acc.code}] ${acc.name}`);
  });

  // Cerca specificamente conti di apertura/differenze
  let targetAccount = equityAccounts.find(a => a.code === '2979' || a.code === '2980');

  if (!targetAccount) {
    targetAccount = equityAccounts.find(a =>
      a.name.toLowerCase().includes('eröffnung') ||
      a.name.toLowerCase().includes('differenz') ||
      a.name.toLowerCase().includes('apertura') ||
      a.name.toLowerCase().includes('opening')
    );
  }

  if (!targetAccount) {
    targetAccount = equityAccounts.find(a => a.account_type === 'equity_unaffected');
  }

  if (!targetAccount) {
    targetAccount = equityAccounts[0];
  }

  console.log(`\n✅ Conto selezionato:`);
  console.log(`   ID: ${targetAccount.id}`);
  console.log(`   Codice: ${targetAccount.code}`);
  console.log(`   Nome: ${targetAccount.name}`);
  console.log(`   Tipo: ${targetAccount.account_type}`);

  return targetAccount;
}

// ============================================================================
// STEP 3: CREA REGISTRAZIONE
// ============================================================================

async function creaRegistrazioneChiusura(konto1099, kontoEquity, currentBalance) {
  console.log('\n📝 STEP 3: Creazione Registrazione di Chiusura\n');
  console.log('='.repeat(60));

  // Cerca journal generale
  const journals = await searchRead(
    'account.journal',
    [['type', '=', 'general']],
    ['id', 'name', 'code']
  );

  if (journals.length === 0) {
    throw new Error('❌ Nessun journal generale trovato!');
  }

  const journal = journals[0];
  console.log(`\n📘 Journal: ${journal.code} - ${journal.name}`);

  const importo = Math.abs(currentBalance);

  console.log(`\n💡 Saldo da chiudere: CHF ${currentBalance.toFixed(2)}`);
  console.log(`   (${currentBalance < 0 ? 'Credito' : 'Debito'})`);

  // Se saldo è negativo (credito), dobbiamo dare il conto per portarlo a 0
  let line1099, lineEquity;

  if (currentBalance < 0) {
    // Saldo credito → Dare 1099, Avere Equity
    line1099 = {
      account_id: konto1099.id,
      name: 'Chiusura Transferkonto su Patrimonio Netto',
      debit: importo,
      credit: 0
    };
    lineEquity = {
      account_id: kontoEquity.id,
      name: 'Chiusura Transferkonto da conto 1099',
      debit: 0,
      credit: importo
    };
  } else {
    // Saldo debito → Avere 1099, Dare Equity
    line1099 = {
      account_id: konto1099.id,
      name: 'Chiusura Transferkonto su Patrimonio Netto',
      debit: 0,
      credit: importo
    };
    lineEquity = {
      account_id: kontoEquity.id,
      name: 'Chiusura Transferkonto da conto 1099',
      debit: importo,
      credit: 0
    };
  }

  console.log(`\n📋 Registrazione da creare:`);
  console.log(`   Data: ${new Date().toISOString().split('T')[0]}`);
  console.log(`   Importo: CHF ${importo.toFixed(2)}`);
  console.log(`\n   Riga 1: ${konto1099.code} - ${konto1099.name}`);
  console.log(`      D: CHF ${line1099.debit.toFixed(2)} | A: CHF ${line1099.credit.toFixed(2)}`);
  console.log(`\n   Riga 2: ${kontoEquity.code} - ${kontoEquity.name}`);
  console.log(`      D: CHF ${lineEquity.debit.toFixed(2)} | A: CHF ${lineEquity.credit.toFixed(2)}`);

  const moveData = {
    journal_id: journal.id,
    date: new Date().toISOString().split('T')[0],
    ref: 'Chiusura Konto 1099 Transferkonto - Correzioni post-migrazione 2023',
    line_ids: [
      [0, 0, line1099],
      [0, 0, lineEquity]
    ]
  };

  console.log('\n⏳ Creazione registrazione in Odoo...');

  try {
    const moveId = await create('account.move', moveData);
    console.log(`✅ Registrazione creata: ID ${moveId}`);

    const move = await read('account.move', [moveId], ['name', 'state', 'date', 'ref']);

    console.log(`\n📄 Dettagli:`);
    console.log(`   Numero: ${move[0].name}`);
    console.log(`   Stato: ${move[0].state}`);
    console.log(`   Data: ${move[0].date}`);
    console.log(`   Riferimento: ${move[0].ref}`);

    return { moveId, move: move[0] };
  } catch (error) {
    console.error(`\n❌ Errore nella creazione: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// STEP 4: VERIFICA
// ============================================================================

async function verificaSaldoFinale(accountId) {
  console.log('\n✅ STEP 4: Verifica Saldo Finale\n');
  console.log('='.repeat(60));

  const accounts = await read('account.account', [accountId], ['id', 'name', 'code', 'current_balance']);

  const account = accounts[0];
  const saldo = account.current_balance || 0;

  console.log(`\n📊 Conto: ${account.code} - ${account.name}`);
  console.log(`   Saldo Finale: CHF ${saldo.toFixed(2)}`);

  if (Math.abs(saldo) < 0.01) {
    console.log('\n🎉 SUCCESSO! Saldo = 0.00');
    return true;
  } else {
    console.log('\n⚠️  Saldo diverso da 0.00');
    console.log('   Potrebbe essere necessario validare la registrazione.');
    return false;
  }
}

// ============================================================================
// DOCUMENTAZIONE
// ============================================================================

function generaDoc(analisi, kontoEquity, registrazione, verificaOk) {
  const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
  const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900';
  const ODOO_USERNAME = 'paul@lapa.ch';

  return `
${'='.repeat(80)}
CHIUSURA KONTO 1099 TRANSFERKONTO - DOCUMENTAZIONE
${'='.repeat(80)}

Data: ${new Date().toLocaleString('it-CH')}
Eseguito da: Process Automator

${'-'.repeat(80)}
1. SITUAZIONE INIZIALE
${'-'.repeat(80)}

Conto: ${analisi.account.code} - ${analisi.account.name}
Saldo: CHF ${analisi.currentBalance.toFixed(2)}

Movimenti analizzati del 31.01.2024: ${analisi.moves.length}
- Totale Dare: CHF ${analisi.totalDebit.toFixed(2)}
- Totale Avere: CHF ${analisi.totalCredit.toFixed(2)}

Origine: Correzioni post-migrazione software 2023

${'-'.repeat(80)}
2. CONTO DI DESTINAZIONE
${'-'.repeat(80)}

Conto Patrimonio Netto: ${kontoEquity.code} - ${kontoEquity.name}
Tipo: ${kontoEquity.account_type}

Motivazione: Come da istruzioni commercialista, il Transferkonto deve essere
             chiuso a 0.00 su un conto di Patrimonio Netto (Eigenkapital).

${'-'.repeat(80)}
3. REGISTRAZIONE CONTABILE CREATA
${'-'.repeat(80)}

Numero: ${registrazione.move.name}
Data: ${registrazione.move.date}
Stato: ${registrazione.move.state}
ID: ${registrazione.moveId}

Importo: CHF ${Math.abs(analisi.currentBalance).toFixed(2)}

Movimenti:
- ${analisi.currentBalance < 0 ? 'DARE' : 'AVERE'} ${analisi.account.code}: CHF ${Math.abs(analisi.currentBalance).toFixed(2)}
- ${analisi.currentBalance < 0 ? 'AVERE' : 'DARE'} ${kontoEquity.code}: CHF ${Math.abs(analisi.currentBalance).toFixed(2)}

${'-'.repeat(80)}
4. RISULTATO
${'-'.repeat(80)}

Saldo finale Konto 1099: ${verificaOk ? 'CHF 0.00 ✅' : 'Da verificare ⚠️'}

${registrazione.move.state === 'draft' ? `
⚠️  AZIONE RICHIESTA:
La registrazione ${registrazione.move.name} è in stato DRAFT.

Per completare:
1. Accedi a Odoo: ${ODOO_URL}
2. Vai a: Contabilità > Registrazioni Contabili
3. Cerca: ${registrazione.move.name}
4. Clicca "Validate" (Valida)
5. Verifica saldo conto 1099 = 0.00
` : '✅ Operazione completata'}

${'-'.repeat(80)}
5. RIFERIMENTI
${'-'.repeat(80)}

Odoo URL: ${ODOO_URL}
Database: ${ODOO_DB}
User: ${ODOO_USERNAME}

Conto 1099 ID: ${analisi.account.id}
Conto Equity ID: ${kontoEquity.id}
Registrazione ID: ${registrazione.moveId}

${'='.repeat(80)}
`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO');
  console.log('='.repeat(60));

  try {
    // Connessione
    console.log('\n🔐 Connessione a Odoo...');
    await connect();
    console.log(`✅ Connesso! UID: ${uid}`);

    // Esegui gli step
    const analisi = await analizzaKonto1099();
    const kontoEquity = await trovaContoPatrimonioNetto();
    const registrazione = await creaRegistrazioneChiusura(
      analisi.account,
      kontoEquity,
      analisi.currentBalance
    );
    const verificaOk = await verificaSaldoFinale(analisi.account.id);

    // Genera documentazione
    const doc = generaDoc(analisi, kontoEquity, registrazione, verificaOk);
    console.log('\n' + doc);

    // Salva documentazione
    const docFile = `chiusura-konto-1099-${new Date().toISOString().split('T')[0]}.txt`;
    fs.writeFileSync(docFile, doc);
    console.log(`📄 Documentazione salvata in: ${docFile}\n`);

    // Riepilogo
    console.log('='.repeat(60));
    console.log('  ✅ AUTOMAZIONE COMPLETATA');
    console.log('='.repeat(60));
    console.log(`\n✅ Registrazione: ${registrazione.move.name}`);
    console.log(`✅ Importo chiuso: CHF ${Math.abs(analisi.currentBalance).toFixed(2)}`);
    console.log(`${verificaOk ? '✅' : '⚠️ '} Saldo finale: ${verificaOk ? 'CHF 0.00' : 'Da verificare'}`);

    if (registrazione.move.state === 'draft') {
      console.log(`\n⚠️  IMPORTANTE: Vai su Odoo e valida la registrazione ${registrazione.move.name}`);
    }

    console.log('');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  connect,
  analizzaKonto1099,
  trovaContoPatrimonioNetto,
  creaRegistrazioneChiusura,
  verificaSaldoFinale
};
