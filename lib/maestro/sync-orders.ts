/**
 * MAESTRO AI - Orders Sync Engine
 *
 * Sincronizza ordini e order lines da Odoo a PostgreSQL
 * - Sync incrementale (ultimi X giorni)
 * - Sync completo (storico)
 * - UPSERT per evitare duplicati
 */

import { sql } from '@vercel/postgres';
import { createOdooRPCClient } from '../odoo/rpcClient';

interface SyncOrdersOptions {
  daysBack?: number;          // Giorni di storico (default: 180 = 6 mesi)
  odooPartnerId?: number;     // Sync solo 1 cliente specifico
  batchSize?: number;         // Batch size (default: 50)
  dryRun?: boolean;           // Test senza scrivere DB
}

interface SyncOrdersResult {
  success: boolean;
  ordersProcessed: number;
  ordersInserted: number;
  ordersUpdated: number;
  orderLinesProcessed: number;
  errors: number;
  errorMessages: string[];
  duration: string;
}

interface OdooOrder {
  id: number;
  name: string;
  partner_id: [number, string] | number;
  date_order: string;
  amount_total: number;
  state: string;
  user_id: [number, string] | false;
  order_line: number[];
}

interface OdooOrderLine {
  id: number;
  product_id: [number, string] | false;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
  product_category?: [number, string] | false;
}

/**
 * Sync ordini da Odoo a PostgreSQL
 */
export async function syncOrdersFromOdoo(
  odooSessionId: string,
  options: SyncOrdersOptions = {}
): Promise<SyncOrdersResult> {
  const startTime = Date.now();
  const daysBack = options.daysBack || 180; // Default 6 mesi
  const batchSize = options.batchSize || 50;

  const result: SyncOrdersResult = {
    success: false,
    ordersProcessed: 0,
    ordersInserted: 0,
    ordersUpdated: 0,
    orderLinesProcessed: 0,
    errors: 0,
    errorMessages: [],
    duration: '0s'
  };

  console.log('\n📦 ========================================');
  console.log('   MAESTRO AI - ORDERS SYNC');
  console.log('========================================');
  console.log(`⚙️  Options:`, {
    daysBack,
    odooPartnerId: options.odooPartnerId || 'all',
    batchSize,
    dryRun: options.dryRun || false
  });
  console.log('');

  try {
    // STEP 1: Connect to Odoo
    console.log('🔌 [STEP 1/4] Connecting to Odoo...');
    const odoo = createOdooRPCClient(odooSessionId);

    // STEP 2: Calculate date range
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const dateFilter = dateFrom.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`📅 [STEP 2/4] Fetching orders since ${dateFilter}...`);

    // Build filters
    const filters: any[] = [
      ['date_order', '>=', dateFilter],
      ['state', 'in', ['sale', 'done']] // Solo ordini confermati
    ];

    if (options.odooPartnerId) {
      filters.push(['partner_id', '=', options.odooPartnerId]);
    }

    // Fetch orders
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'state', 'user_id', 'order_line'],
      0,
      'date_order desc'
    ) as OdooOrder[];

    console.log(`✅ Found ${orders.length} orders to sync\n`);

    if (orders.length === 0) {
      result.success = true;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      return result;
    }

    // STEP 3: Process orders in batches
    console.log(`🔄 [STEP 3/4] Processing ${orders.length} orders in batches of ${batchSize}...`);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(orders.length / batchSize);

      console.log(`   📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} orders...`);

      try {
        await processBatch(batch, odoo, options.dryRun || false, result);
      } catch (error: any) {
        console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
        result.errors++;
        result.errorMessages.push(`Batch ${batchNum}: ${error.message}`);
      }
    }

    // STEP 4: Complete
    console.log('\n✅ [STEP 4/4] Sync completed!');
    console.log(`   📊 Orders processed: ${result.ordersProcessed}`);
    console.log(`   ✨ Orders inserted: ${result.ordersInserted}`);
    console.log(`   🔄 Orders updated: ${result.ordersUpdated}`);
    console.log(`   📦 Order lines: ${result.orderLinesProcessed}`);
    console.log(`   ❌ Errors: ${result.errors}`);

    result.success = result.errors === 0 || result.ordersProcessed > 0;
    result.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  } catch (error: any) {
    console.error('❌ Sync failed:', error);
    result.errors++;
    result.errorMessages.push(error.message);
    result.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  }

  return result;
}

/**
 * Process batch di ordini
 */
