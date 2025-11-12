import { callOdoo } from '@/lib/odoo-auth';

/**
 * Service Layer per gestione Price Reviews in Odoo
 *
 * Gestisce tutte le operazioni CRUD su x.price.review e pricelist.item
 */
export class PriceReviewService {

  /**
   * Find existing review or create new one
   *
   * @returns reviewId (number)
   */
  async findOrCreateReview(
    cookies: string,
    productId: number,
    orderId: number,
    orderLineId: number
  ): Promise<number> {

    console.log(`🔍 [PriceReviewService] Finding review for product ${productId} in order ${orderId}`);

    // Try to find existing
    const existing = await callOdoo(
      cookies,
      'x.price.review',
      'search_read',
      [],
      {
        domain: [
          ['product_id', '=', productId],
          ['order_id', '=', orderId]
        ],
        fields: ['id'],
        limit: 1
      }
    );

    if (existing && existing.length > 0) {
      console.log(`✅ [PriceReviewService] Found existing review ${existing[0].id}`);
      return existing[0].id;
    }

    // Create new
    console.log(`➕ [PriceReviewService] Creating new review`);
    const reviewId = await callOdoo(
      cookies,
      'x.price.review',
      'create',
      [{
        product_id: productId,
        order_id: orderId,
        order_line_id: orderLineId,
        status: 'pending'
      }]
    );

    console.log(`✅ [PriceReviewService] Created review ${reviewId}`);
    return reviewId;
  }

  /**
   * Mark product as reviewed
   */
  async markAsReviewed(
    cookies: string,
    productId: number,
    orderId: number,
    orderLineId: number,
    reviewedBy: string,
    note?: string
  ): Promise<void> {

    console.log(`✅ [PriceReviewService] Marking as reviewed by ${reviewedBy}`);

    const reviewId = await this.findOrCreateReview(
      cookies, productId, orderId, orderLineId
    );

    await callOdoo(
      cookies,
      'x.price.review',
      'write',
      [[reviewId], {
        status: 'reviewed',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        note: note || false
      }]
    );

    console.log(`✅ [PriceReviewService] Review ${reviewId} marked as reviewed`);
  }

  /**
   * Block price (mark as blocked + create pricelist item)
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

    // 1. Mark as blocked in review
    const reviewId = await this.findOrCreateReview(
      cookies, productId, orderId, orderLineId
    );

    await callOdoo(
      cookies,
      'x.price.review',
      'write',
      [[reviewId], {
        status: 'blocked',
        blocked_by: blockedBy,
        blocked_at: new Date().toISOString(),
        note: note || false
      }]
    );

    console.log(`✅ [PriceReviewService] Review ${reviewId} marked as blocked`);

    // 2. Create or update fixed price in pricelist
    console.log(`📋 [PriceReviewService] Creating/updating pricelist item for pricelist ${pricelistId}`);

    // First check if item already exists
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

    const reviewId = await this.findOrCreateReview(
      cookies, productId, orderId, orderLineId
    );

    await callOdoo(
      cookies,
      'x.price.review',
      'write',
      [[reviewId], {
        status: 'pending',
        reviewed_by: false,
        reviewed_at: false,
        blocked_by: false,
        blocked_at: false
      }]
    );

    console.log(`✅ [PriceReviewService] Review ${reviewId} reset to pending`);

    // If was blocked, remove fixed price from pricelist
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
   * Get order line ID from product and order
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
   * Get pricelist ID from order
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
    cookies: string,
    productIds: number[],
    orderIds: number[]
  ): Promise<Map<string, any>> {

    console.log(`📦 [PriceReviewService] Batch fetching reviews for ${productIds.length} products`);

    const reviews = await callOdoo(
      cookies,
      'x.price.review',
      'search_read',
      [],
      {
        domain: [
          ['product_id', 'in', productIds],
          ['order_id', 'in', orderIds]
        ],
        fields: [
          'product_id', 'order_id', 'status',
          'reviewed_by', 'reviewed_at',
          'blocked_by', 'blocked_at', 'note'
        ]
      }
    );

    // Build map: "productId-orderId" -> review
    const reviewMap = new Map<string, any>();
    reviews.forEach((r: any) => {
      const key = `${r.product_id[0]}-${r.order_id[0]}`;
      reviewMap.set(key, r);
    });

    console.log(`✅ [PriceReviewService] Found ${reviewMap.size} reviews`);
    return reviewMap;
  }
}
