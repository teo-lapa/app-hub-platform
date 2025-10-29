/**
 * MAESTRO AI - AI Recommendations Service
 *
 * Genera raccomandazioni intelligenti usando Claude AI
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';
import type { CustomerAvatar, Recommendation, GenerateRecommendationsRequest } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface RecentOrder {
  id: number;
  date_order: string;
  amount_total: number;
  state: string;
}

interface RecentInteraction {
  id: string;
  interaction_type: string;
  interaction_date: Date;
  outcome: string;
  notes: string | null;
}

interface CustomerAvatarRow extends Omit<CustomerAvatar, 'top_products' | 'product_categories'> {
  top_products: string;
  product_categories: string;
}

interface AIRecommendationInput {
  avatar: CustomerAvatar;
  recent_orders?: RecentOrder[];
  recent_interactions?: RecentInteraction[];
}

interface AIRecommendation {
  type: 'churn_prevention' | 'upsell' | 'cross_sell' | 'reactivation' | 'routine_followup';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  suggested_actions: string[];
  suggested_products?: number[];
  reasoning: string;
  expected_impact: string;
  confidence: number;
  estimated_effort_minutes: number;
}

/**
 * Genera raccomandazioni AI per un venditore
 */
export async function generateRecommendations(
  request: GenerateRecommendationsRequest,
  salespersonId: number
): Promise<Recommendation[]> {
  console.log(`🤖 [MAESTRO-AI] Generating recommendations for salesperson ${salespersonId}...`);

  // 1. Fetch customers del venditore
  const avatarsResult = await sql`
    SELECT * FROM customer_avatars
    WHERE assigned_salesperson_id = ${salespersonId}
      AND is_active = true
    ORDER BY churn_risk_score DESC, health_score ASC
    LIMIT 50
  `;

  const avatarRows = avatarsResult.rows as unknown as CustomerAvatarRow[];
  console.log(`✅ [MAESTRO-AI] Found ${avatarRows.length} active customers`);

  if (avatarRows.length === 0) {
    return [];
  }

  // 2. Filtra in base a focus
  let targetCustomers = avatarRows;
  if (request.focus_on === 'churn') {
    targetCustomers = avatarRows.filter(a => a.churn_risk_score >= 60);
  } else if (request.focus_on === 'upsell') {
    targetCustomers = avatarRows.filter(a => a.upsell_potential_score >= 50);
  }

  console.log(`🎯 [MAESTRO-AI] Focusing on ${targetCustomers.length} customers (focus: ${request.focus_on})`);

  // 3. Genera raccomandazioni per top customers
  const recommendations: Recommendation[] = [];
  const limit = Math.min(request.max_recommendations || 10, targetCustomers.length);

  for (let i = 0; i < limit; i++) {
    const avatarRow = targetCustomers[i];
    if (!avatarRow) continue;

    try {
      // Parse JSON fields to create proper CustomerAvatar
      const avatar: CustomerAvatar = {
        ...avatarRow,
        top_products: JSON.parse(avatarRow.top_products || '[]'),
        product_categories: JSON.parse(avatarRow.product_categories || '{}'),
      };

      const aiRecommendation = await generateAIRecommendation({
        avatar
      });

      // Salva nel database
      const savedRecommendation = await saveRecommendation(
        avatar.id,
        aiRecommendation,
        salespersonId
      );

      recommendations.push(savedRecommendation);

      console.log(`✅ [MAESTRO-AI] Generated ${aiRecommendation.type} recommendation for ${avatar.name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [MAESTRO-AI] Failed to generate recommendation for ${avatarRow.name}:`, errorMessage);
    }
  }

  console.log(`🎉 [MAESTRO-AI] Generated ${recommendations.length} recommendations`);

  return recommendations;
}

/**
 * Usa Claude AI per generare una raccomandazione intelligente
 */
async function generateAIRecommendation(
  input: AIRecommendationInput
): Promise<AIRecommendation> {
  const { avatar } = input;

  const prompt = buildRecommendationPrompt(avatar);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const firstContent = message.content[0];
  const responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';

  // Parse risposta AI (JSON format)
  try {
    const aiResponse = JSON.parse(responseText);
    return aiResponse as AIRecommendation;
  } catch (error) {
    console.error('❌ [MAESTRO-AI] Failed to parse AI response:', error);
    // Fallback: genera raccomandazione basic
    return generateFallbackRecommendation(avatar);
  }
}

/**
 * Build prompt per Claude AI
 */
