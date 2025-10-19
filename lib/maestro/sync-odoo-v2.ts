/**
 * MAESTRO AI - Sync Engine v2.0
 *
 * CRITICAL FEATURE: Parent/Child Partner Hierarchy Support
 *
 * In Odoo res.partner:
 * - PARENT COMPANY: parent_id = NULL, is_company = True
 * - CHILDREN: parent_id = ID_MADRE
 *   - Contacts (type='contact')
 *   - Invoice addresses (type='invoice')
 *   - Delivery addresses (type='delivery')
 *
 * Orders can be placed on ANY child, so we:
 * 1. Find all parent companies
 * 2. For each parent, find ALL children
 * 3. Aggregate orders from parent + ALL children
 * 4. Create ONE avatar per parent company
 */

import { sql } from '@vercel/postgres';
import { getOdooSession } from '../odoo-auth';
import { createOdooRPCClient } from '../odoo/rpcClient';

// ====================================================================
// TYPE DEFINITIONS
// ====================================================================

interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  city: string | false;
  parent_id: [number, string] | false;
  is_company: boolean;
  type: 'contact' | 'invoice' | 'delivery' | 'other';
  child_ids: number[];
  user_id: [number, string] | false;  // assigned salesperson
}

interface OdooOrder {
  id: number;
  partner_id: [number, string];
  date_order: string;
  amount_total: number;
  state: string;
  user_id: [number, string] | false;
  order_line: number[];
}

interface OdooOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
  price_subtotal: number;
}

interface ProductPurchasePattern {
  product_id: number;
  name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

interface CategoryStats {
  category_name: string;
  total_orders: number;
  total_revenue: number;
  percentage_of_total: number;
}

// Type alias for the actual OdooRPCClient to avoid conflicts
type OdooClient = ReturnType<typeof createOdooRPCClient>;

interface ParentCompanyData {
  parentId: number;
  parentName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  parentCity: string | null;
  allPartnerIds: number[];  // parent + all children
  children: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  deliveryAddresses: Array<{
    id: number;
    name: string;
    address: string;
  }>;
  salesPersonId: number | null;
  salesPersonName: string | null;
}

interface CustomerAvatar {
  odoo_partner_id: number;  // parent company ID
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;

  first_order_date: Date | null;
  last_order_date: Date | null;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  order_frequency_days: number | null;
  days_since_last_order: number;

  top_products: ProductPurchasePattern[];
  product_categories: Record<string, CategoryStats>;

  health_score: number;
  churn_risk_score: number;
  upsell_potential_score: number;
  engagement_score: number;

  assigned_salesperson_id: number | null;
  assigned_salesperson_name: string | null;
}

interface SyncResult {
  success: boolean;
  synced: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
  duration_seconds: number;
  timestamp: string;
}

// ====================================================================
// MAIN SYNC FUNCTION
// ====================================================================

/**
 * Sync customers from Odoo with parent/child hierarchy support
 *
 * @param options - Sync configuration
 * @returns SyncResult with statistics
 */
export async function syncCustomersFromOdoo(options?: {
  maxCustomers?: number;
  monthsBack?: number;
  dryRun?: boolean;
}): Promise<SyncResult> {
  const startTime = Date.now();

  console.log('\n🚀 ========================================');
  console.log('   MAESTRO AI - SYNC ENGINE v2.0');
  console.log('   Parent/Child Hierarchy Support');
  console.log('========================================\n');

  const stats = {
    success: false,
    synced: 0,
    updated: 0,
    created: 0,
    skipped: 0,
    errors: [] as string[],
    duration_seconds: 0,
    timestamp: new Date().toISOString()
  };

  const maxCustomers = options?.maxCustomers || 0;
  const monthsBack = options?.monthsBack || 4;
  const dryRun = options?.dryRun || false;

  try {
    // STEP 1: Connect to Odoo
    console.log('🔌 [STEP 1/7] Connecting to Odoo...');
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));
    console.log('✅ Connected to Odoo\n');

    // STEP 2: Calculate date filter
    const dateThreshold = new Date();
    dateThreshold.setMonth(dateThreshold.getMonth() - monthsBack);
    const dateFilter = dateThreshold.toISOString();

    console.log(`📅 [STEP 2/7] Date filter: ${dateThreshold.toLocaleDateString('it-IT')}`);
    console.log(`   Fetching orders from last ${monthsBack} months\n`);

    // STEP 3: Fetch all orders in date range
    console.log('📦 [STEP 3/7] Fetching orders from Odoo...');
    const orders: OdooOrder[] = await odoo.searchRead(
      'sale.order',
      [
        ['date_order', '>=', dateFilter],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'partner_id', 'date_order', 'amount_total', 'state', 'user_id', 'order_line'],
      0  // no limit, fetch all
    );
    console.log(`✅ Found ${orders.length} confirmed orders\n`);

