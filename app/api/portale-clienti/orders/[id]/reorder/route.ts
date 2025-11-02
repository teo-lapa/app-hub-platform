import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * POST /api/portale-clienti/orders/[id]/reorder
 *
 * Prende tutti i prodotti da un ordine precedente e li aggiunge al carrello
 *
 * Returns: Lista prodotti aggiunti al carrello
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID ordine non valido' },
        { status: 400 }
      );
    }

    console.log(`🔄 [REORDER-API] Reorder richiesto per ordine ${orderId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [REORDER-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per riordinare' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [REORDER-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [REORDER-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Recupera l'ordine con le sue righe
    const orderResult = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['id', 'name', 'order_line', 'partner_id'],
      },
    );

    if (!orderResult || orderResult.length === 0) {
      console.error('❌ [REORDER-API] Ordine non trovato');
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orderResult[0];
    console.log('✅ [REORDER-API] Ordine recuperato:', order.name);

    // Step 2: Recupera le righe ordine (prodotti)
    let orderLines: any[] = [];
    if (order.order_line && order.order_line.length > 0) {
      const linesResult = await callOdooAsAdmin(
        'sale.order.line',
        'search_read',
        [],
        {
          domain: [['id', 'in', order.order_line]],
          fields: [
            'id',
            'product_id',
            'name',
            'product_uom_qty',
            'product_uom',
          ],
        },
      );

      if (linesResult) {
        orderLines = linesResult;
      }
    }

    console.log(`✅ [REORDER-API] Recuperate ${orderLines.length} righe ordine`);

    // Step 3: Prepara i prodotti da restituire per il carrello
    const productsToReorder = orderLines
      .filter((line: any) => line.product_id && line.product_id[0]) // Solo prodotti validi
      .map((line: any) => ({
        productId: line.product_id[0],
        productName: line.product_id[1] || line.name,
        quantity: line.product_uom_qty || 1,
        uom: line.product_uom?.[1] || 'Pz',
      }));

    console.log(`✅ [REORDER-API] Preparati ${productsToReorder.length} prodotti per reorder`);

    return NextResponse.json({
      success: true,
      orderName: order.name,
      products: productsToReorder,
      totalProducts: productsToReorder.length,
    });

  } catch (error: any) {
    console.error('💥 [REORDER-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
