import { sql } from '@vercel/postgres';
import { callOdoo } from '@/lib/odoo-auth';

/**
 * Service Layer per gestione Price Reviews in Vercel Postgres
 *
 * Gestisce tutte le operazioni CRUD su price_reviews (Postgres)
 * e pricelist.item (Odoo) per blocco prezzi
 */
export class PriceReviewService {

  /**
   * Find existing review or create new one
   *
   * @returns reviewId (number)
   */
  async findOrCreateReview(
    productId: number,
    orderId: number,
    orderLineId: number
  ): Promise<number> {

    console.log(`🔍 [PriceReviewService] Finding review for product ${productId} in order ${orderId}`);

    // Try to find existing by order_line_id (unique constraint)
    const { rows } = await sql`
      SELECT id FROM price_reviews
      WHERE order_line_id = ${orderLineId}
      LIMIT 1
    `;

    if (rows.length > 0) {
      console.log(`✅ [PriceReviewService] Found existing review ${rows[0].id}`);
      return rows[0].id;
    }

    // Create new
    console.log(`➕ [PriceReviewService] Creating new review`);
    const { rows: newRows } = await sql`
      INSERT INTO price_reviews (product_id, order_id, order_line_id, status)
      VALUES (${productId}, ${orderId}, ${orderLineId}, 'pending')
      RETURNING id
    `;

    console.log(`✅ [PriceReviewService] Created review ${newRows[0].id}`);
    return newRows[0].id;
  }

  /**
   * Mark product as reviewed
   */
  async markAsReviewed(
    productId: number,
    orderId: number,
    orderLineId: number,
    reviewedBy: string,
    note?: string
  ): Promise<void> {

    console.log(`✅ [PriceReviewService] Marking as reviewed by ${reviewedBy}`);

    const reviewId = await this.findOrCreateReview(productId, orderId, orderLineId);

    await sql`
      UPDATE price_reviews
      SET status = 'reviewed',
          reviewed_by = ${reviewedBy},
          note = ${note || null},
          updated_at = NOW()
      WHERE id = ${reviewId}
    `;

    console.log(`✅ [PriceReviewService] Review ${reviewId} marked as reviewed`);
  }

