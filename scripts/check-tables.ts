/**
 * Check Database Tables and Columns
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function checkTables() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`📋 Tables found: ${tables.rows.length}\n`);

    // For each table, get its columns
    for (const table of tables.rows) {
      const tableName = table.table_name;

      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
        ORDER BY ordinal_position
      `;

      console.log(`📊 Table: ${tableName} (${columns.rows.length} columns)`);
      columns.rows.forEach((col: any) => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
      console.log('');
    }

    // Check if customer_avatars has any data
    const avatarCount = await sql`SELECT COUNT(*) as total FROM customer_avatars`;
    console.log(`\n📈 customer_avatars row count: ${avatarCount.rows[0].total}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTables();
