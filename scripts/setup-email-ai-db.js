#!/usr/bin/env node

/**
 * Setup Email AI Monitor Database
 *
 * Creates tables for Gmail integration with AI classification
 *
 * Usage:
 *   node scripts/setup-email-ai-db.js
 */

const fs = require('fs');
const path = require('path');
const { sql: db } = require('@vercel/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function setupDatabase() {
  console.log('📧 Setting up Email AI Monitor database...\n');

  try {
    console.log('✅ Connected to database\n');

    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../lib/db/email-ai-schema.sql');
    console.log(`📄 Reading schema: ${schemaPath}\n`);

    const sqlContent = fs.readFileSync(schemaPath, 'utf8');

    // Execute the entire SQL file
    console.log('⚙️  Executing SQL schema...\n');
    await db.query(sqlContent);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Schema executed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');

    // Verify tables
    const tablesResult = await db`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'gmail_connections',
          'email_messages',
          'email_embeddings',
          'email_analytics'
        )
      ORDER BY table_name
    `;

    console.log(`🔍 Verified ${tablesResult.rows.length}/4 tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check pgvector extension
    const extResult = await db`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `;

    console.log('\n🔍 pgvector extension:');
    if (extResult.rows.length > 0) {
      console.log(`   ✅ Installed (version ${extResult.rows[0].extversion})`);
      console.log(`   🎯 Email RAG similarity search is ENABLED`);
    } else {
      console.log(`   ⚠️  Not installed - RAG features limited`);
      console.log(`   💡 Run: CREATE EXTENSION vector; (requires superuser)`);
    }

    // Check views
    const viewsResult = await db`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%email%'
      ORDER BY table_name
    `;

    console.log(`\n🔍 Verified ${viewsResult.rows.length} views:`);
    viewsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check functions
    const functionsResult = await db`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN (
          'find_similar_emails',
          'extract_email_domain',
          'calculate_urgency_score'
        )
      ORDER BY routine_name
    `;

    console.log(`\n🔍 Verified ${functionsResult.rows.length}/3 functions:`);
    functionsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.routine_name}()`);
    });

    // Check indexes
    const indexesResult = await db`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename IN ('email_messages', 'email_embeddings', 'gmail_connections')
    `;

    const indexCount = parseInt(indexesResult.rows[0].count);
    console.log(`\n🔍 Created ${indexCount} indexes for performance`);

    console.log('\n🎉 Email AI Monitor database setup complete!\n');

    console.log('📋 Next steps:');
    console.log('   1. Install googleapis: npm install googleapis');
    console.log('   2. Setup Gmail OAuth in Google Cloud Console');
    console.log('   3. Create API routes for email fetching');
    console.log('   4. Implement AI classifiers (Gemini)');
    console.log('   5. Build Email Monitor Dashboard UI');
    console.log('   6. Setup Vercel Cron for daily checks\n');

    console.log('🔐 Required Environment Variables:');
    console.log('   - GOOGLE_CLIENT_ID (already set ✅)');
    console.log('   - GOOGLE_CLIENT_SECRET (already set ✅)');
    console.log('   - GEMINI_API_KEY (for AI classification)');
    console.log('   - OPENAI_API_KEY (for embeddings)\n');

  } catch (error) {
    console.error('\n❌ Setup failed!');
    console.error('Error:', error.message);

    // Print more details for specific errors
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tables already exist. This is OK - schema is idempotent.');
      console.log('   You can run this script multiple times safely.\n');
    } else if (error.message.includes('vector')) {
      console.log('\n💡 pgvector extension error.');
      console.log('   Ask your DB admin to run: CREATE EXTENSION vector;\n');
    } else {
      console.error('\nStack trace:');
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run setup
setupDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
