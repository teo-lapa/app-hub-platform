const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'apphubplatform@lapa.ch',
  password: 'apphubplatform2025'
});

async function searchBufferLocations() {
  return new Promise((resolve, reject) => {
    odoo.connect(async function(err) {
      if (err) {
        console.error('Errore connessione:', err);
        return reject(err);
      }

      console.log('✓ Connesso a Odoo\n');

      try {
        // Cerca tutte le ubicazioni per trovare quelle simili a buffer
        console.log('=== CERCA TUTTE LE UBICAZIONI TIPO BUFFER ===\n');

        const allLocations = await new Promise((res, rej) => {
          odoo.execute_kw('stock.location', 'search_read', [[
            [['usage', '=', 'internal']],
            ['id', 'name', 'complete_name', 'location_id', 'usage', 'active']
          ]], (err, locations) => {
            if (err) return rej(err);
            res(locations || []);
          });
        });

        console.log(`Totale ubicazioni interne: ${allLocations.length}\n`);

        // Filtra quelle che contengono parole chiave buffer
        const bufferKeywords = ['sopra', 'frigo', 'pingu', 'buffer', 'staging', 'temp'];

        const bufferLocations = allLocations.filter(loc => {
          const namelow = loc.name.toLowerCase();
          const completelow = loc.complete_name.toLowerCase();
          return bufferKeywords.some(keyword =>
            namelow.includes(keyword) || completelow.includes(keyword)
          );
        });

        console.log('=== UBICAZIONI BUFFER TROVATE ===\n');
        console.log(`Trovate ${bufferLocations.length} ubicazioni:\n`);

        bufferLocations.forEach(loc => {
          console.log(`ID: ${loc.id}`);
          console.log(`  Nome: ${loc.name}`);
          console.log(`  Completo: ${loc.complete_name}`);
          console.log(`  Parent: ${loc.location_id ? loc.location_id[1] : 'N/A'}`);
          console.log(`  Usage: ${loc.usage}`);
          console.log(`  Active: ${loc.active}`);
          console.log();
        });

        // Cerca anche ubicazioni furgoni con nomi varianti
        console.log('\n=== CERCA UBICAZIONI FURGONI (tutte le varianti) ===\n');

        const vanKeywords = ['furgon', 'van', 'veicolo', 'auto', 'camion', 'truck', 'vehicle'];

        const vanLocations = allLocations.filter(loc => {
          const namelow = loc.name.toLowerCase();
          const completelow = loc.complete_name.toLowerCase();
          return vanKeywords.some(keyword =>
            namelow.includes(keyword) || completelow.includes(keyword)
          );
        });

        console.log(`Trovate ${vanLocations.length} ubicazioni furgoni:\n`);

        vanLocations.forEach(loc => {
          console.log(`ID: ${loc.id}`);
          console.log(`  Nome: ${loc.name}`);
          console.log(`  Completo: ${loc.complete_name}`);
          console.log(`  Parent: ${loc.location_id ? loc.location_id[1] : 'N/A'}`);
          console.log(`  Usage: ${loc.usage}`);
          console.log(`  Active: ${loc.active}`);
          console.log();
        });

        // Mostra anche top 20 ubicazioni interne più comuni
        console.log('\n=== TOP 20 UBICAZIONI INTERNE (per riferimento) ===\n');

        allLocations.slice(0, 20).forEach(loc => {
          console.log(`ID: ${loc.id} - ${loc.complete_name}`);
        });

        console.log('\n=== RIEPILOGO FINALE ===\n');
        console.log(`Ubicazioni buffer trovate: ${bufferLocations.length}`);
        console.log(`Ubicazioni furgoni trovate: ${vanLocations.length}`);
        console.log(`Totale ubicazioni interne: ${allLocations.length}`);

        resolve({ bufferLocations, vanLocations, allLocations });
      } catch (error) {
        reject(error);
      }
    });
  });
}

searchBufferLocations()
  .then(() => {
    console.log('\n✓ Ricerca completata');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Errore:', err);
    process.exit(1);
  });
