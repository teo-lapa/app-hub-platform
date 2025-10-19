import { sql } from '@vercel/postgres';

/**
 * Sales AI Hub - Database Client
 * Gestisce memoria conversazionale e tracking interazioni venditori
 *
 * FALLBACK MODE: Se POSTGRES_URL non è configurato, usa memoria in-memory (non persistente)
 */

// ========== CONFIG ==========

const hasDatabase = !!process.env.POSTGRES_URL;

// In-memory storage (fallback quando DB non configurato)
const memoryStore = {
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, ConversationMessage[]>(),
  interactions: new Map<string, ClientInteraction[]>(),
  plans: new Map<string, DailyPlan>()
};

if (!hasDatabase) {
  console.warn('⚠️  POSTGRES_URL not found - Using in-memory storage (data will be lost on restart)');
}

// ========== TYPES ==========

export interface Conversation {
  id: string;
  salesperson_id: number;
  salesperson_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface ClientInteraction {
  id: string;
  conversation_id: string;
  salesperson_id: number;
  odoo_client_id: number;
  client_name: string;
  interaction_type: 'call' | 'email' | 'meeting' | 'follow_up' | 'order' | 'visit';
  summary?: string;
  action_taken?: string;
  outcome?: 'positive' | 'neutral' | 'negative' | 'pending';
  next_action?: string;
  next_action_date?: Date;
  amount?: number;
  created_at: Date;
}

export interface DailyPlan {
  id: string;
  salesperson_id: number;
  plan_date: Date;
  priorities: any[];
  kpis: Record<string, any>;
  generated_at: Date;
}

// ========== CONVERSATIONS ==========

export async function getOrCreateConversation(
  salespersonId: number,
  salespersonName: string
): Promise<Conversation> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const key = `sp_${salespersonId}`;
    let conv = memoryStore.conversations.get(key);

    if (!conv) {
      conv = {
        id: `conv_${Date.now()}`,
        salesperson_id: salespersonId,
        salesperson_name: salespersonName,
        created_at: new Date(),
        updated_at: new Date()
      };
      memoryStore.conversations.set(key, conv);
    }

    return conv;
  }

  // DATABASE mode
  const existing = await sql<Conversation>`
    SELECT * FROM conversations
    WHERE salesperson_id = ${salespersonId}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await sql<Conversation>`
    INSERT INTO conversations (salesperson_id, salesperson_name)
    VALUES (${salespersonId}, ${salespersonName})
    RETURNING *
  `;

  return result.rows[0];
}

// ========== MESSAGES ==========

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, any> = {}
): Promise<ConversationMessage> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      conversation_id: conversationId,
      role,
      content,
      metadata,
      created_at: new Date()
    };

    const messages = memoryStore.messages.get(conversationId) || [];
    messages.push(message);
    memoryStore.messages.set(conversationId, messages);

    return message;
  }

  // DATABASE mode
  const result = await sql<ConversationMessage>`
    INSERT INTO conversation_messages (conversation_id, role, content, metadata)
    VALUES (${conversationId}, ${role}, ${content}, ${JSON.stringify(metadata)})
    RETURNING *
  `;

  await sql`
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = ${conversationId}
  `;

  return result.rows[0];
}

export async function getConversationHistory(
  conversationId: string,
  limit: number = 50,
  daysBack: number = 60
): Promise<ConversationMessage[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const messages = memoryStore.messages.get(conversationId) || [];
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    return messages
      .filter(m => m.created_at >= cutoffDate)
      .slice(-limit);
  }

  // DATABASE mode
  const result = await sql<ConversationMessage>`
    SELECT * FROM conversation_messages
    WHERE conversation_id = ${conversationId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.reverse();
}

export async function getRecentMessages(
  salespersonId: number,
  limit: number = 20
): Promise<ConversationMessage[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const allMessages: ConversationMessage[] = [];

    for (const [convId, messages] of Array.from(memoryStore.messages.entries())) {
      allMessages.push(...messages);
    }

    return allMessages
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  // DATABASE mode
  const result = await sql<ConversationMessage>`
    SELECT cm.*
    FROM conversation_messages cm
    JOIN conversations c ON c.id = cm.conversation_id
    WHERE c.salesperson_id = ${salespersonId}
    ORDER BY cm.created_at DESC
    LIMIT ${limit}
  `;

  return result.rows;
}