function buildRecommendationPrompt(avatar: CustomerAvatar): string {
  return `Tu sei MAESTRO, un AI assistant per agenti di vendita nel settore food & beverage.

Analizza questo cliente e genera UNA raccomandazione strategica di vendita.

**DATI CLIENTE:**
- Nome: ${avatar.name}
- Città: ${avatar.city || 'N/A'}
- Total Orders: ${avatar.total_orders}
- Total Revenue: €${avatar.total_revenue.toFixed(2)}
- Avg Order Value: €${avatar.avg_order_value.toFixed(2)}
- Days Since Last Order: ${avatar.days_since_last_order}
- Order Frequency (days): ${avatar.order_frequency_days || 'N/A'}

**AI SCORES:**
- Health Score: ${avatar.health_score}/100
- Churn Risk: ${avatar.churn_risk_score}/100
- Upsell Potential: ${avatar.upsell_potential_score}/100
- Engagement: ${avatar.engagement_score}/100

**TOP PRODUCTS:**
${avatar.top_products.length > 0 ? avatar.top_products.map(p => `- ${p.product_name} (${p.times_purchased} times)`).join('\n') : '- Nessun dato prodotto'}

**TASK:**
Genera UNA raccomandazione strategica. Rispondi SOLO con JSON valido nel seguente formato:

{
  "type": "churn_prevention" | "upsell" | "cross_sell" | "reactivation" | "routine_followup",
  "priority": "low" | "medium" | "high" | "urgent",
  "title": "Breve titolo azione (max 60 char)",
  "description": "Descrizione azione consigliata (100-200 char)",
  "suggested_actions": [
    "Azione concreta 1",
    "Azione concreta 2",
    "Azione concreta 3"
  ],
  "reasoning": "Perché questa raccomandazione? (150-250 char)",
  "expected_impact": "Impatto atteso es: 'Potenziale recupero: €500' o 'Retention +20%'",
  "confidence": 75,
  "estimated_effort_minutes": 30
}

**LINEE GUIDA:**
- Se churn_risk_score >= 70: priorità URGENT, type "churn_prevention"
- Se churn_risk_score 50-69: priorità HIGH, type "churn_prevention"
- Se upsell_potential_score >= 60 && churn_risk_score < 50: type "upsell"
- Se days_since_last_order > 60: considera "reactivation"
- Azioni concrete, specifiche, actionable
- Confidence: 60-95 (basato su certezza dati)
- Effort: 15-120 minuti (realistico)

Rispondi SOLO con il JSON, nessun testo aggiuntivo.`;
}

/**
 * Fallback recommendation se AI fallisce
 */
function generateFallbackRecommendation(avatar: CustomerAvatar): AIRecommendation {
  // Logica basic per determinare tipo
  let type: AIRecommendation['type'] = 'routine_followup';
  let priority: AIRecommendation['priority'] = 'medium';
  let title = 'Follow-up cliente';
  let description = 'Contattare il cliente per verifica ordini';

  if (avatar.churn_risk_score >= 70) {
    type = 'churn_prevention';
    priority = 'urgent';
    title = 'URGENTE: Cliente a rischio abbandono';
    description = `${avatar.name} non ordina da ${avatar.days_since_last_order} giorni. Rischio churn alto.`;
  } else if (avatar.churn_risk_score >= 50) {
    type = 'churn_prevention';
    priority = 'high';
    title = 'Cliente con segnali di disengagement';
    description = `${avatar.name} sta riducendo frequenza ordini. Intervento preventivo necessario.`;
  } else if (avatar.upsell_potential_score >= 60) {
    type = 'upsell';
    priority = 'medium';
    title = 'Opportunità di upsell';
    description = `${avatar.name} è un cliente fedele. Ottima opportunità per proporre nuovi prodotti.`;
  }

  return {
    type,
    priority,
    title,
    description,
    suggested_actions: [
      'Chiamare il cliente entro 48 ore',
      'Verificare soddisfazione prodotti attuali',
      'Proporre offerte personalizzate'
    ],
    reasoning: `Basato su metriche: Churn Risk ${avatar.churn_risk_score}%, Health Score ${avatar.health_score}%`,
    expected_impact: avatar.churn_risk_score >= 60 ? `Potenziale recupero: €${(avatar.avg_order_value * 3).toFixed(2)}` : 'Retention cliente',
    confidence: 70,
    estimated_effort_minutes: 30
  };
}

/**
 * Salva raccomandazione nel database
 */
async function saveRecommendation(
  customerAvatarId: string,
  aiRec: AIRecommendation,
  salespersonId: number
): Promise<Recommendation> {
  const result = await sql`
    INSERT INTO maestro_recommendations (
      customer_avatar_id,
      recommendation_type,
      priority,
      title,
      description,
      suggested_actions,
      suggested_products,
      reasoning,
      expected_impact,
      status,
      created_by,
      ai_confidence,
      estimated_effort_minutes,
      created_at,
      updated_at
    ) VALUES (
      ${customerAvatarId},
      ${aiRec.type},
      ${aiRec.priority},
      ${aiRec.title},
      ${aiRec.description},
      ${JSON.stringify(aiRec.suggested_actions)},
      ${aiRec.suggested_products ? JSON.stringify(aiRec.suggested_products) : null},
      ${aiRec.reasoning},
      ${aiRec.expected_impact},
      'pending',
      'ai',
      ${aiRec.confidence},
      ${aiRec.estimated_effort_minutes},
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  return result.rows[0] as unknown as Recommendation;
}

/**
 * Update recommendation status
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: 'in_progress' | 'completed' | 'dismissed',
  outcome?: string,
  outcomeNotes?: string
): Promise<Recommendation> {
  const result = await sql`
    UPDATE maestro_recommendations
    SET
      status = ${status},
      outcome = ${outcome || null},
      outcome_notes = ${outcomeNotes || null},
      completed_at = ${status === 'completed' ? new Date().toISOString() : null},
      updated_at = NOW()
    WHERE id = ${recommendationId}
    RETURNING *
  `;

  if (result.rows.length === 0) {
    throw new Error('Recommendation not found');
  }

  return result.rows[0] as unknown as Recommendation;
}
