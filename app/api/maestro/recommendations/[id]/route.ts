/**
 * MAESTRO AI - Single Recommendation API
 *
 * PATCH /api/maestro/recommendations/[id]
 * Update recommendation status, outcome, notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { updateRecommendationStatus } from '@/lib/maestro/ai-service';
import { updateRecommendationSchema, validateRequest } from '@/lib/maestro/validation';

/**
 * GET /api/maestro/recommendations/[id]
 * Fetch single recommendation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recommendationId = params.id;

    const result = await sql`
      SELECT r.*, ca.name as customer_name
      FROM maestro_recommendations r
      JOIN customer_avatars ca ON r.customer_avatar_id = ca.id
      WHERE r.id = ${recommendationId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const recommendation = {
      ...row,
      suggested_actions: JSON.parse(row.suggested_actions || '[]'),
      suggested_products: row.suggested_products ? JSON.parse(row.suggested_products) : null,
    };

    return NextResponse.json({ recommendation });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /recommendations/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendation', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/maestro/recommendations/[id]
 * Update recommendation status and outcome
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recommendationId = params.id;
    const body = await request.json();

    // Valida input
    const validation = validateRequest(updateRecommendationSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { status, outcome, outcome_notes } = validation.data;

    console.log(`📝 [MAESTRO-API] Updating recommendation ${recommendationId} to status: ${status}`);

    // Update via service (include learning logic)
    const updatedRecommendation = await updateRecommendationStatus(
      recommendationId,
      status,
      outcome,
      outcome_notes
    );

    // Se completata con successo, trigger avatar update (recalculate scores)
    if (status === 'completed' && outcome === 'success') {
      console.log('🔄 [MAESTRO-API] Triggering avatar recalculation after successful recommendation...');

      // Fetch avatar ID
      const avatarId = updatedRecommendation.customer_avatar_id;

      // Update last interaction date (segnala che è avvenuto un contatto)
      await sql`
        UPDATE customer_avatars
        SET
          updated_at = NOW(),
          -- Opzionale: potresti voler decrementare churn_risk dopo interazione di successo
          churn_risk_score = GREATEST(0, churn_risk_score - 10)
        WHERE id = ${avatarId}
      `;

      console.log('✅ [MAESTRO-API] Avatar updated after successful recommendation');
    }

    return NextResponse.json({
      success: true,
      recommendation: {
        ...updatedRecommendation,
        suggested_actions: JSON.parse(updatedRecommendation.suggested_actions as any || '[]'),
        suggested_products: updatedRecommendation.suggested_products
          ? JSON.parse(updatedRecommendation.suggested_products as any)
          : null,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] PATCH /recommendations/[id] error:', error);

    if (error.message === 'Recommendation not found') {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update recommendation', details: error.message },
      { status: 500 }
    );
  }
}
