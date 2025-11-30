/**
 * AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO - V2
 *
 * Usa XML-RPC direttamente per evitare problemi di sessione
 *
 * @author Process Automator
 * @date 2025-11-15
 */

const Odoo = require('odoo-xmlrpc');

// ============================================================================
// CONFIGURAZIONE
// ============================================================================

const CONFIG = {
  url: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

const odoo = new Odoo({
  url: CONFIG.url,
  port: CONFIG.port,
  db: CONFIG.db,
  username: CONFIG.username,
  password: CONFIG.password
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Promisify Odoo connect
 */
function connect() {
  return new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promisify search_read
 */
function searchRead(model, domain, fields) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'search_read', [[domain]], { fields }, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

/**
 * Promisify create
 */
function create(model, data) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'create', [[data]], {}, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

/**
 * Promisify read
 */
function read(model, ids, fields) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'read', [[ids]], { fields }, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
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

  // Cerca i movimenti del 31.01.2024
  const moves = await searchRead(
    'account.move.line',
    [['account_id', '=', konto1099.id], ['date', '=', '2024-01-31']],
    ['id', 'date', 'name', 'debit', 'credit', 'balance', 'move_id', 'ref']
  );

  console.log(`\n📋 Movimenti del 31.01.2024: ${moves.length}`);
  console.log('-'.repeat(60));

  let totalDebit = 0;
  let totalCredit = 0;

  moves.forEach((line, idx) => {
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

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RIEPILOGO:`);
  console.log(`   Totale Dare: CHF ${totalDebit.toFixed(2)}`);
  console.log(`   Totale Avere: CHF ${totalCredit.toFixed(2)}`);
  console.log(`   Saldo Netto: CHF ${netBalance.toFixed(2)}`);
  console.log('='.repeat(60));

  return { account: konto1099, moves, totalDebit, totalCredit, netBalance };
}

// ============================================================================
// STEP 2: TROVA CONTO PATRIMONIO NETTO
// ============================================================================

async function trovaContoPatrimonioNetto() {
  console.log('\n💰 STEP 2: Identifica Conto Patrimonio Netto\n');
  console.log('='.repeat(60));

  // Cerca conti di tipo equity
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
    console.log(`   ${idx + 1}. [${acc.code}] ${acc.name} (${acc.account_type})`);
  });

  // Cerca specificamente "2979" o "2980" (Eröffnungsdifferenzen)
  let targetAccount = equityAccounts.find(a => a.code === '2979' || a.code === '2980');

  if (!targetAccount) {
    // Se non trovato, cerca per nome
    targetAccount = equityAccounts.find(a =>
      a.name.toLowerCase().includes('eröffnung') ||
      a.name.toLowerCase().includes('differenz') ||
      a.name.toLowerCase().includes('apertura')
    );
  }

  if (!targetAccount) {
    // Usa il primo equity disponibile
    targetAccount = equityAccounts[0];
  }

  console.log(`\n✅ Utilizzo conto:`);
  console.log(`   ID: ${targetAccount.id}`);
  console.log(`   Codice: ${targetAccount.code}`);
  console.log(`   Nome: ${targetAccount.name}`);
  console.log(`   Tipo: ${targetAccount.account_type}`);

  return targetAccount;
}

// ============================================================================
// STEP 3: CREA REGISTRAZIONE
// ============================================================================

async function creaRegistrazioneChiusura(konto1099, kontoEquity, netBalance) {
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

  const importo = Math.abs(netBalance);

  // Saldo negativo significa credito → Dare 1099, Avere Equity
  let line1099, lineEquity;

  if (netBalance < 0) {
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

  console.log(`\n📋 Registrazione:`);
  console.log(`   Data: ${new Date().toISOString().split('T')[0]}`);
  console.log(`   Importo: CHF ${importo.toFixed(2)}`);
  console.log(`\n   Riga 1: ${konto1099.code} - ${konto1099.name}`);
  console.log(`   Dare: CHF ${line1099.debit.toFixed(2)} | Avere: CHF ${line1099.credit.toFixed(2)}`);
  console.log(`\n   Riga 2: ${kontoEquity.code} - ${kontoEquity.name}`);
  console.log(`   Dare: CHF ${lineEquity.debit.toFixed(2)} | Avere: CHF ${lineEquity.credit.toFixed(2)}`);

  const moveData = {
    journal_id: journal.id,
    date: new Date().toISOString().split('T')[0],
    ref: 'Chiusura Konto 1099 Transferkonto',
    line_ids: [
      [0, 0, line1099],
      [0, 0, lineEquity]
    ]
  };

  console.log('\n⏳ Creazione registrazione in corso...');

  const moveId = await create('account.move', moveData);
  console.log(`✅ Registrazione creata: ID ${moveId}`);

  const move = await read('account.move', moveId, ['name', 'state', 'date', 'ref']);

  console.log(`\n📄 Dettagli:`);
  console.log(`   Numero: ${move[0].name}`);
  console.log(`   Stato: ${move[0].state}`);
  console.log(`   Data: ${move[0].date}`);

  return { moveId, move: move[0] };
}

// ============================================================================
// STEP 4: VERIFICA
// ============================================================================

async function verificaSaldoFinale(accountId) {
  console.log('\n✅ STEP 4: Verifica Saldo Finale\n');
  console.log('='.repeat(60));

  const accounts = await read('account.account', accountId, ['id', 'name', 'code', 'current_balance']);

  const account = accounts[0];
  const saldo = account.current_balance || 0;

  console.log(`\n📊 Conto: ${account.code} - ${account.name}`);
  console.log(`   Saldo Finale: CHF ${saldo.toFixed(2)}`);

  if (Math.abs(saldo) < 0.01) {
    console.log('\n🎉 SUCCESSO! Saldo = 0.00');
    return true;
  } else {
    console.log('\n⚠️  Saldo diverso da 0.00 - Validare la registrazione in Odoo');
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  AUTOMAZIONE CHIUSURA KONTO 1099 TRANSFERKONTO');
  console.log('='.repeat(60));

  try {
    // Connect
    console.log('\n🔐 Connessione a Odoo...');
    await connect();
    console.log('✅ Connesso!');

    // Esegui gli step
    const analisi = await analizzaKonto1099();
    const kontoEquity = await trovaContoPatrimonioNetto();
    const registrazione = await creaRegistrazioneChiusura(analisi.account, kontoEquity, analisi.netBalance);
    const verificaOk = await verificaSaldoFinale(analisi.account.id);

    // Riepilogo finale
    console.log('\n' + '='.repeat(60));
    console.log('  RIEPILOGO OPERAZIONE');
    console.log('='.repeat(60));
    console.log(`\n✅ Conto chiuso: ${analisi.account.code} - ${analisi.account.name}`);
    console.log(`✅ Importo: CHF ${Math.abs(analisi.netBalance).toFixed(2)}`);
    console.log(`✅ Su conto: ${kontoEquity.code} - ${kontoEquity.name}`);
    console.log(`✅ Registrazione: ${registrazione.move.name} (${registrazione.move.state})`);
    console.log(`${verificaOk ? '✅' : '⚠️ '} Saldo finale: ${verificaOk ? 'CHF 0.00' : 'Da verificare'}`);

    if (registrazione.move.state === 'draft') {
      console.log(`\n⚠️  IMPORTANTE: La registrazione è in stato DRAFT`);
      console.log(`   Vai su Odoo e valida la registrazione ${registrazione.move.name}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ AUTOMAZIONE COMPLETATA');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
