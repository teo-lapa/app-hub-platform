/**
 * Test SQL Query Performance
 * Simula esattamente la query dell'API /api/maestro/avatars
 */
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function testQuery() {
  try {
    console.log('🔍 Testing SQL query performance...\n');

    // Parametri default come nell'API
    const limit = 20;
    const offset = 0;
    const sortColumn = 'health_score';
    const sortOrder = 'DESC';

    console.log('Parameters:', { limit, offset, sortColumn, sortOrder });

    // Test 1: COUNT query
    console.log('\n1️⃣ Testing COUNT query...');
    const countStart = Date.now();
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_avatars
      WHERE is_active = true
    `;
    const countResult = await sql.query(countQuery, []);
    const countTime = Date.now() - countStart;
    console.log(`   ✅ Count query completed in ${countTime}ms`);
    console.log(`   Total active avatars: ${countResult.rows[0].total}`);

    // Test 2: Main data query
    console.log('\n2️⃣ Testing main SELECT query...');
    const dataStart = Date.now();
    const dataQuery = `
      SELECT
        id,
        odoo_partner_id,
        name,
        email,
        phone,
        city,
        first_order_date,
        last_order_date,
        total_orders,
        total_revenue,
        avg_order_value,
        order_frequency_days,
        days_since_last_order,
        top_products,
        product_categories,
        health_score,
        churn_risk_score,
        upsell_potential_score,
        engagement_score,
        assigned_salesperson_id,
        assigned_salesperson_name,
        is_active,
        created_at,
        updated_at,
        last_sync_odoo
      FROM customer_avatars
      WHERE is_active = true
      ORDER BY ${sortColumn} ${sortOrder}, name ASC
      LIMIT $1 OFFSET $2
    `;

    const dataResult = await sql.query(dataQuery, [limit, offset]);
    const dataTime = Date.now() - dataStart;
    console.log(`   ✅ Data query completed in ${dataTime}ms`);
    console.log(`   Rows returned: ${dataResult.rows.length}`);

    // Test 3: JSON parsing
    console.log('\n3️⃣ Testing JSON field parsing...');
    console.log('   First row top_products type:', typeof dataResult.rows[0]?.top_products);
    console.log('   First row top_products value:', dataResult.rows[0]?.top_products);

    const parseStart = Date.now();
    const avatars = dataResult.rows.map(row => ({
      ...row,
      // Check if already parsed
      top_products: typeof row.top_products === 'string'
        ? JSON.parse(row.top_products || '[]')
        : row.top_products || [],
      product_categories: typeof row.product_categories === 'string'
        ? JSON.parse(row.product_categories || '{}')
        : row.product_categories || {},
    }));
    const parseTime = Date.now() - parseStart;
    console.log(`   ✅ JSON parsing completed in ${parseTime}ms`);

    // Total time
    const totalTime = countTime + dataTime + parseTime;
    console.log(`\n⏱️  TOTAL TIME: ${totalTime}ms`);

    // Show first avatar
    if (avatars.length > 0) {
      console.log('\n📋 First avatar sample:');
      console.log(JSON.stringify({
        id: avatars[0].id,
        name: avatars[0].name,
        health_score: avatars[0].health_score,
        churn_risk_score: avatars[0].churn_risk_score,
        top_products: avatars[0].top_products,
      }, null, 2));
    }

    console.log('\n✅ Query test completed successfully!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Query test failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

testQuery();
