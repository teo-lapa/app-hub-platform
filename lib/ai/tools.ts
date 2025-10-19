/**
 * MAESTRO AI - Claude Tools Definitions & Implementations
 *
 * Tools disponibili per Claude durante il chat:
 * - get_customer_info: Recupera customer avatar completo
 * - get_customer_orders: Recupera ultimi ordini cliente
 * - get_salesperson_performance: KPI performance venditore
 * - search_customers: Ricerca clienti per nome/città
 */

import { sql } from '@vercel/postgres';
import Anthropic from '@anthropic-ai/sdk';
import type { CustomerAvatar } from '@/lib/maestro/types';

// ============================================================================
// TOOL DEFINITIONS (JSON Schema per Claude)
// ============================================================================

export const MAESTRO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_customer_info',
    description: 'Recupera informazioni complete su un cliente specifico inclusi metriche, health score, prodotti top e raccomandazioni.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID Odoo del cliente (partner_id)',
        },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'get_customer_orders',
    description: 'Recupera gli ultimi ordini di un cliente con dettagli su prodotti, importi e stato.',
    input_schema: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'number',
          description: 'ID Odoo del cliente (partner_id)',
        },
        limit: {
          type: 'number',
          description: 'Numero massimo di ordini da recuperare (default: 10)',
          default: 10,
        },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'get_salesperson_performance',
    description: 'Recupera KPI di performance del venditore: clienti gestiti, ordini totali, revenue, top customers.',
    input_schema: {
      type: 'object',
      properties: {
        salesperson_id: {
          type: 'number',
          description: 'ID Odoo del venditore (res.users)',
        },
        period_days: {
          type: 'number',
          description: 'Periodo in giorni per calcolare metriche (default: 30)',
          default: 30,
        },
      },
      required: ['salesperson_id'],
    },
  },
  {
    name: 'search_customers',
    description: 'Cerca clienti per nome, città o altre caratteristiche. Utile per trovare un cliente senza conoscere ID esatto.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Testo di ricerca (nome cliente, città, etc.)',
        },
        salesperson_id: {
          type: 'number',
          description: 'Filtra solo clienti assegnati a questo venditore (opzionale)',
        },
        limit: {
          type: 'number',
          description: 'Numero massimo di risultati (default: 5)',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Tool: get_customer_info
 * Recupera avatar completo del cliente
 */
export async function getCustomerInfo(customerId: number): Promise<{
  success: boolean;
  customer?: CustomerAvatar;
  recommendations?: any[];
  error?: string;
}> {
  try {
    console.log(`🔍 [MAESTRO-TOOL] get_customer_info(${customerId})`);

    // Fetch customer avatar
    const avatarResult = await sql`
      SELECT * FROM customer_avatars
      WHERE odoo_partner_id = ${customerId}
      LIMIT 1
    `;

    if (avatarResult.rows.length === 0) {
      return {
        success: false,
        error: `Cliente ${customerId} non trovato nel database Maestro`,
      };
    }

    const avatarRow = avatarResult.rows[0] as any;

    // Parse JSON fields
    const avatar: CustomerAvatar = {
      ...avatarRow,
      top_products: JSON.parse(avatarRow.top_products || '[]'),
      product_categories: JSON.parse(avatarRow.product_categories || '{}'),
    };

    // Fetch active recommendations per questo cliente
    const recsResult = await sql`
      SELECT * FROM maestro_recommendations
      WHERE customer_avatar_id = ${avatar.id}
        AND status IN ('pending', 'in_progress')
      ORDER BY priority DESC, created_at DESC
      LIMIT 5
    `;

    console.log(`✅ [MAESTRO-TOOL] Found customer: ${avatar.name}`);

    return {
      success: true,
      customer: avatar,
      recommendations: recsResult.rows,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-TOOL] get_customer_info error:`, errorMessage);
    return {
      success: false,
      error: `Errore recupero info cliente: ${errorMessage}`,
    };
  }
}

/**
 * Tool: get_customer_orders
 * Recupera ultimi ordini cliente dal DB Maestro
 */
export async function getCustomerOrders(
  customerId: number,
  limit: number = 10
): Promise<{
  success: boolean;
  orders?: any[];
  summary?: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
  };
  error?: string;
}> {
  try {
    console.log(`🔍 [MAESTRO-TOOL] get_customer_orders(${customerId}, limit=${limit})`);

    // Prima recupera l'avatar per avere i dati aggregati
    const avatarResult = await sql`
      SELECT total_orders, total_revenue, avg_order_value
      FROM customer_avatars
      WHERE odoo_partner_id = ${customerId}
      LIMIT 1
    `;

    if (avatarResult.rows.length === 0) {
      return {
        success: false,
        error: `Cliente ${customerId} non trovato`,
      };
    }

    const avatarData = avatarResult.rows[0] as any;

    // Nota: per ora non abbiamo una tabella order_history nel DB
    // In una implementazione completa, dovresti avere una tabella
    // maestro_orders con sync da Odoo
    // Per ora ritorniamo solo i dati aggregati dall'avatar

    console.log(`✅ [MAESTRO-TOOL] Retrieved order summary for customer ${customerId}`);

    return {
      success: true,
      orders: [], // TODO: implementare tabella maestro_orders
      summary: {
        total_orders: avatarData.total_orders,
        total_revenue: parseFloat(avatarData.total_revenue),
        avg_order_value: parseFloat(avatarData.avg_order_value),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-TOOL] get_customer_orders error:`, errorMessage);
    return {
      success: false,
      error: `Errore recupero ordini: ${errorMessage}`,
    };
  }
}

