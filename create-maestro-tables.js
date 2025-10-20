// Create missing Maestro Chat tables in Neon DB
require('dotenv').config({ path: '.env.production.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const createTables = async () => {
  const client = await pool.connect();

  try {
    console.log('🔄 Creating Maestro Chat tables...\n');

    // Rate limiting table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maestro_chat_rate_limits (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        request_count INTEGER DEFAULT 0,
        window_start TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Table maestro_chat_rate_limits created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_rate_limits_user_id
      ON maestro_chat_rate_limits(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_rate_limits_window
      ON maestro_chat_rate_limits(window_start)
    `);
    console.log('✅ Indexes for rate_limits created');

    // Conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maestro_conversations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        context JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_message_at TIMESTAMP
      )
    `);
    console.log('✅ Table maestro_conversations created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_conversations_user_id
      ON maestro_conversations(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_conversations_created_at
      ON maestro_conversations(created_at DESC)
    `);
    console.log('✅ Indexes for conversations created');

    // Interactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maestro_interactions (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES maestro_conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Table maestro_interactions created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_interactions_conversation
      ON maestro_interactions(conversation_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_interactions_user_id
      ON maestro_interactions(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maestro_interactions_created_at
      ON maestro_interactions(created_at DESC)
    `);
    console.log('✅ Indexes for interactions created');

    console.log('\n🎉 All Maestro Chat tables created successfully!\n');

    // Verify tables exist
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'maestro_%'
      ORDER BY table_name
    `);

    console.log('📋 Maestro tables in database:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables().catch(console.error);
