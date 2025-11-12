/**
 * Trova altri clienti con customer_rank = 0 che potrebbero essere bloccati
 */

const Odoo = require('odoo-xmlrpc');
const fs = require('fs');

const odoo = new Odoo({
    url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
    db: 'lapadevadmin-lapa-v2-main-7268478',
    username: 'apphubplatform@lapa.ch',
    password: 'apphubplatform2025'
});

async function findBlockedClients() {
    try {
        // Connetti
        const uid = await new Promise((resolve, reject) => {
            odoo.connect((err, uid) => {
                if (err) reject(err);
                else resolve(uid);
            });
        });

        console.log(`✓ Connesso a Odoo (UID: ${uid})\n`);

        // Cerca TUTTI i clienti con customer_rank = 0 che sono aziende o contatti
        const domain = [
            ['customer_rank', '=', 0],  // customer_rank = 0
            '|',
                ['is_company', '=', true],   // Aziende
                '&',
                    ['is_company', '=', false],
                    ['type', '=', 'contact']  // Contatti (NO delivery/invoice)
        ];

        console.log('Cerco clienti con customer_rank = 0...\n');

        // Prima cerca gli ID
        const ids = await new Promise((resolve, reject) => {
            odoo.execute_kw('res.partner', 'search', [[domain]], (err, value) => {
                if (err) reject(err);
                else resolve(value);
            });
        });

        console.log(`Trovati ${ids.length} ID...`);

        // Poi leggi i dati (solo i primi 100 per evitare timeout)
        const idsToRead = ids.slice(0, 100);
        console.log(`Leggo i primi ${idsToRead.length} record...`);

        const results = await new Promise((resolve, reject) => {
            odoo.execute_kw('res.partner', 'read', [[idsToRead, ['id', 'name', 'email', 'city', 'is_company', 'type', 'team_id', 'customer_rank']]], (err, value) => {
                if (err) reject(err);
                else resolve(value);
            });
        });

        console.log(`\n✓ Trovati ${results.length} clienti con customer_rank = 0\n`);

        // Raggruppa per team
        const byTeam = {};

        results.forEach(client => {
            const teamName = client.team_id ? client.team_id[1] : 'Nessun team';

            if (!byTeam[teamName]) {
                byTeam[teamName] = [];
            }

            byTeam[teamName].push({
                id: client.id,
                name: client.name,
                email: client.email || 'N/A',
                city: client.city || 'N/A',
                is_company: client.is_company,
                type: client.type,
                team_id: client.team_id ? client.team_id[0] : null
            });
        });

        // Mostra risultati
        console.log('='.repeat(80));
        console.log('CLIENTI BLOCCATI DA customer_rank = 0 (raggruppati per team)');
        console.log('='.repeat(80));

        Object.entries(byTeam)
            .sort((a, b) => b[1].length - a[1].length)  // Ordina per numero di clienti
            .forEach(([team, clients]) => {
                console.log(`\n${team} (${clients.length} clienti):`);
                console.log('-'.repeat(80));

                clients.forEach(client => {
                    const type = client.is_company ? 'Azienda' : 'Contatto';
                    console.log(`  [${type}] ${client.name} (${client.city}) - ${client.email}`);
                });
            });

        // Statistiche
        console.log('\n\n' + '='.repeat(80));
        console.log('STATISTICHE');
        console.log('='.repeat(80));

        const aziende = results.filter(c => c.is_company);
        const contatti = results.filter(c => !c.is_company);

        console.log(`\n⚠ ATTENZIONE: Ci sono ${ids.length} clienti TOTALI bloccati da customer_rank = 0`);
        console.log(`\n(Analizzati solo i primi ${results.length} per performance)`);
        console.log(`\nTotale clienti bloccati (analizzati): ${results.length}`);
        console.log(`  - Aziende: ${aziende.length}`);
        console.log(`  - Contatti: ${contatti.length}`);
        console.log(`\nTeam con più clienti bloccati:`);

        Object.entries(byTeam)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 5)
            .forEach(([team, clients], index) => {
                console.log(`  ${index + 1}. ${team}: ${clients.length} clienti`);
            });

        // Salva JSON
        const report = {
            timestamp: new Date().toISOString(),
            total_ids_found: ids.length,
            total_analyzed: results.length,
            by_type: {
                aziende: aziende.length,
                contatti: contatti.length
            },
            by_team: byTeam,
            sample_clients: results
        };

        fs.writeFileSync('CLIENTI_BLOCCATI_customer_rank_0.json', JSON.stringify(report, null, 2));
        console.log(`\n✓ Report salvato in: CLIENTI_BLOCCATI_customer_rank_0.json`);

    } catch (error) {
        console.error('Errore:', error);
        process.exit(1);
    }
}

findBlockedClients()
    .then(() => {
        console.log('\n\nAnalisi completata!');
        process.exit(0);
    });
