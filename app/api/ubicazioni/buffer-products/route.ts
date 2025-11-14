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

    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId richiesto'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🔍 Caricamento prodotti buffer location:', locationId);

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
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));

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
            fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id', 'seller_ids']
          }
        },
        id: 3
      })
    });

    const productsData = await productsResponse.json();
    const products = productsData.result || [];

    console.log('📦 Prodotti trovati:', products.length);

    // Carica fornitori (seller_ids -> product.supplierinfo)
    const sellerIds = Array.from(new Set(
      products
        .filter((p: any) => p.seller_ids && p.seller_ids.length > 0)
        .flatMap((p: any) => p.seller_ids)
    ));

    let sellers: any[] = [];
    if (sellerIds.length > 0) {
      const sellersResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'product.supplierinfo',
            method: 'search_read',
            args: [[['id', 'in', sellerIds]]],
            kwargs: {
              fields: ['id', 'partner_id', 'product_tmpl_id'],
              order: 'sequence asc'
            }
          },
          id: 5
        })
      });

      const sellersData = await sellersResponse.json();
      sellers = sellersData.result || [];
      console.log('🏭 Fornitori trovati:', sellers.length);
    }

    // Mappa prodotti con i loro quants
    const productsWithQuants = quants.map((quant: any) => {
      const product = products.find((p: any) => p.id === quant.product_id[0]);

      // Trova il fornitore principale (primo della lista)
      let supplierName = null;
      let supplierId = null;
      if (product?.seller_ids && product.seller_ids.length > 0) {
        const primarySeller = sellers.find((s: any) => s.id === product.seller_ids[0]);
        if (primarySeller && primarySeller.partner_id) {
          supplierName = primarySeller.partner_id[1];
          supplierId = primarySeller.partner_id[0];
        }
      }

      return {
        id: product?.id || 0,
        name: product?.name || '',
        code: product?.default_code || '',
        barcode: product?.barcode || '',
        image: product?.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'PZ',
        lot_id: quant.lot_id ? quant.lot_id[0] : null,
        lot_name: quant.lot_id ? quant.lot_id[1] : null,
        supplier_id: supplierId,
        supplier_name: supplierName
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
