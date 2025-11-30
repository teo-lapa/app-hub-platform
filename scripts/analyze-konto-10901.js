/**
 * Database Optimizer Specialist - Konto 10901 Complete Analysis
 *
 * Obiettivo: Estrarre e categorizzare tutti i 219 movimenti del conto 10901
 * Saldo attuale: CHF -183,912.63
 * Target: CHF 0.00 dopo riclassificazione
 */

const fs = require('fs');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900';
const ODOO_USER = 'paul@lapa.ch';
const ODOO_PASS = 'lapa201180';

// Categorie per riclassificazione
const CATEGORIES = {
  CURRENCY_EXCHANGE: 'CURRENCY_EXCHANGE',     // EUR/CHF cambi valuta
  CREDIT_CARD: 'CREDIT_CARD',                 // Carte credito
  BANK_TRANSFER: 'BANK_TRANSFER',             // Bonifici tra conti bancari
  OTHER: 'OTHER'                               // Altri movimenti
};

/**
 * Login a Odoo e ottieni session ID
 */
async function loginToOdoo() {
  console.log('🔐 Login to Odoo...');

  const loginResp = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_USER,
        password: ODOO_PASS
      },
      id: Math.random()
    })
  });

  const loginData = await loginResp.json();

  // Estrai session_id
  const cookies = loginResp.headers.get('set-cookie') || '';
  const sessionMatch = cookies.match(/session_id=([^;]+)/);
  let sessionId = sessionMatch ? sessionMatch[1] : null;

  if (!sessionId && loginData.result && loginData.result.session_id) {
    sessionId = loginData.result.session_id;
  }

  if (!sessionId) {
    throw new Error('Login failed - no session ID');
  }

  console.log(`✓ Authenticated! Session: ${sessionId.substring(0, 20)}...\n`);
  return sessionId;
}

/**
 * Call Odoo RPC method
 */
