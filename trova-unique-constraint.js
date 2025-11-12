const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
});

console.log('🔍 RICERCA CAMPI UNIVOCI IN account.bank.statement.line...\n');

odoo.connect((err) => {
  if (err) {
    console.error('❌ Errore connessione:', err);
    return;
  }

  console.log('✅ Connesso a Odoo\n');

  // Leggi la definizione del modello
  odoo.execute_kw(
    'ir.model.fields',
    'search_read',
    [[['model', '=', 'account.bank.statement.line']]],
    { fields: ['name', 'field_description', 'ttype', 'required', 'help'] },
    (err, fields) => {
      if (err) {
        console.error('❌ Errore:', err);
        return;
      }

      console.log(`📊 Trovati ${fields.length} campi nel modello account.bank.statement.line\n`);

      console.log('CAMPI CHIAVE:\n');

      fields.forEach(field => {
        if (
          field.name.includes('ref') ||
          field.name.includes('unique') ||
          field.name.includes('transaction') ||
          field.name === 'name' ||
          field.name === 'id'
        ) {
          console.log(`• ${field.name} (${field.ttype})`);
          console.log(`  Descrizione: ${field.field_description}`);
          if (field.help) {
            console.log(`  Help: ${field.help.substring(0, 100)}...`);
          }
          console.log();
        }
      });

      // Ora prova a cercare constraint SQL
      console.log('\n🔍 Cerco constraint UNIQUE nel database...\n');

      odoo.execute_kw(
        'ir.model.constraint',
        'search_read',
        [[['model', '=', 'account.bank.statement.line']]],
        { fields: ['name', 'type', 'definition'] },
        (err, constraints) => {
          if (err) {
            console.error('❌ Errore ricerca constraint:', err);
            process.exit(1);
          }

          console.log(`📋 Trovati ${constraints.length} constraint:\n`);

          constraints.forEach(c => {
            console.log(`• ${c.name} (${c.type})`);
            if (c.definition) {
              console.log(`  ${c.definition}`);
            }
            console.log();
          });

          process.exit(0);
        }
      );
    }
  );
});
