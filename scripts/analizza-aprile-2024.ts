/**
 * ANALISI APRILE 2024 - Verifica Riga per Riga
 *
 * Periodo: 01/04/2024 - 30/04/2024
 * Konti: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
 *
 * Output: REPORT-APRILE-2024.json
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'admin';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'admin';

interface OdooClient {
  uid: number | null;
  sessionId: string | null;
  searchRead: (model: string, domain: any[], fields: string[], limit?: number, offset?: number, orderBy?: string) => Promise<any[]>;
  call: (model: string, method: string, args: any[]) => Promise<any>;
}

class OdooRPC implements OdooClient {
  uid: number | null = null;
  sessionId: string | null = null;

  async authenticate() {
    console.log(`Autenticazione Odoo: ${ODOO_URL}`);
    console.log(`Database: ${ODOO_DB}`);
    console.log(`Username: ${ODOO_USERNAME}`);

    try {
      const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: ODOO_DB,
            login: ODOO_USERNAME,
            password: ODOO_PASSWORD
          },
          id: 1
        })
      });

      const data = await response.json();

      if (data.result && data.result.uid) {
        this.uid = data.result.uid;
        this.sessionId = data.result.session_id;
        console.log(`Autenticato con UID: ${this.uid}\n`);
        return true;
      }

      throw new Error('Authentication failed: ' + JSON.stringify(data));
    } catch (error) {
      console.error('Odoo authentication error:', error);
      throw error;
    }
  }

  private async ensureAuthenticated() {
    if (!this.uid) {
      await this.authenticate();
    }
  }

  async searchRead(
    model: string,
    domain: any[],
    fields: string[],
    limit: number = 0,
    offset: number = 0,
    orderBy: string = 'id asc'
  ): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'search_read',
          args: [],
          kwargs: {
            domain: domain,
            fields: fields,
            limit: limit,
            offset: offset,
            order: orderBy
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo searchRead error:', data.error);
      throw new Error(data.error.message || 'Search failed');
    }

    return data.result || [];
  }

  async call(model: string, method: string, args: any[]): Promise<any> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error(`Odoo call error (${method}):`, data.error);
      throw new Error(data.error.message || 'Call failed');
    }

    return data.result;
  }
}

/**
 * Fetch all account move lines for Aprile 2024 for accounts 1024, 1025, 1026
 */
