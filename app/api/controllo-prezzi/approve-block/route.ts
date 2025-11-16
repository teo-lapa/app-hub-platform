import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { PriceReviewService } from '@/lib/services/price-review-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/controllo-prezzi/approve-block
 *
 * Approves a price block request by:
 * 1. Marking the activity as done
 * 2. Creating a FIXED PRICE in the customer's pricelist
 *
 * Input: {
 *   activityId: number,
 *   productId: number,
 *   orderId: number,
 *   proposedPrice: number,
 *   feedback?: string
 * }
 *
 * Returns: { success: true, message: "..." }
 */

interface ApproveBlockRequest {
  activityId: number;
  productId: number;
  orderId: number;
  proposedPrice: number;
  feedback?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('✅ [APPROVE-BLOCK] Starting approval process...');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [APPROVE-BLOCK] No valid user session');
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: ApproveBlockRequest = await request.json();
    const { activityId, productId, orderId, proposedPrice, feedback } = body;

    // Validate input
    if (!activityId || typeof activityId !== 'number') {
      console.error('❌ [APPROVE-BLOCK] Invalid activityId:', activityId);
      return NextResponse.json(
        { success: false, error: 'activityId mancante o non valido' },
        { status: 400 }
      );
    }

    if (!productId || !orderId || proposedPrice === undefined) {
      console.error('❌ [APPROVE-BLOCK] Missing required fields:', { productId, orderId, proposedPrice });
      return NextResponse.json(
        { success: false, error: 'productId, orderId e proposedPrice sono obbligatori' },
        { status: 400 }
      );
    }

    console.log(`📋 [APPROVE-BLOCK] Activity ID: ${activityId}`);
    console.log(`🏷️ [APPROVE-BLOCK] Product ID: ${productId}, Order ID: ${orderId}`);
    console.log(`💰 [APPROVE-BLOCK] Proposed Price: ${proposedPrice}`);
    console.log(`💬 [APPROVE-BLOCK] Feedback: ${feedback || 'Prezzo bloccato approvato'}`);

    // STEP 1: Get pricelist ID from order
    console.log('🔍 [APPROVE-BLOCK] Getting pricelist ID from order...');
    const service = new PriceReviewService();

    const pricelistId = await service.getPricelistId(cookies, orderId);
    if (!pricelistId) {
      console.error('❌ [APPROVE-BLOCK] Pricelist not found for order:', orderId);
      return NextResponse.json(
        { success: false, error: 'Listino cliente non trovato per questo ordine' },
        { status: 404 }
      );
    }

    console.log(`✅ [APPROVE-BLOCK] Found pricelist ID: ${pricelistId}`);

    // STEP 2: Get order line ID
    console.log('🔍 [APPROVE-BLOCK] Getting order line ID...');
    const orderLineId = await service.getOrderLineId(cookies, productId, orderId);
    if (!orderLineId) {
      console.error('❌ [APPROVE-BLOCK] Order line not found');
      return NextResponse.json(
        { success: false, error: 'Riga ordine non trovata' },
        { status: 404 }
      );
    }

    console.log(`✅ [APPROVE-BLOCK] Found order line ID: ${orderLineId}`);

    // STEP 3: Create/update fixed price in pricelist
    console.log('🔒 [APPROVE-BLOCK] Creating fixed price in pricelist...');

    // Check if item already exists
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
      console.log(`🔄 [APPROVE-BLOCK] Updating existing pricelist item ${itemId}`);

      await callOdoo(
        cookies,
        'product.pricelist.item',
        'write',
        [[itemId], {
          compute_price: 'fixed',
          fixed_price: proposedPrice
        }]
      );

      console.log(`✅ [APPROVE-BLOCK] Pricelist item ${itemId} updated to ${proposedPrice}`);
    } else {
      // Create new
      console.log(`➕ [APPROVE-BLOCK] Creating new pricelist item`);

      const itemId = await callOdoo(
        cookies,
        'product.pricelist.item',
        'create',
        [{
          pricelist_id: pricelistId,
          product_id: productId,
          compute_price: 'fixed',
          fixed_price: proposedPrice,
          applied_on: '0_product_variant',
          min_quantity: 1
        }]
      );

      console.log(`✅ [APPROVE-BLOCK] Pricelist item ${itemId} created with price ${proposedPrice}`);
    }

    // STEP 4: Mark activity as done with feedback
    console.log('🔄 [APPROVE-BLOCK] Marking activity as done...');
    await callOdoo(
      cookies,
      'mail.activity',
      'action_feedback',
      [[activityId]],
      {
        feedback: feedback || `Prezzo bloccato approvato: CHF ${proposedPrice.toFixed(2)} fissato nel listino cliente`
      }
    );

    console.log('✅ [APPROVE-BLOCK] Activity marked as done successfully');

    return NextResponse.json({
      success: true,
      message: 'Richiesta di blocco prezzo approvata e prezzo fisso creato nel listino',
      activityId,
      productId,
      pricelistId,
      proposedPrice,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('💥 [APPROVE-BLOCK] Error:', error);
    console.error('💥 [APPROVE-BLOCK] Stack trace:', error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'approvazione del blocco prezzo',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
