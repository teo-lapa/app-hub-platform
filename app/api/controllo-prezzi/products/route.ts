import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { PriceReviewService } from '@/lib/services/price-review-service';

/**
 * GET /api/controllo-prezzi/products
 *
 * Ritorna la lista dei prodotti per una categoria specifica
 * Query params:
 * - category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all'
 * - days: numero di giorni da considerare (default: 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const days = parseInt(searchParams.get('days') || '7');

    console.log(`📋 [PRODUCTS-API] Fetching category=${category}, days=${days}`);

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // 1. Call aggregate API via fetch to get all products
    console.log(`🔄 [PRODUCTS-API] Calling aggregate API...`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url.split('/api')[0];
    const aggregateUrl = `${baseUrl}/api/controllo-prezzi/aggregate`;

    const aggregateResponse = await fetch(aggregateUrl, {
      method: 'GET',
      headers: {
        cookie: cookieHeader || ''
      },
      cache: 'no-store'
    });

    const aggregateData = await aggregateResponse.json();

    if (!aggregateData.success) {
      throw new Error('Failed to fetch aggregate data');
    }

    let products = aggregateData.products;
    console.log(`✅ [PRODUCTS-API] Got ${products.length} products from aggregate`);

    // 2. Filter by days (order date)
    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      products = products.filter((p: any) => {
        // Assume orderDate exists in aggregate data
        if (p.orderDate) {
          const orderDate = new Date(p.orderDate);
          return orderDate >= cutoffDate;
        }
        return true; // If no orderDate, include it
      });

      console.log(`📅 [PRODUCTS-API] Filtered to ${products.length} products (last ${days} days)`);
    }

    // 3. Batch fetch review statuses from x.price.review
    const service = new PriceReviewService();
    const productIds = Array.from(new Set(products.map((p: any) => p.productId))) as number[];
    const orderIds = Array.from(new Set(products.map((p: any) => p.orderId))) as number[];

    console.log(`🔍 [PRODUCTS-API] Fetching review statuses for ${productIds.length} products...`);
    const reviewMap = await service.batchFetchReviewStatuses(productIds, orderIds);

    // 4. Enrich products with review status
    products = products.map((p: any) => {
      const review = reviewMap.get(`${p.productId}-${p.orderId}`);
      return {
        ...p,
        status: review?.status || 'pending',
        reviewedBy: review?.reviewed_by,
        reviewedAt: review?.reviewed_at,
        blockedBy: review?.blocked_by,
        blockedAt: review?.blocked_at,
        note: review?.note
      };
    });

    console.log(`✅ [PRODUCTS-API] Enriched products with review data`);

    // 5. Filter by category
    if (category !== 'all') {
      const categoryMap: Record<string, string> = {
        'below_critical': 'sotto_pc',
        'critical_to_avg': 'tra_pc_medio',
        'above_avg': 'sopra_medio'
      };

      if (category === 'blocked') {
        // Special case: filter by status
        products = products.filter((p: any) => p.status === 'blocked');
      } else if (categoryMap[category]) {
        products = products.filter((p: any) =>
          p.category === categoryMap[category]
        );
      }

      console.log(`🎯 [PRODUCTS-API] Filtered to ${products.length} products (category: ${category})`);
    }

    // 6. Calculate summary
    const summary = {
      total: products.length,
      totalRevenue: products.reduce((sum: number, p: any) =>
        sum + (p.currentPriceUnit * p.quantity), 0
      ),
      byCategory: {
        below_critical: products.filter((p: any) => p.category === 'sotto_pc').length,
        critical_to_avg: products.filter((p: any) => p.category === 'tra_pc_medio').length,
        above_avg: products.filter((p: any) => p.category === 'sopra_medio').length
      },
      byStatus: {
        pending: products.filter((p: any) => p.status === 'pending').length,
        reviewed: products.filter((p: any) => p.status === 'reviewed').length,
        blocked: products.filter((p: any) => p.status === 'blocked').length
      }
    };

    console.log(`✅ [PRODUCTS-API] Complete - returning ${products.length} products`);

    return NextResponse.json({
      success: true,
      products,
      summary,
      filters: {
        category,
        days
      },
      timestamp: aggregateData.timestamp
    });

  } catch (error: any) {
    console.error('❌ [PRODUCTS-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore recupero prodotti'
      },
      { status: 500 }
    );
  }
}
