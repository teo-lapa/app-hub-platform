/**
 * MAESTRO AI - Analisi Dati Odoo
 * GET /api/maestro/analyze-odoo
 *
 * STRICT TYPE SAFETY - NO 'any' ALLOWED
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { createOdooRPCClient, type OdooRPCClient } from '@/lib/odoo/rpcClient';
import type {
  OdooUser,
  OdooOrder,
  OdooPartner,
  SalespersonInfo,
  SalespersonSales,
  OdooAnalysis
} from '@/lib/maestro/types';
import { createErrorResponse } from '@/lib/maestro/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  console.log('🔍 [MAESTRO] Analyzing Odoo data...');

  try {
    // 1. Connetti a Odoo
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies } = await getOdooSession(userCookies || undefined);
    const odoo: OdooRPCClient = createOdooRPCClient(odooCookies?.replace('session_id=', '') ?? '');

    console.log('✅ [MAESTRO] Connected to Odoo');

    // 2. VENDITORI TARGET
    const venditoriTarget = [
      'Mihai Nizza',
      'Alessandro Motta',
      'Gregorio Buccolieri',
      'Domingos Pereira'
    ];

    const venditoriFound: SalespersonInfo[] = [];

    for (const nome of venditoriTarget) {
      const users = await odoo.searchRead(
        'res.users',
        [['name', 'ilike', nome]],
        ['id', 'name', 'login'],
        5
      ) as OdooUser[];

      const user = users[0];

      if (!user) {
        console.log(`⚠️  [MAESTRO] NOT found: ${nome}`);
        continue;
      }

      console.log(`✅ [MAESTRO] Found salesperson: ${user.name} (ID: ${user.id})`);

      // Conta clienti assegnati
      const clienti = await odoo.searchRead(
        'res.partner',
        [
          ['user_id', '=', user.id],
          ['customer_rank', '>', 0]
        ],
        ['id'],
        0
      ) as OdooPartner[];

      venditoriFound.push({
        id: user.id,
        name: user.name,
        login: user.login,
        clienti_assegnati: clienti.length
      });
    }

    // 3. CLIENTI ATTIVI ULTIMI 4 MESI
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const dateFilter = fourMonthsAgo.toISOString();

    console.log(`📅 [MAESTRO] Analyzing orders from ${fourMonthsAgo.toLocaleDateString('it-IT')}`);

    const orders = await odoo.searchRead(
      'sale.order',
      [
        ['date_order', '>=', dateFilter],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id', 'partner_id', 'user_id', 'date_order', 'amount_total'],
      0
    ) as OdooOrder[];

    console.log(`✅ [MAESTRO] Found ${orders.length} confirmed orders in last 4 months`);

    // Clienti unici
    const uniquePartners = new Set<number>();
    orders.forEach(o => uniquePartners.add(o.partner_id[0]));

    console.log(`✅ [MAESTRO] Found ${uniquePartners.size} unique active customers`);

    // 4. BREAKDOWN PER VENDITORE
    type VendorStats = {
      id: number | string;
      name: string;
      ordini: number;
      clienti: Set<number>;
      revenue: number;
    };

    const venditoreSales = new Map<number | string, VendorStats>();

    orders.forEach(order => {
      const vendId = order.user_id ? order.user_id[0] : 'unassigned';
      const vendName = order.user_id ? order.user_id[1] : 'Non assegnato';

      if (!venditoreSales.has(vendId)) {
        venditoreSales.set(vendId, {
          id: vendId,
          name: vendName,
          ordini: 0,
          clienti: new Set(),
          revenue: 0
        });
      }

      const stats = venditoreSales.get(vendId)!;
      stats.ordini++;
      stats.clienti.add(order.partner_id[0]);
      stats.revenue += order.amount_total || 0;
    });

    // Convert to array and sort
    const salesByVendor: SalespersonSales[] = Array.from(venditoreSales.values())
      .map(v => ({
        id: v.id,
        name: v.name,
        ordini: v.ordini,
        clienti: v.clienti.size,
        revenue: parseFloat(v.revenue.toFixed(2))
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 5. ORDINI GIORNALIERI (ultimi 30 giorni)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentOrders = await odoo.searchRead(
      'sale.order',
      [
        ['date_order', '>=', last30Days.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ],
      ['id'],
      0
    ) as OdooOrder[];

    const avgOrdersPerDay = parseFloat((recentOrders.length / 30).toFixed(1));

    // 6. RESPONSE
    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    const analysis: OdooAnalysis = {
      success: true,
      timestamp: new Date().toISOString(),

      venditori: {
        target: venditoriTarget,
        found: venditoriFound.length,
        details: venditoriFound
      },

      clienti: {
        attivi_ultimi_4_mesi: uniquePartners.size,
        per_venditore: salesByVendor.slice(0, 10)
      },

      ordini: {
        totali_4_mesi: orders.length,
        ultimi_30_giorni: recentOrders.length,
        media_giornaliera: avgOrdersPerDay
      },

      revenue: {
        totale_4_mesi: parseFloat(totalRevenue.toFixed(2)),
        media_per_ordine: parseFloat((totalRevenue / orders.length).toFixed(2))
      },

      summary: {
        ready_for_sync: true,
        estimated_avatars: uniquePartners.size,
        estimated_sync_time_minutes: Math.ceil(uniquePartners.size / 20)
      }
    };

    console.log('✅ [MAESTRO] Analysis completed successfully');

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('❌ [MAESTRO] Analysis failed:', error);

    const errorResponse = createErrorResponse(
      'ANALYSIS_FAILED',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