async function fetchApril2024Movements(client: OdooClient) {
    console.log('\n=== FETCH MOVIMENTI APRILE 2024 ===\n');

    const accounts = [
        { code: '1024', name: 'UBS CHF', currency: 'CHF' },
        { code: '1025', name: 'UBS EUR', currency: 'EUR' },
        { code: '1026', name: 'Credit Suisse CHF', currency: 'CHF' }
    ];

    const results: any = {};

    for (const account of accounts) {
        console.log(`\nAnalisi ${account.code} - ${account.name}...`);

        // 1. Get account ID
        const accountRecords = await client.searchRead(
            'account.account',
            [['code', '=', account.code]],
            ['id', 'name', 'code', 'currency_id']
        );

        if (!accountRecords || accountRecords.length === 0) {
            console.log(`ERRORE: Account ${account.code} non trovato`);
            continue;
        }

        const accountId = accountRecords[0].id;
        console.log(`  Account ID: ${accountId}`);

        // 2. Fetch move lines for April 2024
        const moveLines = await client.searchRead(
            'account.move.line',
            [
                ['account_id', '=', accountId],
                ['date', '>=', '2024-04-01'],
                ['date', '<=', '2024-04-30'],
                ['parent_state', '=', 'posted']
            ],
            [
                'id',
                'date',
                'name',
                'ref',
                'partner_id',
                'debit',
                'credit',
                'balance',
                'amount_currency',
                'currency_id',
                'move_id',
                'journal_id',
                'analytic_distribution',
                'reconciled',
                'matching_number'
            ],
            0,
            0,
            'date asc, id asc'
        );

        console.log(`  Movimenti trovati: ${moveLines.length}`);

        // 3. Calculate totals
        let totalDebit = 0;
        let totalCredit = 0;
        let runningBalance = 0;

        const movements = moveLines.map((line: any, index: number) => {
            totalDebit += line.debit || 0;
            totalCredit += line.credit || 0;
            runningBalance += (line.debit || 0) - (line.credit || 0);

            return {
                row: index + 1,
                id: line.id,
                date: line.date,
                description: line.name || '',
                ref: line.ref || '',
                partner: line.partner_id ? line.partner_id[1] : '',
                debit: line.debit || 0,
                credit: line.credit || 0,
                balance: runningBalance,
                amount_currency: line.amount_currency || 0,
                currency: line.currency_id ? line.currency_id[1] : '',
                move_id: line.move_id ? line.move_id[0] : null,
                move_name: line.move_id ? line.move_id[1] : '',
                journal: line.journal_id ? line.journal_id[1] : '',
                reconciled: line.reconciled || false,
                matching_number: line.matching_number || ''
            };
        });

        // 4. Get opening balance (31/03/2024)
        const openingLines = await client.searchRead(
            'account.move.line',
            [
                ['account_id', '=', accountId],
                ['date', '<=', '2024-03-31'],
                ['parent_state', '=', 'posted']
            ],
            ['debit', 'credit']
        );

        let openingBalance = 0;
        openingLines.forEach((line: any) => {
            openingBalance += (line.debit || 0) - (line.credit || 0);
        });

        // 5. Calculate closing balance (30/04/2024)
        const closingBalance = openingBalance + totalDebit - totalCredit;

        results[account.code] = {
            account_code: account.code,
            account_name: account.name,
            account_id: accountId,
            currency: account.currency,
            period: 'April 2024',
            date_from: '2024-04-01',
            date_to: '2024-04-30',
            opening_balance: openingBalance,
            closing_balance: closingBalance,
            total_debit: totalDebit,
            total_credit: totalCredit,
            net_change: totalDebit - totalCredit,
            num_movements: moveLines.length,
            movements: movements
        };

        console.log(`  Saldo apertura (31/03): ${openingBalance.toFixed(2)} ${account.currency}`);
        console.log(`  Total Debit: ${totalDebit.toFixed(2)} ${account.currency}`);
        console.log(`  Total Credit: ${totalCredit.toFixed(2)} ${account.currency}`);
        console.log(`  Saldo chiusura (30/04): ${closingBalance.toFixed(2)} ${account.currency}`);
    }

    return results;
}

/**
 * Cross-check with bank statements
 */
