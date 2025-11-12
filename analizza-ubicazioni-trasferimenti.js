const Odoo = require('odoo-xmlrpc');

const odoo = new Odoo({
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'apphubplatform@lapa.ch',
  password: 'apphubplatform2025'
});

async function analyzeLocationsAndPickings() {
  return new Promise((resolve, reject) => {
    odoo.connect(async function(err) {
      if (err) {
        console.error('Errore connessione:', err);
        return reject(err);
      }

      console.log('✓ Connesso a Odoo\n');

      try {
        const results = {
          furgoniLocations: [],
          bufferLocations: [],
          internalPickings: [],
          pickingStructure: null
        };

        // 1. Cerca ubicazioni furgoni
        console.log('=== RICERCA UBICAZIONI FURGONI ===\n');

        const furgoniSearchTerms = [
          ['name', 'ilike', 'furgon'],
          ['name', 'ilike', 'van'],
          ['name', 'ilike', 'veicolo'],
          ['name', 'ilike', 'auto'],
          ['name', 'ilike', 'camion']
        ];

        for (const term of furgoniSearchTerms) {
          await new Promise((res, rej) => {
            odoo.execute_kw('stock.location', 'search_read', [[
              [term],
              ['id', 'name', 'complete_name', 'location_id', 'usage', 'company_id', 'active']
            ]], (err, locations) => {
              if (err) return rej(err);
              if (locations && locations.length > 0) {
                results.furgoniLocations.push(...locations);
              }
              res();
            });
          });
        }

        // Rimuovi duplicati
        const uniqueFurgoni = Array.from(new Map(
          results.furgoniLocations.map(item => [item.id, item])
        ).values());
        results.furgoniLocations = uniqueFurgoni;

        console.log(`Trovate ${results.furgoniLocations.length} ubicazioni furgoni:`);
        results.furgoniLocations.forEach(loc => {
          console.log(`  - ID: ${loc.id}, Nome: ${loc.name}, Complete: ${loc.complete_name}`);
          console.log(`    Parent: ${loc.location_id ? loc.location_id[1] : 'N/A'}, Usage: ${loc.usage}`);
        });
        console.log();

        // 2. Cerca ubicazioni buffer specifiche
        console.log('=== RICERCA UBICAZIONI BUFFER ===\n');

        await new Promise((res, rej) => {
          odoo.execute_kw('stock.location', 'search_read', [[
            ['|', '|',
            ['name', '=', 'Sopra'],
            ['name', '=', 'Frigo'],
            ['name', '=', 'Pingu']],
            ['id', 'name', 'complete_name', 'location_id', 'usage', 'company_id', 'active']
          ]], (err, locations) => {
            if (err) return rej(err);
            results.bufferLocations = locations || [];

            console.log(`Trovate ${results.bufferLocations.length} ubicazioni buffer:`);
            results.bufferLocations.forEach(loc => {
              console.log(`  - ID: ${loc.id}, Nome: ${loc.name}, Complete: ${loc.complete_name}`);
              console.log(`    Parent: ${loc.location_id ? loc.location_id[1] : 'N/A'}, Usage: ${loc.usage}`);
            });
            console.log();

            res();
          });
        });

        // 3. Cerca picking type per trasferimenti interni
        console.log('=== RICERCA PICKING TYPES INTERNI ===\n');

        const pickingTypes = await new Promise((res, rej) => {
          odoo.execute_kw('stock.picking.type', 'search_read', [[
            [['code', '=', 'internal']],
            ['id', 'name', 'code', 'sequence_code', 'default_location_src_id', 'default_location_dest_id', 'warehouse_id']
          ]], (err, types) => {
            if (err) return rej(err);
            console.log(`Trovati ${types?.length || 0} picking types interni:`);
            types?.forEach(pt => {
              console.log(`  - ID: ${pt.id}, Nome: ${pt.name}, Code: ${pt.code}`);
              console.log(`    Src: ${pt.default_location_src_id ? pt.default_location_src_id[1] : 'N/A'}`);
              console.log(`    Dest: ${pt.default_location_dest_id ? pt.default_location_dest_id[1] : 'N/A'}`);
            });
            console.log();
            res(types || []);
          });
        });

        // 4. Cerca esempi di picking interni esistenti
        console.log('=== RICERCA ESEMPI PICKING INTERNI ===\n');

        await new Promise((res, rej) => {
          odoo.execute_kw('stock.picking', 'search_read', [[
            [['picking_type_id.code', '=', 'internal']],
            [
              'id', 'name', 'picking_type_id', 'location_id', 'location_dest_id',
              'state', 'scheduled_date', 'date_done', 'origin', 'move_ids_without_package',
              'partner_id', 'user_id', 'company_id'
            ],
            0, 5  // offset, limit
          ]], (err, pickings) => {
            if (err) return rej(err);
            results.internalPickings = pickings || [];

            console.log(`Trovati ${results.internalPickings.length} esempi di picking interni:`);
            results.internalPickings.forEach(p => {
              console.log(`\n  Picking ID: ${p.id}, Name: ${p.name}, State: ${p.state}`);
              console.log(`    Type: ${p.picking_type_id ? p.picking_type_id[1] : 'N/A'}`);
              console.log(`    From: ${p.location_id ? p.location_id[1] : 'N/A'}`);
              console.log(`    To: ${p.location_dest_id ? p.location_dest_id[1] : 'N/A'}`);
              console.log(`    Moves: ${p.move_ids_without_package?.length || 0} linee`);
            });
            console.log();

            res();
          });
        });

        // 5. Ottieni dettagli di un picking per capire la struttura completa
        if (results.internalPickings.length > 0) {
          console.log('=== STRUTTURA DETTAGLIATA PRIMO PICKING ===\n');

          const firstPickingId = results.internalPickings[0].id;

          await new Promise((res, rej) => {
            odoo.execute_kw('stock.picking', 'read', [[[firstPickingId]]], (err, picking) => {
              if (err) return rej(err);
              results.pickingStructure = picking?.[0] || null;

              console.log('Struttura completa picking:');
              console.log(JSON.stringify(picking?.[0], null, 2));
              console.log();

              res();
            });
          });

          // Ottieni anche i dettagli delle move lines
          if (results.internalPickings[0].move_ids_without_package?.length > 0) {
            console.log('=== DETTAGLI STOCK MOVES ===\n');

            const moveIds = results.internalPickings[0].move_ids_without_package;

            await new Promise((res, rej) => {
              odoo.execute_kw('stock.move', 'read', [[moveIds, [
                'id', 'name', 'product_id', 'product_uom_qty', 'product_uom',
                'location_id', 'location_dest_id', 'state', 'picking_id',
                'date', 'date_deadline', 'move_line_ids'
              ]]], (err, moves) => {
                if (err) return rej(err);

                console.log(`Dettagli ${moves?.length || 0} stock moves:`);
                moves?.forEach(m => {
                  console.log(`\n  Move ID: ${m.id}`);
                  console.log(`    Product: ${m.product_id ? m.product_id[1] : 'N/A'}`);
                  console.log(`    Qty: ${m.product_uom_qty} ${m.product_uom ? m.product_uom[1] : ''}`);
                  console.log(`    From: ${m.location_id ? m.location_id[1] : 'N/A'}`);
                  console.log(`    To: ${m.location_dest_id ? m.location_dest_id[1] : 'N/A'}`);
                  console.log(`    State: ${m.state}`);
                });
                console.log();

                res();
              });
            });
          }
        }

        // 6. Ottieni i campi del modello per capire cosa è obbligatorio
        console.log('=== CAMPI MODELLO STOCK.PICKING ===\n');

        const pickingFields = await new Promise((res, rej) => {
          odoo.execute_kw('stock.picking', 'fields_get', [[], {
            attributes: ['string', 'help', 'type', 'required', 'readonly']
          }], (err, fields) => {
            if (err) return rej(err);

            console.log('Campi obbligatori per stock.picking:');
            Object.keys(fields).forEach(fieldName => {
              const field = fields[fieldName];
              if (field.required) {
                console.log(`  - ${fieldName}: ${field.string} (${field.type})`);
                if (field.help) console.log(`    Help: ${field.help}`);
              }
            });
            console.log();

            res(fields);
          });
        });

        // Stessa cosa per stock.move
        console.log('=== CAMPI MODELLO STOCK.MOVE ===\n');

        await new Promise((res, rej) => {
          odoo.execute_kw('stock.move', 'fields_get', [[], {
            attributes: ['string', 'help', 'type', 'required', 'readonly']
          }], (err, fields) => {
            if (err) return rej(err);

            console.log('Campi obbligatori per stock.move:');
            Object.keys(fields).forEach(fieldName => {
              const field = fields[fieldName];
              if (field.required) {
                console.log(`  - ${fieldName}: ${field.string} (${field.type})`);
                if (field.help) console.log(`    Help: ${field.help}`);
              }
            });
            console.log();

            res(fields);
          });
        });

        // 7. Genera esempio JSON per creare picking
        console.log('=== ESEMPIO JSON PER CREARE PICKING INTERNO ===\n');

        const examplePickingData = {
          picking_type_id: pickingTypes[0]?.id || 'ID_PICKING_TYPE_INTERNO',
          location_id: 'ID_LOCATION_SOURCE',  // es. ubicazione buffer
          location_dest_id: 'ID_LOCATION_DEST',  // es. ubicazione furgone
          scheduled_date: new Date().toISOString(),
          move_ids_without_package: [
            [0, 0, {  // [0, 0, {...}] = crea nuovo record
              name: 'Trasferimento prodotto',
              product_id: 'ID_PRODOTTO',
              product_uom_qty: 10,
              product_uom: 'ID_UOM',  // es. 1 per unità
              location_id: 'ID_LOCATION_SOURCE',
              location_dest_id: 'ID_LOCATION_DEST',
            }]
          ]
        };

        console.log('Struttura dati per create():');
        console.log(JSON.stringify(examplePickingData, null, 2));
        console.log();

        // Esempio con dati reali se disponibili
        if (pickingTypes.length > 0 && results.bufferLocations.length > 0 && results.furgoniLocations.length > 0) {
          const realExample = {
            picking_type_id: pickingTypes[0].id,
            location_id: results.bufferLocations[0].id,
            location_dest_id: results.furgoniLocations[0].id,
            scheduled_date: new Date().toISOString(),
            move_ids_without_package: [
              [0, 0, {
                name: `Trasferimento da ${results.bufferLocations[0].name} a ${results.furgoniLocations[0].name}`,
                product_id: 1,  // Sostituire con ID prodotto reale
                product_uom_qty: 5,
                product_uom: 1,  // Unità
                location_id: results.bufferLocations[0].id,
                location_dest_id: results.furgoniLocations[0].id,
              }]
            ]
          };

          console.log('\n=== ESEMPIO CON DATI REALI ===\n');
          console.log(JSON.stringify(realExample, null, 2));
          console.log();
        }

        // Summary finale
        console.log('\n=== RIEPILOGO ===\n');
        console.log(`Ubicazioni furgoni trovate: ${results.furgoniLocations.length}`);
        console.log(`Ubicazioni buffer trovate: ${results.bufferLocations.length}`);
        console.log(`Picking types interni: ${pickingTypes.length}`);
        console.log(`Esempi picking interni: ${results.internalPickings.length}`);

        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Esegui analisi
analyzeLocationsAndPickings()
  .then(() => {
    console.log('\n✓ Analisi completata');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Errore:', err);
    process.exit(1);
  });
