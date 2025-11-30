/**
 * KONTO 10901 - Quick Summary Report
 * Database Optimizer Specialist
 */

const fs = require('fs');

// Load analysis data
const data = JSON.parse(fs.readFileSync('konto-10901-analysis-v2.json', 'utf8'));

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('              KONTO 10901 - RICLASSIFICAZIONE MOVIMENTI');
console.log('                  Database Optimizer Specialist');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('\n');

// Header info
console.log('ACCOUNT INFORMATION:');
console.log('  Code:           10901');
console.log('  Name:           Trasferimento di liquidità');
console.log('  Type:           asset_current');
console.log('  Total Movements: 353');
console.log('  Current Balance: CHF -375,615.65');
console.log('  Target Balance:  CHF 0.00');
console.log('\n');

console.log('OBIETTIVO: Riclassificare TUTTI i movimenti e azzerare il saldo');
console.log('\n');

console.log('─────────────────────────────────────────────────────────────────────────');
console.log('                        CATEGORIZATION SUMMARY');
console.log('─────────────────────────────────────────────────────────────────────────');
console.log('\n');

const stats = data.statistics;

// Priority 1 - HIGH
console.log('🔴 PRIORITY 1 - HIGH (Immediate Action Required)');
console.log('─────────────────────────────────────────────────────────────────────────');

const priority1 = [
  {
    category: 'CURRENCY_EXCHANGE_FX',
    name: 'Cambi Valuta EUR/CHF',
    targetAccount: '2660 - Utili/perdite da cambi',
    action: 'Execute SQL reclassification'
  },
  {
    category: 'CREDIT_CARD_PAYMENT',
    name: 'Pagamenti Carte Credito',
    targetAccount: '10803 - UBS Kreditkarte',
    action: 'Execute SQL reclassification'
  },
  {
    category: 'BANK_TRANSFER_INTERNAL',
    name: 'Trasferimenti Interni',
    targetAccount: 'Direct bank-to-bank',
    action: 'Manual review required'
  }
];

priority1.forEach(item => {
  const stat = stats[item.category];
  if (stat && stat.count > 0) {
    console.log(`\n${item.name}:`);
    console.log(`  Count:          ${stat.count} movements`);
    console.log(`  Balance:        CHF ${stat.balance.toFixed(2)}`);
    console.log(`  Target Account: ${item.targetAccount}`);
    console.log(`  Action:         ${item.action}`);
  }
});

console.log('\n');

// Priority 2 - MEDIUM
console.log('🟡 PRIORITY 2 - MEDIUM (Review and Reclassify)');
console.log('─────────────────────────────────────────────────────────────────────────');

const priority2 = [
  {
    category: 'CURRENCY_DIFF',
    name: 'Differenze Valuta',
    action: 'Review and move to 2660 if FX gains/losses'
  },
  {
    category: 'INSTANT_PAYMENT',
    name: 'Pagamenti Istantanei',
    action: 'CRITICAL - Check for duplicates in expense accounts'
  },
  {
    category: 'CASH_DEPOSIT',
    name: 'Depositi Contanti',
    action: 'Move to 1000 - Cassa'
  }
];

priority2.forEach(item => {
  const stat = stats[item.category];
  if (stat && stat.count > 0) {
    console.log(`\n${item.name}:`);
    console.log(`  Count:   ${stat.count} movements`);
    console.log(`  Balance: CHF ${stat.balance.toFixed(2)}`);
    console.log(`  Action:  ${item.action}`);
  }
});

console.log('\n');

// Priority 3 - LOW
console.log('⚪ PRIORITY 3 - LOW (Manual Review)');
console.log('─────────────────────────────────────────────────────────────────────────');

const otherStat = stats['OTHER'];
if (otherStat && otherStat.count > 0) {
  console.log(`\nOther Movements:`);
  console.log(`  Count:   ${otherStat.count} movements`);
  console.log(`  Balance: CHF ${otherStat.balance.toFixed(2)}`);
  console.log(`  Action:  Manual categorization required (case-by-case)`);
}

console.log('\n');

// Quick action checklist
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                          QUICK ACTION PLAN');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('\n');

console.log('TODAY:');
console.log('  [ ] 1. Review konto-10901-reclassification-plan.sql');
console.log('  [ ] 2. Execute FX reclassification (40 movements → 2660)');
console.log('  [ ] 3. Execute Credit Card reclassification (15 movements → 10803)');
console.log('  [ ] 4. Start manual review of internal transfers (29 movements)');
console.log('\n');

console.log('THIS WEEK:');
console.log('  [ ] 5. Review currency differences (39 movements)');
console.log('  [ ] 6. Check instant payments for duplicates (69 movements) - CRITICAL!');
console.log('  [ ] 7. Reclassify cash deposits (4 movements → 1000)');
console.log('\n');

console.log('NEXT WEEK:');
console.log('  [ ] 8. Manual categorization of OTHER movements (157)');
console.log('  [ ] 9. Final verification queries');
console.log('  [ ] 10. Close Konto 10901 (target: CHF 0.00)');
console.log('\n');

// Expected impact
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                         EXPECTED IMPACT');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('\n');

const fxBalance = stats['CURRENCY_EXCHANGE_FX']?.balance || 0;
const ccBalance = stats['CREDIT_CARD_PAYMENT']?.balance || 0;
const immediateImpact = fxBalance + ccBalance;

console.log('After Immediate Actions (Step 1.1 + 1.2):');
console.log(`  FX Transactions:       CHF ${fxBalance.toFixed(2)}`);
console.log(`  Credit Card Payments:  CHF ${ccBalance.toFixed(2)}`);
console.log(`  ────────────────────────────────────────`);
console.log(`  TOTAL IMPACT:          CHF ${immediateImpact.toFixed(2)}`);
console.log('\n');

console.log(`  Remaining on 10901:    CHF ${(data.totalBalance - immediateImpact).toFixed(2)}`);
console.log(`  Movements to review:   ${353 - 55} (353 - 55 immediate)`);
console.log('\n');

console.log('After ALL Steps:');
console.log(`  Final Balance:         CHF 0.00`);
console.log(`  Status:                ✓ Account closed`);
console.log('\n');

// Files reference
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                         FILES GENERATED');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('\n');

console.log('REPORTS:');
console.log('  📄 KONTO-10901-EXECUTIVE-REPORT.md     - Executive summary');
console.log('  📊 konto-10901-analysis-v2.json        - Full analysis data');
console.log('  🔧 konto-10901-reclassification-plan.sql - SQL execution plan');
console.log('\n');

console.log('CSV FILES (for Excel):');
console.log('  📑 konto-10901-v2-currency_exchange_fx.csv    (40 movements)');
console.log('  📑 konto-10901-v2-credit_card_payment.csv     (15 movements)');
console.log('  📑 konto-10901-v2-bank_transfer_internal.csv  (29 movements)');
console.log('  📑 konto-10901-v2-currency_diff.csv           (39 movements)');
console.log('  📑 konto-10901-v2-instant_payment.csv         (69 movements)');
console.log('  📑 konto-10901-v2-cash_deposit.csv            (4 movements)');
console.log('  📑 konto-10901-v2-other.csv                   (157 movements)');
console.log('\n');

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                    DATABASE OPTIMIZER SPECIALIST');
console.log('              Analysis complete - Ready for reclassification');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('\n');
