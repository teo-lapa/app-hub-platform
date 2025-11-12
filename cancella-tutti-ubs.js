const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
});

const UBS_CHF_JOURNAL_ID = 9;

console.log('🧹 CANCELLAZIONE TUTTI I MOVIMENTI UBS CHF...\n');

odoo.connect((err) => {
  if (err) {
    console.error('❌ Errore connessione:', err);
    return;
  }

  console.log('✅ Connesso a Odoo\n');

  // Cerca tutti i movimenti
  odoo.execute_kw(
    'account.bank.statement.line',
    'search',
    [[['journal_id', '=', UBS_CHF_JOURNAL_ID]]],
    (err, ids) => {
      if (err) {
        console.error('❌ Errore ricerca:', err);
        return;
      }

      console.log(`📊 Trovati ${ids.length} movimenti da cancellare\n`);

      if (ids.length === 0) {
        console.log('✨ Nessun movimento da cancellare!');
        return;
      }

      console.log('⚠️  ATTENZIONE: Verranno cancellati TUTTI i movimenti UBS CHF!');
      console.log('   Attendi 5 secondi...\n');

      setTimeout(() => {
        // Cancella tutti
        odoo.execute_kw(
          'account.bank.statement.line',
          'unlink',
          [ids],
          (err, result) => {
            if (err) {
              console.error('❌ Errore cancellazione:', err);
              return;
            }

            console.log(`\n✅ Cancellati ${ids.length} movimenti!`);
            process.exit(0);
          }
        );
      }, 5000);
    }
  );
});
