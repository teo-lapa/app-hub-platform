/**
 * Database Optimizer Specialist - Konto 10901 Analysis V2
 *
 * IMPROVED CATEGORIZATION con pattern matching più precisi
 * Analisi dettagliata dei 353 movimenti estratti
 */

const fs = require('fs');

// Carica dati già estratti
const data = JSON.parse(fs.readFileSync('konto-10901-full-analysis.json', 'utf8'));

const CATEGORIES = {
  CURRENCY_EXCHANGE_FX: 'CURRENCY_EXCHANGE_FX',       // Reale cambio EUR/CHF con tasso
  CURRENCY_DIFF: 'CURRENCY_DIFF',                     // Differenze su pagamenti in valuta estera
  CREDIT_CARD_PAYMENT: 'CREDIT_CARD_PAYMENT',         // Pagamento fatture carte credito
  BANK_TRANSFER_INTERNAL: 'BANK_TRANSFER_INTERNAL',   // Trasferimenti interni tra conti
  INSTANT_PAYMENT: 'INSTANT_PAYMENT',                 // Instant payment / carburante
  CLEARING: 'CLEARING',                               // Operazioni clearing
  CASH_DEPOSIT: 'CASH_DEPOSIT',                       // Depositi in contanti
  OTHER: 'OTHER'                                      // Altri movimenti
};

/**
 * Categorizza con pattern matching migliorato
 */
function improvedCategorization(line) {
  const name = (line.name || '').toLowerCase();
  const ref = (line.ref || '').toLowerCase();
  const journalName = line.journal_id ? line.journal_id[1].toLowerCase() : '';

  // 1. FX REALE - Cambio EUR/CHF con tasso esplicito
  if (
    (name.includes('ihr kauf eur') && name.includes('ihr verkauf chf')) ||
    (name.includes('bezahlter kurs') && name.includes('eur/chf')) ||
    name.includes('kauf fx spot')
  ) {
    return {
      category: CATEGORIES.CURRENCY_EXCHANGE_FX,
      reason: 'Real FX transaction EUR/CHF with explicit exchange rate',
      action: 'Move to "Utili/Perdite su cambi" account',
      priority: 1,
      accountType: '2660 - Utili/perdite da cambi'
    };
  }

  // 2. Differenze valuta (ma non FX spot)
  if (
    (name.includes('eur') || name.includes('währung')) &&
    !name.includes('ihr kauf') &&
    !name.includes('iban')
  ) {
    return {
      category: CATEGORIES.CURRENCY_DIFF,
      reason: 'Currency difference on foreign payment',
      action: 'Move to "Utili/Perdite su cambi" account',
      priority: 2,
      accountType: '2660 - Utili/perdite da cambi'
    };
  }

  // 3. Pagamenti carte credito
  if (
    name.includes('ubs switzerland ag') && name.includes('card center') ||
    ref.includes('fattura della carta di credito') ||
    name.includes('kreditkarten-abrechnung') ||
    name.includes('carta di credito')
  ) {
    return {
      category: CATEGORIES.CREDIT_CARD_PAYMENT,
      reason: 'Credit card payment/invoice',
      action: 'Book directly to credit card account (10803)',
      priority: 1,
      accountType: '10803 - UBS Kreditkarte'
    };
  }

  // 4. Trasferimenti interni tra conti
  if (
    name.includes('trasferimento da un conto all\'altro') ||
    name.includes('kontoübertrag') ||
    (name.includes('zahlung an karte') && name.includes('iban'))
  ) {
    return {
      category: CATEGORIES.BANK_TRANSFER_INTERNAL,
      reason: 'Internal transfer between bank accounts',
      action: 'Book directly between source and destination accounts',
      priority: 1,
      accountType: 'Direct bank-to-bank'
    };
  }

  // 5. Instant payment / carburante
  if (
    name.includes('instant-zahlung') ||
    name.includes('instant payment') ||
    (name.includes('carburante') && !name.includes('trasferimento'))
  ) {
    return {
      category: CATEGORIES.INSTANT_PAYMENT,
      reason: 'Instant payment (fuel/operations)',
      action: 'Review: might be double entry, book to expense account',
      priority: 2,
      accountType: '6xxx - Spese operative'
    };
  }

  // 6. Operazioni clearing
  if (
    name.includes('pagamento clearing') ||
    name.includes('clearing')
  ) {
    return {
      category: CATEGORIES.CLEARING,
      reason: 'Clearing operation',
      action: 'Review clearing process, might need offsetting entry',
      priority: 2,
      accountType: 'Clearing account'
    };
  }

  // 7. Depositi contanti
  if (
    name.includes('einzahlung') ||
    name.includes('bareinzahlungs')
  ) {
    return {
      category: CATEGORIES.CASH_DEPOSIT,
      reason: 'Cash deposit',
      action: 'Book directly to cash account',
      priority: 2,
      accountType: '1000 - Cassa'
    };
  }

  // 8. Altri
  return {
    category: CATEGORIES.OTHER,
    reason: 'Does not match specific patterns - manual review needed',
    action: 'Manual categorization required',
    priority: 3,
    accountType: 'TBD'
  };
}

