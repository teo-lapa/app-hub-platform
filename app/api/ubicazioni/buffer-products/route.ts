import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId richiesto'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
    const odooDb = process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB;

    console.log('🔍 Caricamento prodotti buffer location:', locationId);

    // Autenticazione
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: process.env.ODOO_USERNAME || 'paul@lapa.ch',
          password: process.env.ODOO_PASSWORD || 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();
    if (!authData.result || !authData.result.uid) {
      throw new Error('Autenticazione fallita');
    }

    const setCookieHeader = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    // Carica tutti i quants nella location buffer
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
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: {
            fields: ['id', 'product_id', 'quantity', 'lot_id', 'product_uom_id']
          }
        },
        id: 2
      })
    });

    const quantsData = await quantsResponse.json();
    const quants = quantsData.result || [];

    console.log('📦 Quants trovati:', quants.length);

    if (!quants || quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }

    // Estrai IDs prodotti unici
    const productIds = [...new Set(quants.map((q: any) => q.product_id[0]))];

    // Carica dettagli prodotti
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
          args: [[['id', 'in', productIds]]],
          kwargs: {
            fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
          }
        },
        id: 3
      })
    });

    const productsData = await productsResponse.json();
    const products = productsData.result || [];

    console.log('📦 Prodotti trovati:', products.length);

    // Mappa prodotti con i loro quants
    const productsWithQuants = quants.map((quant: any) => {
      const product = products.find((p: any) => p.id === quant.product_id[0]);

      return {
        id: product?.id || 0,
        name: product?.name || '',
        code: product?.default_code || '',
        barcode: product?.barcode || '',
        image: product?.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'PZ',
        lot_id: quant.lot_id ? quant.lot_id[0] : null,
        lot_name: quant.lot_id ? quant.lot_id[1] : null
      };
    });

    // Se ci sono lotti, carica anche le date di scadenza
    const lotIds = productsWithQuants
      .filter((p: any) => p.lot_id)
      .map((p: any) => p.lot_id);

    if (lotIds.length > 0) {
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
            args: [[['id', 'in', lotIds]]],
            kwargs: {
              fields: ['id', 'name', 'expiration_date']
            }
          },
          id: 4
        })
      });

      const lotsData = await lotsResponse.json();
      const lots = lotsData.result || [];

      // Aggiungi date scadenza ai prodotti
      productsWithQuants.forEach((product: any) => {
        if (product.lot_id) {
          const lot = lots.find((l: any) => l.id === product.lot_id);
          if (lot) {
            product.expiration_date = lot.expiration_date || null;
          }
        }
      });
    }

    console.log('✅ Prodotti con quants:', productsWithQuants.length);

    return NextResponse.json({
      success: true,
      products: productsWithQuants
    });

  } catch (error: any) {
    console.error('❌ Errore caricamento prodotti buffer:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel caricamento prodotti'
    }, { status: 500 });
  }
}
