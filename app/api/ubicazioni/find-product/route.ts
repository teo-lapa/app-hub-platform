import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { code, locationId } = await request.json();

    if (!code || !locationId) {
      return NextResponse.json({
        success: false,
        error: 'code e locationId richiesti'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🔍 Ricerca prodotto:', code, 'in location:', locationId);

    // Cerca il prodotto per barcode o default_code
    const productsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [[
            '|',
            ['barcode', '=', code],
            ['default_code', '=', code]
          ]],
          kwargs: {
            fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id'],
            limit: 1
          }
        },
        id: 2
      })
    });

    const productsData = await productsResponse.json();
    const products = productsData.result || [];

    console.log('📦 Prodotti trovati:', products.length);

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Prodotto non trovato'
      }, { status: 404 });
    }

    const product = products[0];

    // Cerca il quant di questo prodotto nella location specificata
    const quantsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.quant',
          method: 'search_read',
          args: [[
            ['product_id', '=', product.id],
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: {
            fields: ['id', 'quantity', 'lot_id', 'product_uom_id'],
            limit: 1
          }
        },
        id: 3
      })
    });

    const quantsData = await quantsResponse.json();
    const quants = quantsData.result || [];

    console.log('📦 Quants trovati:', quants.length);

    if (!quants || quants.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Prodotto non presente in questa ubicazione'
      }, { status: 404 });
    }

    const quant = quants[0];

    // Se c'è un lotto, carica anche la data di scadenza
    let expirationDate = null;
    if (quant.lot_id) {
      const lotsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.lot',
            method: 'search_read',
            args: [[['id', '=', quant.lot_id[0]]]],
            kwargs: {
              fields: ['id', 'name', 'expiration_date'],
              limit: 1
            }
          },
          id: 4
        })
      });

      const lotsData = await lotsResponse.json();
      const lots = lotsData.result || [];

      if (lots && lots.length > 0) {
        expirationDate = lots[0].expiration_date;
      }
    }

    console.log('✅ Prodotto trovato:', product.name);

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        code: product.default_code || '',
        barcode: product.barcode || '',
        image: product.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'PZ',
        lot_id: quant.lot_id ? quant.lot_id[0] : null,
        lot_name: quant.lot_id ? quant.lot_id[1] : null,
        expiration_date: expirationDate
      }
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca prodotto:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella ricerca prodotto'
    }, { status: 500 });
  }
}