    // STEP 4: Extract unique partner IDs (might be children)
    const allPartnerIds = new Set<number>();
    const ordersByPartnerId = new Map<number, OdooOrder[]>();

    for (const order of orders) {
      const partnerId = order.partner_id[0];
      allPartnerIds.add(partnerId);

      if (!ordersByPartnerId.has(partnerId)) {
        ordersByPartnerId.set(partnerId, []);
      }
      ordersByPartnerId.get(partnerId)!.push(order);
    }

    console.log(`👥 [STEP 4/7] Found ${allPartnerIds.size} unique partner IDs with orders`);

    // STEP 5: Fetch partner details and resolve parent hierarchy
    console.log('🔍 [STEP 5/7] Resolving parent/child hierarchy...');

    const partners: OdooPartner[] = await odoo.searchRead(
      'res.partner',
      [['id', 'in', Array.from(allPartnerIds)]],
      ['id', 'name', 'email', 'phone', 'city', 'parent_id', 'is_company', 'type', 'child_ids', 'user_id'],
      0
    );

    // Build parent company map
    const parentCompanies = await buildParentCompanyMap(partners, odoo);
    console.log(`✅ Resolved to ${parentCompanies.size} parent companies\n`);

    // STEP 6: Process each parent company
    console.log('⚙️  [STEP 6/7] Processing customer avatars...');

    const limit = maxCustomers > 0 ? maxCustomers : parentCompanies.size;
    const companiesArray = Array.from(parentCompanies.values()).slice(0, limit);

