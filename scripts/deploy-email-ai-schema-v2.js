/**
 * Deploy Email AI Monitor Database Schema to Vercel Postgres
 * Using native pg client for proper multi-statement execution
 *
 * Usage: node scripts/deploy-email-ai-schema-v2.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function deploySchema() {
  console.log('🚀 Starting Email AI schema deployment to Vercel Postgres...\n');

  // Create postgres client
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to Vercel Postgres\n');

    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'lib', 'db', 'email-ai-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📖 Schema file loaded:', schemaPath);
    console.log('📊 Schema size:', (schemaSQL.length / 1024).toFixed(2), 'KB\n');

    // Execute the full schema as a single transaction
    console.log('🏗️  Executing database schema...');
    console.log('   - Tables: gmail_connections, email_messages, email_embeddings, email_analytics');
    console.log('   - Indexes: performance optimization indexes');
    console.log('   - Views: v_urgent_unread_emails, v_client_emails_summary, etc.');
    console.log('   - Functions: find_similar_emails, calculate_urgency_score, etc.');
    console.log('   - Triggers: auto-update timestamps, extract sender domain\n');

    await client.query(schemaSQL);

    console.log('✅ Schema deployment complete!\n');

    // Verify deployment
    console.log('🔍 Verifying deployment...\n');

    const tables = await client.query(`
      SELECT table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_name IN ('gmail_connections', 'email_messages', 'email_embeddings', 'email_analytics')
      ORDER BY table_name
    `);

    console.log('📊 Tables created:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} (${row.column_count} columns)`);
    });

    const extension = await client.query(`SELECT * FROM pg_extension WHERE extname = 'vector'`);
    console.log(`\n📦 Extensions:`);
    console.log(`   ✓ pgvector ${extension.rows.length > 0 ? 'enabled' : 'NOT FOUND'}`);

    const indexes = await client.query(`
      SELECT tablename, COUNT(*) as index_count
      FROM pg_indexes
      WHERE tablename IN ('email_messages', 'email_embeddings', 'gmail_connections', 'email_analytics')
      GROUP BY tablename
      ORDER BY tablename
    `);

    console.log(`\n🔍 Indexes created:`);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.tablename}: ${row.index_count} indexes`);
    });

    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
      ORDER BY table_name
    `);

    console.log(`\n📈 Views created (${views.rows.length}):`);
    views.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    const functions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name IN ('find_similar_emails', 'calculate_urgency_score', 'extract_email_domain', 'update_updated_at_column', 'set_sender_domain')
      ORDER BY routine_name
    `);

    console.log(`\n⚙️  Functions created (${functions.rows.length}):`);
    functions.rows.forEach(row => {
      console.log(`   ✓ ${row.routine_name}()`);
    });

    console.log('\n✅ Email AI Monitor database schema is ready!');
    console.log('\n🎯 Next steps:');
    console.log('   1. GEMINI_API_KEY and OPENAI_API_KEY are already configured ✓');
    console.log('   2. Configure Gmail OAuth scopes in Google Cloud Console:');
    console.log('      - https://www.googleapis.com/auth/gmail.readonly');
    console.log('      - https://www.googleapis.com/auth/gmail.modify');
    console.log('   3. Update redirect URI in Google Console:');
    console.log('      - https://staging.hub.lapa.ch/api/email-ai/auth/gmail/callback');
    console.log('   4. Test the OAuth flow at https://staging.hub.lapa.ch/email-ai-monitor');
    console.log('   5. Cron job is already configured: 8:00 AM daily sync ✓\n');

  } catch (error) {
    console.error('\n❌ Error deploying schema:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run deployment
deploySchema()
  .then(() => {
    console.log('🎉 Deployment completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Deployment failed:', error.message);
    process.exit(1);
  });
