/**
 * MAESTRO AI - Daily Plan API
 *
 * GET /api/maestro/daily-plan
 * Genera piano giornaliero ottimizzato per venditore
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getDailyPlanQuerySchema, validateRequest } from '@/lib/maestro/validation';
import type { CustomerAvatar, Recommendation, Interaction, DailyPlan, CustomerWithRecommendations } from '@/lib/maestro/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Parse e valida query params
    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      salesperson_id: searchParams.get('salesperson_id') || undefined,
      date: searchParams.get('date') || undefined,
    };

    const validation = validateRequest(getDailyPlanQuerySchema, queryData);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const params = validation.data;
    const targetDate = params.date || new Date().toISOString().split('T')[0]; // Default: oggi

    console.log(`📅 [MAESTRO-API] Generating daily plan for salesperson ${params.salesperson_id || 'ALL'}, date: ${targetDate}`);

    // 2. Fetch tutti i clienti del venditore attivi (or all if no salesperson specified)
    const avatarsResult = params.salesperson_id
      ? await sql`
          SELECT * FROM customer_avatars
          WHERE assigned_salesperson_id = ${params.salesperson_id}
            AND is_active = true
          ORDER BY churn_risk_score DESC, health_score ASC
        `
      : await sql`
          SELECT * FROM customer_avatars
          WHERE is_active = true
          ORDER BY churn_risk_score DESC, health_score ASC
        `;

    if (avatarsResult.rows.length === 0) {
      return NextResponse.json({
        daily_plan: {
          date: targetDate,
          salesperson_id: params.salesperson_id,
          urgent_customers: [],
          high_priority_customers: [],
          upsell_opportunities: [],
          routine_followups: [],
          total_estimated_time_minutes: 0,
          suggested_route: null,
        }
      });
    }

    const avatars = avatarsResult.rows.map(row => ({
      ...row,
      top_products: typeof row.top_products === 'string'
        ? JSON.parse(row.top_products || '[]')
        : row.top_products || [],
      product_categories: typeof row.product_categories === 'string'
        ? JSON.parse(row.product_categories || '{}')
        : row.product_categories || {},
    })) as any[] as CustomerAvatar[];

    // 3. Fetch raccomandazioni attive per questi clienti
    const avatarIds = avatars.map(a => a.id);

    const recommendationsResult = await sql.query(`
      SELECT * FROM maestro_recommendations
      WHERE customer_avatar_id = ANY($1::int[])
        AND status IN ('pending', 'in_progress')
      ORDER BY priority DESC, created_at DESC
    `, [avatarIds]);

    const recommendations: Recommendation[] = recommendationsResult.rows.map(row => ({
      ...row,
      suggested_actions: typeof row.suggested_actions === 'string'
        ? JSON.parse(row.suggested_actions || '[]')
        : row.suggested_actions || [],
      suggested_products: row.suggested_products
        ? (typeof row.suggested_products === 'string' ? JSON.parse(row.suggested_products) : row.suggested_products)
        : null,
    })) as any[];

    // 4. Fetch last interaction per ogni cliente (se tabella esiste)
    const lastInteractionsMap = new Map();
    try {
      const interactionsResult = await sql.query(`
        SELECT DISTINCT ON (customer_avatar_id)
          customer_avatar_id,
          interaction_date,
          outcome
        FROM maestro_interactions
        WHERE customer_avatar_id = ANY($1::int[])
        ORDER BY customer_avatar_id, interaction_date DESC
      `, [avatarIds]);

      interactionsResult.rows.forEach(row => {
        lastInteractionsMap.set(row.customer_avatar_id, row);
      });
    } catch (error: any) {
      // Table might not exist yet - it's ok, continue without interactions
      if (error.code !== '42P01') throw error; // Re-throw if not "relation does not exist"
    }

    // 5. Crea mappa raccomandazioni per cliente
    const recommendationsMap = new Map<string, Recommendation[]>();
    for (const rec of recommendations) {
      if (!recommendationsMap.has(rec.customer_avatar_id)) {
        recommendationsMap.set(rec.customer_avatar_id, []);
      }
      recommendationsMap.get(rec.customer_avatar_id)!.push(rec);
    }

    // 6. Categorizza clienti in base a priorità
    const urgentCustomers: CustomerWithRecommendations[] = [];
    const highPriorityCustomers: CustomerWithRecommendations[] = [];
    const upsellOpportunities: CustomerWithRecommendations[] = [];
    const routineFollowups: CustomerWithRecommendations[] = [];

    for (const avatar of avatars) {
      const customerRecs = recommendationsMap.get(avatar.id) || [];
      const lastInteraction = lastInteractionsMap.get(avatar.id) || null;

      const customerWithRecs: CustomerWithRecommendations = {
        avatar,
        recommendations: customerRecs,
        last_interaction: lastInteraction as any,
      };

      // Categorizzazione
      const hasUrgentRec = customerRecs.some(r => r.priority === 'urgent');
      const hasHighRec = customerRecs.some(r => r.priority === 'high');

      if (avatar.churn_risk_score >= 70 || hasUrgentRec) {
        urgentCustomers.push(customerWithRecs);
      } else if (avatar.churn_risk_score >= 50 || hasHighRec) {
        highPriorityCustomers.push(customerWithRecs);
      } else if (avatar.upsell_potential_score >= 60) {
        upsellOpportunities.push(customerWithRecs);
      } else if (avatar.days_since_last_order >= 30 && avatar.days_since_last_order < 60) {
        routineFollowups.push(customerWithRecs);
      }
    }

    // 7. Calcola tempo totale stimato
    const totalEstimatedTime = [
      ...urgentCustomers,
      ...highPriorityCustomers,
      ...upsellOpportunities,
      ...routineFollowups.slice(0, 3) // Max 3 routine followups
    ].reduce((total, customer) => {
      const recsTime = customer.recommendations.reduce((sum, r) => sum + r.estimated_effort_minutes, 0);
      return total + Math.max(recsTime, 20); // Minimo 20 min per cliente
    }, 0);

    // 8. TODO: Geo-routing optimization
    // Per ora ordiniamo per città (grouping geografico semplice)
    const suggestedRoute = null; // Future implementation

    // 9. Fetch salesperson name
    const salesPersonName = avatars[0]?.assigned_salesperson_name || 'Unknown';

    const dailyPlan: DailyPlan = {
      date: new Date(targetDate),
      salesperson_id: params.salesperson_id ?? 0,
      salesperson_name: salesPersonName,
      urgent_customers: urgentCustomers.slice(0, 5), // Max 5 urgent
      high_priority_customers: highPriorityCustomers.slice(0, 5),
      upsell_opportunities: upsellOpportunities.slice(0, 3),
      routine_followups: routineFollowups.slice(0, 3),
      total_estimated_time_minutes: totalEstimatedTime,
      suggested_route: suggestedRoute,
      created_at: new Date(),
    };

    console.log(`✅ [MAESTRO-API] Daily plan generated: ${urgentCustomers.length} urgent, ${highPriorityCustomers.length} high priority`);

    return NextResponse.json({
      daily_plan: dailyPlan,
      summary: {
        total_customers_to_contact: urgentCustomers.length + highPriorityCustomers.length + upsellOpportunities.length + routineFollowups.length,
        urgent_count: urgentCustomers.length,
        high_priority_count: highPriorityCustomers.length,
        upsell_count: upsellOpportunities.length,
        routine_count: routineFollowups.length,
        estimated_hours: Math.round(totalEstimatedTime / 60 * 10) / 10,
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /daily-plan error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily plan', details: error.message },
      { status: 500 }
    );
  }
}
