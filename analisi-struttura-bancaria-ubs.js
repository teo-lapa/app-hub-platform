const xmlrpc = require('xmlrpc');

// Configurazione connessione Odoo Staging
const url = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
const db = 'lapadevadmin-lapa-v2-staging-2406-25408900';
const username = 'paul@lapa.ch';
const password = 'lapa201180';

const common = xmlrpc.createSecureClient({ host: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com', port: 443, path: '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ host: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com', port: 443, path: '/xmlrpc/2/object' });

async function authenticate() {
    return new Promise((resolve, reject) => {
        common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
            if (err) reject(err);
            else resolve(uid);
        });
    });
}

async function executeKw(model, method, params) {
    return new Promise((resolve, reject) => {
        models.methodCall('execute_kw', params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

async function getModelFields(uid, model) {
    return executeKw(model, 'fields_get', [
        db, uid, password,
        model, 'fields_get',
        [],
        { attributes: ['string', 'help', 'type', 'required', 'readonly', 'relation'] }
    ]);
}

async function searchRead(uid, model, domain, fields, limit = 1000) {
    return executeKw(model, 'search_read', [
        db, uid, password,
        model, 'search_read',
        [domain],
        { fields: fields, limit: limit }
    ]);
}

async function analizzaStrutturaBancaria() {
    try {
        console.log('🔐 Autenticazione in corso...');
        const uid = await authenticate();
        console.log(`✅ Autenticato con UID: ${uid}\n`);

        const risultati = {
            timestamp: new Date().toISOString(),
            database: db,
            uid: uid,
            analisi: {}
        };

        // 1. ANALISI GIORNALI BANCARI
        console.log('📋 1. ANALISI GIORNALI BANCARI (account.journal)');
        console.log('='.repeat(70));

        const journals = await searchRead(uid, 'account.journal',
            [['type', '=', 'bank']],
            ['id', 'name', 'code', 'type', 'bank_account_id', 'bank_id', 'currency_id', 'company_id', 'default_account_id', 'suspense_account_id']
        );

        console.log(`✅ Trovati ${journals.length} giornali bancari:\n`);
        journals.forEach(j => {
            console.log(`  ID: ${j.id}`);
            console.log(`  Nome: ${j.name}`);
            console.log(`  Codice: ${j.code}`);
            console.log(`  Bank Account ID: ${j.bank_account_id ? j.bank_account_id[1] : 'N/A'}`);
            console.log(`  Bank ID: ${j.bank_id ? j.bank_id[1] : 'N/A'}`);
            console.log(`  Currency: ${j.currency_id ? j.currency_id[1] : 'N/A'}`);
            console.log(`  Default Account: ${j.default_account_id ? j.default_account_id[1] : 'N/A'}`);
            console.log(`  Suspense Account: ${j.suspense_account_id ? j.suspense_account_id[1] : 'N/A'}`);
            console.log('  ' + '-'.repeat(60));
        });
        risultati.analisi.giornali_bancari = journals;

        // 2. ANALISI CAMPI account.bank.statement
        console.log('\n📋 2. CAMPI ACCOUNT.BANK.STATEMENT (estratti conto)');
        console.log('='.repeat(70));

        const statementFields = await getModelFields(uid, 'account.bank.statement');
        const statementFieldsImportanti = {};
        const campiImportantiStatement = ['name', 'date', 'balance_start', 'balance_end_real', 'journal_id', 'company_id', 'line_ids', 'currency_id', 'is_complete', 'is_valid'];

        console.log('Campi principali per account.bank.statement:\n');
        campiImportantiStatement.forEach(campo => {
            if (statementFields[campo]) {
                statementFieldsImportanti[campo] = statementFields[campo];
                console.log(`  ${campo}:`);
                console.log(`    Tipo: ${statementFields[campo].type}`);
                console.log(`    Label: ${statementFields[campo].string}`);
                console.log(`    Obbligatorio: ${statementFields[campo].required ? 'SÌ' : 'NO'}`);
                console.log(`    Readonly: ${statementFields[campo].readonly ? 'SÌ' : 'NO'}`);
                if (statementFields[campo].relation) {
                    console.log(`    Relazione: ${statementFields[campo].relation}`);
                }
                if (statementFields[campo].help) {
                    console.log(`    Help: ${statementFields[campo].help}`);
                }
                console.log('');
            }
        });
        risultati.analisi.account_bank_statement_fields = statementFieldsImportanti;

        // 3. ANALISI CAMPI account.bank.statement.line
        console.log('\n📋 3. CAMPI ACCOUNT.BANK.STATEMENT.LINE (righe movimenti)');
        console.log('='.repeat(70));

        const lineFields = await getModelFields(uid, 'account.bank.statement.line');
        const lineFieldsImportanti = {};
        const campiImportantiLine = [
            'date', 'payment_ref', 'ref', 'partner_id', 'amount', 'foreign_currency_id', 'amount_currency',
            'statement_id', 'journal_id', 'move_id', 'company_id', 'currency_id',
            'account_number', 'partner_name', 'transaction_type', 'narration',
            'running_balance', 'is_reconciled', 'to_check'
        ];

        console.log('Campi principali per account.bank.statement.line:\n');
        campiImportantiLine.forEach(campo => {
            if (lineFields[campo]) {
                lineFieldsImportanti[campo] = lineFields[campo];
                console.log(`  ${campo}:`);
                console.log(`    Tipo: ${lineFields[campo].type}`);
                console.log(`    Label: ${lineFields[campo].string}`);
                console.log(`    Obbligatorio: ${lineFields[campo].required ? 'SÌ' : 'NO'}`);
                console.log(`    Readonly: ${lineFields[campo].readonly ? 'SÌ' : 'NO'}`);
                if (lineFields[campo].relation) {
                    console.log(`    Relazione: ${lineFields[campo].relation}`);
                }
                if (lineFields[campo].help) {
                    console.log(`    Help: ${lineFields[campo].help}`);
                }
                console.log('');
            }
        });
        risultati.analisi.account_bank_statement_line_fields = lineFieldsImportanti;

        // 4. ESTRATTI CONTO ESISTENTI
        console.log('\n📋 4. ESTRATTI CONTO ESISTENTI (ultimi 10)');
        console.log('='.repeat(70));

        const statements = await searchRead(uid, 'account.bank.statement',
            [],
            ['id', 'name', 'date', 'balance_start', 'balance_end_real', 'journal_id', 'company_id'],
            10
        );

        console.log(`✅ Trovati ${statements.length} estratti conto recenti:\n`);
        statements.forEach(s => {
            console.log(`  ID: ${s.id} | Nome: ${s.name} | Data: ${s.date}`);
            console.log(`  Giornale: ${s.journal_id ? s.journal_id[1] : 'N/A'}`);
            console.log(`  Saldo iniziale: ${s.balance_start} | Saldo finale: ${s.balance_end_real}`);
            console.log('  ' + '-'.repeat(60));
        });
        risultati.analisi.estratti_conto_esempio = statements;

        // 5. RIGHE MOVIMENTI ESEMPIO
        console.log('\n📋 5. RIGHE MOVIMENTI ESEMPIO (ultime 10)');
        console.log('='.repeat(70));

        const lines = await searchRead(uid, 'account.bank.statement.line',
            [],
            ['id', 'date', 'payment_ref', 'partner_id', 'amount', 'statement_id', 'journal_id', 'is_reconciled'],
            10
        );

        console.log(`✅ Trovate ${lines.length} righe movimento recenti:\n`);
        lines.forEach(l => {
            console.log(`  ID: ${l.id} | Data: ${l.date}`);
            console.log(`  Riferimento: ${l.payment_ref || 'N/A'}`);
            console.log(`  Partner: ${l.partner_id ? l.partner_id[1] : 'N/A'}`);
            console.log(`  Importo: ${l.amount}`);
            console.log(`  Estratto: ${l.statement_id ? l.statement_id[1] : 'N/A'}`);
            console.log(`  Riconciliato: ${l.is_reconciled ? 'SÌ' : 'NO'}`);
            console.log('  ' + '-'.repeat(60));
        });
        risultati.analisi.righe_movimento_esempio = lines;

        // 6. PIANO DEI CONTI - CONTI BANCARI
        console.log('\n📋 6. PIANO DEI CONTI - CONTI BANCARI');
        console.log('='.repeat(70));

        const accounts = await searchRead(uid, 'account.account',
            [['account_type', '=', 'asset_cash']],
            ['id', 'code', 'name', 'account_type', 'currency_id', 'company_id', 'reconcile']
        );

        console.log(`✅ Trovati ${accounts.length} conti bancari/cassa:\n`);
        accounts.forEach(a => {
            console.log(`  ID: ${a.id}`);
            console.log(`  Codice: ${a.code}`);
            console.log(`  Nome: ${a.name}`);
            console.log(`  Tipo: ${a.account_type}`);
            console.log(`  Riconciliabile: ${a.reconcile ? 'SÌ' : 'NO'}`);
            console.log('  ' + '-'.repeat(60));
        });
        risultati.analisi.conti_bancari = accounts;

        // 7. VERIFICA MODULI IMPORTAZIONE
        console.log('\n📋 7. VERIFICA MODULI IMPORTAZIONE BANCARIA');
        console.log('='.repeat(70));

        try {
            const modules = await searchRead(uid, 'ir.module.module',
                [['name', 'ilike', 'bank'], ['state', '=', 'installed']],
                ['id', 'name', 'shortdesc', 'summary']
            );

            console.log(`✅ Trovati ${modules.length} moduli bancari installati:\n`);
            modules.forEach(m => {
                console.log(`  ID: ${m.id}`);
                console.log(`  Nome tecnico: ${m.name}`);
                console.log(`  Descrizione: ${m.shortdesc}`);
                console.log('  ' + '-'.repeat(60));
            });
            risultati.analisi.moduli_bancari = modules;
        } catch (err) {
            console.log('⚠️  Impossibile accedere ai moduli (potrebbero servire permessi admin)');
            risultati.analisi.moduli_bancari = { error: err.message };
        }

        // 8. VERIFICA WIZARD IMPORTAZIONE
        console.log('\n📋 8. VERIFICA WIZARD IMPORTAZIONE');
        console.log('='.repeat(70));

        try {
            const importWizardFields = await getModelFields(uid, 'account.bank.statement.import');
            console.log('✅ Trovato wizard account.bank.statement.import');
            console.log('Campi disponibili:');
            Object.keys(importWizardFields).forEach(campo => {
                console.log(`  - ${campo} (${importWizardFields[campo].type}): ${importWizardFields[campo].string}`);
            });
            risultati.analisi.import_wizard = importWizardFields;
        } catch (err) {
            console.log('⚠️  Wizard account.bank.statement.import non trovato o non accessibile');
            risultati.analisi.import_wizard = { error: err.message };
        }

        // 9. INFORMAZIONI AZIENDA
        console.log('\n📋 9. INFORMAZIONI AZIENDA');
        console.log('='.repeat(70));

        const companies = await searchRead(uid, 'res.company',
            [],
            ['id', 'name', 'currency_id', 'country_id']
        );

        console.log(`✅ Trovate ${companies.length} aziende:\n`);
        companies.forEach(c => {
            console.log(`  ID: ${c.id}`);
            console.log(`  Nome: ${c.name}`);
            console.log(`  Valuta: ${c.currency_id ? c.currency_id[1] : 'N/A'}`);
            console.log(`  Paese: ${c.country_id ? c.country_id[1] : 'N/A'}`);
            console.log('  ' + '-'.repeat(60));
        });
        risultati.analisi.aziende = companies;

        // 10. RIEPILOGO CAMPI OBBLIGATORI
        console.log('\n📋 10. RIEPILOGO CAMPI OBBLIGATORI PER IMPORTAZIONE');
        console.log('='.repeat(70));

        const campiObbligatoriStatement = Object.keys(statementFieldsImportanti)
            .filter(k => statementFieldsImportanti[k].required)
            .map(k => ({ campo: k, tipo: statementFieldsImportanti[k].type, label: statementFieldsImportanti[k].string }));

        const campiObbligatoriLine = Object.keys(lineFieldsImportanti)
            .filter(k => lineFieldsImportanti[k].required)
            .map(k => ({ campo: k, tipo: lineFieldsImportanti[k].type, label: lineFieldsImportanti[k].string }));

        console.log('\nAccount.bank.statement - CAMPI OBBLIGATORI:');
        campiObbligatoriStatement.forEach(c => {
            console.log(`  ✓ ${c.campo} (${c.tipo}): ${c.label}`);
        });

        console.log('\nAccount.bank.statement.line - CAMPI OBBLIGATORI:');
        campiObbligatoriLine.forEach(c => {
            console.log(`  ✓ ${c.campo} (${c.tipo}): ${c.label}`);
        });

        risultati.analisi.campi_obbligatori = {
            statement: campiObbligatoriStatement,
            line: campiObbligatoriLine
        };

        // Salva risultati in JSON
        const fs = require('fs');
        const outputPath = 'C:\\Users\\lapa\\OneDrive\\Desktop\\Claude Code\\ANALISI_STRUTTURA_BANCARIA_UBS.json';
        fs.writeFileSync(outputPath, JSON.stringify(risultati, null, 2));
        console.log(`\n✅ Analisi completata! Risultati salvati in: ${outputPath}`);

        // Genera anche un report markdown
        const markdownReport = generaReportMarkdown(risultati);
        const mdPath = 'C:\\Users\\lapa\\OneDrive\\Desktop\\Claude Code\\ANALISI_STRUTTURA_BANCARIA_UBS.md';
        fs.writeFileSync(mdPath, markdownReport);
        console.log(`✅ Report markdown salvato in: ${mdPath}`);

        return risultati;

    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
        throw error;
    }
}

function generaReportMarkdown(risultati) {
    const { analisi } = risultati;

    let md = `# ANALISI STRUTTURA CONTABILE - IMPORTAZIONE MOVIMENTI BANCARI UBS\n\n`;
    md += `**Database:** ${risultati.database}\n`;
    md += `**Data analisi:** ${new Date(risultati.timestamp).toLocaleString('it-IT')}\n`;
    md += `**UID:** ${risultati.uid}\n\n`;
    md += `---\n\n`;

    // Giornali bancari
    md += `## 1. GIORNALI BANCARI CONFIGURATI\n\n`;
    md += `Trovati **${analisi.giornali_bancari.length} giornali bancari**:\n\n`;
    analisi.giornali_bancari.forEach(j => {
        md += `### ${j.name} (Codice: ${j.code})\n`;
        md += `- **ID:** ${j.id}\n`;
        md += `- **Bank Account:** ${j.bank_account_id ? j.bank_account_id[1] : 'N/A'}\n`;
        md += `- **Banca:** ${j.bank_id ? j.bank_id[1] : 'N/A'}\n`;
        md += `- **Valuta:** ${j.currency_id ? j.currency_id[1] : 'N/A'}\n`;
        md += `- **Conto predefinito:** ${j.default_account_id ? j.default_account_id[1] : 'N/A'}\n`;
        md += `- **Conto sospeso:** ${j.suspense_account_id ? j.suspense_account_id[1] : 'N/A'}\n\n`;
    });

    // Campi obbligatori
    md += `## 2. CAMPI OBBLIGATORI PER IMPORTAZIONE\n\n`;
    md += `### account.bank.statement (Estratto conto)\n\n`;
    md += `| Campo | Tipo | Descrizione |\n`;
    md += `|-------|------|-------------|\n`;
    analisi.campi_obbligatori.statement.forEach(c => {
        md += `| \`${c.campo}\` | ${c.tipo} | ${c.label} |\n`;
    });

    md += `\n### account.bank.statement.line (Riga movimento)\n\n`;
    md += `| Campo | Tipo | Descrizione |\n`;
    md += `|-------|------|-------------|\n`;
    analisi.campi_obbligatori.line.forEach(c => {
        md += `| \`${c.campo}\` | ${c.tipo} | ${c.label} |\n`;
    });

    // Schema completo campi statement
    md += `\n## 3. SCHEMA COMPLETO CAMPI - account.bank.statement\n\n`;
    md += `| Campo | Tipo | Label | Obbligatorio | Readonly | Relazione |\n`;
    md += `|-------|------|-------|--------------|----------|----------|\n`;
    Object.keys(analisi.account_bank_statement_fields).forEach(campo => {
        const f = analisi.account_bank_statement_fields[campo];
        md += `| \`${campo}\` | ${f.type} | ${f.string} | ${f.required ? '✓' : ''} | ${f.readonly ? '✓' : ''} | ${f.relation || ''} |\n`;
    });

    // Schema completo campi line
    md += `\n## 4. SCHEMA COMPLETO CAMPI - account.bank.statement.line\n\n`;
    md += `| Campo | Tipo | Label | Obbligatorio | Readonly | Relazione |\n`;
    md += `|-------|------|-------|--------------|----------|----------|\n`;
    Object.keys(analisi.account_bank_statement_line_fields).forEach(campo => {
        const f = analisi.account_bank_statement_line_fields[campo];
        md += `| \`${campo}\` | ${f.type} | ${f.string} | ${f.required ? '✓' : ''} | ${f.readonly ? '✓' : ''} | ${f.relation || ''} |\n`;
    });

    // Conti bancari
    md += `\n## 5. CONTI BANCARI (Piano dei conti)\n\n`;
    md += `Trovati **${analisi.conti_bancari.length} conti bancari/cassa**:\n\n`;
    md += `| ID | Codice | Nome | Riconciliabile |\n`;
    md += `|----|--------|------|----------------|\n`;
    analisi.conti_bancari.forEach(a => {
        md += `| ${a.id} | ${a.code} | ${a.name} | ${a.reconcile ? '✓' : ''} |\n`;
    });

    // Moduli bancari
    md += `\n## 6. MODULI BANCARI INSTALLATI\n\n`;
    if (analisi.moduli_bancari.error) {
        md += `⚠️ Non accessibili (servono permessi amministratore)\n\n`;
    } else {
        analisi.moduli_bancari.forEach(m => {
            md += `- **${m.shortdesc}** (\`${m.name}\`)\n`;
        });
        md += `\n`;
    }

    // Import wizard
    md += `## 7. WIZARD IMPORTAZIONE\n\n`;
    if (analisi.import_wizard.error) {
        md += `⚠️ Wizard \`account.bank.statement.import\` non trovato o non accessibile\n\n`;
    } else {
        md += `✓ Wizard \`account.bank.statement.import\` disponibile\n\n`;
        md += `Campi disponibili:\n`;
        Object.keys(analisi.import_wizard).forEach(campo => {
            const f = analisi.import_wizard[campo];
            md += `- \`${campo}\` (${f.type}): ${f.string}\n`;
        });
        md += `\n`;
    }

    // Guida implementazione
    md += `## 8. GUIDA IMPLEMENTAZIONE IMPORTAZIONE UBS\n\n`;
    md += `### Step 1: Preparazione dati CSV\n\n`;
    md += `Il file CSV UBS deve contenere almeno:\n`;
    md += `- Data movimento\n`;
    md += `- Descrizione/Riferimento\n`;
    md += `- Importo\n`;
    md += `- Saldo (opzionale ma consigliato)\n\n`;

    md += `### Step 2: Creazione estratto conto\n\n`;
    md += `\`\`\`javascript\n`;
    md += `const statement = await odoo.create('account.bank.statement', {\n`;
    md += `    name: 'UBS/2025/001',  // Nome estratto\n`;
    md += `    date: '2025-11-11',     // Data estratto\n`;
    md += `    journal_id: XX,         // ID giornale UBS (vedi sezione 1)\n`;
    md += `    balance_start: 0.0,     // Saldo iniziale\n`;
    md += `    balance_end_real: 0.0   // Saldo finale\n`;
    md += `});\n`;
    md += `\`\`\`\n\n`;

    md += `### Step 3: Creazione righe movimento\n\n`;
    md += `\`\`\`javascript\n`;
    md += `const line = await odoo.create('account.bank.statement.line', {\n`;
    md += `    statement_id: statement.id,\n`;
    md += `    date: '2025-11-11',\n`;
    md += `    payment_ref: 'Descrizione movimento',\n`;
    md += `    amount: 1000.00,        // Positivo per entrate, negativo per uscite\n`;
    md += `    partner_id: false,      // ID partner se identificato\n`;
    md += `    partner_name: 'Nome cliente',  // Nome se partner non trovato\n`;
    md += `});\n`;
    md += `\`\`\`\n\n`;

    md += `### Step 4: Validazione estratto\n\n`;
    md += `Dopo l'importazione, verificare:\n`;
    md += `1. Saldo finale calcolato corrisponde al saldo reale\n`;
    md += `2. Tutte le righe sono state importate correttamente\n`;
    md += `3. Nessuna riga duplicata\n\n`;

    md += `---\n\n`;
    md += `*Analisi generata automaticamente da Claude Code*\n`;

    return md;
}

// Esegui analisi
analizzaStrutturaBancaria()
    .then(() => {
        console.log('\n🎉 Analisi completata con successo!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Errore fatale:', err);
        process.exit(1);
    });
