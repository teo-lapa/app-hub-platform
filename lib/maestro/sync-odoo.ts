/**
 * MAESTRO AI - Sync Odoo Data to Vercel Postgres
 *
 * STRICT TYPE SAFETY - NO 'any' ALLOWED
 * Questo script sincronizza gli ultimi 4 mesi di clienti attivi da Odoo
 * e crea/aggiorna i Customer Avatars nel database
 */

import { sql } from '@vercel/postgres';
import { getOdooSession } from '../odoo-auth';
import { createOdooRPCClient, type OdooRPCClient } from '../odoo/rpcClient';
import type {
  OdooPartner,
  OdooOrder,
  OdooOrderLine,
  SyncResult,
  SyncStatus,
  CustomerMetrics,
  AIScoresResult
} from './types';
import { extractOdooId, extractOdooName, odooFalseToNull, roundTo, safeDivide, clamp } from './utils';

/**
 * Database Customer Avatar type for SQL inserts (snake_case fields)
 * Note: Dates are converted to ISO strings for Postgres compatibility
 */
interface CustomerAvatarDB {
  odoo_partner_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;

  first_order_date: string | null;
  last_order_date: string | null;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  order_frequency_days: number | null;
  days_since_last_order: number;

  top_products: unknown[];
  product_categories: Record<string, unknown>;

  health_score: number;
  churn_risk_score: number;
  upsell_potential_score: number;
  engagement_score: number;

  assigned_salesperson_id: number | null;
  assigned_salesperson_name: string | null;
}

/**
 * Sync clienti attivi ultimi 4 mesi da Odoo
 */
