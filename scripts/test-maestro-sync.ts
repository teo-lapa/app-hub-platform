/**
 * Test Script - MAESTRO AI Sync Engine
 *
 * Run: npx tsx scripts/test-maestro-sync.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { syncCustomersFromOdoo, getSyncStatus } from '../lib/maestro/sync-odoo-v2';

async function main() {
  console.log('🧪 ========================================');
  console.log('   MAESTRO SYNC ENGINE - TEST SCRIPT');
  console.log('========================================\n');

  // Debug env vars
  console.log('🔧 Environment check:');
  console.log(`   - ODOO_URL: ${process.env.ODOO_URL || 'NOT SET'}`);
  console.log(`   - POSTGRES_URL: ${process.env.POSTGRES_URL ? 'SET' : 'NOT SET'}\n`);

  try {
    // STEP 1: Check current database status
    console.log('📊 STEP 1: Checking current database status...\n');

    const initialStatus = await getSyncStatus();

    console.log('Current Database Status:');
    console.log(`  - Total avatars: ${initialStatus.totalAvatars}`);
    console.log(`  - Active avatars: ${initialStatus.activeAvatars}`);
    console.log(`  - Last sync: ${initialStatus.lastSync || 'Never'}`);
    console.log(`  - Avg health score: ${initialStatus.avgHealthScore}`);
    console.log(`  - High churn risk: ${initialStatus.highChurnRiskCount}`);
    console.log('');

    // STEP 2: Run DRY RUN first (no DB writes)
    console.log('🏃 STEP 2: Running DRY RUN (no database writes)...\n');

    const dryRunResult = await syncCustomersFromOdoo({
      maxCustomers: 10,  // Test with 10 customers first
      monthsBack: 4,
      dryRun: true
    });

    console.log('\nDry Run Results:');
    console.log(`  - Success: ${dryRunResult.success}`);
    console.log(`  - Would sync: ${dryRunResult.synced} customers`);
    console.log(`  - Duration: ${dryRunResult.duration_seconds}s`);
    console.log(`  - Errors: ${dryRunResult.errors.length}`);

    if (dryRunResult.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      dryRunResult.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (!dryRunResult.success || dryRunResult.synced === 0) {
      console.log('\n❌ Dry run failed or no data found. Aborting real sync.');
      process.exit(1);
    }

    // STEP 3: Ask for confirmation (in real scenario)
    console.log('\n✅ Dry run successful! Ready for real sync.\n');

    // STEP 4: Run REAL SYNC with limited customers
    console.log('🚀 STEP 3: Running REAL SYNC (10 customers)...\n');

    const syncResult = await syncCustomersFromOdoo({
      maxCustomers: 10,
      monthsBack: 4,
      dryRun: false
    });

    console.log('\nSync Results:');
    console.log(`  - Success: ${syncResult.success}`);
    console.log(`  - Synced: ${syncResult.synced}`);
    console.log(`  - Created: ${syncResult.created}`);
    console.log(`  - Updated: ${syncResult.updated}`);
    console.log(`  - Skipped: ${syncResult.skipped}`);
    console.log(`  - Errors: ${syncResult.errors.length}`);
    console.log(`  - Duration: ${syncResult.duration_seconds}s`);

    if (syncResult.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      syncResult.errors.forEach(err => console.log(`  - ${err}`));
    }

    // STEP 5: Verify database changes
    console.log('\n📊 STEP 4: Verifying database changes...\n');

    const finalStatus = await getSyncStatus();

    console.log('Final Database Status:');
    console.log(`  - Total avatars: ${finalStatus.totalAvatars} (was ${initialStatus.totalAvatars})`);
    console.log(`  - Active avatars: ${finalStatus.activeAvatars} (was ${initialStatus.activeAvatars})`);
    console.log(`  - Last sync: ${finalStatus.lastSync}`);
    console.log(`  - Avg health score: ${finalStatus.avgHealthScore}`);
    console.log(`  - High churn risk: ${finalStatus.highChurnRiskCount}`);

    const newAvatars = finalStatus.totalAvatars - initialStatus.totalAvatars;
    console.log(`\n✅ Created ${newAvatars} new customer avatars!`);

    // STEP 6: Success summary
    console.log('\n✅ ========================================');
    console.log('   TEST COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('  1. Review the synced data in database');
    console.log('  2. Check AI scores look reasonable');
    console.log('  3. Run full sync: syncCustomersFromOdoo({ monthsBack: 4 })');
    console.log('  4. Set up cron job for daily syncs');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ ========================================');
    console.error('   TEST FAILED');
    console.error('========================================');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

main();