/**
 * Analizza con categorizzazione migliorata
 */
function analyzeV2() {
  console.log('\n=== KONTO 10901 ANALYSIS V2 - IMPROVED CATEGORIZATION ===\n');
  console.log(`Total movements: ${data.totalMovements}`);
  console.log(`Current total balance: CHF ${data.totalBalance.toFixed(2)}\n`);

  // Ricategorizza tutti i movimenti
  const recategorized = data.categorization.map(item => ({
    line: item.line,
    ...improvedCategorization(item.line)
  }));

  // Calcola statistiche per categoria
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

  recategorized.forEach(item => {
    stats[item.category].count++;
    stats[item.category].totalDebit += item.line.debit;
    stats[item.category].totalCredit += item.line.credit;
    stats[item.category].balance += item.line.balance;
    stats[item.category].movements.push(item);
  });

  // Report categorizzazione
  console.log('=== IMPROVED CATEGORIZATION SUMMARY ===\n');

  // Ordina per priority (1 = alta priorità)
  const sortedCategories = Object.entries(stats).sort((a, b) => {
    if (a[1].count === 0) return 1;
    if (b[1].count === 0) return -1;
    const priorityA = a[1].movements[0]?.priority || 3;
    const priorityB = b[1].movements[0]?.priority || 3;
    return priorityA - priorityB;
  });

  sortedCategories.forEach(([category, stat]) => {
    if (stat.count > 0) {
      const priority = stat.movements[0]?.priority || 3;
      const priorityLabel = priority === 1 ? '🔴 HIGH' : priority === 2 ? '🟡 MEDIUM' : '⚪ LOW';

      console.log(`${category} (${priorityLabel}):`);
      console.log(`  Count: ${stat.count} movements`);
      console.log(`  Total Debit: CHF ${stat.totalDebit.toFixed(2)}`);
      console.log(`  Total Credit: CHF ${stat.totalCredit.toFixed(2)}`);
      console.log(`  Net Balance: CHF ${stat.balance.toFixed(2)}`);
      console.log(`  Suggested account: ${stat.movements[0]?.accountType || 'N/A'}`);
      console.log('');
    }
  });

  // Verifica totale
  const totalBalance = Object.values(stats).reduce((sum, s) => sum + s.balance, 0);
  console.log(`TOTAL BALANCE: CHF ${totalBalance.toFixed(2)}`);
  console.log(`Match original: ${Math.abs(totalBalance - data.totalBalance) < 0.01 ? '✓' : '✗'}\n`);

  // Sample dettagliati per categoria
  console.log('=== DETAILED SAMPLES BY CATEGORY ===\n');

  sortedCategories.forEach(([category, stat]) => {
    if (stat.count > 0) {
      console.log(`\n${category} (${stat.count} movements):`);
      console.log(`Suggested action: ${stat.movements[0]?.action}\n`);

      stat.movements.slice(0, 3).forEach((m, i) => {
        const line = m.line;
        console.log(`  ${i + 1}. ID ${line.id} - Date: ${line.date}`);
        console.log(`     ${line.name.substring(0, 100)}${line.name.length > 100 ? '...' : ''}`);
        console.log(`     Journal: ${line.journal_id ? line.journal_id[1] : 'N/A'}`);
        console.log(`     Debit: CHF ${line.debit.toFixed(2)} | Credit: CHF ${line.credit.toFixed(2)} | Balance: CHF ${line.balance.toFixed(2)}`);
        console.log('');
      });
    }
  });

  // Salva risultati V2
  const outputV2 = {
    originalData: data,
    improvedCategorization: recategorized,
    statistics: stats,
    totalBalance,
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    'konto-10901-analysis-v2.json',
    JSON.stringify(outputV2, null, 2)
  );
  console.log('\n✓ Improved analysis saved to: konto-10901-analysis-v2.json');

  // CSV per categoria (V2)
  Object.entries(stats).forEach(([category, stat]) => {
    if (stat.count > 0) {
      const csvLines = [
        'ID,Date,Description,Journal,Debit,Credit,Balance,Category,Priority,Suggested Account,Action'
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
          category,
          m.priority,
          `"${m.accountType}"`,
          `"${m.action}"`
        ].join(','));
      });

      const filename = `konto-10901-v2-${category.toLowerCase()}.csv`;
      fs.writeFileSync(filename, csvLines.join('\n'));
      console.log(`   ✓ ${category} CSV: ${filename}`);
    }
  });

  // Genera piano di riclassificazione dettagliato
  generateReclassificationPlan(stats);

  console.log('\n✓ Analysis V2 complete!\n');
}

