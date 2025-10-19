/**
 * Simulate API Response
 * Test the exact logic used in the API route without going through Next.js
 */
import 'dotenv/config';
import { sql } from '@vercel/postgres';

async function simulateGetAvatars() {
  try {
    console.log('🚀 Simulating GET /api/maestro/avatars...\n');

    // Default params
    const params = {
      limit: 20,
      offset: 0,
      sort_by: 'health_score' as const,
      sort_order: 'desc' as 'asc' | 'desc',
    };

    // Build query
    const whereConditions: string[] = ['is_active = true'];
    const queryParams: any[] = [];
    const whereClause = whereConditions.join(' AND ');

    const validSortColumns: Record<string, string> = {
      health_score: 'health_score',
      churn_risk_score: 'churn_risk_score',
      total_revenue: 'total_revenue',
      last_order_date: 'last_order_date'
    };
    const sortColumn = validSortColumns[params.sort_by];
    const sortOrder = params.sort_order.toUpperCase();

    // COUNT query
    console.log('1️⃣ Running COUNT query...');
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_avatars
      WHERE ${whereClause}
    `;
    const countResult = await sql.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    console.log(`   Total: ${total}\n`);

    // Main query
    console.log('2️⃣ Running main SELECT query...');
    const paramIndex = queryParams.length + 1;
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
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}, name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(params.limit, params.offset);
    const dataResult = await sql.query(dataQuery, queryParams);
    console.log(`   Rows: ${dataResult.rows.length}\n`);

    // Parse JSON fields
    console.log('3️⃣ Parsing JSON fields...');
    const avatars = dataResult.rows.map(row => ({
      ...row,
      top_products: typeof row.top_products === 'string'
        ? JSON.parse(row.top_products || '[]')
        : row.top_products || [],
      product_categories: typeof row.product_categories === 'string'
        ? JSON.parse(row.product_categories || '{}')
        : row.product_categories || {},
    }));
    console.log(`   Parsed ${avatars.length} avatars\n`);

    // Build response
    const response = {
      avatars,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: params.offset + params.limit < total,
      }
    };

    console.log('4️⃣ Final response structure:');
    console.log(`   - avatars: Array(${response.avatars.length})`);
    console.log(`   - pagination.total: ${response.pagination.total}`);
    console.log(`   - pagination.has_more: ${response.pagination.has_more}\n`);

    console.log('5️⃣ First avatar sample:');
    console.log(JSON.stringify({
      id: response.avatars[0].id,
      name: response.avatars[0].name,
      health_score: response.avatars[0].health_score,
      churn_risk_score: response.avatars[0].churn_risk_score,
      assigned_salesperson_id: response.avatars[0].assigned_salesperson_id,
    }, null, 2));

    console.log('\n✅ API simulation completed successfully!');
    console.log(`   Response size: ${JSON.stringify(response).length} bytes`);

    process.exit(0);

  } catch (error: any) {
    console.error('❌ API simulation failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

simulateGetAvatars();
