/**
 * Full Sync Script - MAESTRO AI
 *
 * Sync ALL customers from Odoo (last 4 months)
 *
 * Run: npx tsx scripts/run-full-sync.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { syncCustomersFromOdoo, getSyncStatus } from '../lib/maestro/sync-odoo-v2';

async function main() {
  console.log('🚀 ========================================');
  console.log('   MAESTRO AI - FULL SYNC');
  console.log('   Syncing ALL customers (last 4 months)');
  console.log('========================================\n');

  try {
    // Check initial status
    const initialStatus = await getSyncStatus();
    console.log(`📊 Current database: ${initialStatus.totalAvatars} avatars\n`);

    // Confirm
    console.log('⚠️  WARNING: This will sync ALL customers from Odoo.');
    console.log('   This may take several minutes.\n');

    // Run full sync
    const result = await syncCustomersFromOdoo({
      monthsBack: 4,
      dryRun: false
    });

    // Results
    console.log('\n📈 SYNC RESULTS');
    console.log('========================================');
    console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Synced: ${result.synced} customers`);
    console.log(`Created: ${result.created} new avatars`);
    console.log(`Updated: ${result.updated} existing avatars`);
    console.log(`Skipped: ${result.skipped} (no orders)`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Duration: ${result.duration_seconds}s`);
    console.log('========================================\n');

    if (result.errors.length > 0) {
      console.log('❌ ERRORS:');
      result.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
      console.log('');
    }

    // Final status
    const finalStatus = await getSyncStatus();
    console.log('📊 FINAL DATABASE STATUS');
    console.log('========================================');
    console.log(`Total avatars: ${finalStatus.totalAvatars}`);
    console.log(`Active avatars: ${finalStatus.activeAvatars}`);
    console.log(`Avg health score: ${finalStatus.avgHealthScore}/100`);
    console.log(`High churn risk: ${finalStatus.highChurnRiskCount} customers`);
    console.log(`Last sync: ${finalStatus.lastSync}`);
    console.log('========================================\n');

    if (result.success) {
      console.log('✅ Full sync completed successfully!\n');
    } else {
      console.log('⚠️  Sync completed with errors. Please review.\n');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ FULL SYNC FAILED');
    console.error('========================================');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();
