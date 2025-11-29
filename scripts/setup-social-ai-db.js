#!/usr/bin/env node

/**
 * Setup Social AI Studio Database
 *
 * Simpler migration script that executes the entire SQL file at once
 *
 * Usage:
 *   node scripts/setup-social-ai-db.js
 */

const fs = require('fs');
const path = require('path');
const { sql: db } = require('@vercel/postgres');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function setupDatabase() {
  console.log('🚀 Setting up Social AI Studio database...\n');

  try {
    console.log('✅ Connected to database\n');

    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../lib/db/social-ai-schema.sql');
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
          'social_posts',
          'social_analytics',
          'brand_settings',
          'post_embeddings',
          'canton_hashtags'
        )
      ORDER BY table_name
    `;

    console.log(`🔍 Verified ${tablesResult.rows.length}/5 tables:`);
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
      console.log(`   🎯 RAG similarity search is ENABLED`);
    } else {
      console.log(`   ⚠️  Not installed - RAG features limited`);
    }

    // Check views
    const viewsResult = await db`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
      ORDER BY table_name
    `;

    console.log(`\n🔍 Verified ${viewsResult.rows.length}/4 views:`);
    viewsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check Canton Zürich hashtags
    const hashtagsResult = await db`
      SELECT COUNT(*) as count
      FROM canton_hashtags
      WHERE canton = 'Zürich'
    `;

    const zurichCount = parseInt(hashtagsResult.rows[0].count);
    console.log(`\n🔍 Canton Zürich hashtags: ${zurichCount}`);

    console.log('\n🎉 Social AI Studio database setup complete!\n');

    console.log('📋 Next steps:');
    console.log('   1. Update API to save posts → database');
    console.log('   2. Build Analytics Dashboard UI');
    console.log('   3. Setup RAG embedding pipeline');
    console.log('   4. Add geo-targeting to Social AI form\n');

  } catch (error) {
    console.error('\n❌ Setup failed!');
    console.error('Error:', error.message);

    // Print more details for specific errors
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tables already exist. This is OK - schema is idempotent.');
      console.log('   You can run this script multiple times safely.\n');
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
