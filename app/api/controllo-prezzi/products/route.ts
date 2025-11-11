import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/controllo-prezzi/products
 *
 * Ritorna la lista dei prodotti per una categoria specifica
 * Query params:
 * - category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked'
 * - days: numero di giorni da considerare (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const days = parseInt(searchParams.get('days') || '7');

    // TODO: Implementare la logica per recuperare i prodotti da Odoo
    // basandosi sui seguenti criteri:
    // 1. Recuperare ordini confermati degli ultimi N giorni
    // 2. Per ogni riga ordine, calcolare:
    //    - costPrice (prezzo d'acquisto)
    //    - criticalPrice = costPrice * 1.4
    //    - avgSellingPrice (media vendita ultimi 3 mesi)
    //    - soldPrice (prezzo effettivo di vendita)
    // 3. Classificare in base alla categoria:
    //    - below_critical: soldPrice < criticalPrice
    //    - critical_to_avg: criticalPrice <= soldPrice < avgSellingPrice
    //    - above_avg: soldPrice >= avgSellingPrice
    //    - blocked: prodotti con flag blocked

    // Per ora ritorna dati mock
    const mockProducts = [
      {
        id: 1,
        name: 'Prodotto Test 1',
        code: 'TEST001',
        barcode: '1234567890',
        image: null,
        soldPrice: 15.50,
        discount: 10.0,
        costPrice: 12.00,
        criticalPrice: 16.80, // 12 * 1.4
        avgSellingPrice: 18.50,
        listPrice: 20.00,
        orderId: 100,
        orderName: 'SO001',
        orderDate: '2025-11-10',
        customerId: 1,
        customerName: 'Cliente Test',
        quantity: 5,
        uom: 'Units',
        status: 'pending',
        note: 'Cliente importante, controllare prezzo',
        priceCategory: 'below_critical'
      }
    ];

    return NextResponse.json({
      success: true,
      products: mockProducts,
      summary: {
        total: mockProducts.length,
        totalRevenue: mockProducts.reduce((sum, p) => sum + (p.soldPrice * p.quantity), 0),
        byCategory: {
          below_critical: 1,
          critical_to_avg: 0,
          above_avg: 0
        },
        byStatus: {
          pending: 1,
          reviewed: 0,
          blocked: 0
        }
      }
    });

  } catch (error: any) {
    console.error('Error in GET /api/controllo-prezzi/products:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel caricamento dei prodotti'
      },
      { status: 500 }
    );
  }
}