/**
 * Tool: get_salesperson_performance
 * KPI performance venditore
 */
export async function getSalespersonPerformance(
  salespersonId: number,
  periodDays: number = 30
): Promise<{
  success: boolean;
  performance?: {
    total_customers: number;
    active_customers: number;
    total_revenue: number;
    total_orders: number;
    avg_order_value: number;
    churn_risk_customers: number;
    upsell_opportunities: number;
    top_customers: Array<{
      name: string;
      revenue: number;
      health_score: number;
    }>;
  };
  error?: string;
}> {
  try {
    console.log(`🔍 [MAESTRO-TOOL] get_salesperson_performance(${salespersonId}, period=${periodDays}d)`);

    // Total customers assigned
    const totalCustomersResult = await sql`
      SELECT COUNT(*) as count
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
    `;

    // Active customers (ordered in last period)
    const activeCustomersResult = await sql`
      SELECT COUNT(*) as count
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
        AND days_since_last_order <= ${periodDays}
    `;

    // Revenue and order stats
    const statsResult = await sql`
      SELECT
        SUM(total_revenue) as total_revenue,
        SUM(total_orders) as total_orders,
        AVG(avg_order_value) as avg_order_value
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
    `;

    // Churn risk count
    const churnRiskResult = await sql`
      SELECT COUNT(*) as count
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
        AND churn_risk_score >= 60
    `;

    // Upsell opportunities
    const upsellResult = await sql`
      SELECT COUNT(*) as count
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
        AND upsell_potential_score >= 60
        AND churn_risk_score < 50
    `;

    // Top 5 customers by revenue
    const topCustomersResult = await sql`
      SELECT name, total_revenue as revenue, health_score
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${salespersonId}
      ORDER BY total_revenue DESC
      LIMIT 5
    `;

    const stats = statsResult.rows[0] as any;

    console.log(`✅ [MAESTRO-TOOL] Performance data for salesperson ${salespersonId}`);

    return {
      success: true,
      performance: {
        total_customers: parseInt((totalCustomersResult.rows[0] as any).count),
        active_customers: parseInt((activeCustomersResult.rows[0] as any).count),
        total_revenue: parseFloat(stats.total_revenue || 0),
        total_orders: parseInt(stats.total_orders || 0),
        avg_order_value: parseFloat(stats.avg_order_value || 0),
        churn_risk_customers: parseInt((churnRiskResult.rows[0] as any).count),
        upsell_opportunities: parseInt((upsellResult.rows[0] as any).count),
        top_customers: topCustomersResult.rows.map((row: any) => ({
          name: row.name,
          revenue: parseFloat(row.revenue),
          health_score: row.health_score,
        })),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-TOOL] get_salesperson_performance error:`, errorMessage);
    return {
      success: false,
      error: `Errore recupero performance: ${errorMessage}`,
    };
  }
}

/**
 * Tool: search_customers
 * Ricerca clienti per nome o città
 */
export async function searchCustomers(
  query: string,
  salespersonId?: number,
  limit: number = 5
): Promise<{
  success: boolean;
  customers?: Array<{
    id: string;
    odoo_partner_id: number;
    name: string;
    city: string | null;
    health_score: number;
    churn_risk_score: number;
    total_revenue: number;
    days_since_last_order: number;
  }>;
  count?: number;
  error?: string;
}> {
  try {
    console.log(`🔍 [MAESTRO-TOOL] search_customers("${query}", salesperson=${salespersonId}, limit=${limit})`);

    const searchPattern = `%${query}%`;

    let customersResult;

    if (salespersonId) {
      // Search only in salesperson's customers
      customersResult = await sql`
        SELECT
          id,
          odoo_partner_id,
          name,
          city,
          health_score,
          churn_risk_score,
          total_revenue,
          days_since_last_order
        FROM customer_avatars
        WHERE assigned_salesperson_id = ${salespersonId}
          AND (
            LOWER(name) LIKE LOWER(${searchPattern})
            OR LOWER(city) LIKE LOWER(${searchPattern})
          )
          AND is_active = true
        ORDER BY total_revenue DESC
        LIMIT ${limit}
      `;
    } else {
      // Search across all customers
      customersResult = await sql`
        SELECT
          id,
          odoo_partner_id,
          name,
          city,
          health_score,
          churn_risk_score,
          total_revenue,
          days_since_last_order
        FROM customer_avatars
        WHERE (
            LOWER(name) LIKE LOWER(${searchPattern})
            OR LOWER(city) LIKE LOWER(${searchPattern})
          )
          AND is_active = true
        ORDER BY total_revenue DESC
        LIMIT ${limit}
      `;
    }

    console.log(`✅ [MAESTRO-TOOL] Found ${customersResult.rows.length} customers matching "${query}"`);

    return {
      success: true,
      customers: customersResult.rows.map((row: any) => ({
        id: row.id,
        odoo_partner_id: row.odoo_partner_id,
        name: row.name,
        city: row.city,
        health_score: row.health_score,
        churn_risk_score: row.churn_risk_score,
        total_revenue: parseFloat(row.total_revenue),
        days_since_last_order: row.days_since_last_order,
      })),
      count: customersResult.rows.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-TOOL] search_customers error:`, errorMessage);
    return {
      success: false,
      error: `Errore ricerca clienti: ${errorMessage}`,
    };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Execute a tool call from Claude
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, any>
): Promise<any> {
  console.log(`🛠️ [MAESTRO-TOOL] Executing: ${toolName}`, toolInput);

  try {
    switch (toolName) {
      case 'get_customer_info':
        return await getCustomerInfo(toolInput.customer_id);

      case 'get_customer_orders':
        return await getCustomerOrders(
          toolInput.customer_id,
          toolInput.limit
        );

      case 'get_salesperson_performance':
        return await getSalespersonPerformance(
          toolInput.salesperson_id,
          toolInput.period_days
        );

      case 'search_customers':
        return await searchCustomers(
          toolInput.query,
          toolInput.salesperson_id,
          toolInput.limit
        );

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-TOOL] Tool execution error:`, errorMessage);
    return {
      success: false,
      error: `Tool execution failed: ${errorMessage}`,
    };
  }
}