  /**
   * Block price (mark as blocked + create pricelist item in Odoo)
   */
  async blockPrice(
    cookies: string,
    productId: number,
    orderId: number,
    orderLineId: number,
    pricelistId: number,
    currentPrice: number,
    blockedBy: string,
    note?: string
  ): Promise<void> {

    console.log(`🔒 [PriceReviewService] Blocking price ${currentPrice} for product ${productId}`);

    // 1. Mark as blocked in Postgres
    const reviewId = await this.findOrCreateReview(productId, orderId, orderLineId);

    await sql`
      UPDATE price_reviews
      SET status = 'blocked',
          blocked_by = ${blockedBy},
          note = ${note || null},
          updated_at = NOW()
      WHERE id = ${reviewId}
    `;

    console.log(`✅ [PriceReviewService] Review ${reviewId} marked as blocked`);

    // 2. Create or update fixed price in Odoo pricelist
    console.log(`📋 [PriceReviewService] Creating/updating pricelist item for pricelist ${pricelistId}`);

    // First check if item already exists in Odoo
    const existingItems = await callOdoo(
      cookies,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', '=', pricelistId],
          ['product_id', '=', productId],
          ['applied_on', '=', '0_product_variant']
        ],
        fields: ['id', 'compute_price', 'fixed_price'],
        limit: 1
      }
    );

    if (existingItems && existingItems.length > 0) {
      // Update existing
      const itemId = existingItems[0].id;
      console.log(`🔄 [PriceReviewService] Updating existing pricelist item ${itemId}`);

      await callOdoo(
        cookies,
        'product.pricelist.item',
        'write',
        [[itemId], {
          compute_price: 'fixed',
          fixed_price: currentPrice
        }]
      );

      console.log(`✅ [PriceReviewService] Pricelist item ${itemId} updated to ${currentPrice}`);
    } else {
      // Create new
      console.log(`➕ [PriceReviewService] Creating new pricelist item`);

      const itemId = await callOdoo(
        cookies,
        'product.pricelist.item',
        'create',
        [{
          pricelist_id: pricelistId,
          product_id: productId,
          compute_price: 'fixed',
          fixed_price: currentPrice,
          applied_on: '0_product_variant',
          min_quantity: 1
        }]
      );

      console.log(`✅ [PriceReviewService] Pricelist item ${itemId} created with price ${currentPrice}`);
    }
  }

  /**
   * Mark as pending (reset status + remove fixed price if exists)
   */
  async markAsPending(
    cookies: string,
    productId: number,
    orderId: number,
    orderLineId: number,
    pricelistId?: number
  ): Promise<void> {

    console.log(`⏳ [PriceReviewService] Marking as pending`);

    const reviewId = await this.findOrCreateReview(productId, orderId, orderLineId);

    await sql`
      UPDATE price_reviews
      SET status = 'pending',
          reviewed_by = NULL,
          blocked_by = NULL,
          note = NULL,
          updated_at = NOW()
      WHERE id = ${reviewId}
    `;

    console.log(`✅ [PriceReviewService] Review ${reviewId} reset to pending`);

    // If was blocked, remove fixed price from Odoo pricelist
    if (pricelistId) {
      console.log(`🗑️ [PriceReviewService] Removing fixed price from pricelist ${pricelistId}`);

      const items = await callOdoo(
        cookies,
        'product.pricelist.item',
        'search_read',
        [],
        {
          domain: [
            ['pricelist_id', '=', pricelistId],
            ['product_id', '=', productId],
            ['compute_price', '=', 'fixed'],
            ['applied_on', '=', '0_product_variant']
          ],
          fields: ['id'],
          limit: 1
        }
      );

      if (items && items.length > 0) {
        const itemIds = items.map((i: any) => i.id);
        await callOdoo(
          cookies,
          'product.pricelist.item',
          'unlink',
          [itemIds]
        );

        console.log(`✅ [PriceReviewService] Removed ${itemIds.length} pricelist items`);
      } else {
        console.log(`ℹ️ [PriceReviewService] No pricelist items to remove`);
      }
    }
  }

  /**
   * Get order line ID from product and order (from Odoo)
   */
  async getOrderLineId(
    cookies: string,
    productId: number,
    orderId: number
  ): Promise<number | null> {

    console.log(`🔍 [PriceReviewService] Getting order line for product ${productId} in order ${orderId}`);

    const lines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [
          ['order_id', '=', orderId],
          ['product_id', '=', productId]
        ],
        fields: ['id'],
        limit: 1
      }
    );

    if (lines && lines.length > 0) {
      console.log(`✅ [PriceReviewService] Found order line ${lines[0].id}`);
      return lines[0].id;
    }

    console.log(`❌ [PriceReviewService] Order line not found`);
    return null;
  }

  /**
   * Get pricelist ID from order (from Odoo)
   */
  async getPricelistId(
    cookies: string,
    orderId: number
  ): Promise<number | null> {

    console.log(`🔍 [PriceReviewService] Getting pricelist for order ${orderId}`);

    const orders = await callOdoo(
      cookies,
      'sale.order',
      'read',
      [[orderId], ['pricelist_id']]
    );

    if (orders && orders.length > 0 && orders[0].pricelist_id) {
      const pricelistId = orders[0].pricelist_id[0];
      console.log(`✅ [PriceReviewService] Found pricelist ${pricelistId}`);
      return pricelistId;
    }

    console.log(`❌ [PriceReviewService] Pricelist not found`);
    return null;
  }

  /**
   * Batch fetch review statuses for multiple products
   */
  async batchFetchReviewStatuses(
    productIds: number[],
    orderIds: number[]
  ): Promise<Map<string, any>> {

    console.log(`📦 [PriceReviewService] Batch fetching reviews for ${productIds.length} products`);

    if (productIds.length === 0) {
      return new Map();
    }

    try {
      // Fetch reviews using parameterized query
      // Note: Vercel Postgres doesn't support array parameters directly in template strings
      // We need to use a workaround with JSON or multiple queries
      // For now, we'll fetch all and filter in memory (optimization possible later)
      const { rows: allRows } = await sql`
        SELECT
          product_id,
          order_id,
          order_line_id,
          status,
          reviewed_by,
          blocked_by,
          note,
          created_at,
          updated_at
        FROM price_reviews
      `;

      // Filter in memory
      const productIdSet = new Set(productIds);
      const orderIdSet = new Set(orderIds);
      const rows = allRows.filter((r: any) =>
        productIdSet.has(r.product_id) && orderIdSet.has(r.order_id)
      );

      // Build map: "productId-orderId" -> review
      const reviewMap = new Map<string, any>();
      rows.forEach((r: any) => {
        const key = `${r.product_id}-${r.order_id}`;
        reviewMap.set(key, r);
      });

      console.log(`✅ [PriceReviewService] Found ${reviewMap.size} reviews`);
      return reviewMap;
    } catch (error: any) {
      // If table doesn't exist or other DB error, return empty map
      console.warn(`⚠️ [PriceReviewService] Failed to fetch reviews (table may not exist):`, error.message);
      return new Map();
    }
  }
}
