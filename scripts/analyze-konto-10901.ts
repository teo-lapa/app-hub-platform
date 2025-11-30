/**
 * Database Optimizer Specialist - Konto 10901 Analysis
 *
 * Obiettivo: Estrarre e categorizzare tutti i 219 movimenti del conto 10901
 * per riclassificazione completa e azzeramento saldo
 */

interface OdooConnection {
  url: string;
  db: string;
  username: string;
  password: string;
}

interface AccountMoveLine {
  id: number;
  name: string;
  ref: string;
  date: string;
  move_id: [number, string];
  journal_id: [number, string];
  debit: number;
  credit: number;
  balance: number;
  amount_currency: number;
  currency_id: [number, string] | false;
  partner_id: [number, string] | false;
  reconciled: boolean;
}

class OdooClient {
  private uid: number | null = null;
  private sessionId: string | null = null;
  private config: OdooConnection;

  constructor(config: OdooConnection) {
    this.config = config;
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.config.url}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: this.config.db,
          login: this.config.username,
          password: this.config.password
        },
        id: 1
      })
    });

    const data = await response.json();
    if (data.result && data.result.uid) {
      this.uid = data.result.uid;
      this.sessionId = data.result.session_id;
      console.log(`✓ Authenticated as user ${this.uid}`);
    } else {
      throw new Error('Authentication failed');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.uid) {
      await this.authenticate();
    }
  }

  async searchRead(
    model: string,
    domain: any[],
    options: {
      fields?: string[];
      limit?: number;
      offset?: number;
      order?: string;
    } = {}
  ): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${this.config.url}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      credentials: 'include',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'search_read',
          args: [],
          kwargs: {
            domain,
            fields: options.fields || [],
            limit: options.limit || 1000,
            offset: options.offset || 0,
            order: options.order || 'id desc'
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    // Session expired - re-authenticate
    if (data.error && data.error.message && data.error.message.includes('Session')) {
      console.log('Session expired, re-authenticating...');
      this.uid = null;
      this.sessionId = null;
      await this.ensureAuthenticated();

      // Retry request
      return this.searchRead(model, domain, options);
    }

    if (data.error) {
      throw new Error(data.error.message || 'Search failed');
    }

    return data.result || [];
  }
}

// Categorie per classificazione movimenti
enum TransactionCategory {
  CURRENCY_EXCHANGE = 'CURRENCY_EXCHANGE',     // EUR/CHF cambi
  CREDIT_CARD = 'CREDIT_CARD',                 // Carte credito
  BANK_TRANSFER = 'BANK_TRANSFER',             // Bonifici tra conti
  OTHER = 'OTHER'                              // Altri movimenti
}

interface CategorizedMovement {
  line: AccountMoveLine;
  category: TransactionCategory;
  reason: string;
  suggestedAction: string;
}

class Konto10901Analyzer {
  private client: OdooClient;

  constructor(client: OdooClient) {
    this.client = client;
  }

  /**
   * Categorizza un movimento basandosi su regole euristiche
   */
  private categorizeMovement(line: AccountMoveLine): CategorizedMovement {
    const name = (line.name || '').toLowerCase();
    const ref = (line.ref || '').toLowerCase();
    const journal = line.journal_id ? line.journal_id[1].toLowerCase() : '';

    // 1. Cambi valuta EUR/CHF
    if (
      name.includes('eur') || name.includes('chf') ||
      name.includes('währung') || name.includes('exchange') ||
      ref.includes('eur') || ref.includes('exchange')
    ) {
      return {
        line,
        category: TransactionCategory.CURRENCY_EXCHANGE,
        reason: 'Contains currency keywords (EUR/CHF/exchange)',
        suggestedAction: 'Move to "Utili/Perdite su cambi" account'
      };
    }

    // 2. Carte credito
    if (
      name.includes('kreditkarte') || name.includes('credit card') ||
      journal.includes('kreditkarte') || journal.includes('card')
    ) {
      return {
        line,
        category: TransactionCategory.CREDIT_CARD,
        reason: 'Contains credit card keywords',
        suggestedAction: 'Verify correctness, might be already correct'
      };
    }

    // 3. Bonifici tra conti (Liquiditätstransfer)
    if (
      name.includes('transfer') || name.includes('übertrag') ||
      name.includes('liquidität') ||
      journal.includes('transfer') || journal.includes('bank')
    ) {
      return {
        line,
        category: TransactionCategory.BANK_TRANSFER,
        reason: 'Contains transfer/liquidity keywords',
        suggestedAction: 'Book directly between bank accounts'
      };
    }

    // 4. Altri movimenti
    return {
      line,
      category: TransactionCategory.OTHER,
      reason: 'Does not match specific patterns',
      suggestedAction: 'Manual review required'
    };
  }

