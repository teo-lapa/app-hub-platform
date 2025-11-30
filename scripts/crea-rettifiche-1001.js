/**
 * CREAZIONE REGISTRAZIONI DI RETTIFICA - CONTO 1001 CASH
 *
 * Questo script prepara (ma NON esegue automaticamente) le registrazioni
 * di rettifica necessarie per correggere il saldo del conto Cash.
 *
 * IMPORTANTE: Le rettifiche devono essere APPROVATE dal commercialista
 * prima dell'esecuzione!
 */

const Odoo = require('odoo-xmlrpc');
const fs = require('fs');

// Configurazione Odoo
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

async function create(model, values) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'create', [[values]], (err, id) => {
      if (err) reject(err);
      else resolve(id);
    });
  });
}

async function write(model, ids, values) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'write', [[ids, values]], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function unlink(model, ids) {
  return new Promise((resolve, reject) => {
    odoo.execute_kw(model, 'unlink', [[ids]], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function getAccounts() {
  console.log('\n📋 Ricerca conti necessari...');

  // Conto 1001 Cash
  const cash = await searchRead('account.account', [['code', '=', '1001']], ['id', 'code', 'name']);
  if (cash.length === 0) throw new Error('Conto 1001 non trovato');

  // Conto di contropartita (es. 3900 - Ricavi/perdite straordinarie o simile)
  // NOTA: Questo va confermato con il commercialista!
  const controlAccounts = await searchRead('account.account', [
    ['code', 'in', ['3900', '6900', '8900']]
  ], ['id', 'code', 'name']);

  console.log(`✅ Conto Cash: ${cash[0].code} - ${cash[0].name}`);
  console.log(`✅ Conti contropartita disponibili:`);
  controlAccounts.forEach(acc => {
    console.log(`   - ${acc.code}: ${acc.name}`);
  });

  return {
    cash: cash[0],
    control: controlAccounts.length > 0 ? controlAccounts[0] : null
  };
}

async function getJournal() {
  console.log('\n📖 Ricerca giornale per rettifiche...');

  // Cerca giornale "Miscellaneous Operations" o simile
  const journals = await searchRead('account.journal', [
    '|',
    ['name', 'ilike', 'Miscellaneous'],
    ['name', 'ilike', 'Rettifiche']
  ], ['id', 'name', 'code']);

  if (journals.length === 0) {
    throw new Error('Nessun giornale di rettifica trovato');
  }

  console.log(`✅ Giornale trovato: ${journals[0].name} (${journals[0].code})`);
  return journals[0];
}

async function prepareRettifiche() {
  console.log('\n🔧 PREPARAZIONE REGISTRAZIONI DI RETTIFICA');
  console.log('═'.repeat(80));

  const accounts = await getAccounts();
  const journal = await getJournal();

  if (!accounts.control) {
    console.log('\n⚠️  ATTENZIONE: Nessun conto di contropartita trovato!');
    console.log('   Sarà necessario specificare manualmente il conto di contropartita.');
    return;
  }

  const rettifiche = [
    {
      descrizione: 'Storno Rettifica Cash 31.12.2023',
      data: '2025-11-15',
      importo: 87884.43,
      movimentoOrigine: 525905,
      giustificazione: 'Storno rettifica manuale non documentata del 31.12.2023',
      tipo: 'STORNO_RETTIFICA_2023'
    },
    {
      descrizione: 'Storno Rettifica Cash 31.01.2024',
      data: '2025-11-15',
      importo: 86405.83,
      movimentoOrigine: 525812,
      giustificazione: 'Storno rettifica manuale non documentata del 31.01.2024',
      tipo: 'STORNO_RETTIFICA_2024'
    },
    {
      descrizione: 'Storno duplicato deposito Nuraghets 01.10.2025',
      data: '2025-11-15',
      importo: 400.00,
      movimentoOrigine: 522654, // Uno dei due duplicati
      giustificazione: 'Eliminazione movimento duplicato',
      tipo: 'STORNO_DUPLICATO'
    },
    {
      descrizione: 'Storno duplicato ordine DL Services 13.02.2024',
      data: '2025-11-15',
      importo: 174.25,
      movimentoOrigine: 234762,
      giustificazione: 'Eliminazione movimento duplicato',
      tipo: 'STORNO_DUPLICATO'
    },
    {
      descrizione: 'Storno duplicato ordine Emma\'s Cafe 13.01.2024',
      data: '2025-11-15',
      importo: 209.47,
      movimentoOrigine: 115978,
      giustificazione: 'Eliminazione movimento duplicato',
      tipo: 'STORNO_DUPLICATO'
    }
  ];

  console.log('\n📝 RETTIFICHE DA CREARE:');
  console.log('═'.repeat(80));

  let totalRettifiche = 0;

  const rettifichePreparate = rettifiche.map((rett, idx) => {
    console.log(`\n${idx + 1}. ${rett.descrizione}`);
    console.log(`   Data:          ${rett.data}`);
    console.log(`   Importo:       ${formatCHF(rett.importo)}`);
    console.log(`   Movimento orig: ${rett.movimentoOrigine}`);
    console.log(`   Giustificazione: ${rett.giustificazione}`);

    totalRettifiche += rett.importo;

    return {
      journal_id: journal.id,
      date: rett.data,
      ref: `RETTIFICA_1001_${rett.tipo}_${idx + 1}`,
      line_ids: [
        // Riga 1: Dare sul conto di contropartita
        [0, 0, {
          account_id: accounts.control.id,
          name: rett.descrizione,
          debit: rett.importo,
          credit: 0
        }],
        // Riga 2: Avere sul conto Cash (riduce il saldo)
        [0, 0, {
          account_id: accounts.cash.id,
          name: rett.descrizione,
          debit: 0,
          credit: rett.importo
        }]
      ]
    };
  });

  console.log(`\n═`.repeat(80));
  console.log(`   TOTALE RETTIFICHE: ${formatCHF(totalRettifiche)}`);

  // Salva le rettifiche preparate in un file JSON
  const outputPath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\RETTIFICHE_1001_PREPARATE.json';

  const output = {
    dataPreparazione: new Date().toISOString(),
    conti: {
      cash: accounts.cash,
      contropartita: accounts.control
    },
    giornale: journal,
    rettifiche: rettifiche,
    registrazioniOdoo: rettifichePreparate,
    riepilogo: {
      numeroRettifiche: rettifiche.length,
      importoTotale: totalRettifiche,
      saldoAttualeStimato: 386336.67,
      saldoDopoRettifiche: 386336.67 - totalRettifiche
    },
    istruzioni: [
      'IMPORTANTE: Queste rettifiche devono essere APPROVATE dal commercialista',
      'NON eseguire automaticamente senza approvazione',
      'Verificare che il conto di contropartita sia corretto',
      'Verificare le date delle rettifiche',
      'Dopo approvazione, utilizzare la funzione executeRettifiche()'
    ]
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Rettifiche preparate e salvate in: ${outputPath}`);

  return output;
}

async function executeRettifiche() {
  console.log('\n⚠️  ESECUZIONE RETTIFICHE');
  console.log('═'.repeat(80));
  console.log('ATTENZIONE: Questa funzione creerà realmente le registrazioni contabili!');
  console.log('Assicurarsi di avere l\'approvazione del commercialista prima di procedere.');

  // Carica le rettifiche preparate
  const rettifichePath = 'C:\\Users\\lapa\\Desktop\\Claude Code\\app-hub-platform\\RETTIFICHE_1001_PREPARATE.json';

  if (!fs.existsSync(rettifichePath)) {
    throw new Error('File rettifiche non trovato. Eseguire prima prepareRettifiche()');
  }

  const rettificheData = JSON.parse(fs.readFileSync(rettifichePath, 'utf8'));

  console.log(`\nCaricate ${rettificheData.registrazioniOdoo.length} rettifiche da eseguire`);
  console.log(`Importo totale: ${formatCHF(rettificheData.riepilogo.importoTotale)}`);

  // MODALITÀ SICURA: Chiedi conferma
  console.log('\n⚠️  Per sicurezza, questa funzione è disabilitata in modalità automatica.');
  console.log('   Per eseguire le rettifiche:');
  console.log('   1. Verificare il file RETTIFICHE_1001_PREPARATE.json');
  console.log('   2. Ottenere approvazione dal commercialista');
  console.log('   3. Decommentare il codice di esecuzione nello script');
  console.log('   4. Eseguire manualmente');

  /*
  // DECOMMENTARE SOLO DOPO APPROVAZIONE DEL COMMERCIALISTA!
  const createdMoves = [];

  for (let i = 0; i < rettificheData.registrazioniOdoo.length; i++) {
    const rett = rettificheData.registrazioniOdoo[i];
    console.log(`\n${i + 1}. Creazione: ${rett.ref}...`);

    try {
      const moveId = await create('account.move', rett);
      console.log(`   ✅ Creata registrazione ID: ${moveId}`);
      createdMoves.push(moveId);
    } catch (error) {
      console.error(`   ❌ Errore: ${error.message}`);
      throw error;
    }
  }

  console.log(`\n✅ Tutte le rettifiche sono state create!`);
  console.log(`   IDs creati: ${createdMoves.join(', ')}`);

  return createdMoves;
  */
}

// MODALITÀ INTERATTIVA
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'prepare';

  try {
    console.log('🏗️  ODOO DATA MODELER - Registrazioni Rettifica Conto 1001');
    console.log('═'.repeat(80));

    await connect();
    console.log('✅ Connesso a Odoo\n');

    if (mode === 'prepare') {
      await prepareRettifiche();
    } else if (mode === 'execute') {
      await executeRettifiche();
    } else {
      console.log('❌ Modalità non valida. Usa: prepare | execute');
    }

    console.log('\n✅ OPERAZIONE COMPLETATA');

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
