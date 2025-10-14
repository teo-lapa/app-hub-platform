import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API endpoint per testare la tracciabilità lotto -> ordine -> cliente
 *
 * GET /api/test-lot-trace?lot=FPI060825
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotName = searchParams.get('lot') || 'FPI060825';

    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato - devi fare login' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
    const authHeaders = {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    };

    console.log(`\n🔍 ===== TEST TRACCIABILITÀ LOTTO "${lotName}" =====\n`);

    // Helper per chiamate Odoo
    const odooCall = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { model, method, args, kwargs },
          id: Math.floor(Math.random() * 1000000)
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(`Odoo Error: ${JSON.stringify(data.error)}`);
      }

      return data.result;
    }

    // STEP 1: Trova il lotto
    console.log('📦 STEP 1: Ricerca lotto...');
    const lots = await odooCall('stock.lot', 'search_read',
      [[['name', '=', lotName]]],
      { fields: ['id', 'name', 'product_id', 'expiration_date'] }
    );

    if (lots.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Lotto "${lotName}" non trovato`,
        suggestion: 'Verifica che il nome del lotto sia corretto'
      });
    }

    const lot = lots[0];
    console.log('✅ Lotto trovato:', lot);

    // STEP 2: Trova ubicazioni
    console.log('\n📍 STEP 2: Verifica ubicazioni...');
    const quants = await odooCall('stock.quant', 'search_read',
      [[['lot_id', '=', lot.id], ['quantity', '>', 0]]],
      { fields: ['location_id', 'quantity', 'reserved_quantity'] }
    );

    console.log(`✅ Trovate ${quants.length} ubicazioni`);

    // STEP 3: Trova movimenti dettagliati
    console.log('\n🚚 STEP 3: Ricerca movimenti...');
    const moveLines = await odooCall('stock.move.line', 'search_read',
      [[['lot_id', '=', lot.id], ['state', 'in', ['assigned', 'done']]]],
      {
        fields: ['id', 'move_id', 'picking_id', 'location_dest_id', 'qty_done', 'state'],
        limit: 20
      }
    );

    console.log(`✅ Trovati ${moveLines.length} movimenti`);

    // STEP 4: Per ogni movimento, risali al picking e all'ordine
    console.log('\n📋 STEP 4: Tracciamento completo...\n');

    const results = [];
    const pickingCache = new Map();

    for (const ml of moveLines) {
      console.log(`  🔗 Move Line ${ml.id}: ${ml.location_dest_id[1]}`);

      if (!ml.picking_id) {
        console.log('     ⚠️ Nessun picking associato');
        continue;
      }

      const pickingId = ml.picking_id[0];

      // Usa cache per evitare chiamate duplicate
      let pickingData = pickingCache.get(pickingId);
      if (!pickingData) {
        const picking = await odooCall('stock.picking', 'read',
          [[pickingId]],
          { fields: ['name', 'origin', 'partner_id', 'scheduled_date', 'date_done', 'state', 'location_dest_id'] }
        );

        pickingData = picking[0];
        pickingCache.set(pickingId, pickingData);
      }

      console.log(`     - Picking: ${pickingData.name}`);
      console.log(`     - Origin: ${pickingData.origin || 'N/A'}`);
      console.log(`     - Cliente: ${pickingData.partner_id ? pickingData.partner_id[1] : 'N/A'}`);

      // STEP 5a: Prova a trovare l'ordine tramite origin
      let order = null;

      if (pickingData.origin) {
        try {
          const orders = await odooCall('sale.order', 'search_read',
            [[['name', '=', pickingData.origin]]],
            { fields: ['id', 'name', 'partner_id', 'commitment_date', 'date_order', 'state'], limit: 1 }
          );

          if (orders.length > 0) {
            order = orders[0];
            console.log(`     ✅ Ordine trovato: ${order.name}`);
          } else {
            console.log(`     ⚠️ Origin "${pickingData.origin}" non è un ordine di vendita`);
          }
        } catch (err) {
          console.log(`     ⚠️ Errore ricerca ordine: ${err}`);
        }
      }

      // STEP 5b: Fallback - usa move.sale_line_id
      if (!order && ml.move_id) {
        try {
          const move = await odooCall('stock.move', 'read',
            [[ml.move_id[0]]],
            { fields: ['sale_line_id'] }
          );

          if (move[0].sale_line_id && move[0].sale_line_id[0]) {
            console.log(`     🔗 Trovato sale_line_id, risalgo all'ordine...`);

            const saleLine = await odooCall('sale.order.line', 'read',
              [[move[0].sale_line_id[0]]],
              { fields: ['order_id'] }
            );

            if (saleLine[0].order_id) {
              const orderId = saleLine[0].order_id[0];

              const orders = await odooCall('sale.order', 'read',
                [[orderId]],
                { fields: ['name', 'partner_id', 'commitment_date', 'date_order', 'state'] }
              );

              if (orders.length > 0) {
                order = orders[0];
                console.log(`     ✅ Ordine trovato via sale_line_id: ${order.name}`);
              }
            }
          }
        } catch (err) {
          console.log(`     ⚠️ Errore fallback sale_line_id: ${err}`);
        }
      }

      // Aggiungi risultato
      if (order) {
        results.push({
          lotName: lot.name,
          productName: lot.product_id[1],
          productId: lot.product_id[0],
          orderNumber: order.name,
          customerName: order.partner_id[1],
          customerId: order.partner_id[0],
          deliveryDate: order.commitment_date || order.date_order,
          orderState: order.state,
          pickingName: pickingData.name,
          pickingId: pickingData.id,
          quantity: ml.qty_done,
          destination: ml.location_dest_id[1]
        });
      } else {
        // Anche se non c'è ordine, mostra almeno il picking
        results.push({
          lotName: lot.name,
          productName: lot.product_id[1],
          productId: lot.product_id[0],
          orderNumber: pickingData.origin || pickingData.name,
          customerName: pickingData.partner_id ? pickingData.partner_id[1] : 'N/A',
          customerId: pickingData.partner_id ? pickingData.partner_id[0] : null,
          deliveryDate: pickingData.scheduled_date || pickingData.date_done,
          orderState: 'transfer_only',
          pickingName: pickingData.name,
          pickingId: pickingData.id,
          quantity: ml.qty_done,
          destination: ml.location_dest_id[1]
        });
      }
    }

    console.log(`\n✅ Test completato: ${results.length} risultati trovati\n`);

    return NextResponse.json({
      success: true,
      lotName: lotName,
      lotInfo: {
        id: lot.id,
        name: lot.name,
        product: lot.product_id[1],
        productId: lot.product_id[0],
        expiryDate: lot.expiration_date
      },
      locations: quants.map((q: any) => ({
        location: q.location_id[1],
        quantity: q.quantity,
        reserved: q.reserved_quantity || 0
      })),
      traceability: results,
      summary: {
        totalMoves: moveLines.length,
        ordersFound: results.filter((r: any) => r.orderState !== 'transfer_only').length,
        transfersFound: results.filter((r: any) => r.orderState === 'transfer_only').length
      }
    });

  } catch (error: any) {
    console.error('❌ Errore test tracciabilità:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
