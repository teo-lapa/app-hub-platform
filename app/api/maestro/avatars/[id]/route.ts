/**
 * MAESTRO AI - Customer Avatar Detail API
 *
 * GET /api/maestro/avatars/[id]
 * Ritorna avatar completo + ordini recenti + raccomandazioni attive
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { CustomerAvatar, Recommendation, Interaction } from '@/lib/maestro/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const avatarId = params.id;

    // 1. Fetch avatar
    const avatarResult = await sql`
      SELECT * FROM customer_avatars
      WHERE id = ${avatarId}
    `;

    if (avatarResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer avatar not found' },
        { status: 404 }
      );
    }

    const avatarData = avatarResult.rows[0];
    const avatar: CustomerAvatar = {
      ...avatarData,
      top_products: typeof avatarData.top_products === 'string'
        ? JSON.parse(avatarData.top_products || '[]')
        : avatarData.top_products || [],
      product_categories: typeof avatarData.product_categories === 'string'
        ? JSON.parse(avatarData.product_categories || '{}')
        : avatarData.product_categories || {},
    } as any;

    // 2. Fetch raccomandazioni attive (pending + in_progress)
    const recommendationsResult = await sql`
      SELECT * FROM maestro_recommendations
      WHERE customer_avatar_id = ${avatarId}
        AND status IN ('pending', 'in_progress')
      ORDER BY priority DESC, created_at DESC
      LIMIT 10
    `;

    const recommendations: Recommendation[] = recommendationsResult.rows.map(row => ({
      ...row,
      suggested_actions: typeof row.suggested_actions === 'string'
        ? JSON.parse(row.suggested_actions || '[]')
        : row.suggested_actions || [],
      suggested_products: row.suggested_products
        ? (typeof row.suggested_products === 'string' ? JSON.parse(row.suggested_products) : row.suggested_products)
        : null,
    })) as any[];

    // 3. Fetch ultime 5 interazioni (se tabella esiste)
    let interactions: Interaction[] = [];
    try {
      const interactionsResult = await sql`
        SELECT * FROM maestro_interactions
        WHERE customer_avatar_id = ${avatarId}
        ORDER BY interaction_date DESC
        LIMIT 5
      `;

      interactions = interactionsResult.rows.map(row => ({
        ...row,
        samples_given: row.samples_given
          ? (typeof row.samples_given === 'string' ? JSON.parse(row.samples_given) : row.samples_given)
          : null,
      })) as any[];
    } catch (error: any) {
      // Table might not exist yet - it's ok, just return empty array
      if (error.code !== '42P01') throw error; // Re-throw if not "relation does not exist"
    }

    // 4. Fetch ultimi ordini da Odoo (se possibile)
    // TODO: Integrazione Odoo per fetch ordini recenti in real-time
    // Per ora restituiamo solo dati da DB
    const recentOrders: any[] = [];

    // 5. Risposta completa
    return NextResponse.json({
      avatar,
      recommendations,
      interactions,
      recent_orders: recentOrders,
      summary: {
        total_recommendations_active: recommendations.length,
        last_interaction_date: interactions.length > 0 ? interactions[0].interaction_date : null,
        requires_attention: avatar.churn_risk_score >= 70 || recommendations.some(r => r.priority === 'urgent'),
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /avatars/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch avatar details', details: error.message },
      { status: 500 }
    );
  }
}
