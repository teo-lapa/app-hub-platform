/**
 * DEBUG ENDPOINT - Check Avatar Data Quality
 *
 * GET /api/maestro/debug-avatars
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getVisibleSalespersonIds } from '@/lib/maestro/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const visibleSalespersonIds = getVisibleSalespersonIds(user);

    if (visibleSalespersonIds.length === 0) {
      return NextResponse.json({
        message: 'No visible salesperson IDs',
        user: { email: user.email, role: user.role }
      });
    }

    // Build WHERE clause for permissions
    let whereConditions: string[] = ['is_active = true'];
    let queryParams: any[] = [];

    if (visibleSalespersonIds !== 'all') {
      whereConditions.push(`assigned_salesperson_id = ANY($1)`);
      queryParams.push(visibleSalespersonIds);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get sample of avatars with all data
    const query = `
      SELECT
        id,
        name,
        assigned_salesperson_id,
        assigned_salesperson_name,
        total_orders,
        total_revenue,
        churn_risk_score,
        health_score,
        top_products,
        product_categories
      FROM customer_avatars
      WHERE ${whereClause}
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const result = await sql.query(query, queryParams);

    // Analyze the data
    const avatars = result.rows.map(row => ({
      ...row,
      top_products: typeof row.top_products === 'string'
        ? JSON.parse(row.top_products || '[]')
        : row.top_products || [],
      product_categories: typeof row.product_categories === 'string'
        ? JSON.parse(row.product_categories || '{}')
        : row.product_categories || {},
    }));

    const stats = {
      total_avatars_found: result.rows.length,
      avatars_with_top_products: avatars.filter(a => Array.isArray(a.top_products) && a.top_products.length > 0).length,
      avatars_with_high_churn: avatars.filter(a => a.churn_risk_score > 70).length,
      avg_churn_risk: avatars.reduce((sum, a) => sum + Number(a.churn_risk_score || 0), 0) / (avatars.length || 1),
      avg_health_score: avatars.reduce((sum, a) => sum + Number(a.health_score || 0), 0) / (avatars.length || 1),
    };

    return NextResponse.json({
      user: {
        email: user.email,
        role: user.role,
        visibleSalespersonIds: visibleSalespersonIds === 'all' ? 'ALL' : visibleSalespersonIds
      },
      stats,
      sample_avatars: avatars.map(a => ({
        id: a.id,
        name: a.name,
        salesperson: a.assigned_salesperson_name,
        revenue: a.total_revenue,
        orders: a.total_orders,
        churn_risk: a.churn_risk_score,
        health_score: a.health_score,
        top_products_count: Array.isArray(a.top_products) ? a.top_products.length : 0,
        top_products_sample: Array.isArray(a.top_products) ? a.top_products.slice(0, 2) : []
      }))
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-AVATARS] Error:', error);
    return NextResponse.json(
      { error: 'Debug query failed', details: error.message },
      { status: 500 }
    );
  }
}
