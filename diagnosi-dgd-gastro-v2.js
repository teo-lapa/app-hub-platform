/**
 * DIAGNOSI: Perché "DGD Gastro GmbH" non viene trovato dalla ricerca?
 *
 * Questo script:
 * 1. Cerca "DGD" con query semplice (solo nome)
 * 2. Mostra TUTTI i campi dei record trovati
 * 3. Prova filtri progressivi per capire quale blocca il risultato
 */

const Odoo = require('odoo-xmlrpc');
const fs = require('fs');

// Colori per output console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function logHeader(title) {
    console.log('\n' + '='.repeat(80));
    log(title, 'bright');
    console.log('='.repeat(80));
}

function logSubHeader(title) {
    console.log('\n' + '-'.repeat(80));
    log(title, 'cyan');
    console.log('-'.repeat(80));
}

// Configurazione Odoo
const odoo = new Odoo({
    url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
    db: 'lapadevadmin-lapa-v2-main-7268478',
    username: 'apphubplatform@lapa.ch',
    password: 'apphubplatform2025'
});

// Helper per chiamare Odoo in modo sincrono
function searchRead(domain, fields = [], limit = 100) {
    return new Promise((resolve, reject) => {
        odoo.execute_kw('res.partner', 'search_read', [[domain]], (err, value) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(value);
        });
    });
}

