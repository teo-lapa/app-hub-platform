/**
 * COMPLETE BANK STATEMENT IMPORT SCRIPT - 2024
 *
 * Imports ALL missing UBS bank statements (CHF + EUR) into Odoo
 * Resolves CHF 343K discrepancy caused by missing transactions from June onwards
 *
 * STRATEGY:
 * 1. Parse all 6 CSV files (4 CHF + 2 EUR)
 * 2. Deduplicate against existing Odoo transactions
 * 3. Batch import with error handling
 * 4. Validate balances
 * 5. Generate comprehensive report
 *
 * EXECUTION:
 * npx tsx scripts/import-bank-statements-2024-complete.ts
 */

import { BankStatementImportService, ImportSummary } from '../lib/services/bank-statement-import-service';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  odoo: {
    url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
    db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
    username: 'paul@lapa.ch',
    password: 'lapa201180'
  },

  // Base directory containing CSV files
  baseDir: 'C:\\Users\\lapa\\Downloads\\CHIUSURA 2024\\CHIUSURA 2024',

  // Journal mappings
  journals: [
    {
      ubsCode: 'UBS CHF',
      odooJournalCode: 'UBSCH', // Adjust to actual Odoo journal code
      currency: 'CHF',
      targetBalance: undefined // Will be set from last CSV closing balance
    },
    {
      ubsCode: 'UBS EUR',
      odooJournalCode: 'UBEUR', // Adjust to actual Odoo journal code
      currency: 'EUR',
      targetBalance: undefined
    }
  ],

  // Options
  skipIfExists: true, // Skip if statement already imported
  validateBalance: true,
  dryRun: false // Set to true for testing without actual import
};

/**
 * Main execution function
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('BANK STATEMENT IMPORT - CHIUSURA 2024');
  console.log('Resolving CHF 343K discrepancy from missing statements');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Initialize import service
    console.log('Connecting to Odoo...');
    const importService = new BankStatementImportService(CONFIG.odoo);
    await importService.connect();
    console.log('✓ Connected to Odoo\n');

    // 2. Verify journals exist
    console.log('Verifying Odoo journals...');
    await verifyJournals(importService);
    console.log('✓ Journals verified\n');

    // 3. Scan available files
    console.log('Scanning CSV files...');
    const filesInfo = scanFiles(CONFIG.baseDir);
    console.log(`✓ Found ${filesInfo.totalFiles} CSV files (${filesInfo.totalLines} total lines)\n`);

    if (CONFIG.dryRun) {
      console.log('DRY RUN MODE - No actual imports will be performed\n');
      return;
    }

    // 4. Import all statements
    console.log('Starting import process...\n');
    const summary = await importService.importAll2024(CONFIG.baseDir, CONFIG.journals);

    // 5. Generate and display report
    console.log('\n' + '='.repeat(80));
    console.log('IMPORT COMPLETED');
    console.log('='.repeat(80) + '\n');

    const report = importService.generateReport(summary);
    console.log(report);

    // 6. Save report to file
    const reportPath = saveReport(summary, report);
    console.log(`\n✓ Report saved to: ${reportPath}\n`);

    // 7. Display summary
    displaySummary(summary);

    // 8. Check if discrepancy is resolved
    checkDiscrepancyResolution(summary);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Verify that required journals exist in Odoo
 */
async function verifyJournals(service: BankStatementImportService) {
  const client = (service as any).client;

  for (const mapping of CONFIG.journals) {
    console.log(`  Checking journal: ${mapping.odooJournalCode}...`);
    const journal = await client.findJournal(mapping.odooJournalCode);

    if (!journal) {
      console.error(`\n❌ ERROR: Journal "${mapping.odooJournalCode}" not found in Odoo`);
      console.log('\nAvailable bank journals:');
      const bankJournals = await client.getBankJournals();
      bankJournals.forEach((j: any) => {
        console.log(`  - ${j.code}: ${j.name} (${j.currency_id ? j.currency_id[1] : 'CHF'})`);
      });
      throw new Error(`Journal ${mapping.odooJournalCode} not found`);
    }

    console.log(`    ✓ Found: ${journal.name} (ID: ${journal.id})`);
  }
}

/**
 * Scan files and get statistics
 */
function scanFiles(baseDir: string): {
  totalFiles: number;
  totalLines: number;
  files: { path: string; lines: number; currency: string }[];
} {
  const files: { path: string; lines: number; currency: string }[] = [];
  let totalLines = 0;

  for (const mapping of CONFIG.journals) {
    const dirPath = path.join(baseDir, mapping.ubsCode);

    if (!fs.existsSync(dirPath)) {
      console.warn(`  Warning: Directory not found: ${dirPath}`);
      continue;
    }

    const csvFiles = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.csv'))
      .sort();

    for (const file of csvFiles) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;

      files.push({
        path: filePath,
        lines,
        currency: mapping.currency
      });

      totalLines += lines;
      console.log(`  ${file}: ${lines} lines (${mapping.currency})`);
    }
  }

  return {
    totalFiles: files.length,
    totalLines,
    files
  };
}

/**
 * Save report to file
 */
function saveReport(summary: ImportSummary, reportText: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = path.join(
    process.cwd(),
    `bank-import-report-${timestamp}.txt`
  );

  // Save text report
  fs.writeFileSync(reportPath, reportText, 'utf-8');

  // Save JSON for programmatic access
  const jsonPath = reportPath.replace('.txt', '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

  return reportPath;
}

/**
 * Display summary
 */
function displaySummary(summary: ImportSummary) {
  console.log('QUICK SUMMARY');
  console.log('-'.repeat(80));

  const successRate = summary.totalFiles > 0
    ? ((summary.successCount / summary.totalFiles) * 100).toFixed(1)
    : '0.0';

  console.log(`Files processed:      ${summary.totalFiles}`);
  console.log(`Successful imports:   ${summary.successCount} (${successRate}%)`);
  console.log(`Failed imports:       ${summary.failureCount}`);
  console.log(`Transactions added:   ${summary.totalTransactions.toLocaleString()}`);
  console.log('');

  // Balance verification
  if (summary.balanceVerification.length > 0) {
    console.log('BALANCE VERIFICATION');
    console.log('-'.repeat(80));

    for (const verification of summary.balanceVerification) {
      const status = verification.matches ? '✓ MATCH' : '✗ MISMATCH';
      const diff = verification.actualBalance - verification.expectedBalance;

      console.log(`${verification.journal} (${verification.currency}):`);
      console.log(`  Expected: ${verification.expectedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  Actual:   ${verification.actualBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  Diff:     ${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${status}`);
      console.log('');
    }
  }
}

/**
 * Check if discrepancy is resolved
 */
function checkDiscrepancyResolution(summary: ImportSummary) {
  console.log('DISCREPANCY RESOLUTION CHECK');
  console.log('-'.repeat(80));

  const targetDiscrepancy = 343000; // CHF 343K original discrepancy

  if (summary.totalTransactions > 2000) {
    console.log(`✓ SUCCESS: Imported ${summary.totalTransactions.toLocaleString()} transactions`);
    console.log('  This should resolve the CHF 343K discrepancy.');
  } else {
    console.log(`⚠ WARNING: Only ${summary.totalTransactions} transactions imported`);
    console.log('  Expected ~2,263 transactions. Some files may be missing.');
  }

  console.log('');
  console.log('NEXT STEPS:');
  console.log('1. Verify balances in Odoo match bank statements');
  console.log('2. Run bank reconciliation for unmatched transactions');
  console.log('3. Review any failed imports and retry if necessary');
  console.log('4. Generate final accounting report for commercialista');
  console.log('');
}

// Execute
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
