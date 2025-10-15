/**
 * API: Create Purchase Orders
 * POST /api/smart-ordering/create-orders
 *
 * Crea ordini acquisto in Odoo
 */

import { NextResponse } from 'next/server';
import { odooIntegration, PurchaseOrder } from '@/lib/smart-ordering/odoo-integration';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productIds, groupBySupplier = true } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'productIds array richiesto'
      }, { status: 400 });
    }

    console.log(`🛒 Creazione ordini per ${productIds.length} prodotti...`);

    // TODO: Load products data and group by supplier
    // For now, create mock order

    const mockOrder: PurchaseOrder = {
      supplierId: 1, // TODO: Get real supplier
      supplierName: 'Fornitore Test',
      orderLines: productIds.map(id => ({
        productId: id,
        productName: `Prodotto ${id}`,
        quantity: 100 // TODO: Use recommended quantity
      })),
      dateOrder: new Date(),
      notes: 'Creato da LAPA Smart Ordering AI'
    };

    const result = await odooIntegration.createPurchaseOrder(mockOrder);

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.orderId,
        orderName: result.orderName,
        totalAmount: result.totalAmount,
        status: result.status,
        message: `Ordine ${result.orderName} creato con successo`
      }
    });
  } catch (error: any) {
    console.error('❌ Errore creazione ordini:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore creazione ordini'
    }, { status: 500 });
  }
}
