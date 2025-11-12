import Odoo from 'odoo-xmlrpc';
import fs from 'fs';
import https from 'https';

// Disabilita controllo certificato SSL per ambiente staging
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Configurazione connessione Odoo
const odoo = new Odoo({
    url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
    port: 443,
    db: 'lapadevadmin-lapa-v2-main-7268478',
    username: 'apphubplatform@lapa.ch',
    password: 'apphubplatform2025'
});

// Lista venditori (nomi corretti da Odoo)
const VENDITORI = [
    'Mihai Nita',
    'Gregorio Buccolieri',
    'Alessandro Motta',
    'Domingos Ferreira'
];

// Date per analisi
const oggi = new Date();
const inizioAnno = new Date(oggi.getFullYear(), 0, 1);
const inizioMeseCorrente = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
const inizioMeseScorso = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
const fineMeseScorso = new Date(oggi.getFullYear(), oggi.getMonth(), 0);
const tresMesiFa = new Date(oggi.getFullYear(), oggi.getMonth() - 3, 1);

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatEuro(value) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatPercent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

async function connect() {
    return new Promise((resolve, reject) => {
        odoo.connect((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function searchRead(model, domain, fields, options = {}) {
    return new Promise((resolve, reject) => {
        const params = [[domain], { fields, ...options }];
        odoo.execute_kw(model, 'search_read', params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

async function search(model, domain) {
    return new Promise((resolve, reject) => {
        odoo.execute_kw(model, 'search', [domain], (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

async function trovaVenditoreETeam(nomeVenditore) {
    console.log(`🔍 Cerco venditore: ${nomeVenditore}`);

    const users = await searchRead('res.users', [
        ['name', 'ilike', nomeVenditore]
    ], ['id', 'name']);

    if (users.length === 0) {
        console.log(`⚠️  Venditore non trovato: ${nomeVenditore}`);
        return null;
    }

    const venditore = users[0];
    console.log(`✅ Trovato: ${venditore.name} (ID: ${venditore.id})`);

    // Cerca il team di vendita dove il venditore è leader (user_id)
    let teams = await searchRead('crm.team', [
        ['user_id', '=', venditore.id]
    ], ['id', 'name', 'member_ids']);

    // Se non è leader, cerca dove è membro
    if (teams.length === 0) {
        teams = await searchRead('crm.team', [
            ['member_ids', 'in', [venditore.id]]
        ], ['id', 'name', 'member_ids', 'user_id']);
    }

    if (teams.length === 0) {
        console.log(`⚠️  Nessun team trovato per ${venditore.name}`);
        return { venditore, team: null };
    }

    const team = teams[0];
    console.log(`✅ Team trovato: ${team.name} (ID: ${team.id})`);

    return { venditore, team };
}

async function analizzaVendite(teamId, periodo) {
    const { nome, dataInizio, dataFine } = periodo;

    const ordini = await searchRead('sale.order', [
        ['team_id', '=', teamId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', dataInizio],
        ['date_order', '<=', dataFine]
    ], ['name', 'partner_id', 'date_order', 'amount_total', 'state']);

    const totale = ordini.reduce((sum, ord) => sum + (ord.amount_total || 0), 0);

    return {
        periodo: nome,
        numeroOrdini: ordini.length,
        totaleVenduto: totale,
        mediaOrdine: ordini.length > 0 ? totale / ordini.length : 0,
        ordini: ordini
    };
}

async function analizzaClientiNuovi(teamId) {
    // Clienti acquisiti quest'anno
    const clientiAnno = await searchRead('res.partner', [
        ['team_id', '=', teamId],
        ['customer_rank', '>', 0],
        ['create_date', '>=', formatDate(inizioAnno)]
    ], ['name', 'create_date', 'email', 'phone']);

    // Clienti acquisiti ultimi 3 mesi
    const clientiRecenti = await searchRead('res.partner', [
        ['team_id', '=', teamId],
        ['customer_rank', '>', 0],
        ['create_date', '>=', formatDate(tresMesiFa)]
    ], ['name', 'create_date', 'email', 'phone']);

    return {
        nuoviAnno: clientiAnno.length,
        nuoviUltimi3Mesi: clientiRecenti.length,
        dettaglio: clientiRecenti.map(c => ({
            nome: c.name,
            dataAcquisizione: c.create_date,
            contatti: {
                email: c.email || 'N/A',
                telefono: c.phone || 'N/A'
            }
        }))
    };
}

async function analizzaTopProdotti(teamId) {
    // Prendo tutte le righe ordine del team (quest'anno)
    const righeOrdine = await searchRead('sale.order.line', [
        ['order_id.team_id', '=', teamId],
        ['order_id.state', 'in', ['sale', 'done']],
        ['order_id.date_order', '>=', formatDate(inizioAnno)]
    ], ['product_id', 'product_uom_qty', 'price_subtotal']);

    // Aggregazione per prodotto
    const prodottiMap = {};
    for (const riga of righeOrdine) {
        const prodId = riga.product_id[0];
        const prodNome = riga.product_id[1];

        if (!prodottiMap[prodId]) {
            prodottiMap[prodId] = {
                nome: prodNome,
                quantita: 0,
                valore: 0
            };
        }

        prodottiMap[prodId].quantita += riga.product_uom_qty || 0;
        prodottiMap[prodId].valore += riga.price_subtotal || 0;
    }

    // Converto in array e ordino per valore
    const topProdotti = Object.values(prodottiMap)
        .sort((a, b) => b.valore - a.valore)
        .slice(0, 10);

    return topProdotti;
}

async function analizzaClientiTop(teamId) {
    // Tutti gli ordini del team quest'anno
    const ordini = await searchRead('sale.order', [
        ['team_id', '=', teamId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', formatDate(inizioAnno)]
    ], ['partner_id', 'amount_total']);

    // Aggregazione per cliente
    const clientiMap = {};
    for (const ordine of ordini) {
        const clienteId = ordine.partner_id[0];
        const clienteNome = ordine.partner_id[1];

        if (!clientiMap[clienteId]) {
            clientiMap[clienteId] = {
                nome: clienteNome,
                ordini: 0,
                totale: 0
            };
        }

        clientiMap[clienteId].ordini += 1;
        clientiMap[clienteId].totale += ordine.amount_total || 0;
    }

    // Top 10 clienti per valore
    const topClienti = Object.values(clientiMap)
        .sort((a, b) => b.totale - a.totale)
        .slice(0, 10);

    return topClienti;
}

async function generaReportVenditore(nomeVenditore) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 ANALISI VENDITORE: ${nomeVenditore.toUpperCase()}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = await trovaVenditoreETeam(nomeVenditore);
    if (!result) {
        return null;
    }

    const { venditore, team } = result;

    if (!team) {
        console.log(`⚠️  Impossibile generare report senza team associato\n`);
        return null;
    }

    const teamId = team.id;

    // 1. ANDAMENTO VENDITE
    console.log('📈 Analizzo andamento vendite...');
    const venditeMeseCorrente = await analizzaVendite(teamId, {
        nome: 'Mese Corrente',
        dataInizio: formatDate(inizioMeseCorrente),
        dataFine: formatDate(oggi)
    });

    const venditeMeseScorso = await analizzaVendite(teamId, {
        nome: 'Mese Scorso',
        dataInizio: formatDate(inizioMeseScorso),
        dataFine: formatDate(fineMeseScorso)
    });

    const venditeUltimi3Mesi = await analizzaVendite(teamId, {
        nome: 'Ultimi 3 Mesi',
        dataInizio: formatDate(tresMesiFa),
        dataFine: formatDate(oggi)
    });

    const venditeAnno = await analizzaVendite(teamId, {
        nome: 'Anno Corrente',
        dataInizio: formatDate(inizioAnno),
        dataFine: formatDate(oggi)
    });

    // 2. CLIENTI NUOVI
    console.log('👥 Analizzo clienti nuovi...');
    const clientiNuovi = await analizzaClientiNuovi(teamId);

    // 3. TOP PRODOTTI
    console.log('🏆 Analizzo top prodotti...');
    const topProdotti = await analizzaTopProdotti(teamId);

    // 4. TOP CLIENTI
    console.log('💎 Analizzo top clienti...');
    const topClienti = await analizzaClientiTop(teamId);

    // CALCOLO CRESCITA
    const crescitaMese = venditeMeseScorso.totaleVenduto > 0
        ? ((venditeMeseCorrente.totaleVenduto - venditeMeseScorso.totaleVenduto) / venditeMeseScorso.totaleVenduto)
        : 0;

    const report = {
        venditore: venditore.name,
        venditoreId: venditore.id,
        team: team.name,
        teamId: team.id,
        dataReport: oggi.toISOString(),

        andamentoVendite: {
            meseCorrente: venditeMeseCorrente,
            meseScorso: venditeMeseScorso,
            ultimi3Mesi: venditeUltimi3Mesi,
            annoCorrente: venditeAnno,
            crescitaMensile: crescitaMese
        },

        clienti: {
            nuoviAnno: clientiNuovi.nuoviAnno,
            nuoviUltimi3Mesi: clientiNuovi.nuoviUltimi3Mesi,
            dettaglioNuovi: clientiNuovi.dettaglio,
            topClienti: topClienti
        },

        prodotti: {
            top10: topProdotti
        }
    };

    return report;
}

function stampaReportConsole(report) {
    console.log(`\n${'━'.repeat(80)}`);
    console.log(`📋 REPORT: ${report.venditore}`);
    console.log(`👥 TEAM: ${report.team}`);
    console.log(`${'━'.repeat(80)}\n`);

    // ANDAMENTO VENDITE
    console.log('📈 ANDAMENTO VENDITE:\n');
    console.log(`   🗓️  Mese Corrente:     ${formatEuro(report.andamentoVendite.meseCorrente.totaleVenduto)} (${report.andamentoVendite.meseCorrente.numeroOrdini} ordini)`);
    console.log(`   🗓️  Mese Scorso:       ${formatEuro(report.andamentoVendite.meseScorso.totaleVenduto)} (${report.andamentoVendite.meseScorso.numeroOrdini} ordini)`);
    console.log(`   📊 Crescita Mensile:   ${formatPercent(report.andamentoVendite.crescitaMensile)} ${report.andamentoVendite.crescitaMensile >= 0 ? '📈' : '📉'}`);
    console.log(`   📅 Ultimi 3 Mesi:      ${formatEuro(report.andamentoVendite.ultimi3Mesi.totaleVenduto)} (${report.andamentoVendite.ultimi3Mesi.numeroOrdini} ordini)`);
    console.log(`   📆 Anno Corrente:      ${formatEuro(report.andamentoVendite.annoCorrente.totaleVenduto)} (${report.andamentoVendite.annoCorrente.numeroOrdini} ordini)`);
    console.log(`   💰 Media Ordine Anno:  ${formatEuro(report.andamentoVendite.annoCorrente.mediaOrdine)}`);

    // CLIENTI
    console.log('\n👥 CLIENTI:\n');
    console.log(`   🆕 Nuovi Quest'Anno:      ${report.clienti.nuoviAnno}`);
    console.log(`   🆕 Nuovi Ultimi 3 Mesi:   ${report.clienti.nuoviUltimi3Mesi}`);

    if (report.clienti.dettaglioNuovi.length > 0) {
        console.log('\n   📋 Ultimi Clienti Acquisiti:');
        report.clienti.dettaglioNuovi.slice(0, 5).forEach((cliente, i) => {
            const data = new Date(cliente.dataAcquisizione).toLocaleDateString('it-IT');
            console.log(`      ${i + 1}. ${cliente.nome} (${data})`);
        });
    }

    // TOP CLIENTI
    if (report.clienti.topClienti.length > 0) {
        console.log('\n   💎 Top 5 Clienti (per fatturato anno):');
        report.clienti.topClienti.slice(0, 5).forEach((cliente, i) => {
            console.log(`      ${i + 1}. ${cliente.nome} - ${formatEuro(cliente.totale)} (${cliente.ordini} ordini)`);
        });
    }

    // TOP PRODOTTI
    if (report.prodotti.top10.length > 0) {
        console.log('\n🏆 TOP 5 PRODOTTI (per fatturato anno):\n');
        report.prodotti.top10.slice(0, 5).forEach((prodotto, i) => {
            console.log(`   ${i + 1}. ${prodotto.nome}`);
            console.log(`      💰 Fatturato: ${formatEuro(prodotto.valore)}`);
            console.log(`      📦 Quantità:  ${prodotto.quantita.toFixed(0)} unità\n`);
        });
    }

    console.log(`${'━'.repeat(80)}\n`);
}

function generaReportHTML(reports) {
    const html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report Riunione Venditori - ${new Date().toLocaleDateString('it-IT')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
            text-align: center;
        }

        .header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header .date {
            color: #666;
            font-size: 1.2em;
        }

        .venditore-card {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .venditore-header {
            border-bottom: 3px solid #667eea;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }

        .venditore-header h2 {
            color: #667eea;
            font-size: 2em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            color: #333;
            font-size: 1.5em;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-left: 4px solid #667eea;
            padding-left: 15px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }

        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 8px;
        }

        .metric-value {
            font-size: 1.8em;
            font-weight: bold;
        }

        .metric-sub {
            font-size: 0.85em;
            opacity: 0.8;
            margin-top: 5px;
        }

        .crescita-positiva {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }

        .crescita-negativa {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        th, td {
            padding: 15px;
            text-align: left;
        }

        tbody tr:nth-child(even) {
            background: #f8f9fa;
        }

        tbody tr:hover {
            background: #e9ecef;
        }

        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }

        .badge-success {
            background: #38ef7d;
            color: white;
        }

        .badge-warning {
            background: #f093fb;
            color: white;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .venditore-card {
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Report Riunione Venditori</h1>
            <div class="date">📅 ${new Date().toLocaleDateString('it-IT', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}</div>
        </div>

        ${reports.map(report => `
        <div class="venditore-card">
            <div class="venditore-header">
                <h2>👤 ${report.venditore}</h2>
                <p style="color: #666; font-size: 0.9em; margin-top: 8px;">👥 Team: <strong>${report.team}</strong></p>
            </div>

            <!-- ANDAMENTO VENDITE -->
            <div class="section">
                <h3 class="section-title">📈 Andamento Vendite</h3>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">🗓️ Mese Corrente</div>
                        <div class="metric-value">${formatEuro(report.andamentoVendite.meseCorrente.totaleVenduto)}</div>
                        <div class="metric-sub">${report.andamentoVendite.meseCorrente.numeroOrdini} ordini</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">🗓️ Mese Scorso</div>
                        <div class="metric-value">${formatEuro(report.andamentoVendite.meseScorso.totaleVenduto)}</div>
                        <div class="metric-sub">${report.andamentoVendite.meseScorso.numeroOrdini} ordini</div>
                    </div>

                    <div class="metric-card ${report.andamentoVendite.crescitaMensile >= 0 ? 'crescita-positiva' : 'crescita-negativa'}">
                        <div class="metric-label">📊 Crescita Mensile</div>
                        <div class="metric-value">${formatPercent(report.andamentoVendite.crescitaMensile)} ${report.andamentoVendite.crescitaMensile >= 0 ? '📈' : '📉'}</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">📅 Ultimi 3 Mesi</div>
                        <div class="metric-value">${formatEuro(report.andamentoVendite.ultimi3Mesi.totaleVenduto)}</div>
                        <div class="metric-sub">${report.andamentoVendite.ultimi3Mesi.numeroOrdini} ordini</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">📆 Anno Corrente</div>
                        <div class="metric-value">${formatEuro(report.andamentoVendite.annoCorrente.totaleVenduto)}</div>
                        <div class="metric-sub">${report.andamentoVendite.annoCorrente.numeroOrdini} ordini</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">💰 Media Ordine</div>
                        <div class="metric-value">${formatEuro(report.andamentoVendite.annoCorrente.mediaOrdine)}</div>
                    </div>
                </div>
            </div>

            <!-- CLIENTI -->
            <div class="section">
                <h3 class="section-title">👥 Clienti</h3>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-label">🆕 Nuovi Quest'Anno</div>
                        <div class="metric-value">${report.clienti.nuoviAnno}</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">🆕 Nuovi Ultimi 3 Mesi</div>
                        <div class="metric-value">${report.clienti.nuoviUltimi3Mesi}</div>
                    </div>
                </div>

                ${report.clienti.dettaglioNuovi.length > 0 ? `
                <h4 style="margin-top: 20px; margin-bottom: 10px; color: #666;">📋 Ultimi Clienti Acquisiti</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Data Acquisizione</th>
                            <th>Email</th>
                            <th>Telefono</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.clienti.dettaglioNuovi.slice(0, 10).map(cliente => `
                        <tr>
                            <td><strong>${cliente.nome}</strong></td>
                            <td>${new Date(cliente.dataAcquisizione).toLocaleDateString('it-IT')}</td>
                            <td>${cliente.contatti.email}</td>
                            <td>${cliente.contatti.telefono}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                ${report.clienti.topClienti.length > 0 ? `
                <h4 style="margin-top: 30px; margin-bottom: 10px; color: #666;">💎 Top Clienti (per fatturato anno)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Cliente</th>
                            <th>Ordini</th>
                            <th>Fatturato Totale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.clienti.topClienti.map((cliente, i) => `
                        <tr>
                            <td><strong>${i + 1}</strong></td>
                            <td><strong>${cliente.nome}</strong></td>
                            <td>${cliente.ordini}</td>
                            <td><strong>${formatEuro(cliente.totale)}</strong></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>

            <!-- TOP PRODOTTI -->
            ${report.prodotti.top10.length > 0 ? `
            <div class="section">
                <h3 class="section-title">🏆 Top Prodotti (per fatturato anno)</h3>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Prodotto</th>
                            <th>Quantità Venduta</th>
                            <th>Fatturato</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.prodotti.top10.map((prodotto, i) => `
                        <tr>
                            <td><strong>${i + 1}</strong></td>
                            <td><strong>${prodotto.nome}</strong></td>
                            <td>${prodotto.quantita.toFixed(0)} unità</td>
                            <td><strong>${formatEuro(prodotto.valore)}</strong></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>
</body>
</html>
    `.trim();

    return html;
}

async function main() {
    try {
        console.log('🚀 Avvio generazione report venditori...\n');
        console.log(`📅 Data: ${oggi.toLocaleDateString('it-IT')}`);
        console.log(`👥 Venditori da analizzare: ${VENDITORI.join(', ')}\n`);

        // Connessione
        console.log('🔌 Connessione a Odoo...');
        await connect();
        console.log('✅ Connesso!\n');

        // Genera report per ogni venditore
        const reports = [];
        for (const nomeVenditore of VENDITORI) {
            const report = await generaReportVenditore(nomeVenditore);
            if (report) {
                reports.push(report);
                stampaReportConsole(report);
            }
        }

        // Salva report completo JSON
        const nomeFileJSON = `REPORT_VENDITORI_RIUNIONE_${formatDate(oggi)}.json`;
        fs.writeFileSync(nomeFileJSON, JSON.stringify(reports, null, 2));
        console.log(`\n💾 Report JSON salvato: ${nomeFileJSON}`);

        // Genera e salva report HTML
        const html = generaReportHTML(reports);
        const nomeFileHTML = `REPORT_VENDITORI_RIUNIONE_${formatDate(oggi)}.html`;
        fs.writeFileSync(nomeFileHTML, html);
        console.log(`💾 Report HTML salvato: ${nomeFileHTML}`);

        console.log('\n✅ REPORT COMPLETATO!\n');
        console.log('📋 Riepilogo:');
        console.log(`   - Venditori analizzati: ${reports.length}`);
        console.log(`   - File generati: ${nomeFileJSON}, ${nomeFileHTML}`);
        console.log('\n🎯 Apri il file HTML nel browser per una visualizzazione completa!\n');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