/**
 * Genera piano di riclassificazione step-by-step
 */
function generateReclassificationPlan(stats) {
  let plan = `-- ============================================================================
-- PIANO DI RICLASSIFICAZIONE KONTO 10901
-- Database Optimizer Specialist - Generated: ${new Date().toISOString()}
-- ============================================================================
--
-- OBIETTIVO: Portare saldo Konto 10901 da CHF -375,615.65 a CHF 0.00
-- Total movements: ${data.totalMovements}
--
-- STEP-BY-STEP RECLASSIFICATION PLAN
-- ============================================================================

`;

  // Priority 1 - Alta priorità
  plan += `\n-- ============================================================================
-- PRIORITY 1 - HIGH (Immediate action required)
-- ============================================================================\n\n`;

  const priority1 = Object.entries(stats).filter(([cat, stat]) =>
    stat.count > 0 && stat.movements[0]?.priority === 1
  );

  priority1.forEach(([category, stat]) => {
    plan += `-- ${category}: ${stat.count} movements, Balance: CHF ${stat.balance.toFixed(2)}\n`;
    plan += `-- Action: ${stat.movements[0]?.action}\n`;
    plan += `-- Target account: ${stat.movements[0]?.accountType}\n\n`;

    if (category === CATEGORIES.CURRENCY_EXCHANGE_FX) {
      plan += `-- 1. Find or create "Utili/Perdite su cambi" account\n`;
      plan += `SELECT id, code, name FROM account_account
WHERE code = '2660' OR name ILIKE '%cambi%' OR name ILIKE '%währung%';\n\n`;

      const ids = stat.movements.map(m => m.line.id).join(', ');
      plan += `-- 2. Reclassify all FX transactions\n`;
      plan += `UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '2660')
WHERE id IN (${ids});\n\n`;
      plan += `-- Expected impact: CHF ${stat.balance.toFixed(2)}\n\n`;
    }

    if (category === CATEGORIES.CREDIT_CARD_PAYMENT) {
      plan += `-- 1. Find credit card account\n`;
      plan += `SELECT id, code, name FROM account_account WHERE code = '10803';\n\n`;

      const ids = stat.movements.map(m => m.line.id).join(', ');
      plan += `-- 2. Reclassify credit card payments\n`;
      plan += `UPDATE account_move_line
SET account_id = (SELECT id FROM account_account WHERE code = '10803')
WHERE id IN (${ids});\n\n`;
      plan += `-- Expected impact: CHF ${stat.balance.toFixed(2)}\n\n`;
    }

    if (category === CATEGORIES.BANK_TRANSFER_INTERNAL) {
      plan += `-- IMPORTANT: These require manual review - each transfer needs individual handling\n`;
      plan += `-- You need to identify source and destination accounts for each transfer\n\n`;

      stat.movements.slice(0, 10).forEach(m => {
        plan += `-- ID ${m.line.id}: ${m.line.date} - CHF ${m.line.balance.toFixed(2)}\n`;
        plan += `--   ${m.line.name.substring(0, 100)}\n`;
        plan += `--   TODO: Identify source and destination accounts\n\n`;
      });
    }

    plan += `\n`;
  });

  // Priority 2 - Media priorità
  plan += `\n-- ============================================================================
-- PRIORITY 2 - MEDIUM (Review and reclassify)
-- ============================================================================\n\n`;

  const priority2 = Object.entries(stats).filter(([cat, stat]) =>
    stat.count > 0 && stat.movements[0]?.priority === 2
  );

  priority2.forEach(([category, stat]) => {
    plan += `-- ${category}: ${stat.count} movements, Balance: CHF ${stat.balance.toFixed(2)}\n`;
    plan += `-- Action: ${stat.movements[0]?.action}\n\n`;

    plan += `-- Sample movements (first 5):\n`;
    stat.movements.slice(0, 5).forEach(m => {
      plan += `-- ID ${m.line.id}: ${m.line.date} - CHF ${m.line.balance.toFixed(2)}\n`;
    });
    plan += `\n`;
  });

  // Priority 3 - Bassa priorità
  plan += `\n-- ============================================================================
-- PRIORITY 3 - LOW (Manual review required)
-- ============================================================================\n\n`;

  const priority3 = Object.entries(stats).filter(([cat, stat]) =>
    stat.count > 0 && stat.movements[0]?.priority === 3
  );

  priority3.forEach(([category, stat]) => {
    plan += `-- ${category}: ${stat.count} movements, Balance: CHF ${stat.balance.toFixed(2)}\n`;
    plan += `-- These require individual assessment\n\n`;
  });

  // Verification queries
  plan += `\n-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================\n\n`;

  plan += `-- Check current balance on 10901
SELECT
  SUM(debit) as total_debit,
  SUM(credit) as total_credit,
  SUM(balance) as current_balance,
  COUNT(*) as movement_count
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '10901');\n\n`;

  plan += `-- After reclassification, this should show 0.00:
-- Expected result: current_balance = 0.00, movement_count = 0\n\n`;

  plan += `-- Check distribution by new accounts
SELECT
  a.code,
  a.name,
  COUNT(*) as movements,
  SUM(aml.debit) as total_debit,
  SUM(aml.credit) as total_credit,
  SUM(aml.balance) as balance
FROM account_move_line aml
JOIN account_account a ON aml.account_id = a.id
WHERE aml.id IN (
  SELECT id FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '10901')
)
GROUP BY a.code, a.name
ORDER BY a.code;\n\n`;

  fs.writeFileSync('konto-10901-reclassification-plan.sql', plan);
  console.log('   ✓ Detailed plan: konto-10901-reclassification-plan.sql');
}

// Run analysis V2
analyzeV2();
