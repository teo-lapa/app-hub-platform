/**
 * Deploy Database Schema to Vercel Postgres
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function deploySchema() {
  console.log('🚀 [DEPLOY] Starting schema deployment to Vercel Postgres...\n');

  try {
    // Read schema file (use minimal schema for faster deployment)
    const schemaPath = join(process.cwd(), 'database', 'schema-minimal.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');

    console.log('📄 [DEPLOY] Schema file loaded');
    console.log(`📏 [DEPLOY] Size: ${(schemaSQL.length / 1024).toFixed(2)} KB\n`);

    // Split into individual statements (rough split on semicolons)
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 [DEPLOY] Found ${statements.length} SQL statements to execute\n`);

    let executed = 0;
    let errors = 0;

    for (const statement of statements) {
      try {
        // Skip comments
        if (statement.startsWith('--') || statement.length < 10) {
          continue;
        }

        await sql.query(statement + ';');
        executed++;

        // Log progress every 10 statements
        if (executed % 10 === 0) {
          console.log(`⏳ [DEPLOY] Progress: ${executed}/${statements.length} statements executed`);
        }

      } catch (error) {
        errors++;
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Ignore "already exists" errors (idempotent)
        if (errorMsg.includes('already exists')) {
          console.log(`ℹ️  [DEPLOY] Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`❌ [DEPLOY] Error executing statement:`, errorMsg);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ [DEPLOY] Schema deployment completed!');
    console.log(`📊 [DEPLOY] Statistics:`);
    console.log(`   - Total statements: ${statements.length}`);
    console.log(`   - Executed: ${executed}`);
    console.log(`   - Errors: ${errors}`);
    console.log('='.repeat(60) + '\n');

    // Verify tables created
    console.log('🔍 [DEPLOY] Verifying tables...\n');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log('📋 [DEPLOY] Tables in database:');
    tables.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

    console.log('\n✅ [DEPLOY] Schema deployment successful!\n');

  } catch (error) {
    console.error('\n❌ [DEPLOY] Fatal error:', error);
    process.exit(1);
  }
}

// Run deployment
deploySchema();