async function processBatch(
  orders: OdooOrder[],
  odoo: ReturnType<typeof createOdooRPCClient>,
  dryRun: boolean,
  result: SyncOrdersResult
): Promise<void> {
  for (const order of orders) {
    try {
      const partnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : order.partner_id;
      const salesPersonId = order.user_id && Array.isArray(order.user_id) ? order.user_id[0] : null;
      const salesPersonName = order.user_id && Array.isArray(order.user_id) ? order.user_id[1] : null;

      if (dryRun) {
        console.log(`   [DRY RUN] Would sync order ${order.name} (${order.amount_total} CHF)`);
        result.ordersProcessed++;
        continue;
      }

      // Get customer_avatar_id from customer_avatars table
      const customerResult = await sql`
        SELECT id FROM customer_avatars
        WHERE odoo_partner_id = ${partnerId}
        LIMIT 1
      `;

      const customerAvatarId = customerResult.rows[0]?.id;

      // UPSERT order
      const existingOrder = await sql`
        SELECT id FROM maestro_orders
        WHERE odoo_order_id = ${order.id}
      `;

      let maestroOrderId: number;

      if (existingOrder.rows.length > 0) {
        // UPDATE
        await sql`
          UPDATE maestro_orders
          SET
            customer_avatar_id = ${customerAvatarId},
            odoo_partner_id = ${partnerId},
            order_name = ${order.name},
            order_date = ${order.date_order},
            amount_total = ${order.amount_total},
            state = ${order.state},
            salesperson_id = ${salesPersonId},
            salesperson_name = ${salesPersonName},
            updated_at = NOW(),
            last_sync_odoo = NOW()
          WHERE odoo_order_id = ${order.id}
          RETURNING id
        `;
        maestroOrderId = existingOrder.rows[0].id;
        result.ordersUpdated++;
      } else {
        // INSERT
        const insertResult = await sql`
          INSERT INTO maestro_orders (
            odoo_order_id,
            customer_avatar_id,
            odoo_partner_id,
            order_name,
            order_date,
            amount_total,
            state,
            salesperson_id,
            salesperson_name,
            last_sync_odoo
          ) VALUES (
            ${order.id},
            ${customerAvatarId},
            ${partnerId},
            ${order.name},
            ${order.date_order},
            ${order.amount_total},
            ${order.state},
            ${salesPersonId},
            ${salesPersonName},
            NOW()
          )
          RETURNING id
        `;
        maestroOrderId = insertResult.rows[0].id;
        result.ordersInserted++;
      }

      result.ordersProcessed++;

      // Sync order lines (products)
      if (order.order_line && order.order_line.length > 0) {
        await syncOrderLines(maestroOrderId, order.order_line, odoo, result);
      }

    } catch (error: any) {
      console.error(`   ❌ Failed to sync order ${order.name}:`, error.message);
      result.errors++;
      result.errorMessages.push(`Order ${order.name}: ${error.message}`);
    }
  }
}

/**
 * Sync order lines (prodotti)
 */
async function syncOrderLines(
  maestroOrderId: number,
  orderLineIds: number[],
  odoo: ReturnType<typeof createOdooRPCClient>,
  result: SyncOrdersResult
): Promise<void> {
  try {
    // Fetch order lines from Odoo with product category
    const orderLines = await odoo.searchRead(
      'sale.order.line',
      [['id', 'in', orderLineIds]],
      ['id', 'product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'],
      0
    ) as OdooOrderLine[];

    // For each line, fetch the product category from product.product
    const productIds = orderLines
      .map(l => l.product_id && Array.isArray(l.product_id) ? l.product_id[0] : null)
      .filter(id => id !== null) as number[];

    let productCategories: Record<number, string> = {};

    if (productIds.length > 0) {
      try {
        const products = await odoo.searchRead(
          'product.product',
          [['id', 'in', productIds]],
          ['id', 'categ_id'],
          0
        ) as Array<{id: number; categ_id: [number, string] | false}>;

        productCategories = products.reduce((acc, p) => {
          if (p.categ_id && Array.isArray(p.categ_id)) {
            acc[p.id] = p.categ_id[1]; // category name
          }
          return acc;
        }, {} as Record<number, string>);
      } catch (err) {
        console.error('   ⚠️  Failed to fetch product categories:', err);
      }
    }

    // Delete existing lines and re-insert (simpler than UPSERT per line)
    await sql`
      DELETE FROM maestro_order_lines
      WHERE maestro_order_id = ${maestroOrderId}
    `;

    // Insert all lines
    for (const line of orderLines) {
      const productId = line.product_id && Array.isArray(line.product_id) ? line.product_id[0] : null;
      const productName = line.product_id && Array.isArray(line.product_id) ? line.product_id[1] : '';

      // Extract product code from name (format: "[CODE] Name")
      const productCodeMatch = productName.match(/^\[([^\]]+)\]/);
      const productCode = productCodeMatch ? productCodeMatch[1] : null;

      // Get category for this product
      const productCategory = productId ? (productCategories[productId] || null) : null;

      await sql`
        INSERT INTO maestro_order_lines (
          maestro_order_id,
          odoo_line_id,
          product_id,
          product_name,
          product_code,
          product_category,
          quantity,
          price_unit,
          price_subtotal
        ) VALUES (
          ${maestroOrderId},
          ${line.id},
          ${productId},
          ${productName},
          ${productCode},
          ${productCategory},
          ${line.product_uom_qty},
          ${line.price_unit},
          ${line.price_subtotal}
        )
      `;

      result.orderLinesProcessed++;
    }
  } catch (error: any) {
    console.error(`   ⚠️  Failed to sync order lines for order ${maestroOrderId}:`, error.message);
    // Non bloccare il sync per errori sulle righe
  }
}
