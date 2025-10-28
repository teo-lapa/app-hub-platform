import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const WASTE_CUSTOMER_ID = 1200; // SPAZZATURA SCADUTI DETERIORATI
const WASTE_LOCATION_ID = 648; // MERCE DETERIORATA

interface OrderProductPayload {
  productId: number;
  quantity: number;
  lotId: number | null;
  price: number;
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { products }: { products: OrderProductPayload[] } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun prodotto fornito per l\'ordine'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🗑️ Generazione ordine scarico per', products.length, 'prodotti');

    // 1. Create sale.order
    const timestamp = Date.now();
    const orderData = {
      partner_id: WASTE_CUSTOMER_ID,
      date_order: new Date().toISOString(),
      origin: `WEB-SCARTI-${timestamp}`
    };

    const orderCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'create',
          args: [orderData],
          kwargs: {}
        },
        id: Date.now()
      })
    });

    const orderCreateData = await orderCreateResponse.json();
    const orderId = orderCreateData.result;

    if (!orderId) {
      throw new Error('Impossibile creare l\'ordine di vendita');
    }

    console.log('📝 Ordine creato:', orderId);

    // 2. Add order lines for each product
    const orderLineIds: number[] = [];

    for (const product of products) {
      const lineData = {
        order_id: orderId,
        product_id: product.productId,
        product_uom_qty: product.quantity,
        price_unit: product.price
      };

      const lineCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'sale.order.line',
            method: 'create',
            args: [lineData],
            kwargs: {}
          },
          id: Date.now() + orderLineIds.length
        })
      });

      const lineCreateData = await lineCreateResponse.json();
      if (lineCreateData.result) {
        orderLineIds.push(lineCreateData.result);
      }
    }

    console.log(`📦 Create ${orderLineIds.length} righe ordine`);

    // 3. Confirm the order automatically
    const confirmResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'action_confirm',
          args: [[orderId]],
          kwargs: {}
        },
        id: Date.now() + 1000
      })
    });

    const confirmData = await confirmResponse.json();
    console.log('✅ Ordine confermato');

    // 4. Wait a moment for Odoo to create the picking
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Get order name first to use for picking search
    const orderReadTempResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'read',
          args: [[orderId], ['name']],
          kwargs: {}
        },
        id: Date.now() + 1500
      })
    });

    const orderReadTempData = await orderReadTempResponse.json();
    const orderNameTemp = orderReadTempData.result?.[0]?.name;

    // 6. Find the created picking for this order using order name
    const pickingSearchResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking',
          method: 'search_read',
          args: [[
            ['origin', '=', orderNameTemp]
          ]],
          kwargs: {
            fields: ['id', 'name', 'state', 'location_id'],
            limit: 1
          }
        },
        id: Date.now() + 2000
      })
    });

    const pickingSearchData = await pickingSearchResponse.json();
    const pickings = pickingSearchData.result || [];

    let pickingId = null;
    let pickingName = null;

    if (pickings.length > 0) {
      pickingId = pickings[0].id;
      pickingName = pickings[0].name;

      // 7. Update picking location_id to MERCE DETERIORATA (648)
      const updatePickingResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.picking',
            method: 'write',
            args: [[pickingId], { location_id: WASTE_LOCATION_ID }],
            kwargs: {}
          },
          id: Date.now() + 3000
        })
      });

      const updateData = await updatePickingResponse.json();
      console.log(`📋 Picking ${pickingName} aggiornato con ubicazione origine ${WASTE_LOCATION_ID}`);

      // 8. Update all move lines to have correct source location
      const moveUpdateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.move',
            method: 'search_write',
            args: [
              [['picking_id', '=', pickingId]],
              { location_id: WASTE_LOCATION_ID }
            ],
            kwargs: {}
          },
          id: Date.now() + 4000
        })
      });

      console.log('✅ Move lines aggiornate con ubicazione origine corretta');
    } else {
      console.warn('⚠️ Picking non ancora creato - potrebbe richiedere più tempo');
    }

    console.log('✅ Ordine scarico generato con successo:', orderNameTemp);

    return NextResponse.json({
      success: true,
      orderId,
      orderName: orderNameTemp,
      pickingId,
      pickingName,
      productsCount: products.length,
      message: pickingId
        ? `Ordine ${orderNameTemp} creato e confermato. Picking ${pickingName} pronto (NON validato).`
        : `Ordine ${orderNameTemp} creato e confermato. Il picking verrà generato a breve.`
    });

  } catch (error: any) {
    console.error('❌ Errore generazione ordine scarico:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore generazione ordine'
    }, { status: 500 });
  }
}
