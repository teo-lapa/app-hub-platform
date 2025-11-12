/**
 * DIAGNOSI: Perché "DGD Gastro GmbH" non viene trovato dalla ricerca?
 *
 * Questo script:
 * 1. Cerca "DGD" con query semplice (solo nome)
 * 2. Mostra TUTTI i campi dei record trovati
 * 3. Prova filtri progressivi per capire quale blocca il risultato
 */

const odoo = require('./odoo-staging-connect');
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

async function diagnoseSearch() {
    const risultati = {
        timestamp: new Date().toISOString(),
        ricerche: []
    };

    try {
        await odoo.connect();

        // ============================================================================
        // TEST 1: Ricerca BASE - Solo nome "DGD"
        // ============================================================================
        logHeader('TEST 1: Ricerca BASE - Solo nome "DGD"');

        const domain1 = [['name', 'ilike', 'DGD']];
        log(`Domain: ${JSON.stringify(domain1)}`, 'yellow');

        const risultato1 = await odoo.execute_kw('res.partner', 'search_read', [domain1], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato2 = await odoo.execute_kw('res.partner', 'search_read', [domain2], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato3 = await odoo.execute_kw('res.partner', 'search_read', [domain3], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato4 = await odoo.execute_kw('res.partner', 'search_read', [domain4], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato5 = await odoo.execute_kw('res.partner', 'search_read', [domain5], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato6 = await odoo.execute_kw('res.partner', 'search_read', [domain6], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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

        const risultato7 = await odoo.execute_kw('res.partner', 'search_read', [domain7], {
            limit: 100
        });

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
                console.log(JSON.stringify(record, null, 2));
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
            log('\nDati completi di "DGD Gastro GmbH":', 'cyan');
            console.log(JSON.stringify(record, null, 2));

            log('\n\nCampi critici:', 'yellow');
            console.log(`- customer_rank: ${record.customer_rank || 'NON DEFINITO'}`);
            console.log(`- is_company: ${record.is_company}`);
            console.log(`- type: ${record.type}`);
            console.log(`- active: ${record.active}`);
            console.log(`- parent_id: ${record.parent_id || 'NULL'}`);
            console.log(`- team_id: ${record.team_id || 'NULL'}`);

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
                customer_rank: record.customer_rank || 0,
                is_company: record.is_company,
                type: record.type,
                active: record.active,
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
