#!/usr/bin/env node

/**
 * Apply Social AI Studio Migration
 *
 * Creates database tables for Social AI content generation and analytics:
 * - social_posts (generated content + media)
 * - social_analytics (performance metrics)
 * - brand_settings (user preferences)
 * - post_embeddings (RAG system - requires pgvector)
 * - canton_hashtags (localized hashtags)
 *
 * Usage:
 *   node scripts/apply-social-ai-migration.js
 */

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function applyMigration() {
  console.log('🚀 Starting Social AI Studio migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../lib/db/social-ai-schema.sql');
    console.log(`📄 Reading schema file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by statements (simple approach - split on semicolon)
    // Skip comments and empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out comments, empty statements, and verification queries
        return s.length > 0 &&
               !s.startsWith('--') &&
               !s.startsWith('/*') &&
               !s.match(/^\/\*/); // Skip multi-line comments
      });

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip verification queries (SELECT statements at the end)
      if (statement.trim().toUpperCase().startsWith('SELECT')) {
        console.log(`⏭️  Skipping verification query ${i + 1}`);
        skipCount++;
        continue;
      }

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);

        // Execute raw SQL
        await sql.query(statement + ';');

        successCount++;
        console.log(`   ✅ Success\n`);
      } catch (error) {
        // Check if error is "already exists" or "already enabled"
        if (error.message.includes('already exists') ||
            error.message.includes('already installed') ||
            error.message.includes('duplicate key')) {
          console.log(`   ⚠️  Already exists (skipping)\n`);
          skipCount++;
        } else {
          // Log error but continue with migration
          console.error(`   ⚠️  Warning: ${error.message}\n`);
          errorCount++;

          // Don't fail on pgvector extension errors (might not be available on all instances)
          if (error.message.includes('vector') || error.message.includes('extension')) {
            console.log(`   ℹ️  Note: pgvector extension may not be available. RAG features will be limited.\n`);
          }
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Migration completed!');
    console.log(`   • ${successCount} statements executed`);
    console.log(`   • ${skipCount} statements skipped`);
    console.log(`   • ${errorCount} warnings/errors`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Verify tables created
    console.log('🔍 Verifying tables...\n');

    const tablesResult = await sql`
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

    console.log(`✅ Found ${tablesResult.rows.length}/5 tables:`);
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });

    if (tablesResult.rows.length < 5) {
      console.log('\n⚠️  Some tables may not have been created. Check errors above.');
    }

    // Check pgvector extension
    console.log('\n🔍 Checking pgvector extension...\n');
    try {
      const extResult = await sql`
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname = 'vector'
      `;

      if (extResult.rows.length > 0) {
        console.log(`✅ pgvector extension installed (version ${extResult.rows[0].extversion})`);
        console.log('   RAG similarity search is ENABLED ✨\n');
      } else {
        console.log('⚠️  pgvector extension NOT installed');
        console.log('   RAG similarity search will be LIMITED\n');
      }
    } catch (error) {
      console.log('⚠️  Could not check pgvector extension');
      console.log('   RAG features may not be available\n');
    }

    // Verify views created
    console.log('🔍 Verifying views...\n');
    const viewsResult = await sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name LIKE 'v_%'
        AND table_name IN (
          'v_top_performing_posts',
          'v_platform_performance',
          'v_canton_performance',
          'v_category_performance'
        )
      ORDER BY table_name
    `;

    console.log(`✅ Found ${viewsResult.rows.length}/4 views:`);
    viewsResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });

    // Check canton hashtags seed data
    console.log('\n🔍 Checking Canton Zürich hashtags...\n');
    const hashtagsResult = await sql`
      SELECT COUNT(*) as count
      FROM canton_hashtags
      WHERE canton = 'Zürich'
    `;

    const zurichHashtags = parseInt(hashtagsResult.rows[0].count);
    console.log(`✅ Found ${zurichHashtags} hashtags for Canton Zürich`);

    console.log('\n🎉 Migration complete! Social AI Studio database is ready.\n');

    // Next steps
    console.log('📋 Next steps:');
    console.log('   1. Update API routes to save posts to database');
    console.log('   2. Build Analytics Dashboard UI');
    console.log('   3. Setup RAG embedding pipeline');
    console.log('   4. Add geo-targeting to UI\n');

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
