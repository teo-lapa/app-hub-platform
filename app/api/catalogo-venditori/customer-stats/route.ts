import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/catalogo-venditori/customer-stats
 * Calcola statistiche ordini cliente negli ultimi 3 mesi:
 * - Totale fatturato
 * - Media valore ordine
 * - Numero ordini
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId è richiesto' },
        { status: 400 }
      );
    }

    const customerIdNum = parseInt(customerId);
    if (isNaN(customerIdNum)) {
      return NextResponse.json(
        { success: false, error: 'customerId deve essere un numero' },
        { status: 400 }
      );
    }

    console.log(`📊 [CUSTOMER-STATS] Calcolo statistiche per cliente ${customerIdNum}`);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CUSTOMER-STATS] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Data 3 mesi fa
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateThreshold = threeMonthsAgo.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`📅 [CUSTOMER-STATS] Cerco ordini dal ${dateThreshold}`);

    // Cerca ordini confermati degli ultimi 3 mesi
    const orders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
      domain: [
        ['partner_id', '=', customerIdNum],
        ['state', 'in', ['sale', 'done']], // Solo ordini confermati o completati
        ['date_order', '>=', dateThreshold] // Ultimi 3 mesi
      ],
      fields: ['amount_total', 'date_order'],
      order: 'date_order desc'
    });

    console.log(`✅ [CUSTOMER-STATS] Trovati ${orders?.length || 0} ordini`);

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        stats: {
          totalRevenue: 0,
          averageOrderValue: 0,
          orderCount: 0,
          period: '3 mesi'
        }
      });
    }

    // Calcola statistiche
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
    const averageOrderValue = totalRevenue / orders.length;

    console.log(`📊 [CUSTOMER-STATS] Totale: CHF ${totalRevenue.toFixed(2)}, Media: CHF ${averageOrderValue.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        orderCount: orders.length,
        period: '3 mesi'
      }
    });

  } catch (error: any) {
    console.error('❌ [CUSTOMER-STATS] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel calcolo statistiche'
      },
      { status: 500 }
    );
  }
}
