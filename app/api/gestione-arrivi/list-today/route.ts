import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * LIST TODAY ARRIVALS (Gestione Arrivi)
 *
 * Recupera tutti gli arrivi (stock.picking incoming) previsti per OGGI
 * ESCLUDE i resi (WH/RET) - vogliamo solo arrivi fornitori
 * Include informazioni su purchase order e conteggio allegati
 */
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    console.log('📅 [GESTIONE-ARRIVI] Recupero arrivi di oggi...');

    // Calcola range di oggi (00:00:00 - 23:59:59)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    console.log(`📅 Range: ${todayStartISO} → ${todayEndISO}`);

    // Cerca stock.picking di tipo "incoming" per oggi
    // ESCLUDI i resi (WH/RET) - vogliamo solo arrivi fornitori (WH/IN)
    const domain = [
      ['picking_type_code', '=', 'incoming'],
      ['scheduled_date', '>=', todayStartISO],
      ['scheduled_date', '<=', todayEndISO],
      ['state', 'in', ['assigned', 'confirmed', 'waiting', 'done']],
      ['name', 'not ilike', '%RET%']  // Escludi resi
    ];

    const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
      domain,
      [
        'id',
        'name',
        'partner_id',
        'scheduled_date',
        'state',
        'origin',
        'move_ids_without_package'
      ]
    ]);

    console.log(`📦 Trovati ${pickings.length} arrivi per oggi (esclusi resi)`);

    // OTTIMIZZAZIONE: Batch query per Purchase Orders
    const origins = pickings.map((p: any) => p.origin).filter(Boolean);
    const pickingNames = pickings.map((p: any) => p.name);
    let purchaseOrdersMap = new Map();
    let attachmentsMap = new Map();
    let invoicesMap = new Map(); // Mappa origin -> fattura

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
          ['id', 'name', 'res_id', 'mimetype', 'file_size']
        ]);

        console.log(`✅ Trovati ${attachments.length} attachments in batch`);

        // Crea mappa res_id -> attachments array
        attachments.forEach((att: any) => {
          const existing = attachmentsMap.get(att.res_id) || [];
          existing.push(att);
          attachmentsMap.set(att.res_id, existing);
        });
      }

      // Batch query per le fatture collegate (cercando per invoice_origin)
      console.log(`📄 Batch query per fatture collegate...`);
      const invoices = await callOdoo(cookies, 'account.move', 'search_read', [
        [
          ['move_type', '=', 'in_invoice'],
          ['invoice_origin', 'in', origins],
          ['state', 'in', ['draft', 'posted']]
        ],
        ['id', 'name', 'invoice_origin', 'state', 'ref', 'invoice_date']
      ]);

      console.log(`✅ Trovate ${invoices.length} fatture collegate in batch`);

      // Crea mappa origin -> fattura
      invoices.forEach((inv: any) => {
        invoicesMap.set(inv.invoice_origin, inv);
      });
    }

    // Arricchisci ogni picking con info pre-caricate
    const enrichedPickings = pickings.map((picking: any) => {
      let purchaseOrderId = null;
      let purchaseOrderName = null;
      let attachmentsCount = 0;
      let attachmentsList: any[] = [];
      let invoiceData: any = null;

      // Lookup da mappa invece di query
      if (picking.origin && purchaseOrdersMap.has(picking.origin)) {
        const po = purchaseOrdersMap.get(picking.origin);
        purchaseOrderId = po.id;
        purchaseOrderName = po.name;
        attachmentsList = attachmentsMap.get(po.id) || [];
        attachmentsCount = attachmentsList.length;

        // Cerca fattura collegata
        if (invoicesMap.has(picking.origin)) {
          const inv = invoicesMap.get(picking.origin);
          invoiceData = {
            id: inv.id,
            name: inv.name,
            state: inv.state,
            ref: inv.ref,
            invoice_date: inv.invoice_date
          };
        }
      }

      // Conta prodotti nel picking
      const moveIds = picking.move_ids_without_package || [];
      const productsCount = moveIds.length;

      // Determina se è processato (arrivo fatto + fattura creata)
      const isProcessed = picking.state === 'done' && invoiceData !== null;

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
        attachments: attachmentsList, // Include dettagli allegati per il processing
        products_count: productsCount,
        // Fattura collegata
        invoice: invoiceData,
        has_invoice: invoiceData !== null,
        // Flag per UI
        has_purchase_order: !!purchaseOrderId,
        has_attachments: attachmentsCount > 0,
        is_ready: attachmentsCount > 0 && !!purchaseOrderId,
        is_completed: picking.state === 'done',
        is_processed: isProcessed  // Verde = completato + fattura
      };
    });

    // Ordina per:
    // 1. Prima quelli pronti (con P.O. e allegati) e NON completati
    // 2. Poi per orario scheduled_date
    enrichedPickings.sort((a: any, b: any) => {
      // Completati alla fine
      if (a.is_completed && !b.is_completed) return 1;
      if (!a.is_completed && b.is_completed) return -1;

      // Poi i "ready" prima
      if (a.is_ready && !b.is_ready) return -1;
      if (!a.is_ready && b.is_ready) return 1;

      // Poi per orario
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });

    console.log(`✅ [GESTIONE-ARRIVI] ${enrichedPickings.length} arrivi arricchiti e ordinati`);

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      count: enrichedPickings.length,
      arrivals: enrichedPickings
    });

  } catch (error: any) {
    console.error('❌ [GESTIONE-ARRIVI] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il recupero degli arrivi',
      details: error.toString()
    }, { status: 500 });
  }
}