// ========== CLIENT INTERACTIONS ==========

export async function saveClientInteraction(
  interaction: Omit<ClientInteraction, 'id' | 'created_at'>
): Promise<ClientInteraction> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const newInteraction: ClientInteraction = {
      ...interaction,
      id: `int_${Date.now()}`,
      created_at: new Date()
    };

    const key = `sp_${interaction.salesperson_id}`;
    const interactions = memoryStore.interactions.get(key) || [];
    interactions.push(newInteraction);
    memoryStore.interactions.set(key, interactions);

    return newInteraction;
  }

  // DATABASE mode
  const result = await sql<ClientInteraction>`
    INSERT INTO client_interactions (
      conversation_id,
      salesperson_id,
      odoo_client_id,
      client_name,
      interaction_type,
      summary,
      action_taken,
      outcome,
      next_action,
      next_action_date,
      amount
    )
    VALUES (
      ${interaction.conversation_id},
      ${interaction.salesperson_id},
      ${interaction.odoo_client_id},
      ${interaction.client_name},
      ${interaction.interaction_type},
      ${interaction.summary || null},
      ${interaction.action_taken || null},
      ${interaction.outcome || null},
      ${interaction.next_action || null},
      ${interaction.next_action_date ? interaction.next_action_date.toISOString() : null},
      ${interaction.amount || null}
    )
    RETURNING *
  `;

  return result.rows[0];
}

export async function getClientInteractions(
  clientId: number,
  daysBack: number = 60
): Promise<ClientInteraction[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const allInteractions: ClientInteraction[] = [];

    for (const interactions of Array.from(memoryStore.interactions.values())) {
      allInteractions.push(...interactions);
    }

    return allInteractions
      .filter(i => i.odoo_client_id === clientId && i.created_at >= cutoffDate)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // DATABASE mode
  const result = await sql<ClientInteraction>`
    SELECT * FROM client_interactions
    WHERE odoo_client_id = ${clientId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
    ORDER BY created_at DESC
  `;

  return result.rows;
}

export async function getSalespersonInteractions(
  salespersonId: number,
  daysBack: number = 60
): Promise<ClientInteraction[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const key = `sp_${salespersonId}`;
    const interactions = memoryStore.interactions.get(key) || [];

    return interactions
      .filter(i => i.created_at >= cutoffDate)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  // DATABASE mode
  const result = await sql<ClientInteraction>`
    SELECT * FROM client_interactions
    WHERE salesperson_id = ${salespersonId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
    ORDER BY created_at DESC
  `;

  return result.rows;
}

export async function getUpcomingActions(
  salespersonId?: number
): Promise<ClientInteraction[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const allInteractions: ClientInteraction[] = [];

    if (salespersonId) {
      const key = `sp_${salespersonId}`;
      const interactions = memoryStore.interactions.get(key) || [];
      allInteractions.push(...interactions);
    } else {
      for (const interactions of Array.from(memoryStore.interactions.values())) {
        allInteractions.push(...interactions);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allInteractions
      .filter(i => i.next_action_date && i.next_action_date >= today)
      .sort((a, b) => {
        const dateA = a.next_action_date?.getTime() || 0;
        const dateB = b.next_action_date?.getTime() || 0;
        return dateA - dateB;
      });
  }

  // DATABASE mode
  if (salespersonId) {
    const result = await sql<ClientInteraction>`
      SELECT * FROM client_interactions
      WHERE salesperson_id = ${salespersonId}
        AND next_action_date IS NOT NULL
        AND next_action_date >= CURRENT_DATE
      ORDER BY next_action_date ASC
    `;
    return result.rows;
  }

  const result = await sql<ClientInteraction>`
    SELECT * FROM upcoming_actions
  `;
  return result.rows;
}

// ========== DAILY PLANS ==========

export async function saveDailyPlan(
  salespersonId: number,
  planDate: Date,
  priorities: any[],
  kpis: Record<string, any>
): Promise<DailyPlan> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const key = `${salespersonId}_${planDate.toISOString().split('T')[0]}`;
    const plan: DailyPlan = {
      id: `plan_${Date.now()}`,
      salesperson_id: salespersonId,
      plan_date: planDate,
      priorities,
      kpis,
      generated_at: new Date()
    };

    memoryStore.plans.set(key, plan);
    return plan;
  }

  // DATABASE mode
  await sql`
    DELETE FROM daily_plans
    WHERE salesperson_id = ${salespersonId}
      AND plan_date = ${planDate.toISOString().split('T')[0]}
  `;

  const result = await sql<DailyPlan>`
    INSERT INTO daily_plans (salesperson_id, plan_date, priorities, kpis)
    VALUES (
      ${salespersonId},
      ${planDate.toISOString().split('T')[0]},
      ${JSON.stringify(priorities)},
      ${JSON.stringify(kpis)}
    )
    RETURNING *
  `;

  return result.rows[0];
}

