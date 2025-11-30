#!/usr/bin/env ts-node

/**
 * Import Bank Statements 2024
 *
 * Imports all bank statements for year 2024 into Odoo:
 * - UBS CHF (Q1-Q4)
 * - UBS EUR (H1-H2)
 * - Credit Suisse (from PDFs - TODO)
 *
 * Usage:
 *   ts-node scripts/import-bank-statements-2024.ts
 *   ts-node scripts/import-bank-statements-2024.ts --dry-run
 *   ts-node scripts/import-bank-statements-2024.ts --journal UBS_CHF
 */

import { BankStatementImportService, JournalMapping } from '../lib/services/bank-statement-import-service';
import * as fs from 'fs';
import * as path from 'path';

// Odoo configuration
const ODOO_CONFIG = {
  odooUrl: process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  odooDb: process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-25408900',
  odooUsername: process.env.ODOO_USERNAME || 'paul@lapa.ch',
  odooPassword: process.env.ODOO_PASSWORD || 'lapa201180'
};

// Base directory for bank statements
const BASE_DIR = 'C:\\Users\\lapa\\Downloads\\CHIUSURA 2024\\CHIUSURA 2024';

// Journal mappings
const JOURNAL_MAPPINGS: JournalMapping[] = [
  {
    ubsCode: 'UBS CHF',
    odooJournalCode: 'UBS_CHF', // Update this to match your Odoo journal code
    currency: 'CHF',
    targetBalance: 182613.26 // Target balance on 31.12.2024
  },
  {
    ubsCode: 'UBS EUR',
    odooJournalCode: 'UBS_EUR', // Update this to match your Odoo journal code
    currency: 'EUR',
    targetBalance: 128860.70 // Target balance on 31.12.2024
  }
  // Credit Suisse will be added later when PDF parser is ready
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const journalFilter = args.find(a => a.startsWith('--journal='))?.split('=')[1];

  console.log('='.repeat(80));
  console.log('BANK STATEMENT IMPORT 2024');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Odoo URL: ${ODOO_CONFIG.odooUrl}`);
  console.log(`Odoo DB: ${ODOO_CONFIG.odooDb}`);
  console.log(`Odoo User: ${ODOO_CONFIG.odooUsername}`);
  console.log(`Base Directory: ${BASE_DIR}`);
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  // Verify directories exist
  console.log('Verifying directories...');
  const missingDirs: string[] = [];

  for (const mapping of JOURNAL_MAPPINGS) {
    if (journalFilter && mapping.ubsCode !== journalFilter) {
      continue;
    }

    const dirPath = path.join(BASE_DIR, mapping.ubsCode);
    if (!fs.existsSync(dirPath)) {
      missingDirs.push(dirPath);
    } else {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
      console.log(`  ✓ ${mapping.ubsCode}: ${files.length} CSV files`);
    }
  }

  if (missingDirs.length > 0) {
    console.error('\nERROR: Missing directories:');
    missingDirs.forEach(dir => console.error(`  - ${dir}`));
    process.exit(1);
  }

  console.log('');

  if (dryRun) {
    console.log('DRY RUN MODE - No data will be imported to Odoo');
    console.log('');
    return;
  }

  // Create import service
  const service = new BankStatementImportService(ODOO_CONFIG);

  try {
    // Connect to Odoo
    console.log('Connecting to Odoo...');
    await service.connect();
    console.log('✓ Connected to Odoo\n');

    // Filter mappings if journal specified
    let mappingsToImport = JOURNAL_MAPPINGS;
    if (journalFilter) {
      mappingsToImport = JOURNAL_MAPPINGS.filter(m => m.ubsCode === journalFilter);
      if (mappingsToImport.length === 0) {
        console.error(`ERROR: Journal "${journalFilter}" not found`);
        process.exit(1);
      }
    }

    // Import all statements
    const summary = await service.importAll2024(BASE_DIR, mappingsToImport);

    // Generate and print report
    console.log('\n');
    const report = service.generateReport(summary);
    console.log(report);

    // Save report to file
    const reportPath = path.join(
      process.cwd(),
      `bank-import-report-${new Date().toISOString().split('T')[0]}.txt`
    );
    fs.writeFileSync(reportPath, report);
    console.log(`\nReport saved to: ${reportPath}`);

    // Exit with error code if any imports failed
    if (summary.failureCount > 0) {
      console.error(`\n${summary.failureCount} imports failed`);
      process.exit(1);
    }

    // Exit with error code if any balance mismatches
    const balanceMismatches = summary.balanceVerification.filter(v => !v.matches);
    if (balanceMismatches.length > 0) {
      console.error(`\n${balanceMismatches.length} balance mismatches detected`);
      process.exit(1);
    }

    console.log('\n✓ All imports completed successfully with matching balances!');

  } catch (error) {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
