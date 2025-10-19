/**
 * MAESTRO AI - Customer Avatars API
 *
 * GET /api/maestro/avatars
 * Query params: salesperson_id, health_score_min, churn_risk_min, limit, offset, sort_by, sort_order
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getAvatarsQuerySchema, validateRequest } from '@/lib/maestro/validation';
import type { CustomerAvatar } from '@/lib/maestro/types';

export async function GET(request: NextRequest) {
  try {
    // 1. Parse e valida query params
    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      salesperson_id: searchParams.get('salesperson_id') || undefined,
      health_score_min: searchParams.get('health_score_min') || undefined,
      churn_risk_min: searchParams.get('churn_risk_min') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      sort_by: searchParams.get('sort_by') || undefined,
      sort_order: searchParams.get('sort_order') || undefined,
    };

    const validation = validateRequest(getAvatarsQuerySchema, queryData);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const params = validation.data;

    // 2. Build query dinamica con filtri
    let whereConditions: string[] = ['is_active = true'];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (params.salesperson_id !== undefined) {
      whereConditions.push(`assigned_salesperson_id = $${paramIndex}`);
      queryParams.push(params.salesperson_id);
      paramIndex++;
    }

    if (params.health_score_min !== undefined) {
      whereConditions.push(`health_score >= $${paramIndex}`);
      queryParams.push(params.health_score_min);
      paramIndex++;
    }

    if (params.churn_risk_min !== undefined) {
      whereConditions.push(`churn_risk_score >= $${paramIndex}`);
      queryParams.push(params.churn_risk_min);
      paramIndex++;
    }

    if (params.search !== undefined) {
      whereConditions.push(`name ILIKE $${paramIndex}`);
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // 3. Determina order by
    const validSortColumns: Record<string, string> = {
      health_score: 'health_score',
      churn_risk_score: 'churn_risk_score',
      total_revenue: 'total_revenue',
      last_order_date: 'last_order_date'
    };
    const sortBy = params.sort_by || 'health_score';
    const sortColumn = validSortColumns[sortBy] || 'health_score';
    const sortOrder = (params.sort_order || 'desc').toUpperCase();

    // 4. Query con COUNT per total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_avatars
      WHERE ${whereClause}
    `;

    const countResult = await sql.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 5. Query principale con pagination
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

    // 6. Parse JSON fields (if needed - Vercel Postgres auto-parses JSON columns)
    const avatars = dataResult.rows.map(row => ({
      ...row,
      top_products: typeof row.top_products === 'string'
        ? JSON.parse(row.top_products || '[]')
        : row.top_products || [],
      product_categories: typeof row.product_categories === 'string'
        ? JSON.parse(row.product_categories || '{}')
        : row.product_categories || {},
    })) as CustomerAvatar[];

    // 7. Risposta con pagination metadata
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    return NextResponse.json({
      avatars,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /avatars error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer avatars', details: error.message },
      { status: 500 }
    );
  }
}
