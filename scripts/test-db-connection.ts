/**
 * Test Database Connection
 */
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing Vercel Postgres connection...\n');

    // Test 1: Simple COUNT query
    console.log('Test 1: Count customer avatars');
    const countResult = await sql`SELECT COUNT(*) FROM customer_avatars`;
    console.log(`✅ Database connected! Total avatars: ${countResult.rows[0].count}\n`);

    // Test 2: Fetch first 3 avatars
    console.log('Test 2: Fetch first 3 avatars');
    const avatarsResult = await sql`
      SELECT id, name, health_score, churn_risk_score, assigned_salesperson_id
      FROM customer_avatars
      LIMIT 3
    `;
    console.log(`✅ Fetched ${avatarsResult.rows.length} avatars:`);
    avatarsResult.rows.forEach(avatar => {
      console.log(`   - ID: ${avatar.id}, Name: ${avatar.name}, Health: ${avatar.health_score}`);
    });
    console.log('');

    // Test 3: Check if table exists
    console.log('Test 3: Verify all tables exist');
    const tablesResult = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'customer%' OR table_name LIKE 'maestro%'
      ORDER BY table_name
    `;
    console.log(`✅ Found ${tablesResult.rows.length} Maestro tables:`);
    tablesResult.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

    console.log('\n✅ All database tests passed!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

testDatabaseConnection();
