import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
const ODOO_DB = process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB;

async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Openerp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || 'Errore Odoo');
  }

  return data.result;
}

export async function GET(request: NextRequest) {
  try {
    // Get session from cookie or header
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Get current user info
    const userInfo = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Openerp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      })
    });

    const userInfoData = await userInfo.json();
    const uid = userInfoData.result?.uid;

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // Get vehicle assigned to current user (driver)
    // Assuming there's a field vehicle_id on res.users or a separate fleet.driver model
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    // Search for deliveries (stock.picking)
    const deliveries = await callOdoo(
      sessionId,
      'stock.picking',
      'search_read',
      [
        [
          ['picking_type_id.code', '=', 'outgoing'],
          ['scheduled_date', '>=', todayStart],
          ['scheduled_date', '<=', todayEnd],
          ['state', 'in', ['assigned', 'done']]
          // Add vehicle_id filter if you have it
          // ['vehicle_id', '=', vehicleId]
        ]
      ],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'scheduled_date',
          'state',
          'origin',
          'note',
          'sale_id',
          'move_lines',
          'latitude',
          'longitude'
        ],
        order: 'scheduled_date ASC'
      }
    );

    // For each delivery, get detailed product info and sale order data
    const enrichedDeliveries = await Promise.all(
      deliveries.map(async (delivery: any) => {
        // Get move lines details
        const moveLines = await callOdoo(
          sessionId,
          'stock.move',
          'search_read',
          [[['id', 'in', delivery.move_lines]]],
          {
            fields: [
              'id',
              'product_id',
              'product_uom_qty',
              'quantity_done',
              'product_uom',
              'name'
            ]
          }
        );

        // Get sale order data if exists
        let saleOrderData = null;
        if (delivery.sale_id) {
          try {
            const saleOrders = await callOdoo(
              sessionId,
              'sale.order',
              'read',
              [[delivery.sale_id[0]]],
              {
                fields: ['name', 'amount_total', 'payment_state', 'invoice_ids']
              }
            );
            saleOrderData = saleOrders[0];
          } catch (err) {
            console.error('Error fetching sale order:', err);
          }
        }

        // Get partner details (address, phone, coordinates)
        let partnerData: any = {};
        if (delivery.partner_id) {
          try {
            const partners = await callOdoo(
              sessionId,
              'res.partner',
              'read',
              [[delivery.partner_id[0]]],
              {
                fields: ['street', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude']
              }
            );
            partnerData = partners[0];
          } catch (err) {
            console.error('Error fetching partner:', err);
          }
        }

        return {
          ...delivery,
          partner_street: partnerData.street,
          partner_city: partnerData.city,
          partner_zip: partnerData.zip,
          partner_phone: partnerData.phone || partnerData.mobile,
          latitude: delivery.latitude || partnerData.partner_latitude,
          longitude: delivery.longitude || partnerData.partner_longitude,
          move_lines: moveLines,
          amount_total: saleOrderData?.amount_total,
          payment_status: saleOrderData?.payment_state === 'paid' ? 'paid' :
                         saleOrderData?.payment_state === 'partial' ? 'partial' :
                         saleOrderData?.amount_total > 0 ? 'to_pay' : null
        };
      })
    );

    return NextResponse.json(enrichedDeliveries);
  } catch (error: any) {
    console.error('Error loading deliveries:', error);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento consegne' },
      { status: 500 }
    );
  }
}