async function callOdoo(sessionId, model, method, args = [], kwargs = {}) {
  const resp = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.random()
    })
  });

  const data = await resp.json();

  if (data.error) {
    throw new Error(`Odoo Error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Categorizza movimento basandosi su pattern matching
 */
function categorizeMovement(line) {
  const name = (line.name || '').toLowerCase();
  const ref = (line.ref || '').toLowerCase();
  const journalName = line.journal_id ? line.journal_id[1].toLowerCase() : '';

  // 1. Cambi valuta EUR/CHF
  if (
    name.includes('eur') || name.includes('chf') ||
    name.includes('währung') || name.includes('exchange') ||
    name.includes('wechselkurs') || name.includes('umrechnung') ||
    ref.includes('eur') || ref.includes('exchange') ||
    journalName.includes('exchange')
  ) {
    return {
      category: CATEGORIES.CURRENCY_EXCHANGE,
      reason: 'Contains currency keywords (EUR/CHF/exchange/Währung)',
      action: 'Move to "Utili/Perdite su cambi" account',
      accountType: 'Currency gains/losses'
    };
  }

  // 2. Carte credito
  if (
    name.includes('kreditkarte') || name.includes('credit card') ||
    name.includes('visa') || name.includes('mastercard') ||
    journalName.includes('kreditkarte') || journalName.includes('card')
  ) {
    return {
      category: CATEGORIES.CREDIT_CARD,
      reason: 'Contains credit card keywords',
      action: 'Verify and potentially re-book to correct card account',
      accountType: 'Credit card account'
    };
  }

  // 3. Bonifici tra conti (Liquiditätstransfer)
  if (
    name.includes('transfer') || name.includes('übertrag') ||
    name.includes('liquidität') || name.includes('überweisung') ||
    journalName.includes('transfer') || journalName.includes('bank')
  ) {
    return {
      category: CATEGORIES.BANK_TRANSFER,
      reason: 'Contains transfer/liquidity keywords',
      action: 'Book directly between source and destination bank accounts',
      accountType: 'Bank-to-bank transfer'
    };
  }

  // 4. Altri movimenti (require manual review)
  return {
    category: CATEGORIES.OTHER,
    reason: 'Does not match predefined patterns',
    action: 'Manual review and classification required',
    accountType: 'To be determined'
  };
}

/**
 * Analisi completa Konto 10901
 */
async function analyzeKonto10901() {
  const sessionId = await loginToOdoo();

  console.log('=== KONTO 10901 COMPLETE ANALYSIS ===\n');

  // 1. Find account 10901
  console.log('1. Searching for account 10901...');
  const accounts = await callOdoo(sessionId, 'account.account', 'search_read', [], {
    domain: [['code', '=', '10901']],
    fields: ['id', 'name', 'code', 'account_type', 'currency_id'],
    limit: 1
  });

  if (accounts.length === 0) {
    throw new Error('Account 10901 not found!');
  }

  const account = accounts[0];
  console.log(`   Found: ${account.code} - ${account.name}`);
  console.log(`   Type: ${account.account_type}\n`);

  // 2. Extract ALL move lines (batch fetching)
  console.log('2. Extracting all move lines...');
  const allMoveLines = [];
  const batchSize = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await callOdoo(sessionId, 'account.move.line', 'search_read', [], {
      domain: [['account_id', '=', account.id]],
      fields: [
        'id', 'name', 'ref', 'date', 'move_id', 'journal_id',
        'debit', 'credit', 'balance', 'amount_currency', 'currency_id',
        'partner_id', 'reconciled', 'company_id'
      ],
      limit: batchSize,
      offset,
      order: 'date desc'
    });

    allMoveLines.push(...batch);
    console.log(`   Fetched ${allMoveLines.length} lines...`);

    if (batch.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  console.log(`   ✓ Total lines extracted: ${allMoveLines.length}\n`);

  // 3. Categorize all movements
  console.log('3. Categorizing movements...\n');

  const categorized = allMoveLines.map(line => ({
    line,
    ...categorizeMovement(line)
  }));

  // 4. Calculate statistics by category
  const stats = {};
  Object.values(CATEGORIES).forEach(cat => {
    stats[cat] = {
      count: 0,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      movements: []
    };
  });

  categorized.forEach(item => {
    stats[item.category].count++;
    stats[item.category].totalDebit += item.line.debit;
    stats[item.category].totalCredit += item.line.credit;
    stats[item.category].balance += item.line.balance;
    stats[item.category].movements.push(item);
  });

  // 5. Print summary report
  console.log('=== CATEGORIZATION SUMMARY ===\n');

  Object.entries(stats).forEach(([category, stat]) => {
    console.log(`${category}:`);
    console.log(`  Count: ${stat.count} movements`);
    console.log(`  Total Debit: CHF ${stat.totalDebit.toFixed(2)}`);
    console.log(`  Total Credit: CHF ${stat.totalCredit.toFixed(2)}`);
    console.log(`  Net Balance: CHF ${stat.balance.toFixed(2)}`);
    console.log('');
  });

  // 6. Total balance verification
  const totalBalance = Object.values(stats).reduce((sum, s) => sum + s.balance, 0);
  console.log(`TOTAL BALANCE: CHF ${totalBalance.toFixed(2)}`);
  console.log(`Expected: CHF -183,912.63`);
  console.log(`Match: ${Math.abs(totalBalance - (-183912.63)) < 1 ? '✓' : '✗'}\n`);

  // 7. Sample movements per category
  console.log('=== SAMPLE MOVEMENTS BY CATEGORY ===\n');

  Object.entries(stats).forEach(([category, stat]) => {
    if (stat.count > 0) {
      console.log(`\n${category} (showing first 5 of ${stat.count}):`);
      stat.movements.slice(0, 5).forEach((m, i) => {
        const line = m.line;
        console.log(`  ${i + 1}. Date: ${line.date}`);
        console.log(`     Description: ${line.name}`);
        console.log(`     Journal: ${line.journal_id ? line.journal_id[1] : 'N/A'}`);
        console.log(`     Debit: CHF ${line.debit.toFixed(2)} | Credit: CHF ${line.credit.toFixed(2)}`);
        console.log(`     Balance: CHF ${line.balance.toFixed(2)}`);
        console.log(`     Reason: ${m.reason}`);
        console.log(`     Action: ${m.action}`);
        console.log('');
      });
    }
  });

  // 8. Generate detailed reports
  console.log('\n4. Generating detailed reports...\n');

  // Report 1: Full JSON with all data
  const fullReport = {
    account,
    totalMovements: allMoveLines.length,
    totalBalance,
    categorization: categorized,
    statistics: stats,
    extractedAt: new Date().toISOString(),
    credentials: {
      url: ODOO_URL,
      db: ODOO_DB,
      user: ODOO_USER
    }
  };

  fs.writeFileSync(
    'konto-10901-full-analysis.json',
    JSON.stringify(fullReport, null, 2)
  );
  console.log('   ✓ Full analysis saved to: konto-10901-full-analysis.json');

  // Report 2: CSV per categoria (for easy import to Excel)
  Object.entries(stats).forEach(([category, stat]) => {
    if (stat.count > 0) {
      const csvLines = [
        'ID,Date,Description,Journal,Debit,Credit,Balance,Partner,Reconciled,Reason,Suggested Action'
      ];

      stat.movements.forEach(m => {
        const line = m.line;
        csvLines.push([
          line.id,
          line.date,
          `"${(line.name || '').replace(/"/g, '""')}"`,
          `"${line.journal_id ? line.journal_id[1] : ''}"`,
          line.debit.toFixed(2),
          line.credit.toFixed(2),
          line.balance.toFixed(2),
          `"${line.partner_id ? line.partner_id[1] : ''}"`,
          line.reconciled ? 'Yes' : 'No',
          `"${m.reason}"`,
          `"${m.action}"`
        ].join(','));
      });

      const filename = `konto-10901-${category.toLowerCase()}.csv`;
      fs.writeFileSync(filename, csvLines.join('\n'));
      console.log(`   ✓ ${category} CSV saved to: ${filename}`);
    }
  });

  // Report 3: SQL queries per riclassificazione
  const sqlQueries = generateSQLQueries(stats);
  fs.writeFileSync('konto-10901-reclassification-queries.sql', sqlQueries);
  console.log('   ✓ SQL queries saved to: konto-10901-reclassification-queries.sql');

  console.log('\n✓ Analysis complete!\n');
}

