import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const WASTE_LOCATION_ID = 648; // MERCE DETERIORATA

interface WasteProductData {
  quantId: number;
  productId: number;
  productName: string;
  productCode: string;
  barcode: string;
  image: string | null;
  quantity: number;
  uom: string;
  lot: {
    id: number;
    name: string;
    expiration_date: string | null;
  } | null;
  standardPrice: number;
  totalValue: number;
  disposalInfo: {
    pickingId: number;
    pickingName: string;
    reason: string;
    notes: string;
    date: string;
    photos: Array<{
      id: number;
      name: string;
      data: string | null;
      created: string;
    }>;
  } | null;
  allDisposals: any[];
  createdDate: string;
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('📊 Caricamento dashboard scarti dalla ubicazione:', WASTE_LOCATION_ID);

    // 1. Fetch all stock.quant from waste location
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
            ['location_id', '=', WASTE_LOCATION_ID],
            ['quantity', '>', 0]
          ]],
          kwargs: {
            fields: ['id', 'product_id', 'quantity', 'lot_id', 'product_uom_id', 'create_date']
          }
        },
        id: Date.now()
      })
    });

    const quantsData = await quantsResponse.json();
    const quants = quantsData.result || [];

    console.log(`📦 Trovati ${quants.length} quants nella ubicazione scarti`);

    if (quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        statistics: {
          totalProducts: 0,
          totalQuantity: 0,
          totalValueLost: 0,
          reasonBreakdown: {}
        }
      });
    }

    // 2. Get unique product IDs
    const productIdsSet = new Set<number>();
    quants.forEach((q: any) => productIdsSet.add(q.product_id[0]));
    const productIds = Array.from(productIdsSet);

    // 3. Fetch product details including standard_price
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
          method: 'read',
          args: [productIds, ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id', 'standard_price']],
          kwargs: {}
        },
        id: Date.now() + 1
      })
    });

    const productsData = await productsResponse.json();
    const products = productsData.result || [];

    console.log(`📦 Caricati ${products.length} prodotti con prezzi`);

    // 4. Get lot IDs for lots
    const lotIds = quants
      .filter((q: any) => q.lot_id)
      .map((q: any) => q.lot_id[0]);

    let lots: any[] = [];
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
            method: 'read',
            args: [lotIds, ['id', 'name', 'expiration_date']],
            kwargs: {}
          },
          id: Date.now() + 2
        })
      });

      const lotsData = await lotsResponse.json();
      lots = lotsData.result || [];
    }

    // 5. Fetch all pickings with destination = waste location
    const pickingsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            ['location_dest_id', '=', WASTE_LOCATION_ID],
            ['state', '=', 'done']
          ]],
          kwargs: {
            fields: ['id', 'name', 'note', 'date_done', 'create_date'],
            order: 'date_done desc'
          }
        },
        id: Date.now() + 3
      })
    });

    const pickingsData = await pickingsResponse.json();
    const pickings = pickingsData.result || [];

    console.log(`📋 Trovati ${pickings.length} trasferimenti verso scarti`);

    // 6. Fetch attachments for all pickings
    const pickingIds = pickings.map((p: any) => p.id);
    let attachments: any[] = [];

    if (pickingIds.length > 0) {
      const attachmentsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'ir.attachment',
            method: 'search_read',
            args: [[
              ['res_model', '=', 'stock.picking'],
              ['res_id', 'in', pickingIds],
              ['mimetype', 'like', 'image']
            ]],
            kwargs: {
              fields: ['id', 'name', 'res_id', 'datas', 'mimetype', 'create_date']
            }
          },
          id: Date.now() + 4
        })
      });

      const attachmentsData = await attachmentsResponse.json();
      attachments = attachmentsData.result || [];
    }

    console.log(`📸 Trovati ${attachments.length} allegati foto`);

    // 7. Fetch move lines to link products to pickings
    const moveLinesResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.move.line',
          method: 'search_read',
          args: [[
            ['picking_id', 'in', pickingIds],
            ['location_dest_id', '=', WASTE_LOCATION_ID]
          ]],
          kwargs: {
            fields: ['id', 'picking_id', 'product_id', 'lot_id', 'qty_done']
          }
        },
        id: Date.now() + 5
      })
    });

    const moveLinesData = await moveLinesResponse.json();
    const moveLines = moveLinesData.result || [];

    console.log(`📦 Trovate ${moveLines.length} move lines`);

    // 8. Build comprehensive product data
    const wasteProducts: WasteProductData[] = quants.map((quant: any): WasteProductData => {
      const productId = quant.product_id[0];
      const product = products.find((p: any) => p.id === productId);

      let lotInfo = null;
      if (quant.lot_id) {
        const lot = lots.find((l: any) => l.id === quant.lot_id[0]);
        lotInfo = lot ? {
          id: lot.id,
          name: lot.name,
          expiration_date: lot.expiration_date || null
        } : null;
      }

      // Find related move lines for this product/lot combination
      const relatedMoveLines = moveLines.filter((ml: any) => {
        const matchProduct = ml.product_id[0] === productId;
        const matchLot = quant.lot_id ?
          (ml.lot_id && ml.lot_id[0] === quant.lot_id[0]) :
          !ml.lot_id;
        return matchProduct && matchLot;
      });

      // Get picking info from move lines
      const pickingInfo = relatedMoveLines.map((ml: any) => {
        const pickingId = ml.picking_id[0];
        const picking = pickings.find((p: any) => p.id === pickingId);

        if (!picking) return null;

        // Parse reason from note field
        let reason = 'Non specificato';
        let notes = '';

        if (picking.note) {
          const noteText = picking.note;
          // Format: "SCARTO - {reason}\n\nNote: {notes}"
          const reasonMatch = noteText.match(/SCARTO\s*-\s*([^\n]+)/);
          const notesMatch = noteText.match(/Note:\s*(.+)/s);

          if (reasonMatch) reason = reasonMatch[1].trim();
          if (notesMatch) notes = notesMatch[1].trim();
        }

        // Get attachments for this picking
        const pickingAttachments = attachments
          .filter((a: any) => a.res_id === pickingId)
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            data: a.datas ? `data:${a.mimetype};base64,${a.datas}` : null,
            created: a.create_date
          }));

        return {
          pickingId: picking.id,
          pickingName: picking.name,
          reason,
          notes,
          date: picking.date_done || picking.create_date,
          photos: pickingAttachments
        };
      }).filter(Boolean);

      const standardPrice = product?.standard_price || 0;
      const totalValue = standardPrice * quant.quantity;

      return {
        quantId: quant.id,
        productId: productId,
        productName: product?.name || 'Prodotto sconosciuto',
        productCode: product?.default_code || '',
        barcode: product?.barcode || '',
        image: product?.image_128 ? `data:image/png;base64,${product.image_128}` : null,
        quantity: quant.quantity,
        uom: product?.uom_id ? product.uom_id[1] : 'PZ',
        lot: lotInfo,
        standardPrice: standardPrice,
        totalValue: totalValue,
        disposalInfo: pickingInfo.length > 0 ? pickingInfo[0] : null,
        allDisposals: pickingInfo,
        createdDate: quant.create_date
      };
    });

    // 9. Calculate statistics
    const totalQuantity = wasteProducts.reduce((sum: number, p: WasteProductData) => sum + p.quantity, 0);
    const totalValueLost = wasteProducts.reduce((sum: number, p: WasteProductData) => sum + p.totalValue, 0);

    const reasonBreakdown: Record<string, { count: number; value: number }> = {};
    wasteProducts.forEach((p: WasteProductData) => {
      const reason = p.disposalInfo?.reason || 'Non specificato';
      if (!reasonBreakdown[reason]) {
        reasonBreakdown[reason] = { count: 0, value: 0 };
      }
      reasonBreakdown[reason].count += 1;
      reasonBreakdown[reason].value += p.totalValue;
    });

    console.log('✅ Dashboard scarti caricata con successo');

    return NextResponse.json({
      success: true,
      products: wasteProducts,
      statistics: {
        totalProducts: wasteProducts.length,
        totalQuantity: totalQuantity,
        totalValueLost: totalValueLost,
        reasonBreakdown: reasonBreakdown
      }
    });

  } catch (error: any) {
    console.error('❌ Errore caricamento dashboard scarti:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento dashboard'
    }, { status: 500 });
  }
}
