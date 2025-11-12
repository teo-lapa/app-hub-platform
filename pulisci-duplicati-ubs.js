const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
});

const UBS_CHF_JOURNAL_ID = 9;

async function pulisciDuplicati() {
  console.log('🧹 PULIZIA DUPLICATI UBS CHF JOURNAL...\n');

  // Connetti a Odoo
  await new Promise((resolve, reject) => {
    odoo.connect((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log('✅ Connesso a Odoo\n');

  // 1. Cerca tutti i movimenti del giornale UBS CHF
  const allMovements = await new Promise((resolve, reject) => {
    odoo.execute_kw(
      'account.bank.statement.line',
      'search_read',
      [[['journal_id', '=', UBS_CHF_JOURNAL_ID]]],
      { fields: ['id', 'date', 'amount', 'payment_ref', 'partner_name'] },
      (err, value) => {
        if (err) {
          console.error('Errore search_read:', err);
          reject(err);
        } else {
          resolve(value);
        }
      }
    );
  });

  console.log(`📊 Trovati ${allMovements.length} movimenti totali nel giornale UBS CHF\n`);

  // 2. Trova duplicati (stessa data + stesso importo)
  const duplicateMap = new Map();
  const toDelete = [];

  for (const mov of allMovements) {
    const key = `${mov.date}_${mov.amount}`;

    if (duplicateMap.has(key)) {
      // Questo è un duplicato - tieni il primo (ID più basso), cancella gli altri
      toDelete.push(mov);
      console.log(`🔴 DUPLICATO: ${mov.date} - ${mov.amount} CHF - "${mov.payment_ref?.substring(0, 50)}" (ID: ${mov.id})`);
    } else {
      duplicateMap.set(key, mov);
      console.log(`✅ ORIGINALE: ${mov.date} - ${mov.amount} CHF - "${mov.payment_ref?.substring(0, 50)}" (ID: ${mov.id})`);
    }
  }

  console.log(`\n📋 RIEPILOGO:`);
  console.log(`   • Movimenti originali: ${duplicateMap.size}`);
  console.log(`   • Duplicati trovati: ${toDelete.length}\n`);

  if (toDelete.length === 0) {
    console.log('✨ Nessun duplicato da cancellare!');
    return;
  }

  // 3. Chiedi conferma
  console.log(`⚠️  ATTENZIONE: Verranno cancellati ${toDelete.length} movimenti duplicati.`);
  console.log(`   Premi CTRL+C per annullare, oppure attendi 5 secondi per procedere...\n`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 4. Cancella i duplicati
  console.log('🗑️  Cancellazione in corso...\n');

  for (const mov of toDelete) {
    try {
      await new Promise((resolve, reject) => {
        odoo.execute_kw(
          'account.bank.statement.line',
          'unlink',
          [[mov.id]],
          (err, value) => {
            if (err) reject(err);
            else resolve(value);
          }
        );
      });
      console.log(`   ✅ Cancellato: ID ${mov.id} - ${mov.date} - ${mov.amount} CHF`);
    } catch (error) {
      console.error(`   ❌ Errore cancellazione ID ${mov.id}:`, error.message);
    }
  }

  console.log(`\n✨ PULIZIA COMPLETATA!`);
  console.log(`   • Movimenti cancellati: ${toDelete.length}`);
  console.log(`   • Movimenti rimanenti: ${duplicateMap.size}`);
}

pulisciDuplicati().catch(console.error);