export async function getDailyPlan(
  salespersonId: number,
  planDate: Date
): Promise<DailyPlan | null> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const key = `${salespersonId}_${planDate.toISOString().split('T')[0]}`;
    return memoryStore.plans.get(key) || null;
  }

  // DATABASE mode
  const result = await sql<DailyPlan>`
    SELECT * FROM daily_plans
    WHERE salesperson_id = ${salespersonId}
      AND plan_date = ${planDate.toISOString().split('T')[0]}
    LIMIT 1
  `;

  return result.rows[0] || null;
}

// ========== ANALYTICS ==========

export async function getInteractionStats(
  salespersonId: number,
  daysBack: number = 30
): Promise<{
  totalInteractions: number;
  byType: Record<string, number>;
  byOutcome: Record<string, number>;
  totalRevenue: number;
}> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const key = `sp_${salespersonId}`;
    const interactions = memoryStore.interactions.get(key) || [];

    const filtered = interactions.filter(i => i.created_at >= cutoffDate);

    const byType: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    let totalRevenue = 0;

    filtered.forEach(i => {
      byType[i.interaction_type] = (byType[i.interaction_type] || 0) + 1;
      if (i.outcome) {
        byOutcome[i.outcome] = (byOutcome[i.outcome] || 0) + 1;
      }
      if (i.amount) {
        totalRevenue += i.amount;
      }
    });

    return {
      totalInteractions: filtered.length,
      totalRevenue,
      byType,
      byOutcome
    };
  }

  // DATABASE mode
  const result = await sql`
    SELECT
      COUNT(*) as total_interactions,
      SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_revenue
    FROM client_interactions
    WHERE salesperson_id = ${salespersonId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
  `;

  const byType = await sql`
    SELECT interaction_type, COUNT(*) as count
    FROM client_interactions
    WHERE salesperson_id = ${salespersonId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
    GROUP BY interaction_type
  `;

  const byOutcome = await sql`
    SELECT outcome, COUNT(*) as count
    FROM client_interactions
    WHERE salesperson_id = ${salespersonId}
      AND created_at >= NOW() - INTERVAL '${daysBack} days'
      AND outcome IS NOT NULL
    GROUP BY outcome
  `;

  return {
    totalInteractions: parseInt(result.rows[0]?.total_interactions || '0'),
    totalRevenue: parseFloat(result.rows[0]?.total_revenue || '0'),
    byType: byType.rows.reduce((acc, row) => ({
      ...acc,
      [row.interaction_type]: parseInt(row.count)
    }), {}),
    byOutcome: byOutcome.rows.reduce((acc, row) => ({
      ...acc,
      [row.outcome]: parseInt(row.count)
    }), {})
  };
}

// ========== INITIALIZATION ==========

/**
 * Inizializza il database con lo schema
 * NOTA: Da eseguire solo una volta o via Vercel Dashboard
 */
export async function initializeDatabase(): Promise<void> {
  // Lo schema SQL deve essere eseguito manualmente o via Vercel Dashboard
  // Questo metodo serve solo come placeholder per future migrations
  console.log('Database schema should be initialized via Vercel Dashboard or SQL file');
}