async function diagnoseSearch() {
    const risultati = {
        timestamp: new Date().toISOString(),
        ricerche: []
    };

    try {
        // Connetti a Odoo
        await new Promise((resolve, reject) => {
            odoo.connect((err, uid) => {
                if (err) {
                    reject(err);
                    return;
                }
                log(`✓ Connesso a Odoo staging (UID: ${uid})`, 'green');
                resolve(uid);
            });
        });

        // ============================================================================
        // TEST 1: Ricerca BASE - Solo nome "DGD"
        // ============================================================================
        logHeader('TEST 1: Ricerca BASE - Solo nome "DGD"');

        const domain1 = [['name', 'ilike', 'DGD']];
        log(`Domain: ${JSON.stringify(domain1)}`, 'yellow');

        const risultato1 = await searchRead(domain1);

        log(`\n✓ Trovati ${risultato1.length} record`, 'green');

        risultati.ricerche.push({
            test: 'TEST 1 - Ricerca BASE',
            domain: domain1,
            count: risultato1.length,
            records: risultato1
        });

        // Mostra TUTTI i campi dei record trovati
        if (risultato1.length > 0) {
            risultato1.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);

                // Mostra solo i campi più importanti in modo leggibile
                log(`  ID: ${record.id}`, 'cyan');
                log(`  Nome: ${record.name}`, 'cyan');
                log(`  customer_rank: ${record.customer_rank !== undefined ? record.customer_rank : 'NON DEFINITO'}`, 'yellow');
                log(`  is_company: ${record.is_company}`, 'yellow');
                log(`  type: ${record.type}`, 'yellow');
                log(`  active: ${record.active !== undefined ? record.active : 'NON DEFINITO'}`, 'yellow');
                log(`  parent_id: ${record.parent_id ? record.parent_id[1] : 'NULL'}`, 'yellow');
                log(`  team_id: ${record.team_id ? record.team_id[1] : 'NULL'}`, 'yellow');
                log(`  email: ${record.email || 'NULL'}`, 'cyan');
                log(`  phone: ${record.phone || 'NULL'}`, 'cyan');
                log(`  city: ${record.city || 'NULL'}`, 'cyan');
            });
        }

        // ============================================================================
        // TEST 2: Ricerca con customer_rank > 0
        // ============================================================================
        logHeader('TEST 2: Ricerca con customer_rank > 0');

        const domain2 = [
            ['name', 'ilike', 'DGD'],
            ['customer_rank', '>', 0]
        ];
        log(`Domain: ${JSON.stringify(domain2)}`, 'yellow');

        const risultato2 = await searchRead(domain2);

        log(`\n✓ Trovati ${risultato2.length} record`, risultato2.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 2 - customer_rank > 0',
            domain: domain2,
            count: risultato2.length,
            records: risultato2
        });

        if (risultato2.length > 0) {
            risultato2.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  customer_rank: ${record.customer_rank}`, 'yellow');
            });
        } else {
            log('\n⚠ FILTRO customer_rank > 0 BLOCCA I RISULTATI!', 'red');
        }

        // ============================================================================
        // TEST 3: Ricerca con is_company = true
        // ============================================================================
        logHeader('TEST 3: Ricerca con is_company = true');

        const domain3 = [
            ['name', 'ilike', 'DGD'],
            ['is_company', '=', true]
        ];
        log(`Domain: ${JSON.stringify(domain3)}`, 'yellow');

        const risultato3 = await searchRead(domain3);

        log(`\n✓ Trovati ${risultato3.length} record`, risultato3.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 3 - is_company = true',
            domain: domain3,
            count: risultato3.length,
            records: risultato3
        });

        if (risultato3.length > 0) {
            risultato3.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  is_company: ${record.is_company}`, 'yellow');
            });
        } else {
            log('\n⚠ FILTRO is_company = true BLOCCA I RISULTATI!', 'red');
        }

        // ============================================================================
        // TEST 4: Ricerca con type = 'contact'
        // ============================================================================
        logHeader('TEST 4: Ricerca con type = \'contact\'');

        const domain4 = [
            ['name', 'ilike', 'DGD'],
            ['type', '=', 'contact']
        ];
        log(`Domain: ${JSON.stringify(domain4)}`, 'yellow');

        const risultato4 = await searchRead(domain4);

        log(`\n✓ Trovati ${risultato4.length} record`, risultato4.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 4 - type = contact',
            domain: domain4,
            count: risultato4.length,
            records: risultato4
        });

        if (risultato4.length > 0) {
            risultato4.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  type: ${record.type}`, 'yellow');
            });
        } else {
            log('\n⚠ FILTRO type = contact BLOCCA I RISULTATI!', 'red');
        }

        // ============================================================================
        // TEST 5: Ricerca con active = true
        // ============================================================================
        logHeader('TEST 5: Ricerca con active = true');

        const domain5 = [
            ['name', 'ilike', 'DGD'],
            ['active', '=', true]
        ];
        log(`Domain: ${JSON.stringify(domain5)}`, 'yellow');

        const risultato5 = await searchRead(domain5);

        log(`\n✓ Trovati ${risultato5.length} record`, risultato5.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 5 - active = true',
            domain: domain5,
            count: risultato5.length,
            records: risultato5
        });

        if (risultato5.length > 0) {
            risultato5.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  active: ${record.active}`, 'yellow');
            });
        } else {
            log('\n⚠ FILTRO active = true BLOCCA I RISULTATI!', 'red');
        }

        // ============================================================================
        // TEST 6: Combinazione customer_rank > 0 E is_company = true
        // ============================================================================
        logHeader('TEST 6: Combinazione customer_rank > 0 E is_company = true');

        const domain6 = [
            ['name', 'ilike', 'DGD'],
            ['customer_rank', '>', 0],
            ['is_company', '=', true]
        ];
        log(`Domain: ${JSON.stringify(domain6)}`, 'yellow');

        const risultato6 = await searchRead(domain6);

        log(`\n✓ Trovati ${risultato6.length} record`, risultato6.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 6 - customer_rank > 0 AND is_company = true',
            domain: domain6,
            count: risultato6.length,
            records: risultato6
        });

        if (risultato6.length > 0) {
            risultato6.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  customer_rank: ${record.customer_rank}`, 'yellow');
                log(`  is_company: ${record.is_company}`, 'yellow');
            });
        } else {
            log('\n⚠ COMBINAZIONE customer_rank > 0 AND is_company = true BLOCCA I RISULTATI!', 'red');
        }

        // ============================================================================
        // TEST 7: Domain complesso della ricerca attuale
        // ============================================================================
        logHeader('TEST 7: Domain COMPLESSO della ricerca attuale (API route)');

        const domain7 = [
            ['customer_rank', '>', 0],
            '|',
                ['is_company', '=', true],
                '&',
                    ['is_company', '=', false],
                    ['type', '=', 'contact'],
            '|', '|', '|', '|',
            ['name', 'ilike', 'DGD'],
            ['email', 'ilike', 'DGD'],
            ['phone', 'ilike', 'DGD'],
            ['mobile', 'ilike', 'DGD'],
            ['city', 'ilike', 'DGD']
        ];
        log(`Domain: ${JSON.stringify(domain7, null, 2)}`, 'yellow');

        const risultato7 = await searchRead(domain7);

        log(`\n✓ Trovati ${risultato7.length} record`, risultato7.length > 0 ? 'green' : 'red');

        risultati.ricerche.push({
            test: 'TEST 7 - Domain COMPLESSO (API route)',
            domain: domain7,
            count: risultato7.length,
            records: risultato7
        });

        if (risultato7.length > 0) {
            risultato7.forEach((record, index) => {
                logSubHeader(`Record ${index + 1}: ${record.name} (ID: ${record.id})`);
                log(`  customer_rank: ${record.customer_rank}`, 'yellow');
                log(`  is_company: ${record.is_company}`, 'yellow');
                log(`  type: ${record.type}`, 'yellow');
            });
        } else {
            log('\n⚠ DOMAIN COMPLESSO NON TROVA "DGD Gastro GmbH"!', 'red');
        }

        // ============================================================================
        // ANALISI FINALE
        // ============================================================================
        logHeader('ANALISI FINALE');

        const record = risultato1.length > 0 ? risultato1[0] : null;

        if (record) {
            log('\n\nCampi critici:', 'yellow');
            console.log(`- customer_rank: ${record.customer_rank !== undefined ? record.customer_rank : 'NON DEFINITO'}`);
            console.log(`- is_company: ${record.is_company}`);
            console.log(`- type: ${record.type}`);
            console.log(`- active: ${record.active !== undefined ? record.active : 'NON DEFINITO'}`);
            console.log(`- parent_id: ${record.parent_id ? record.parent_id[1] : 'NULL'}`);
            console.log(`- team_id: ${record.team_id ? record.team_id[1] : 'NULL'}`);

            // Analisi dei blocchi
            log('\n\nFILTRI CHE BLOCCANO:', 'red');

            if (risultato2.length === 0) {
                log('✗ customer_rank > 0 → BLOCCA (customer_rank è probabilmente 0 o null)', 'red');
            } else {
                log('✓ customer_rank > 0 → OK', 'green');
            }

            if (risultato3.length === 0) {
                log('✗ is_company = true → BLOCCA (is_company è probabilmente false)', 'red');
            } else {
                log('✓ is_company = true → OK', 'green');
            }

            if (risultato4.length === 0) {
                log('✗ type = contact → BLOCCA (type è diverso da contact)', 'red');
            } else {
                log('✓ type = contact → OK', 'green');
            }

            if (risultato5.length === 0) {
                log('✗ active = true → BLOCCA (record disabilitato)', 'red');
            } else {
                log('✓ active = true → OK', 'green');
            }

            // Suggerimento query corretta
            log('\n\nQUERY CORRETTA per trovare "DGD Gastro GmbH":', 'green');

            const querySuggerita = [['name', 'ilike', 'DGD']];

            // Aggiungi customer_rank solo se > 0
            if (record.customer_rank && record.customer_rank > 0) {
                querySuggerita.push(['customer_rank', '>', 0]);
            }

            // Aggiungi is_company solo se true
            if (record.is_company === true) {
                querySuggerita.push(['is_company', '=', true]);
            }

            // Aggiungi type solo se non è contact
            if (record.type && record.type !== 'contact') {
                querySuggerita.push(['type', '=', record.type]);
            }

            console.log(JSON.stringify(querySuggerita, null, 2));

            risultati.query_corretta = querySuggerita;
            risultati.analisi = {
                customer_rank: record.customer_rank !== undefined ? record.customer_rank : null,
                is_company: record.is_company,
                type: record.type,
                active: record.active !== undefined ? record.active : null,
                parent_id: record.parent_id,
                team_id: record.team_id,
                blocchi: {
                    customer_rank_blocca: risultato2.length === 0,
                    is_company_blocca: risultato3.length === 0,
                    type_blocca: risultato4.length === 0,
                    active_blocca: risultato5.length === 0
                }
            };
        } else {
            log('\n⚠ NESSUN RECORD TROVATO con nome "DGD"!', 'red');
        }

        // Salva risultati in JSON
        const filename = 'DIAGNOSI_DGD_GASTRO.json';
        fs.writeFileSync(filename, JSON.stringify(risultati, null, 2));
        log(`\n\n✓ Risultati salvati in: ${filename}`, 'green');

    } catch (error) {
        console.error('Errore durante la diagnosi:', error);
        risultati.errore = error.message;
        fs.writeFileSync('DIAGNOSI_DGD_GASTRO_ERROR.json', JSON.stringify({ error: error.message, risultati }, null, 2));
    }

    return risultati;
}

// Esegui diagnosi
diagnoseSearch()
    .then(() => {
        console.log('\n\nDiagnosi completata!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Errore fatale:', error);
        process.exit(1);
    });