    for (let i = 0; i < companiesArray.length; i++) {
      const companyData = companiesArray[i];
      if (!companyData) continue;

      try {
        // Collect ALL orders from parent + children
        const allCompanyOrders: OdooOrder[] = [];

        for (const partnerId of companyData.allPartnerIds) {
          const partnerOrders = ordersByPartnerId.get(partnerId) || [];
          allCompanyOrders.push(...partnerOrders);
        }

        if (allCompanyOrders.length === 0) {
          stats.skipped++;
          continue;
        }

        // Build avatar
        const avatar = await buildCustomerAvatar(companyData, allCompanyOrders, odoo);

        if (dryRun) {
          console.log(`[DRY RUN] Would sync: ${avatar.name} (${allCompanyOrders.length} orders)`);
          stats.synced++;
          continue;
        }

        // Upsert to database
        const existing = await sql`
          SELECT id FROM customer_avatars WHERE odoo_partner_id = ${companyData.parentId}
        `;

        if (existing.rows.length > 0) {
          await updateCustomerAvatar(companyData.parentId, avatar);
          stats.updated++;
          console.log(`   ♻️  Updated: ${avatar.name} (${allCompanyOrders.length} orders)`);
        } else {
          await insertCustomerAvatar(avatar);
          stats.created++;
          console.log(`   ✨ Created: ${avatar.name} (${allCompanyOrders.length} orders)`);
        }

        stats.synced++;

        // Progress indicator
        if ((i + 1) % 20 === 0) {
          console.log(`\n   Progress: ${i + 1}/${companiesArray.length} companies processed\n`);
        }

      } catch (error) {
        const errorMsg = `Error processing ${companyData.parentName}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // STEP 7: Complete
    const duration = (Date.now() - startTime) / 1000;
    stats.duration_seconds = parseFloat(duration.toFixed(2));
    stats.success = true;

    console.log('\n✅ ========================================');
    console.log('   SYNC COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`📊 Statistics:`);
    console.log(`   - Total synced: ${stats.synced}`);
    console.log(`   - Created: ${stats.created}`);
    console.log(`   - Updated: ${stats.updated}`);
    console.log(`   - Skipped: ${stats.skipped}`);
    console.log(`   - Errors: ${stats.errors.length}`);
    console.log(`   - Duration: ${stats.duration_seconds}s`);
    console.log('========================================\n');

    return stats;

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    stats.duration_seconds = parseFloat(duration.toFixed(2));
    stats.success = false;

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('\n❌ ========================================');
    console.error('   SYNC FAILED');
    console.error('========================================');
    console.error(`Error: ${errorMessage}`);
    console.error(`Duration before failure: ${stats.duration_seconds}s`);
    console.error('========================================\n');

    stats.errors.push(`Fatal: ${errorMessage}`);
    return stats;
  }
}

// ====================================================================
// PARENT/CHILD HIERARCHY RESOLUTION
// ====================================================================

/**
 * Build map of parent companies with all their children
 *
 * This is the CRITICAL function that handles hierarchy
 */
async function buildParentCompanyMap(
  partners: OdooPartner[],
  odoo: OdooClient
): Promise<Map<number, ParentCompanyData>> {

  const parentMap = new Map<number, ParentCompanyData>();
  const processedPartners = new Set<number>();

  // First pass: identify all parent companies
  const parentIds = new Set<number>();
  const childToParentMap = new Map<number, number>();

  for (const partner of partners) {
    if (!partner.parent_id) {
      // This is a parent company
      parentIds.add(partner.id);
      processedPartners.add(partner.id);
    } else {
      // This is a child - track its parent
      const parentId = partner.parent_id[0];
      childToParentMap.set(partner.id, parentId);
      parentIds.add(parentId);
    }
  }

  // Fetch parent companies that might not be in our initial partner list
  const existingParentIds = new Set(partners.filter(p => !p.parent_id).map(p => p.id));
  const missingParentIds = Array.from(parentIds).filter(id => !existingParentIds.has(id));

  let parentCompanies = partners.filter(p => !p.parent_id);

  if (missingParentIds.length > 0) {
    console.log(`   📥 Fetching ${missingParentIds.length} missing parent companies...`);

    const missingParents: OdooPartner[] = await odoo.searchRead(
      'res.partner',
      [['id', 'in', missingParentIds]],
      ['id', 'name', 'email', 'phone', 'city', 'parent_id', 'is_company', 'type', 'child_ids', 'user_id'],
      0
    );

    parentCompanies = [...parentCompanies, ...missingParents];
    partners.push(...missingParents);
  }

  // Build parent company data structures
  for (const parent of parentCompanies) {
    const childrenIds = parent.child_ids || [];

    // Fetch children details if needed
    let children: OdooPartner[] = [];

    if (childrenIds.length > 0) {
      // Check if we already have these children
      const existingChildren = partners.filter(p => childrenIds.includes(p.id));
      const missingChildIds = childrenIds.filter(id => !partners.find(p => p.id === id));

      children = existingChildren;

      if (missingChildIds.length > 0) {
        const fetchedChildren: OdooPartner[] = await odoo.searchRead(
          'res.partner',
          [['id', 'in', missingChildIds]],
          ['id', 'name', 'email', 'phone', 'city', 'parent_id', 'is_company', 'type', 'child_ids', 'user_id'],
          0
        );
        children = [...children, ...fetchedChildren];
      }
    }

    // Extract delivery addresses
    const deliveryAddresses = children
      .filter(c => c.type === 'delivery')
      .map(c => ({
        id: c.id,
        name: c.name,
        address: `${c.city || 'N/A'}`
      }));

    // All partner IDs (parent + children)
    const allPartnerIds = [parent.id, ...childrenIds];

    // Get salesperson from parent
    const salesPersonId = parent.user_id ? parent.user_id[0] : null;
    const salesPersonName = parent.user_id ? parent.user_id[1] : null;

    parentMap.set(parent.id, {
      parentId: parent.id,
      parentName: parent.name,
      parentEmail: parent.email || null,
      parentPhone: parent.phone || null,
      parentCity: parent.city || null,
      allPartnerIds,
      children: children.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type || 'other'
      })),
      deliveryAddresses,
      salesPersonId,
      salesPersonName
    });
  }

  return parentMap;
}

// ====================================================================
// CUSTOMER AVATAR BUILDER
// ====================================================================

async function buildCustomerAvatar(
  companyData: ParentCompanyData,
  orders: OdooOrder[],
  odoo: OdooClient
): Promise<CustomerAvatar> {

  // Sort orders by date
  const sortedOrders = orders.sort((a, b) =>
    new Date(a.date_order).getTime() - new Date(b.date_order).getTime()
  );

  const firstOrder = sortedOrders[0];
  const lastOrder = sortedOrders[sortedOrders.length - 1];

  if (!firstOrder || !lastOrder) {
    throw new Error('No orders found for customer');
  }

  // Calculate metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);
  const avgOrderValue = totalRevenue / totalOrders;

  // Calculate order frequency (average days between orders)
  let orderFrequencyDays: number | null = null;
  if (totalOrders > 1) {
    const firstDate = new Date(firstOrder.date_order);
    const lastDate = new Date(lastOrder.date_order);
    const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    orderFrequencyDays = Math.floor(daysDiff / (totalOrders - 1));
  }

  // Days since last order
  const daysSinceLastOrder = Math.floor(
    (Date.now() - new Date(lastOrder.date_order).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch top products
  const topProducts = await getTopProducts(orders, odoo);

  // Calculate AI Scores
  const scores = calculateAIScores({
    daysSinceLastOrder,
    orderFrequencyDays,
    totalOrders,
    avgOrderValue,
    totalRevenue
  });

  return {
    odoo_partner_id: companyData.parentId,
    name: companyData.parentName,
    email: companyData.parentEmail,
    phone: companyData.parentPhone,
    city: companyData.parentCity,

    first_order_date: new Date(firstOrder.date_order),
    last_order_date: new Date(lastOrder.date_order),
    total_orders: totalOrders,
    total_revenue: parseFloat(totalRevenue.toFixed(2)),
    avg_order_value: parseFloat(avgOrderValue.toFixed(2)),
    order_frequency_days: orderFrequencyDays,
    days_since_last_order: daysSinceLastOrder,

    top_products: topProducts,
    product_categories: {},

    health_score: scores.healthScore,
    churn_risk_score: scores.churnRiskScore,
    upsell_potential_score: scores.upsellPotentialScore,
    engagement_score: scores.engagementScore,

    assigned_salesperson_id: companyData.salesPersonId,
    assigned_salesperson_name: companyData.salesPersonName
  };
}

// ====================================================================
// AI SCORING ALGORITHMS
// ====================================================================

/**
 * Calculate AI-powered customer scores
 *
 * Health Score (0-100): Overall relationship health
 * Churn Risk (0-100): Risk of customer leaving (higher = more risk)
 * Upsell Potential (0-100): Opportunity for growth
 * Engagement (0-100): How active/engaged customer is
 */
function calculateAIScores(metrics: {
  daysSinceLastOrder: number;
  orderFrequencyDays: number | null;
  totalOrders: number;
  avgOrderValue: number;
  totalRevenue: number;
}): {
  healthScore: number;
  churnRiskScore: number;
  upsellPotentialScore: number;
  engagementScore: number;
} {
  const {
    daysSinceLastOrder,
    orderFrequencyDays,
    totalOrders,
    avgOrderValue,
    totalRevenue
  } = metrics;

  // ============ CHURN RISK SCORE ============
  // Higher score = higher risk of churn
  let churnRiskScore = 0;

  if (orderFrequencyDays && orderFrequencyDays > 0) {
    // If days since last order exceeds 2x normal frequency, high risk
    const ratio = daysSinceLastOrder / orderFrequencyDays;

    if (ratio < 0.5) {
      churnRiskScore = 0;  // Very active
    } else if (ratio < 1) {
      churnRiskScore = 20;  // Normal
    } else if (ratio < 1.5) {
      churnRiskScore = 40;  // Slightly concerning
    } else if (ratio < 2) {
      churnRiskScore = 60;  // Concerning
    } else if (ratio < 3) {
      churnRiskScore = 80;  // High risk
    } else {
      churnRiskScore = 100;  // Critical risk
    }
  } else {
    // Only 1 order - use absolute days
    if (daysSinceLastOrder < 30) {
      churnRiskScore = 10;
    } else if (daysSinceLastOrder < 60) {
      churnRiskScore = 30;
    } else if (daysSinceLastOrder < 90) {
      churnRiskScore = 50;
    } else if (daysSinceLastOrder < 120) {
      churnRiskScore = 70;
    } else {
      churnRiskScore = 90;
    }
  }

  // ============ ENGAGEMENT SCORE ============
  // Higher score = more engaged
  let engagementScore = 100;

  // Recency penalty (max -60 points)
  const recencyPenalty = Math.min(60, Math.floor(daysSinceLastOrder / 3));
  engagementScore -= recencyPenalty;

  // Frequency bonus (max +30 points)
  const frequencyBonus = Math.min(30, totalOrders * 3);
  engagementScore += frequencyBonus;

  // Revenue bonus (max +20 points)
  if (totalRevenue > 10000) {
    engagementScore += 20;
  } else if (totalRevenue > 5000) {
    engagementScore += 10;
  } else if (totalRevenue > 1000) {
    engagementScore += 5;
  }

  engagementScore = Math.max(0, Math.min(100, engagementScore));

  // ============ HEALTH SCORE ============
  // Combination of low churn risk + high engagement
  const healthScore = Math.floor((100 - churnRiskScore + engagementScore) / 2);

  // ============ UPSELL POTENTIAL SCORE ============
  let upsellPotentialScore = 0;

  // High average order value = upsell potential
  if (avgOrderValue > 1000) {
    upsellPotentialScore += 40;
  } else if (avgOrderValue > 500) {
    upsellPotentialScore += 25;
  } else if (avgOrderValue > 200) {
    upsellPotentialScore += 10;
  }

  // Frequent buyer = upsell potential
  if (totalOrders > 10) {
    upsellPotentialScore += 30;
  } else if (totalOrders > 5) {
    upsellPotentialScore += 20;
  } else if (totalOrders > 3) {
    upsellPotentialScore += 10;
  }

  // High total revenue = upsell potential
  if (totalRevenue > 10000) {
    upsellPotentialScore += 20;
  } else if (totalRevenue > 5000) {
    upsellPotentialScore += 10;
  }

  // Loyal customers (low churn) = upsell potential
  if (churnRiskScore < 30) {
    upsellPotentialScore += 10;
  }

  upsellPotentialScore = Math.max(0, Math.min(100, upsellPotentialScore));

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    churnRiskScore: Math.max(0, Math.min(100, churnRiskScore)),
    upsellPotentialScore,
    engagementScore
  };
}

// ====================================================================
// TOP PRODUCTS EXTRACTION
// ====================================================================

async function getTopProducts(orders: OdooOrder[], odoo: OdooClient): Promise<ProductPurchasePattern[]> {
  try {
    // Get all order line IDs
    const orderLineIds: number[] = [];
    for (const order of orders) {
      if (order.order_line && order.order_line.length > 0) {
        orderLineIds.push(...order.order_line);
      }
    }

    if (orderLineIds.length === 0) {
      return [];
    }

    // Fetch order lines
    const orderLines: OdooOrderLine[] = await odoo.searchRead(
      'sale.order.line',
      [['id', 'in', orderLineIds]],
      ['id', 'product_id', 'product_uom_qty', 'price_subtotal'],
      0
    );

    // Aggregate by product
    const productMap = new Map<number, {
      id: number;
      name: string;
      totalQty: number;
      totalRevenue: number;
      orderCount: number;
    }>();

    for (const line of orderLines) {
      if (!line.product_id) continue;

      const productId = line.product_id[0];
      const productName = line.product_id[1];

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          id: productId,
          name: productName,
          totalQty: 0,
          totalRevenue: 0,
          orderCount: 0
        });
      }

      const product = productMap.get(productId)!;
      product.totalQty += line.product_uom_qty || 0;
      product.totalRevenue += line.price_subtotal || 0;
      product.orderCount += 1;
    }

    // Sort by revenue and return top 10
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map(p => ({
        product_id: p.id,
        name: p.name,
        total_quantity: parseFloat(p.totalQty.toFixed(2)),
        total_revenue: parseFloat(p.totalRevenue.toFixed(2)),
        order_count: p.orderCount
      }));

    return topProducts;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ⚠️  Failed to fetch top products: ${errorMessage}`);
    return [];
  }
}

