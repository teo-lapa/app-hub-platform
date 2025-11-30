/**
 * VERIFICA PRE-RETTIFICA CONTO 1001 CASH
 *
 * Script di validazione da eseguire PRIMA di applicare le rettifiche
 * per assicurarsi che i dati siano ancora consistenti
 */

const Odoo = require('odoo-xmlrpc');
const fs = require('fs');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
});

const formatCHF = (amount) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount);
};

async function connect() {
  return new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) reject(err);
      else resolve();
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

async function verificaMovimentiOriginali() {
  console.log('\n🔍 VERIFICA MOVIMENTI ORIGINALI DA STORNARE');
  console.log('═'.repeat(80));

  // IDs dei movimenti da verificare
  const movimentiDaVerificare = [
    { id: 525905, descrizione: 'Rettifica 31.12.2023', importoAtteso: 87884.43 },
    { id: 525812, descrizione: 'Rettifica 31.01.2024', importoAtteso: 86405.83 },
    { id: 522654, descrizione: 'Duplicato Nuraghets', importoAtteso: 400.00 },
    { id: 234762, descrizione: 'Duplicato DL Services', importoAtteso: 174.25 },
    { id: 115978, descrizione: 'Duplicato Emma\'s Cafe', importoAtteso: 209.47 }
  ];

  console.log('\nVerifica esistenza movimenti:');

  let tuttiPresenti = true;

  for (const mov of movimentiDaVerificare) {
    const result = await searchRead('account.move.line', [
      ['id', '=', mov.id]
    ], ['id', 'date', 'name', 'debit', 'credit', 'move_id']);

    if (result.length === 0) {
      console.log(`❌ Movimento ${mov.id} (${mov.descrizione}) NON TROVATO!`);
      tuttiPresenti = false;
    } else {
      const line = result[0];
      const importoTrovato = line.debit || line.credit;
      const match = Math.abs(importoTrovato - mov.importoAtteso) < 0.01;

      console.log(`${match ? '✅' : '⚠️ '} ID ${mov.id}: ${mov.descrizione}`);
      console.log(`   Data: ${line.date}, Importo: ${formatCHF(importoTrovato)} ${match ? '' : `(atteso: ${formatCHF(mov.importoAtteso)})`}`);

      if (!match) {
        console.log(`   ⚠️  IMPORTO NON CORRISPONDE!`);
      }
    }
  }

  if (!tuttiPresenti) {
    console.log('\n⚠️  ATTENZIONE: Non tutti i movimenti sono stati trovati!');
    console.log('   Verificare che il database non sia cambiato dall\'analisi.');
  }

  return tuttiPresenti;
}

async function verificaSaldoAttuale() {
  console.log('\n\n💰 VERIFICA SALDO ATTUALE');
  console.log('═'.repeat(80));

  const account = await searchRead('account.account', [
    ['code', '=', '1001']
  ], ['id', 'code', 'name', 'current_balance']);

  if (account.length === 0) {
    throw new Error('Conto 1001 non trovato!');
  }

  const saldoAttuale = account[0].current_balance;
  const saldoAttesoAnalisi = 386336.67;
  const differenza = Math.abs(saldoAttuale - saldoAttesoAnalisi);

  console.log(`Saldo attuale Odoo:  ${formatCHF(saldoAttuale)}`);
  console.log(`Saldo analisi:       ${formatCHF(saldoAttesoAnalisi)}`);
  console.log(`Differenza:          ${formatCHF(differenza)}`);

  if (differenza > 0.01) {
    console.log('\n⚠️  ATTENZIONE: Il saldo è cambiato dall\'analisi!');
    console.log('   Potrebbe essere necessario rifare l\'analisi.');
    return false;
  } else {
    console.log('\n✅ Saldo coerente con l\'analisi.');
    return true;
  }
}

async function verificaContiDestinazione() {
  console.log('\n\n📋 VERIFICA CONTI DI DESTINAZIONE');
  console.log('═'.repeat(80));

  const rettifiche = JSON.parse(fs.readFileSync('C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\RETTIFICHE_1001_PREPARATE.json', 'utf8'));

  const accountId = rettifiche.conti.contropartita.id;

  const account = await searchRead('account.account', [
    ['id', '=', accountId]
  ], ['id', 'code', 'name', 'reconcile']);

  if (account.length === 0) {
    console.log('❌ Conto di contropartita non trovato!');
    return false;
  }

  console.log(`✅ Conto contropartita: ${account[0].code} - ${account[0].name}`);

  return true;
}

async function verificaGiornale() {
  console.log('\n\n📖 VERIFICA GIORNALE');
  console.log('═'.repeat(80));

  const rettifiche = JSON.parse(fs.readFileSync('C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\RETTIFICHE_1001_PREPARATE.json', 'utf8'));

  const journalId = rettifiche.giornale.id;

  const journal = await searchRead('account.journal', [
    ['id', '=', journalId]
  ], ['id', 'name', 'code', 'type']);

  if (journal.length === 0) {
    console.log('❌ Giornale non trovato!');
    return false;
  }

  console.log(`✅ Giornale: ${journal[0].name} (${journal[0].code})`);
  console.log(`   Tipo: ${journal[0].type}`);

  return true;
}