function crossCheckBankStatements(odooData: any) {
    console.log('\n=== CROSS-CHECK CON ESTRATTI BANCARI ===\n');

    // Load bank statement data
    let ubsChf: any, ubsEur: any, creditSuisse: any;

    try {
        ubsChf = JSON.parse(fs.readFileSync('./data-estratti/UBS-CHF-2024-CLEAN.json', 'utf8'));
        ubsEur = JSON.parse(fs.readFileSync('./data-estratti/UBS-EUR-2024-CLEAN.json', 'utf8'));
        creditSuisse = JSON.parse(fs.readFileSync('./data-estratti/CREDIT-SUISSE-2024-CLEAN.json', 'utf8'));
    } catch (error: any) {
        console.error('ERRORE lettura estratti bancari:', error.message);
        return null;
    }

    const comparison: any = {
        '1024_UBS_CHF': {
            odoo_opening: odooData['1024']?.opening_balance || 0,
            odoo_closing: odooData['1024']?.closing_balance || 0,
            bank_opening_31_03: ubsChf.monthly_balances['2024-03']?.ending_balance || 0,
            bank_closing_30_04: ubsChf.monthly_balances['2024-04']?.ending_balance || 0,
            difference_opening: 0,
            difference_closing: 0
        },
        '1025_UBS_EUR': {
            odoo_opening: odooData['1025']?.opening_balance || 0,
            odoo_closing: odooData['1025']?.closing_balance || 0,
            bank_opening_31_03: ubsEur.monthly_balances_2024['2024-03']?.balance || 0,
            bank_closing_30_04: ubsEur.monthly_balances_2024['2024-04']?.balance || 0,
            difference_opening: 0,
            difference_closing: 0
        },
        '1026_CREDIT_SUISSE': {
            odoo_opening: odooData['1026']?.opening_balance || 0,
            odoo_closing: odooData['1026']?.closing_balance || 0,
            bank_opening_31_03: 'N/A - Solo saldo finale anno disponibile',
            bank_closing_30_04: 'N/A - Solo saldo finale anno disponibile',
            note: 'Credit Suisse: estratti conto non disponibili per aprile 2024'
        }
    };

    // Calculate differences
    comparison['1024_UBS_CHF'].difference_opening =
        comparison['1024_UBS_CHF'].odoo_opening - comparison['1024_UBS_CHF'].bank_opening_31_03;
    comparison['1024_UBS_CHF'].difference_closing =
        comparison['1024_UBS_CHF'].odoo_closing - comparison['1024_UBS_CHF'].bank_closing_30_04;

    comparison['1025_UBS_EUR'].difference_opening =
        comparison['1025_UBS_EUR'].odoo_opening - comparison['1025_UBS_EUR'].bank_opening_31_03;
    comparison['1025_UBS_EUR'].difference_closing =
        comparison['1025_UBS_EUR'].odoo_closing - comparison['1025_UBS_EUR'].bank_closing_30_04;

    console.log('1024 UBS CHF:');
    console.log(`  Odoo Opening: ${comparison['1024_UBS_CHF'].odoo_opening.toFixed(2)}`);
    console.log(`  Bank Opening: ${comparison['1024_UBS_CHF'].bank_opening_31_03.toFixed(2)}`);
    console.log(`  Differenza: ${comparison['1024_UBS_CHF'].difference_opening.toFixed(2)}`);
    console.log(`  Odoo Closing: ${comparison['1024_UBS_CHF'].odoo_closing.toFixed(2)}`);
    console.log(`  Bank Closing: ${comparison['1024_UBS_CHF'].bank_closing_30_04.toFixed(2)}`);
    console.log(`  Differenza: ${comparison['1024_UBS_CHF'].difference_closing.toFixed(2)}`);

    console.log('\n1025 UBS EUR:');
    console.log(`  Odoo Opening: ${comparison['1025_UBS_EUR'].odoo_opening.toFixed(2)}`);
    console.log(`  Bank Opening: ${comparison['1025_UBS_EUR'].bank_opening_31_03.toFixed(2)}`);
    console.log(`  Differenza: ${comparison['1025_UBS_EUR'].difference_opening.toFixed(2)}`);
    console.log(`  Odoo Closing: ${comparison['1025_UBS_EUR'].odoo_closing.toFixed(2)}`);
    console.log(`  Bank Closing: ${comparison['1025_UBS_EUR'].bank_closing_30_04.toFixed(2)}`);
    console.log(`  Differenza: ${comparison['1025_UBS_EUR'].difference_closing.toFixed(2)}`);

    console.log('\n1026 Credit Suisse:');
    console.log('  Dati aprile non disponibili negli estratti');

    return comparison;
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(odooData: any, comparison: any) {
    const summary: any = {
        period: 'Aprile 2024',
        date_from: '2024-04-01',
        date_to: '2024-04-30',
        analysis_date: new Date().toISOString(),
        total_movements: 0,
        accounts: [],
        discrepancies: [],
        recommendations: []
    };

    // Aggregate data
    for (const code in odooData) {
        const data = odooData[code];
        summary.total_movements += data.num_movements;
        summary.accounts.push({
            code: data.account_code,
            name: data.account_name,
            currency: data.currency,
            movements: data.num_movements,
            opening_balance: data.opening_balance,
            closing_balance: data.closing_balance,
            net_change: data.net_change
        });
    }

    // Check discrepancies
    if (comparison) {
        if (Math.abs(comparison['1024_UBS_CHF'].difference_closing) > 0.5) {
            summary.discrepancies.push({
                account: '1024 UBS CHF',
                type: 'closing_balance',
                odoo: comparison['1024_UBS_CHF'].odoo_closing,
                bank: comparison['1024_UBS_CHF'].bank_closing_30_04,
                difference: comparison['1024_UBS_CHF'].difference_closing,
                severity: Math.abs(comparison['1024_UBS_CHF'].difference_closing) > 1000 ? 'HIGH' : 'MEDIUM'
            });
        }

        if (Math.abs(comparison['1025_UBS_EUR'].difference_closing) > 0.5) {
            summary.discrepancies.push({
                account: '1025 UBS EUR',
                type: 'closing_balance',
                odoo: comparison['1025_UBS_EUR'].odoo_closing,
                bank: comparison['1025_UBS_EUR'].bank_closing_30_04,
                difference: comparison['1025_UBS_EUR'].difference_closing,
                severity: Math.abs(comparison['1025_UBS_EUR'].difference_closing) > 1000 ? 'HIGH' : 'MEDIUM'
            });
        }
    }

    // Recommendations
    if (summary.discrepancies.length > 0) {
        summary.recommendations.push('Verificare le discrepanze tra Odoo e estratti bancari');
        summary.recommendations.push('Controllare movimenti non riconciliati');
    }

    if (!comparison || comparison['1026_CREDIT_SUISSE'].bank_closing_30_04 === 'N/A - Solo saldo finale anno disponibile') {
        summary.recommendations.push('Recuperare estratti conto Credit Suisse per aprile 2024');
    }

    return summary;
}

/**
 * Main execution
 */
async function main() {
    console.log('========================================');
    console.log('  ANALISI APRILE 2024 - RIGA PER RIGA  ');
    console.log('========================================\n');

    try {
        // 1. Create Odoo client and authenticate
        const client = new OdooRPC();
        await client.authenticate();

        // 2. Fetch movements
        const odooData = await fetchApril2024Movements(client);

        // 3. Cross-check with bank statements
        const comparison = crossCheckBankStatements(odooData);

        // 4. Generate executive summary
        const summary = generateExecutiveSummary(odooData, comparison);

        // 5. Prepare final report
        const report = {
            summary: summary,
            odoo_movements: odooData,
            bank_comparison: comparison,
            metadata: {
                generated_at: new Date().toISOString(),
                generated_by: 'Backend Specialist - Odoo Integration',
                odoo_url: ODOO_URL,
                odoo_db: ODOO_DB,
                total_movements_analyzed: summary.total_movements
            }
        };

        // 6. Save report
        const filename = 'REPORT-APRILE-2024.json';
        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`\n\nREPORT SALVATO: ${filename}`);

        // 7. Print summary
        console.log('\n========================================');
        console.log('           RIEPILOGO FINALE             ');
        console.log('========================================\n');

        console.log(`Periodo: ${summary.period}`);
        console.log(`Movimenti totali: ${summary.total_movements}`);
        console.log(`\nConti analizzati:`);
        summary.accounts.forEach((acc: any) => {
            console.log(`  ${acc.code} - ${acc.name} (${acc.currency})`);
            console.log(`    Movimenti: ${acc.movements}`);
            console.log(`    Saldo apertura: ${acc.opening_balance.toFixed(2)}`);
            console.log(`    Saldo chiusura: ${acc.closing_balance.toFixed(2)}`);
            console.log(`    Variazione netta: ${acc.net_change.toFixed(2)}`);
        });

        if (summary.discrepancies.length > 0) {
            console.log(`\nDISCREPANZE RILEVATE: ${summary.discrepancies.length}`);
            summary.discrepancies.forEach((disc: any, i: number) => {
                console.log(`  ${i + 1}. ${disc.account} - ${disc.type}`);
                console.log(`     Odoo: ${disc.odoo.toFixed(2)}`);
                console.log(`     Banca: ${disc.bank.toFixed(2)}`);
                console.log(`     Differenza: ${disc.difference.toFixed(2)} [${disc.severity}]`);
            });
        } else {
            console.log('\nNESSUNA DISCREPANZA - Saldi allineati!');
        }

        if (summary.recommendations.length > 0) {
            console.log(`\nRACCOMANDAZIONI:`);
            summary.recommendations.forEach((rec: string, i: number) => {
                console.log(`  ${i + 1}. ${rec}`);
            });
        }

        console.log('\n========================================\n');

    } catch (error) {
        console.error('ERRORE durante analisi:', error);
        process.exit(1);
    }
}

// Execute
main();