// ====================================================================
// DATABASE OPERATIONS
// ====================================================================

async function insertCustomerAvatar(avatar: CustomerAvatar): Promise<void> {
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
      ${avatar.first_order_date?.toISOString() || null}, ${avatar.last_order_date?.toISOString() || null}, ${avatar.total_orders},
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

async function updateCustomerAvatar(partnerId: number, avatar: CustomerAvatar): Promise<void> {
  await sql`
    UPDATE customer_avatars SET
      name = ${avatar.name},
      email = ${avatar.email},
      phone = ${avatar.phone},
      city = ${avatar.city},
      first_order_date = ${avatar.first_order_date?.toISOString() || null},
      last_order_date = ${avatar.last_order_date?.toISOString() || null},
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

// ====================================================================
// SYNC STATUS
// ====================================================================

export async function getSyncStatus(): Promise<{
  totalAvatars: number;
  lastSync: Date | null;
  activeAvatars: number;
  avgHealthScore: number;
  highChurnRiskCount: number;
}> {
  const result = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      MAX(last_sync_odoo) as last_sync,
      AVG(health_score) FILTER (WHERE is_active = true) as avg_health,
      COUNT(*) FILTER (WHERE churn_risk_score > 70 AND is_active = true) as high_churn_risk
    FROM customer_avatars
  `;

  const row = result.rows[0];

  if (!row) {
    return {
      totalAvatars: 0,
      activeAvatars: 0,
      lastSync: null,
      avgHealthScore: 0,
      highChurnRiskCount: 0
    };
  }

  return {
    totalAvatars: parseInt(row.total as string),
    activeAvatars: parseInt(row.active as string),
    lastSync: row.last_sync ? new Date(row.last_sync as string) : null,
    avgHealthScore: row.avg_health ? parseFloat(parseFloat(row.avg_health as string).toFixed(1)) : 0,
    highChurnRiskCount: parseInt(row.high_churn_risk as string)
  };
}
