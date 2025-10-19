/**
 * MAESTRO AI - Recommendations API
 *
 * GET /api/maestro/recommendations - Fetch recommendations
 * POST /api/maestro/recommendations/generate - Generate new AI recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { generateRecommendations } from '@/lib/maestro/ai-service';
import { generateRecommendationsSchema, validateRequest } from '@/lib/maestro/validation';
import type { Recommendation } from '@/lib/maestro/types';

/**
 * GET /api/maestro/recommendations
 * Fetch recommendations con filtri
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const salespersonId = searchParams.get('salesperson_id');
    const status = searchParams.get('status'); // pending, in_progress, completed, dismissed
    const priority = searchParams.get('priority'); // low, medium, high, urgent
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build dynamic query
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (salespersonId) {
      // Join con customer_avatars per filtrare per venditore
      whereConditions.push(`ca.assigned_salesperson_id = $${paramIndex}`);
      queryParams.push(parseInt(salespersonId));
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`r.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`r.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query con join su customer_avatars
    const query = `
      SELECT
        r.*,
        ca.name as customer_name,
        ca.assigned_salesperson_name
      FROM maestro_recommendations r
      JOIN customer_avatars ca ON r.customer_avatar_id = ca.id
      ${whereClause}
      ORDER BY
        CASE r.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await sql.query(query, queryParams);

    // Parse JSON fields
    const recommendations: Recommendation[] = result.rows.map(row => ({
      ...row,
      suggested_actions: JSON.parse(row.suggested_actions || '[]'),
      suggested_products: row.suggested_products ? JSON.parse(row.suggested_products) : null,
    })) as any[];

    return NextResponse.json({
      recommendations,
      pagination: {
        limit,
        offset,
        count: recommendations.length,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maestro/recommendations/generate
 * Genera nuove raccomandazioni AI per un venditore
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valida input
    const validation = validateRequest(generateRecommendationsSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const params = validation.data;

    console.log(`🤖 [MAESTRO-API] Generating recommendations for salesperson ${params.salesperson_id}...`);

    // Genera raccomandazioni tramite AI service
    const startTime = Date.now();
    const recommendations = await generateRecommendations(params, params.salesperson_id);
    const duration = Date.now() - startTime;

    // Calcola statistiche
    const urgentCount = recommendations.filter(r => r.priority === 'urgent').length;
    const highPriorityCount = recommendations.filter(r => r.priority === 'high').length;
    const totalEstimatedTime = recommendations.reduce((sum, r) => sum + r.estimated_effort_minutes, 0);

    console.log(`✅ [MAESTRO-API] Generated ${recommendations.length} recommendations in ${duration}ms`);

    return NextResponse.json({
      success: true,
      recommendations,
      summary: {
        total_generated: recommendations.length,
        urgent_count: urgentCount,
        high_priority_count: highPriorityCount,
        estimated_total_time_minutes: totalEstimatedTime,
        generation_time_ms: duration,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] POST /recommendations/generate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations', details: error.message },
      { status: 500 }
    );
  }
}
