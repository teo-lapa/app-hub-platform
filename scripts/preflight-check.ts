/**
 * Pre-Flight Check - Verify Production Readiness
 *
 * Run: npx tsx scripts/preflight-check.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { sql } from '@vercel/postgres';
import { getOdooSession } from '../lib/odoo-auth';
import { createOdooRPCClient } from '../lib/odoo/rpcClient';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
  console.log('🔍 ========================================');
  console.log('   MAESTRO AI - PRE-FLIGHT CHECK');
  console.log('   Production Readiness Verification');
  console.log('========================================\n');

  let allGood = true;
  const issues: string[] = [];

  // CHECK 1: Environment Variables
  console.log('1️⃣  Checking environment variables...');

  const requiredEnvVars = [
    'POSTGRES_URL',
    'ODOO_URL',
    'ODOO_DB'
  ];

  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: SET`);
    } else {
      console.log(`   ❌ ${varName}: MISSING`);
      issues.push(`Missing env var: ${varName}`);
      allGood = false;
    }
  }

  console.log('');

  // CHECK 2: Database Connection
  console.log('2️⃣  Testing database connection...');

  try {
    const result = await sql`SELECT NOW() as time`;
    console.log(`   ✅ Database connected: ${new Date(result.rows[0].time).toLocaleString('it-IT')}`);
  } catch (error: any) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
    issues.push('Database connection failed');
    allGood = false;
  }

  console.log('');

  // CHECK 3: Database Schema
  console.log('3️⃣  Checking database schema...');

  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'customer_avatars'
    `;

    if (tables.rows.length > 0) {
      console.log('   ✅ customer_avatars table exists');

      // Check columns
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'customer_avatars'
      `;

      const requiredColumns = [
        'odoo_partner_id',
        'name',
        'total_orders',
        'total_revenue',
        'health_score',
        'churn_risk_score',
        'upsell_potential_score',
        'engagement_score'
      ];

      const existingColumns = columns.rows.map((r: any) => r.column_name);

      for (const col of requiredColumns) {
        if (existingColumns.includes(col)) {
          console.log(`   ✅ Column '${col}' exists`);
        } else {
          console.log(`   ❌ Column '${col}' missing`);
          issues.push(`Missing column: ${col}`);
          allGood = false;
        }
      }

    } else {
      console.log('   ❌ customer_avatars table does not exist');
      console.log('   💡 Run: npx tsx scripts/init-database.ts');
      issues.push('customer_avatars table missing');
      allGood = false;
    }
  } catch (error: any) {
    console.log(`   ❌ Schema check failed: ${error.message}`);
    issues.push('Schema check failed');
    allGood = false;
  }

  console.log('');

  // CHECK 4: Odoo Connection
  console.log('4️⃣  Testing Odoo connection...');

  try {
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    const result = await odoo.searchRead(
      'res.partner',
      [],
      ['id', 'name'],
      1
    );

    if (result && result.length > 0) {
      console.log(`   ✅ Odoo connected: ${result[0].name}`);
    } else {
      console.log('   ⚠️  Odoo connected but no data returned');
    }
  } catch (error: any) {
    console.log(`   ❌ Odoo connection failed: ${error.message}`);
    issues.push('Odoo connection failed');
    allGood = false;
  }

  console.log('');

  // CHECK 5: Data Quality
  console.log('5️⃣  Checking existing data quality...');

  try {
    const stats = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE health_score IS NULL) as null_health,
        COUNT(*) FILTER (WHERE total_orders = 0) as zero_orders,
        MAX(last_sync_odoo) as last_sync
      FROM customer_avatars
    `;

    const stat = stats.rows[0];

    if (parseInt(stat.total as string) === 0) {
      console.log('   ⚠️  No customer avatars in database yet');
      console.log('   💡 Run test sync first: npx tsx scripts/test-maestro-sync.ts');
    } else {
      console.log(`   ✅ ${stat.total} customer avatars found`);

      if (parseInt(stat.null_health as string) > 0) {
        console.log(`   ⚠️  ${stat.null_health} avatars with NULL health_score`);
        issues.push('Some avatars have NULL health scores');
      }

      if (parseInt(stat.zero_orders as string) > 0) {
        console.log(`   ⚠️  ${stat.zero_orders} avatars with 0 orders`);
      }

      if (stat.last_sync) {
        const lastSync = new Date(stat.last_sync as string);
        const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
        console.log(`   ✅ Last sync: ${lastSync.toLocaleString('it-IT')} (${hoursAgo.toFixed(1)} hours ago)`);
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️  Could not check data quality: ${error.message}`);
  }

  console.log('');

  // CHECK 6: Scripts Availability
  console.log('6️⃣  Checking scripts availability...');

  const scripts = [
    'scripts/test-maestro-sync.ts',
    'scripts/run-full-sync.ts',
    'scripts/init-database.ts',
    'scripts/view-avatars.ts'
  ];

  const fs = require('fs');
  for (const script of scripts) {
    const fullPath = path.join(__dirname, '..', script);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ ${script}`);
    } else {
      console.log(`   ❌ ${script} not found`);
      issues.push(`Missing script: ${script}`);
      allGood = false;
    }
  }

  console.log('');

  // FINAL VERDICT
  console.log('========================================');
  if (allGood) {
    console.log('✅ ALL CHECKS PASSED');
    console.log('========================================');
    console.log('🚀 SYSTEM READY FOR PRODUCTION\n');
    console.log('Next steps:');
    console.log('  1. Run test sync: npx tsx scripts/test-maestro-sync.ts');
    console.log('  2. Review data: npx tsx scripts/view-avatars.ts');
    console.log('  3. Full sync: npx tsx scripts/run-full-sync.ts');
    console.log('');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    console.log('========================================');
    console.log('🔧 ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log('\n💡 Fix these issues before production deployment.\n');
    process.exit(1);
  }
}

main();