/**
 * Genera SQL queries per riclassificazione
 */
function generateSQLQueries(stats) {
  let sql = `-- Database Optimizer Specialist - Konto 10901 Reclassification Queries
-- Generated: ${new Date().toISOString()}
--
-- OBIETTIVO: Riclassificare tutti i movimenti e portare saldo a CHF 0.00
-- Saldo corrente: CHF -183,912.63

-- ============================================================================
-- STEP 1: BACKUP - Create backup of current state
-- ============================================================================

CREATE TABLE account_move_line_backup_10901 AS
SELECT * FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '10901');

-- ============================================================================
-- STEP 2: IDENTIFY TARGET ACCOUNTS
-- ============================================================================

-- Find or create "Utili/Perdite su cambi" account for currency exchange
SELECT id, code, name FROM account_account
WHERE name ILIKE '%cambio%' OR name ILIKE '%exchange%' OR name ILIKE '%währung%';

-- Find bank accounts for direct transfers
SELECT id, code, name FROM account_account
WHERE account_type = 'asset_cash' OR account_type = 'asset_bank'
ORDER BY code;

-- ============================================================================
-- STEP 3: RECLASSIFICATION QUERIES BY CATEGORY
-- ============================================================================

`;

  // Currency Exchange
  if (stats[CATEGORIES.CURRENCY_EXCHANGE].count > 0) {
    const ids = stats[CATEGORIES.CURRENCY_EXCHANGE].movements.map(m => m.line.id).join(', ');
    sql += `
-- CURRENCY_EXCHANGE: ${stats[CATEGORIES.CURRENCY_EXCHANGE].count} movements
-- Balance: CHF ${stats[CATEGORIES.CURRENCY_EXCHANGE].balance.toFixed(2)}
--
-- ACTION: Move to "Utili/Perdite su cambi" account
-- Replace XXXXX with correct account ID

UPDATE account_move_line
SET account_id = XXXXX  -- ID of "Utili/Perdite su cambi" account
WHERE id IN (${ids});

`;
  }

  // Bank Transfers
  if (stats[CATEGORIES.BANK_TRANSFER].count > 0) {
    sql += `
-- BANK_TRANSFER: ${stats[CATEGORIES.BANK_TRANSFER].count} movements
-- Balance: CHF ${stats[CATEGORIES.BANK_TRANSFER].balance.toFixed(2)}
--
-- ACTION: Book directly between bank accounts (requires manual review)
-- For each transfer, create offsetting entries in source and destination accounts

-- Example template:
-- UPDATE account_move_line
-- SET account_id = <destination_bank_account_id>
-- WHERE id = <line_id>;

-- List of transfer IDs for manual review:
`;
    stats[CATEGORIES.BANK_TRANSFER].movements.slice(0, 20).forEach(m => {
      sql += `-- ID ${m.line.id}: ${m.line.date} - ${m.line.name} (CHF ${m.line.balance.toFixed(2)})\n`;
    });
    if (stats[CATEGORIES.BANK_TRANSFER].count > 20) {
      sql += `-- ... and ${stats[CATEGORIES.BANK_TRANSFER].count - 20} more (see CSV)\n`;
    }
    sql += '\n';
  }

  // Credit Cards
  if (stats[CATEGORIES.CREDIT_CARD].count > 0) {
    sql += `
-- CREDIT_CARD: ${stats[CATEGORIES.CREDIT_CARD].count} movements
-- Balance: CHF ${stats[CATEGORIES.CREDIT_CARD].balance.toFixed(2)}
--
-- ACTION: Verify and potentially rebook to correct credit card account
-- These might already be correct, manual review recommended

-- List of credit card transaction IDs:
`;
    stats[CATEGORIES.CREDIT_CARD].movements.forEach(m => {
      sql += `-- ID ${m.line.id}: ${m.line.date} - ${m.line.name} (CHF ${m.line.balance.toFixed(2)})\n`;
    });
    sql += '\n';
  }

  // Other
  if (stats[CATEGORIES.OTHER].count > 0) {
    sql += `
-- OTHER: ${stats[CATEGORIES.OTHER].count} movements
-- Balance: CHF ${stats[CATEGORIES.OTHER].balance.toFixed(2)}
--
-- ACTION: Manual review and classification required

-- List of unclassified transaction IDs:
`;
    stats[CATEGORIES.OTHER].movements.slice(0, 20).forEach(m => {
      sql += `-- ID ${m.line.id}: ${m.line.date} - ${m.line.name} (CHF ${m.line.balance.toFixed(2)})\n`;
    });
    if (stats[CATEGORIES.OTHER].count > 20) {
      sql += `-- ... and ${stats[CATEGORIES.OTHER].count - 20} more (see CSV)\n`;
    }
    sql += '\n';
  }

  sql += `
-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Check remaining balance on account 10901 (should be 0.00 after reclassification)
SELECT
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(balance) as total_balance
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '10901');

-- Check movements by new accounts
SELECT
  a.code,
  a.name,
  COUNT(*) as movement_count,
  SUM(aml.debit) as total_debit,
  SUM(aml.credit) as total_credit,
  SUM(aml.balance) as total_balance
FROM account_move_line aml
JOIN account_account a ON aml.account_id = a.id
WHERE aml.id IN (
  SELECT id FROM account_move_line_backup_10901
)
GROUP BY a.code, a.name
ORDER BY a.code;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback all changes:
-- UPDATE account_move_line aml
-- SET account_id = b.account_id
-- FROM account_move_line_backup_10901 b
-- WHERE aml.id = b.id;
`;

  return sql;
}

// Run analysis
analyzeKonto10901().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
