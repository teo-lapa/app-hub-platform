import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function createTables() {
  console.log('🚀 Creating tables...\n');

  try {
    // Table 1: customer_avatars already exists
    console.log('✅ Table customer_avatars already exists');

    // Table 2: sales_interactions
    await sql`
      CREATE TABLE IF NOT EXISTS sales_interactions (
        id SERIAL PRIMARY KEY,
        customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
        odoo_partner_id INT NOT NULL,
        salesperson_id INT NOT NULL,
        salesperson_name VARCHAR(255),
        interaction_type VARCHAR(50) NOT NULL,
        interaction_date TIMESTAMP DEFAULT NOW(),
        outcome VARCHAR(50),
        notes TEXT,
        samples_given JSONB DEFAULT '[]'::jsonb,
        order_generated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Table sales_interactions created');

    // Table 3: maestro_recommendations
    await sql`
      CREATE TABLE IF NOT EXISTS maestro_recommendations (
        id SERIAL PRIMARY KEY,
        customer_avatar_id INT REFERENCES customer_avatars(id) ON DELETE CASCADE,
        odoo_partner_id INT NOT NULL,
        salesperson_id INT NOT NULL,
        recommendation_type VARCHAR(50) NOT NULL,
        priority INT DEFAULT 50,
        urgency_level VARCHAR(20) DEFAULT 'medium',
        action_suggested TEXT NOT NULL,
        reasoning TEXT,
        suggested_products JSONB DEFAULT '[]'::jsonb,
        confidence_score DECIMAL(3,2) DEFAULT 0.5,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;
    console.log('✅ Table maestro_recommendations created');

    // Verify
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log('\n📋 All tables:');
    tables.rows.forEach((row, i) => console.log(`   ${i + 1}. ${row.table_name}`));

    console.log('\n✅ Schema ready!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTables();
