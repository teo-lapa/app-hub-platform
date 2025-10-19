/**
 * Initialize Database - Create MAESTRO AI Tables
 *
 * Run: npx tsx scripts/init-database.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { sql } from '@vercel/postgres';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
  console.log('🗄️  ========================================');
  console.log('   MAESTRO AI - DATABASE INITIALIZATION');
  console.log('========================================\n');

  try {
    // Read schema file (use minimal schema)
    const schemaPath = path.join(__dirname, '..', 'database', 'schema-minimal.sql');
    console.log(`📄 Reading schema from: ${schemaPath}`);

    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    console.log(`✅ Loaded ${schemaSql.length} chars of SQL\n`);

    // Execute schema
    console.log('🔨 Creating customer_avatars table...\n');

    const result = await sql.query(schemaSql);

    console.log('✅ ========================================');
    console.log('   DATABASE INITIALIZED SUCCESSFULLY!');
    console.log('========================================\n');

    // Verify tables exist
    console.log('🔍 Verifying tables...\n');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log('Tables created:');
    tables.rows.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`);
    });

    console.log('\n✅ Database ready for MAESTRO AI sync!\n');

  } catch (error: any) {
    console.error('\n❌ ========================================');
    console.error('   DATABASE INITIALIZATION FAILED');
    console.error('========================================');
    console.error(`Error: ${error.message}`);
    console.error(`\nDetails: ${error.detail || 'N/A'}`);
    console.error(`\nHint: ${error.hint || 'N/A'}`);
    process.exit(1);
  }
}

main();
