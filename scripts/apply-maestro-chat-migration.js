#!/usr/bin/env node

/**
 * Apply Maestro Chat Tables Migration
 *
 * Applies database migration to create chat-related tables.
 *
 * Usage:
 *   node scripts/apply-maestro-chat-migration.js
 */

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🚀 Starting Maestro Chat migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/004_create_maestro_chat_tables.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by statements (simple approach - split on semicolon)
    // Note: This is a simplified splitter. For complex SQL, use a proper SQL parser
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out comments and empty statements
        return s.length > 0 &&
               !s.startsWith('--') &&
               !s.startsWith('/*') &&
               !s.match(/^COMMENT ON/i); // Skip COMMENT statements for now
      });

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip verification queries (SELECT statements)
      if (statement.trim().toUpperCase().startsWith('SELECT')) {
        console.log(`⏭️  Skipping verification query ${i + 1}`);
        skipCount++;
        continue;
      }

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);

        // Execute raw SQL (no template literal needed for already-formatted SQL)
        await sql.query(statement + ';');

        successCount++;
        console.log(`   ✅ Success\n`);
      } catch (error) {
        // Check if error is "already exists"
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Already exists (skipping)\n`);
          skipCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          throw error;
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Migration completed successfully!');
    console.log(`   • ${successCount} statements executed`);
    console.log(`   • ${skipCount} statements skipped`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verify tables created
    console.log('🔍 Verifying tables...\n');

    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('maestro_conversations', 'maestro_chat_messages', 'maestro_chat_rate_limits')
      ORDER BY table_name
    `;

    if (tablesResult.rows.length === 3) {
      console.log('✅ All 3 tables created:');
      tablesResult.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
    } else {
      console.log(`⚠️  Expected 3 tables, found ${tablesResult.rows.length}`);
      tablesResult.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
    }

    console.log('\n🎉 Migration complete! Chat endpoint is now ready.\n');

    // Test chat endpoint
    console.log('💡 Test the chat endpoint with:');
    console.log('   curl -X POST http://localhost:3004/api/maestro/chat \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"message":"Ciao","salespersonId":2}\'\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
