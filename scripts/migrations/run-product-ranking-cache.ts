/**
 * Migration Script: Create product_ranking_cache table
 *
 * Esegue la migration per creare la tabella di cache per l'ordinamento intelligente prodotti
 */

import { sql } from '@vercel/postgres';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🚀 Starting migration: product_ranking_cache table...');

    // Read SQL migration file
    const migrationPath = path.join(__dirname, 'create-product-ranking-cache.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    // Remove comments and split into individual statements
    const statements = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--')) // Remove comment lines
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`Statement preview: ${statement.substring(0, 80)}...`);

      await sql.query(statement);
      console.log(`✅ Statement ${i + 1} executed successfully`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Table product_ranking_cache created with indexes');
    console.log('\nNext steps:');
    console.log('1. Create cron job to populate cache');
    console.log('2. Modify products API to use cache for sorting');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

runMigration();
