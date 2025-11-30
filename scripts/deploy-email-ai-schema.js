/**
 * Deploy Email AI Monitor Database Schema to Vercel Postgres
 *
 * This script:
 * 1. Enables pgvector extension
 * 2. Creates all tables (gmail_connections, email_messages, email_embeddings, email_analytics)
 * 3. Creates indexes, views, functions, and triggers
 *
 * Usage: node scripts/deploy-email-ai-schema.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { sql } = require('@vercel/postgres');

async function deploySchema() {
  console.log('🚀 Starting Email AI schema deployment to Vercel Postgres...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'lib', 'db', 'email-ai-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📖 Schema file loaded:', schemaPath);
    console.log('📊 Schema size:', (schemaSQL.length / 1024).toFixed(2), 'KB\n');

    // Step 1: Enable pgvector extension
    console.log('🔧 Step 1: Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension enabled\n');

    // Step 2: Execute the full schema
    // Note: We need to execute this as a raw query because it contains multiple statements
    console.log('🏗️  Step 2: Creating database schema...');
    console.log('   - Tables: gmail_connections, email_messages, email_embeddings, email_analytics');
    console.log('   - Indexes: performance optimization indexes');
    console.log('   - Views: v_urgent_unread_emails, v_client_emails_summary, etc.');
    console.log('   - Functions: find_similar_emails, calculate_urgency_score, etc.');
    console.log('   - Triggers: auto-update timestamps, extract sender domain\n');

    // Split schema into individual statements and execute them
    // This is necessary because the schema contains multiple CREATE statements
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and verification queries
      if (
        statement.startsWith('--') ||
        statement.includes('SELECT table_name') ||
        statement.includes('SELECT * FROM pg_extension') ||
        statement.includes('SELECT tablename') ||
        statement.includes('DELETE FROM')
      ) {
        skipCount++;
        continue;
      }

      try {
        await sql.query(statement + ';');
        successCount++;

        // Log progress every 10 statements
        if (successCount % 10 === 0) {
          console.log(`   ⏳ Progress: ${successCount} statements executed...`);
        }
      } catch (error) {
        // Some errors are expected (like "already exists" for IF NOT EXISTS)
        if (!error.message.includes('already exists')) {
          console.error(`   ⚠️  Warning on statement ${i + 1}:`, error.message.substring(0, 100));
        }
      }
    }

    console.log(`\n✅ Schema deployment complete!`);
    console.log(`   - Executed: ${successCount} statements`);
    console.log(`   - Skipped: ${skipCount} statements\n`);

    // Step 3: Verify deployment
    console.log('🔍 Step 3: Verifying deployment...\n');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('gmail_connections', 'email_messages', 'email_embeddings', 'email_analytics')
      ORDER BY table_name
    `;

    console.log('📊 Tables created:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    const extension = await sql`SELECT * FROM pg_extension WHERE extname = 'vector'`;
    console.log(`\n📦 Extensions:`);
    console.log(`   ✓ pgvector ${extension.rows.length > 0 ? 'enabled' : 'NOT FOUND'}`);

    const indexes = await sql`
      SELECT COUNT(*) as index_count
      FROM pg_indexes
      WHERE tablename IN ('email_messages', 'email_embeddings', 'gmail_connections', 'email_analytics')
    `;
    console.log(`\n🔍 Indexes created: ${indexes.rows[0].index_count}`);

    const views = await sql`
      SELECT COUNT(*) as view_count
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
    `;
    console.log(`📈 Views created: ${views.rows[0].view_count}`);

    console.log('\n✅ Email AI Monitor database schema is ready!');
    console.log('\n🎯 Next steps:');
    console.log('   1. Set GEMINI_API_KEY in Vercel environment variables');
    console.log('   2. Set OPENAI_API_KEY in Vercel environment variables (for embeddings)');
    console.log('   3. Configure Gmail OAuth scopes in Google Cloud Console:');
    console.log('      - https://www.googleapis.com/auth/gmail.readonly');
    console.log('      - https://www.googleapis.com/auth/gmail.modify');
    console.log('   4. Test the OAuth flow at /email-ai-monitor');
    console.log('   5. Cron job is already configured: 8:00 AM daily sync\n');

  } catch (error) {
    console.error('\n❌ Error deploying schema:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run deployment
deploySchema()
  .then(() => {
    console.log('🎉 Deployment completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  });