  /**
   * Estrai e analizza tutti i movimenti del conto 10901
   */
  async analyzeAccount10901(): Promise<void> {
    console.log('\n=== KONTO 10901 ANALYSIS ===\n');

    // 1. Trova account 10901
    const accounts = await this.client.searchRead('account.account', [
      ['code', '=', '10901']
    ], {
      fields: ['id', 'name', 'code', 'account_type', 'currency_id']
    });

    if (accounts.length === 0) {
      throw new Error('Account 10901 not found');
    }

    const account = accounts[0];
    console.log(`Account: ${account.code} - ${account.name}`);
    console.log(`Type: ${account.account_type}\n`);

    // 2. Estrai TUTTI i movimenti (batch fetch)
    const allMoveLines: AccountMoveLine[] = [];
    let offset = 0;
    const batchSize = 100;
    let hasMore = true;

    console.log('Fetching move lines...');

    while (hasMore) {
      const batch = await this.client.searchRead('account.move.line', [
        ['account_id', '=', account.id]
      ], {
        fields: [
          'id', 'name', 'ref', 'date', 'move_id', 'journal_id',
          'debit', 'credit', 'balance', 'amount_currency', 'currency_id',
          'partner_id', 'reconciled'
        ],
        limit: batchSize,
        offset,
        order: 'date desc'
      });

      allMoveLines.push(...batch);
      console.log(`  Fetched ${allMoveLines.length} move lines...`);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`\n✓ Total move lines extracted: ${allMoveLines.length}\n`);

    // 3. Categorizza tutti i movimenti
    console.log('Categorizing movements...\n');

    const categorized = allMoveLines.map(line => this.categorizeMovement(line));

    // 4. Statistiche per categoria
    const stats = {
      [TransactionCategory.CURRENCY_EXCHANGE]: {
        count: 0,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      },
      [TransactionCategory.CREDIT_CARD]: {
        count: 0,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      },
      [TransactionCategory.BANK_TRANSFER]: {
        count: 0,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      },
      [TransactionCategory.OTHER]: {
        count: 0,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      }
    };

    categorized.forEach(cat => {
      stats[cat.category].count++;
      stats[cat.category].totalDebit += cat.line.debit;
      stats[cat.category].totalCredit += cat.line.credit;
      stats[cat.category].balance += cat.line.balance;
    });

    // 5. Report
    console.log('=== CATEGORIZATION SUMMARY ===\n');

    Object.entries(stats).forEach(([category, stat]) => {
      console.log(`${category}:`);
      console.log(`  Count: ${stat.count}`);
      console.log(`  Total Debit: CHF ${stat.totalDebit.toFixed(2)}`);
      console.log(`  Total Credit: CHF ${stat.totalCredit.toFixed(2)}`);
      console.log(`  Balance: CHF ${stat.balance.toFixed(2)}\n`);
    });

    // 6. Totale generale
    const totalBalance = Object.values(stats).reduce((sum, s) => sum + s.balance, 0);
    console.log(`TOTAL BALANCE: CHF ${totalBalance.toFixed(2)}`);
    console.log(`Expected: CHF -183,912.63\n`);

    // 7. Salva risultati dettagliati
    const fs = await import('fs');
    const output = {
      account,
      totalMovements: allMoveLines.length,
      categorization: categorized,
      statistics: stats,
      totalBalance,
      extractedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      'konto-10901-analysis.json',
      JSON.stringify(output, null, 2)
    );

    console.log('✓ Detailed analysis saved to konto-10901-analysis.json\n');

    // 8. Sample di ogni categoria
    console.log('=== SAMPLE MOVEMENTS BY CATEGORY ===\n');

    Object.values(TransactionCategory).forEach(category => {
      const samples = categorized
        .filter(c => c.category === category)
        .slice(0, 3);

      if (samples.length > 0) {
        console.log(`${category} (showing first 3):`);
        samples.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.line.date} - ${s.line.name}`);
          console.log(`     Debit: ${s.line.debit} | Credit: ${s.line.credit}`);
          console.log(`     Reason: ${s.reason}`);
          console.log(`     Action: ${s.suggestedAction}\n`);
        });
      }
    });
  }
}

// Main execution
async function main() {
  const client = new OdooClient({
    url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
    username: 'paul@lapa.ch',
    password: 'lapa201180'
  });

  const analyzer = new Konto10901Analyzer(client);
  await analyzer.analyzeAccount10901();
}

main().catch(console.error);
