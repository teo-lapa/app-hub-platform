import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Aumentato per gestire batch queries

/**
 * LIST TODAY ARRIVALS
 *
 * Recupera tutti gli arrivi (stock.picking incoming) previsti per OGGI
 * Include informazioni su purchase order e conteggio allegati
 */
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    console.log('📅 [LIST-TODAY] Recupero arrivi di oggi...');

    // Calcola range di oggi (00:00:00 - 23:59:59)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    console.log(`📅 Range: ${todayStartISO} → ${todayEndISO}`);

    // Cerca stock.picking di tipo "incoming" per oggi
    // Include anche 'done' per mostrare quelli già completati con badge
    const domain = [
      ['picking_type_code', '=', 'incoming'],
      ['scheduled_date', '>=', todayStartISO],
      ['scheduled_date', '<=', todayEndISO],
      ['state', 'in', ['assigned', 'confirmed', 'waiting', 'done']]
    ];

    const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
      domain,
      [
        'id',
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin', // Es: "PO00123"
        'move_ids_without_package'
      ]
    ]);

    console.log(`📦 Trovati ${pickings.length} arrivi per oggi`);

    // OTTIMIZZAZIONE: Batch query per Purchase Orders
    const origins = pickings.map((p: any) => p.origin).filter(Boolean);
    let purchaseOrdersMap = new Map();
    let attachmentsMap = new Map();

    if (origins.length > 0) {
      console.log(`🔍 Batch query per ${origins.length} P.O. origins`);

      // Single batch query per tutti i P.O.
      const purchaseOrders = await callOdoo(cookies, 'purchase.order', 'search_read', [
        [['name', 'in', origins]],
        ['id', 'name', 'partner_id', 'date_order']
      ]);

      console.log(`✅ Trovati ${purchaseOrders.length} P.O. in batch`);

      // Crea mappa origin -> P.O.
      purchaseOrders.forEach((po: any) => {
        purchaseOrdersMap.set(po.name, po);
      });

      // Batch query per tutti gli attachments
      if (purchaseOrders.length > 0) {
        const poIds = purchaseOrders.map((po: any) => po.id);
        console.log(`📎 Batch query per attachments di ${poIds.length} P.O.`);

        const attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
          [
            ['res_model', '=', 'purchase.order'],
            ['res_id', 'in', poIds],
            ['mimetype', 'in', ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']]
          ],
          ['id', 'name', 'res_id']
        ]);

        console.log(`✅ Trovati ${attachments.length} attachments in batch`);

        // Crea mappa res_id -> count
        attachments.forEach((att: any) => {
          const count = attachmentsMap.get(att.res_id) || 0;
          attachmentsMap.set(att.res_id, count + 1);
        });
      }
    }

    // Arricchisci ogni picking con info pre-caricate
    const enrichedPickings = pickings.map((picking: any) => {
      let purchaseOrderId = null;
      let purchaseOrderName = null;
      let attachmentsCount = 0;

      // Lookup da mappa invece di query
      if (picking.origin && purchaseOrdersMap.has(picking.origin)) {
        const po = purchaseOrdersMap.get(picking.origin);
        purchaseOrderId = po.id;
        purchaseOrderName = po.name;
        attachmentsCount = attachmentsMap.get(po.id) || 0;
      }

      // Conta prodotti nel picking
      const moveIds = picking.move_ids_without_package || [];
      const productsCount = moveIds.length;

      return {
        id: picking.id,
        name: picking.name,
        partner_id: picking.partner_id[0],
        partner_name: picking.partner_id[1],
        scheduled_date: picking.scheduled_date,
        state: picking.state,
        origin: picking.origin,
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        attachments_count: attachmentsCount,
        products_count: productsCount,
        // Flag per UI
        has_purchase_order: !!purchaseOrderId,
        has_attachments: attachmentsCount > 0,
        is_ready: attachmentsCount > 0 && !!purchaseOrderId,
        is_completed: picking.state === 'done'
      };
    });

    // Ordina per:
    // 1. Prima quelli pronti (con P.O. e allegati)
    // 2. Poi per orario scheduled_date
    enrichedPickings.sort((a: any, b: any) => {
      // Prima i "ready"
      if (a.is_ready && !b.is_ready) return -1;
      if (!a.is_ready && b.is_ready) return 1;

      // Poi per orario
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });

    console.log(`✅ [LIST-TODAY] ${enrichedPickings.length} arrivi arricchiti e ordinati`);

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      count: enrichedPickings.length,
      arrivals: enrichedPickings
    });

  } catch (error: any) {
    console.error('❌ [LIST-TODAY] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il recupero degli arrivi',
      details: error.toString()
    }, { status: 500 });
  }
}
