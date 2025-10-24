import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function callOdoo(
  cookieStore: any,
  model: string,
  method: string,
  args: any[],
  kwargs: any = {}
) {
  const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
  const sessionCookie = cookieStore.get('session_id');

  if (!sessionCookie) {
    throw new Error('No Odoo session found');
  }

  const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_id=${sessionCookie.value}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    console.error('❌ Odoo Error:', data.error);
    throw new Error(data.error.message || 'Odoo API Error');
  }

  return data.result;
}

// GET /api/portale-clienti/deliveries/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const deliveryId = parseInt(params.id);

    if (isNaN(deliveryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid delivery ID' },
        { status: 400 }
      );
    }

    // Fetch picking details
    const pickings = await callOdoo(
      cookieStore,
      'stock.picking',
      'search_read',
      [[['id', '=', deliveryId]]],
      {
        fields: [
          'id',
          'name',
          'scheduled_date',
          'state',
          'partner_id',
          'origin',
          'note',
          'picking_type_code',
          'move_ids_without_package',
          'carrier_id',
          'date_done',
          'batch_id'
        ],
      }
    );

    if (!pickings || pickings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const picking = pickings[0];

    // Fetch partner details con coordinate
    const partners = await callOdoo(
      cookieStore,
      'res.partner',
      'search_read',
      [[['id', '=', picking.partner_id[0]]]],
      {
        fields: [
          'id',
          'name',
          'street',
          'city',
          'zip',
          'phone',
          'partner_latitude',
          'partner_longitude'
        ],
      }
    );

    const partner = partners[0] || {};

    // Fetch move lines per prodotti
    let moveLines: any[] = [];
    if (picking.move_ids_without_package && picking.move_ids_without_package.length > 0) {
      moveLines = await callOdoo(
        cookieStore,
        'stock.move',
        'search_read',
        [[['id', 'in', picking.move_ids_without_package]]],
        {
          fields: [
            'id',
            'product_id',
            'product_uom_qty',
            'quantity_done',
            'product_uom',
            'state'
          ],
        }
      );
    }

    // Fetch immagini prodotti
    const productIds = moveLines.map((m: any) => m.product_id[0]);
    let products: any[] = [];

    if (productIds.length > 0) {
      products = await callOdoo(
        cookieStore,
        'product.product',
        'search_read',
        [[['id', 'in', productIds]]],
        {
          fields: ['id', 'name', 'image_128', 'default_code'],
        }
      );
    }

    const productMap = new Map(
      products.map((p: any) => [
        p.id,
        {
          image: p.image_128 ? `data:image/png;base64,${p.image_128}` : null,
          code: p.default_code,
        },
      ])
    );

    // Fetch foto consegna (attachments)
    const attachments = await callOdoo(
      cookieStore,
      'ir.attachment',
      'search_read',
      [[
        ['res_model', '=', 'stock.picking'],
        ['res_id', '=', deliveryId],
        ['mimetype', 'ilike', 'image/']
      ]],
      {
        fields: ['id', 'name', 'datas', 'mimetype', 'create_date'],
        limit: 10,
      }
    );

    const deliveryPhotos = attachments.map((att: any) => ({
      id: att.id,
      name: att.name,
      url: att.datas ? `data:${att.mimetype};base64,${att.datas}` : null,
      created_at: att.create_date,
    }));

    // Mappa move lines con info prodotto
    const products_detail = moveLines.map((move: any) => {
      const productInfo = productMap.get(move.product_id[0]) || {};
      return {
        id: move.id,
        product_id: move.product_id[0],
        product_name: move.product_id[1],
        product_code: productInfo.code,
        product_image: productInfo.image,
        quantity: move.product_uom_qty,
        quantity_done: move.quantity_done || 0,
        uom: move.product_uom ? move.product_uom[1] : 'PZ',
        state: move.state,
      };
    });

    // Calcola ETA simulato
    const now = new Date();
    const randomMinutes = Math.floor(Math.random() * 210) + 30;
    const eta = new Date(now.getTime() + randomMinutes * 60000);

    // Coordinate default warehouse (se non disponibili usa coordinate Germania centrali)
    const warehouseCoords = {
      latitude: 50.1109, // Germania centrale
      longitude: 8.6821,
    };

    // Coordinate cliente
    const customerCoords = {
      latitude: partner.partner_latitude || 52.52, // Berlin default
      longitude: partner.partner_longitude || 13.405,
    };

    const delivery = {
      id: picking.id,
      name: picking.name,
      scheduled_date: picking.scheduled_date,
      state: picking.state,
      origin: picking.origin,
      note: picking.note,
      carrier_id: picking.carrier_id,
      delivery_status: picking.state === 'assigned' ? 'in_transit' : 'preparing',
      estimated_arrival: eta.toISOString(),
      batch_id: picking.batch_id,
      customer: {
        id: partner.id,
        name: partner.name,
        street: partner.street || '',
        city: partner.city || '',
        zip: partner.zip || '',
        phone: partner.phone || '',
        latitude: customerCoords.latitude,
        longitude: customerCoords.longitude,
      },
      warehouse: warehouseCoords,
      products: products_detail,
      photos: deliveryPhotos,
      total_items: products_detail.reduce((sum: number, p: any) => sum + p.quantity, 0),
    };

    return NextResponse.json({
      success: true,
      delivery,
    });

  } catch (error: any) {
    console.error('💥 [Delivery Detail] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch delivery details',
      },
      { status: 500 }
    );
  }
}