export async function syncCustomersFromOdoo(maxCustomers: number = 0): Promise<SyncResult> {
  console.log('🔄 [MAESTRO-SYNC] Starting Odoo → Database sync...');
  const startTime = Date.now();

  const stats: SyncResult = {
    success: false,
    synced: 0,
    updated: 0,
    created: 0,
    errors: [],
    started_at: new Date().toISOString(),
    completed_at: '',
    duration_ms: 0
  };

  try {
    // 1. Connetti a Odoo
    const { cookies } = await getOdooSession();
    const odoo: OdooRPCClient = createOdooRPCClient(cookies?.replace('session_id=', '') ?? '');
    console.log('✅ [MAESTRO-SYNC] Connected to Odoo');

    // 2. Calcola data 4 mesi fa
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const dateFilter = fourMonthsAgo.toISOString();

    console.log(`📅 [MAESTRO-SYNC] Fetching orders from ${fourMonthsAgo.toLocaleDateString('it-IT')}...`);

    // 3. Fetch ordini ultimi 4 mesi
    const orders = await odoo.searchRead(
      'sale.order',
      [
        ['date_order', '>=', dateFilter],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'partner_id', 'date_order', 'amount_total', 'state', 'user_id'],
      maxCustomers > 0 ? maxCustomers * 10 : 0  // fetch più ordini del necessario
    ) as OdooOrder[];

    console.log(`✅ [MAESTRO-SYNC] Found ${orders.length} orders in last 4 months`);

    // 4. Raggruppa ordini per cliente
    const customerOrdersMap = new Map<number, OdooOrder[]>();
    const partnerIds = new Set<number>();

    for (const order of orders) {
      const partnerId = order.partner_id[0];
      partnerIds.add(partnerId);

      if (!customerOrdersMap.has(partnerId)) {
        customerOrdersMap.set(partnerId, []);
      }
      customerOrdersMap.get(partnerId)!.push(order);
    }

    console.log(`👥 [MAESTRO-SYNC] Found ${partnerIds.size} unique active customers`);

    // 5. Fetch dettagli clienti
    const customers = await odoo.searchRead(
      'res.partner',
      [['id', 'in', Array.from(partnerIds)]],
      ['id', 'name', 'email', 'phone', 'city', 'user_id'],
      0
    ) as OdooPartner[];

    console.log(`✅ [MAESTRO-SYNC] Fetched customer details for ${customers.length} customers`);

    // 6. Processa ogni cliente
    let processed = 0;
    const limit = maxCustomers > 0 ? maxCustomers : customers.length;

    for (const customer of customers.slice(0, limit)) {
      try {
        const partnerId = customer.id;
        const customerOrders = customerOrdersMap.get(partnerId) || [];

        if (customerOrders.length === 0) continue;

        // Calcola metriche
        const avatar = await buildCustomerAvatar(customer, customerOrders, odoo);

        // Upsert nel database
        const existing = await sql`
          SELECT id FROM customer_avatars WHERE odoo_partner_id = ${partnerId}
        `;

        if (existing.rows.length > 0) {
          // Update
          await updateCustomerAvatar(partnerId, avatar);
          stats.updated++;
          console.log(`♻️  [MAESTRO-SYNC] Updated avatar for ${customer.name}`);
        } else {
          // Insert
          await insertCustomerAvatar(avatar);
          stats.created++;
          console.log(`✨ [MAESTRO-SYNC] Created new avatar for ${customer.name}`);
        }

        stats.synced++;
        processed++;

        if (processed % 10 === 0) {
          console.log(`⏳ [MAESTRO-SYNC] Progress: ${processed}/${limit} customers processed`);
        }

      } catch (error) {
        const errorMsg = `Error processing customer ${customer.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ [MAESTRO-SYNC] ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log('✅ [MAESTRO-SYNC] Sync completed!');
    console.log(`📊 Stats: ${stats.synced} synced (${stats.created} new, ${stats.updated} updated), ${stats.errors.length} errors`);

    stats.success = true;
    stats.completed_at = new Date().toISOString();
    stats.duration_ms = Date.now() - startTime;
    return stats;

  } catch (error) {
    console.error('❌ [MAESTRO-SYNC] Fatal error:', error);
    const errorMsg = `Fatal: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(errorMsg);
    stats.completed_at = new Date().toISOString();
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }
}

/**
 * Costruisce Customer Avatar da dati Odoo
 */
async function buildCustomerAvatar(
  customer: OdooPartner,
  orders: OdooOrder[],
  odoo: OdooRPCClient
): Promise<CustomerAvatarDB> {

  // Sort ordini per data
  const sortedOrders = orders.sort((a, b) =>
    new Date(a.date_order).getTime() - new Date(b.date_order).getTime()
  );

  const firstOrder = sortedOrders[0];
  const lastOrder = sortedOrders[sortedOrders.length - 1];

  if (!firstOrder || !lastOrder) {
    throw new Error('No orders found for customer');
  }

  // Calcola metriche base
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);
  const avgOrderValue = totalRevenue / totalOrders;

  // Calcola frequenza ordini (giorni medi tra ordini)
  let orderFrequencyDays: number | null = null;
  if (totalOrders > 1) {
    const firstDate = new Date(firstOrder.date_order);
    const lastDate = new Date(lastOrder.date_order);
    const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    orderFrequencyDays = Math.floor(daysDiff / (totalOrders - 1));
  }

  // Giorni dall'ultimo ordine
  const daysSinceLastOrder = Math.floor(
    (Date.now() - new Date(lastOrder.date_order).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch prodotti ordinati
  const topProducts = await getTopProducts(orders, odoo);

  // Calcola AI Scores
  const metrics: CustomerMetrics = {
    daysSinceLastOrder,
    orderFrequencyDays,
    totalOrders,
    avgOrderValue,
    totalRevenue
  };
  const scores = calculateAIScores(metrics);

  // Venditore assegnato
  const salesPersonId = extractOdooId(customer.user_id);
  const salesPersonName = extractOdooName(customer.user_id);

  return {
    odoo_partner_id: customer.id,
    name: customer.name,
    email: odooFalseToNull(customer.email),
    phone: odooFalseToNull(customer.phone),
    city: odooFalseToNull(customer.city),

    first_order_date: new Date(firstOrder.date_order).toISOString(),
    last_order_date: new Date(lastOrder.date_order).toISOString(),
    total_orders: totalOrders,
    total_revenue: roundTo(totalRevenue, 2),
    avg_order_value: roundTo(avgOrderValue, 2),
    order_frequency_days: orderFrequencyDays,
    days_since_last_order: daysSinceLastOrder,

    top_products: topProducts,
    product_categories: {},

    health_score: scores.healthScore,
    churn_risk_score: scores.churnRiskScore,
    upsell_potential_score: scores.upsellPotentialScore,
    engagement_score: scores.engagementScore,

    assigned_salesperson_id: salesPersonId,
    assigned_salesperson_name: salesPersonName
  };
}

/**
 * Calcola AI Scores per il cliente
 */
function calculateAIScores(metrics: CustomerMetrics): AIScoresResult {
  const { daysSinceLastOrder, orderFrequencyDays, totalOrders, avgOrderValue, totalRevenue } = metrics;

  // Churn Risk Score (0-100, più alto = più rischio)
  let churnRiskScore = 0;
  if (orderFrequencyDays && orderFrequencyDays > 0) {
    // Se supera la frequenza media di 2x, rischio alto
    const ratio = safeDivide(daysSinceLastOrder, orderFrequencyDays);
    churnRiskScore = clamp(Math.floor(ratio * 50), 0, 100);
  } else {
    // Se ha solo 1 ordine, usa giorni assoluti
    churnRiskScore = clamp(Math.floor(daysSinceLastOrder / 2), 0, 100);
  }

  // Engagement Score (0-100, più alto = più attivo)
  const engagementScore = clamp(
    100 - Math.floor(daysSinceLastOrder / 3) + Math.min(30, totalOrders * 5),
    0,
    100
  );

  // Health Score (opposto di churn + engagement)
  const healthScore = Math.floor((100 - churnRiskScore + engagementScore) / 2);

  // Upsell Potential Score (basato su valore ordini e frequenza)
  let upsellPotentialScore = 0;
  if (avgOrderValue > 500) upsellPotentialScore += 30;
  if (totalOrders > 5) upsellPotentialScore += 30;
  if (totalRevenue > 5000) upsellPotentialScore += 20;
  if (churnRiskScore < 30) upsellPotentialScore += 20;  // clienti fedeli = upsell potential

  return {
    healthScore: clamp(healthScore, 0, 100),
    churnRiskScore: clamp(churnRiskScore, 0, 100),
    upsellPotentialScore: clamp(upsellPotentialScore, 0, 100),
    engagementScore: clamp(engagementScore, 0, 100)
  };
}

/**
 * Estrai top 5 prodotti più ordinati dal cliente
 */
async function getTopProducts(orders: OdooOrder[], odoo: OdooRPCClient): Promise<unknown[]> {
  // Per ora versione semplificata - nella versione completa fetch order lines
  // e raggruppa per prodotto

  // TODO: Implementare fetch di sale.order.line e aggregazione
  return [];
}

/**
 * Insert new customer avatar
 */
async function insertCustomerAvatar(avatar: CustomerAvatarDB): Promise<void> {
  await sql`
    INSERT INTO customer_avatars (
      odoo_partner_id, name, email, phone, city,
      first_order_date, last_order_date, total_orders, total_revenue, avg_order_value,
      order_frequency_days, days_since_last_order,
      top_products, product_categories,
      health_score, churn_risk_score, upsell_potential_score, engagement_score,
      assigned_salesperson_id, assigned_salesperson_name,
      created_at, updated_at, last_sync_odoo
    ) VALUES (
      ${avatar.odoo_partner_id}, ${avatar.name}, ${avatar.email}, ${avatar.phone}, ${avatar.city},
      ${avatar.first_order_date}, ${avatar.last_order_date}, ${avatar.total_orders},
      ${avatar.total_revenue}, ${avatar.avg_order_value},
      ${avatar.order_frequency_days}, ${avatar.days_since_last_order},
      ${JSON.stringify(avatar.top_products)}, ${JSON.stringify(avatar.product_categories)},
      ${avatar.health_score}, ${avatar.churn_risk_score},
      ${avatar.upsell_potential_score}, ${avatar.engagement_score},
      ${avatar.assigned_salesperson_id}, ${avatar.assigned_salesperson_name},
      NOW(), NOW(), NOW()
    )
  `;
}

/**
 * Update existing customer avatar
 */
async function updateCustomerAvatar(partnerId: number, avatar: CustomerAvatarDB): Promise<void> {
  await sql`
    UPDATE customer_avatars SET
      name = ${avatar.name},
      email = ${avatar.email},
      phone = ${avatar.phone},
      city = ${avatar.city},
      first_order_date = ${avatar.first_order_date},
      last_order_date = ${avatar.last_order_date},
      total_orders = ${avatar.total_orders},
      total_revenue = ${avatar.total_revenue},
      avg_order_value = ${avatar.avg_order_value},
      order_frequency_days = ${avatar.order_frequency_days},
      days_since_last_order = ${avatar.days_since_last_order},
      top_products = ${JSON.stringify(avatar.top_products)},
      product_categories = ${JSON.stringify(avatar.product_categories)},
      health_score = ${avatar.health_score},
      churn_risk_score = ${avatar.churn_risk_score},
      upsell_potential_score = ${avatar.upsell_potential_score},
      engagement_score = ${avatar.engagement_score},
      assigned_salesperson_id = ${avatar.assigned_salesperson_id},
      assigned_salesperson_name = ${avatar.assigned_salesperson_name},
      updated_at = NOW(),
      last_sync_odoo = NOW()
    WHERE odoo_partner_id = ${partnerId}
  `;
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      MAX(last_sync_odoo) as last_sync
    FROM customer_avatars
  `;

  const row = result.rows[0];

  if (!row) {
    return {
      totalAvatars: 0,
      activeAvatars: 0,
      lastSync: null
    };
  }

  return {
    totalAvatars: parseInt(row.total as string),
    activeAvatars: parseInt(row.active as string),
    lastSync: row.last_sync ? new Date(row.last_sync as string) : null
  };
}