async function calcolaSaldoDopoRettifiche() {
  console.log('\n\n🎯 SIMULAZIONE SALDO POST-RETTIFICHE');
  console.log('═'.repeat(80));

  const account = await searchRead('account.account', [
    ['code', '=', '1001']
  ], ['id', 'current_balance']);

  const saldoAttuale = account[0].current_balance;
  const rettifiche = JSON.parse(fs.readFileSync('C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\RETTIFICHE_1001_PREPARATE.json', 'utf8'));
  const totalRettifiche = rettifiche.riepilogo.importoTotale;
  const saldoDopoRettifiche = saldoAttuale - totalRettifiche;

  console.log(`Saldo attuale:          ${formatCHF(saldoAttuale)}`);
  console.log(`Totale rettifiche:      ${formatCHF(-totalRettifiche)}`);
  console.log(`─────────────────────────────────────────`);
  console.log(`SALDO PREVISTO:         ${formatCHF(saldoDopoRettifiche)}`);

  if (saldoDopoRettifiche < 0) {
    console.log('\n⚠️  ATTENZIONE: Il saldo risulterebbe NEGATIVO!');
    console.log('   Verificare le rettifiche prima di procedere.');
    return false;
  }

  if (saldoDopoRettifiche > 300000) {
    console.log('\n⚠️  ATTENZIONE: Il saldo risulterebbe ancora molto alto!');
    console.log('   Potrebbero esserci altri errori non identificati.');
  }

  if (saldoDopoRettifiche >= 50000 && saldoDopoRettifiche <= 250000) {
    console.log('\n✅ Saldo previsto sembra ragionevole per un conto Cash aziendale.');
  }

  return true;
}

async function generaChecklistCommercialista() {
  console.log('\n\n📝 CHECKLIST PER COMMERCIALISTA');
  console.log('═'.repeat(80));

  const checklist = [
    {
      punto: 'Verificare esistenza documenti giustificativi per rettifica 31.12.2023 (CHF 87,884.43)',
      status: '[ ]'
    },
    {
      punto: 'Verificare esistenza documenti giustificativi per rettifica 31.01.2024 (CHF 86,405.83)',
      status: '[ ]'
    },
    {
      punto: 'Confermare che il conto 3900 è corretto come contropartita',
      status: '[ ]'
    },
    {
      punto: 'Verificare manualmente i 3 movimenti duplicati',
      status: '[ ]'
    },
    {
      punto: 'Approvare il saldo finale previsto di CHF 211,262.69',
      status: '[ ]'
    },
    {
      punto: 'Firmare autorizzazione scritta per esecuzione rettifiche',
      status: '[ ]'
    }
  ];

  console.log('\nPRIMA DI PROCEDERE CON LE RETTIFICHE:\n');

  checklist.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.status} ${item.punto}`);
  });

  console.log('\n⚠️  Tutte le voci devono essere [X] prima di procedere!');

  // Salva checklist
  const checklistPath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\CHECKLIST_COMMERCIALISTA_1001.txt';
  const checklistText = checklist.map((item, idx) => `${idx + 1}. ${item.status} ${item.punto}`).join('\n');
  fs.writeFileSync(checklistPath, `CHECKLIST APPROVAZIONE RETTIFICHE CONTO 1001 CASH\n\nData: ${new Date().toLocaleDateString('de-CH')}\n\n${checklistText}\n\n\nFirma Commercialista: _______________________\nData: _______________\n`);

  console.log(`\n✅ Checklist salvata: ${checklistPath}`);
}

async function main() {
  try {
    console.log('🏗️  VERIFICA PRE-RETTIFICA CONTO 1001 CASH');
    console.log('═'.repeat(80));

    await connect();
    console.log('✅ Connesso a Odoo\n');

    const checks = {
      movimenti: await verificaMovimentiOriginali(),
      saldo: await verificaSaldoAttuale(),
      conti: await verificaContiDestinazione(),
      giornale: await verificaGiornale(),
      simulazione: await calcolaSaldoDopoRettifiche()
    };

    await generaChecklistCommercialista();

    console.log('\n\n📊 RISULTATO VERIFICA');
    console.log('═'.repeat(80));

    const allOk = Object.values(checks).every(v => v === true);

    console.log(`\nMovimenti originali:     ${checks.movimenti ? '✅' : '❌'}`);
    console.log(`Saldo attuale:           ${checks.saldo ? '✅' : '❌'}`);
    console.log(`Conti destinazione:      ${checks.conti ? '✅' : '❌'}`);
    console.log(`Giornale:                ${checks.giornale ? '✅' : '❌'}`);
    console.log(`Simulazione saldo:       ${checks.simulazione ? '✅' : '❌'}`);

    if (allOk) {
      console.log('\n✅ TUTTE LE VERIFICHE SONO OK!');
      console.log('\nProssimi passi:');
      console.log('1. Far compilare la checklist al commercialista');
      console.log('2. Ottenere approvazione scritta');
      console.log('3. Eseguire: node scripts/crea-rettifiche-1001.js execute');
    } else {
      console.log('\n⚠️  ALCUNE VERIFICHE HANNO FALLITO!');
      console.log('   NON procedere con le rettifiche.');
      console.log('   Rivedere l\'analisi o i dati in Odoo.');
    }

    console.log('\n✅ VERIFICA COMPLETATA');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
