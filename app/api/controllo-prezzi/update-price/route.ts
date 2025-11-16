import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/controllo-prezzi/update-price
 *
 * Aggiorna il prezzo di una riga d'ordine
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderLineId, newPrice, newDiscount } = body;

    console.log(`📝 [UPDATE-PRICE-API] Updating line ${orderLineId}:`, {
      newPrice,
      newDiscount
    });

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Prepara i valori da aggiornare
    const values: any = {};

    if (newPrice !== undefined && newPrice !== null) {
      values.price_unit = parseFloat(newPrice);
    }

    if (newDiscount !== undefined && newDiscount !== null) {
      values.discount = parseFloat(newDiscount);
    }

    if (Object.keys(values).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nessun valore da aggiornare' },
        { status: 400 }
      );
    }

    // Aggiorna la riga d'ordine in Odoo
    console.log(`🔄 [UPDATE-PRICE-API] Calling Odoo write for line ${orderLineId}...`);
    const result = await callOdoo(
      cookies,
      'sale.order.line',
      'write',
      [[orderLineId], values]
    );

    if (result) {
      console.log(`✅ [UPDATE-PRICE-API] Price updated successfully`);
      return NextResponse.json({
        success: true,
        message: 'Prezzo aggiornato con successo',
        data: {
          orderLineId,
          ...values
        }
      });
    } else {
      throw new Error('Failed to update order line');
    }

  } catch (error: any) {
    console.error('❌ [UPDATE-PRICE-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore aggiornamento prezzo'
      },
      { status: 500 }
    );
  }
}
