/**
 * MAESTRO AI - Interactions API
 *
 * POST /api/maestro/interactions
 * Registra interazione con cliente (visita, chiamata, email, etc.)
 *
 * GET /api/maestro/interactions
 * Fetch interazioni con filtri
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createInteractionSchema, validateRequest } from '@/lib/maestro/validation';
import type { Interaction } from '@/lib/maestro/types';

/**
 * GET /api/maestro/interactions
 * Fetch interazioni con filtri
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerAvatarId = searchParams.get('customer_avatar_id');
    const salespersonId = searchParams.get('salesperson_id');
    const interactionType = searchParams.get('interaction_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build dynamic query
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (customerAvatarId) {
      whereConditions.push(`customer_avatar_id = $${paramIndex}`);
      queryParams.push(customerAvatarId);
      paramIndex++;
    }

    if (salespersonId) {
      whereConditions.push(`salesperson_id = $${paramIndex}`);
      queryParams.push(parseInt(salespersonId));
      paramIndex++;
    }

    if (interactionType) {
      whereConditions.push(`interaction_type = $${paramIndex}`);
      queryParams.push(interactionType);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        i.*,
        ca.name as customer_name
      FROM maestro_interactions i
      JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
      ${whereClause}
      ORDER BY i.interaction_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await sql.query(query, queryParams);

    // Parse JSON fields
    const interactions: Interaction[] = result.rows.map(row => ({
      ...row,
      samples_given: row.samples_given ? JSON.parse(row.samples_given) : null,
    })) as any[];

    return NextResponse.json({
      interactions,
      pagination: {
        limit,
        offset,
        count: interactions.length,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /interactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interactions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maestro/interactions
 * Crea nuova interazione e trigger avatar update
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valida input
    const validation = validateRequest(createInteractionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

    console.log(`📝 [MAESTRO-API] Creating interaction for customer ${data.customer_avatar_id}`);

    // 1. Fetch avatar per ottenere salesperson info
    const avatarResult = await sql`
      SELECT assigned_salesperson_id, assigned_salesperson_name
      FROM customer_avatars
      WHERE id = ${data.customer_avatar_id}
    `;

    if (avatarResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer avatar not found' },
        { status: 404 }
      );
    }

    const avatar = avatarResult.rows[0];
    const salespersonId = avatar.assigned_salesperson_id;
    const salespersonName = avatar.assigned_salesperson_name;

    // 2. Insert interaction
    const interactionResult = await sql`
      INSERT INTO maestro_interactions (
        customer_avatar_id,
        salesperson_id,
        salesperson_name,
        interaction_type,
        interaction_date,
        outcome,
        notes,
        order_placed,
        order_value,
        samples_given,
        next_follow_up_date,
        recommendation_id,
        created_at,
        updated_at
      ) VALUES (
        ${data.customer_avatar_id},
        ${salespersonId},
        ${salespersonName},
        ${data.interaction_type},
        NOW(),
        ${data.outcome},
        ${data.notes || null},
        ${data.order_placed || false},
        ${data.order_value || null},
        ${data.samples_given ? JSON.stringify(data.samples_given) : null},
        ${data.next_follow_up_date || null},
        ${data.recommendation_id || null},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const interaction = interactionResult.rows[0] as any as Interaction;

    console.log(`✅ [MAESTRO-API] Interaction created: ${interaction.id}`);

    // 3. Update avatar dopo interazione
    await updateAvatarAfterInteraction(
      data.customer_avatar_id,
      data.outcome,
      data.order_placed || false
    );

    // 4. Se l'interazione è legata a una raccomandazione, marca come in_progress
    if (data.recommendation_id) {
      await sql`
        UPDATE maestro_recommendations
        SET
          status = 'in_progress',
          updated_at = NOW()
        WHERE id = ${data.recommendation_id}
          AND status = 'pending'
      `;
      console.log(`📋 [MAESTRO-API] Recommendation ${data.recommendation_id} marked as in_progress`);
    }

    return NextResponse.json({
      success: true,
      interaction: {
        ...interaction,
        samples_given: interaction.samples_given ? JSON.parse(interaction.samples_given as any) : null,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] POST /interactions error:', error);
    return NextResponse.json(
      { error: 'Failed to create interaction', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Update avatar dopo interazione (recalculate scores)
 */
async function updateAvatarAfterInteraction(
  avatarId: string,
  outcome: string,
  orderPlaced: boolean
): Promise<void> {
  console.log(`🔄 [MAESTRO-API] Updating avatar ${avatarId} after interaction (outcome: ${outcome})`);

  // Logica di aggiornamento scores basata su outcome
  let churnRiskAdjustment = 0;
  let engagementAdjustment = 0;

  if (outcome === 'successful') {
    churnRiskAdjustment = -15; // Riduce rischio churn
    engagementAdjustment = +10; // Aumenta engagement
  } else if (outcome === 'neutral') {
    churnRiskAdjustment = -5;
    engagementAdjustment = +5;
  } else if (outcome === 'unsuccessful') {
    churnRiskAdjustment = +5; // Aumenta rischio churn
    engagementAdjustment = -5;
  }

  // Se ha fatto un ordine, ulteriore boost
  if (orderPlaced) {
    churnRiskAdjustment -= 10;
    engagementAdjustment += 15;
  }

  await sql`
    UPDATE customer_avatars
    SET
      churn_risk_score = GREATEST(0, LEAST(100, churn_risk_score + ${churnRiskAdjustment})),
      engagement_score = GREATEST(0, LEAST(100, engagement_score + ${engagementAdjustment})),
      health_score = GREATEST(0, LEAST(100,
        (100 - GREATEST(0, LEAST(100, churn_risk_score + ${churnRiskAdjustment})) +
         GREATEST(0, LEAST(100, engagement_score + ${engagementAdjustment}))) / 2
      )),
      updated_at = NOW()
    WHERE id = ${avatarId}
  `;

  console.log(`✅ [MAESTRO-API] Avatar scores updated (churn: ${churnRiskAdjustment}, engagement: ${engagementAdjustment})`);
}
