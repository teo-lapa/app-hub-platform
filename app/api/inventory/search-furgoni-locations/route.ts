import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ========== GESTIONE AUTENTICAZIONE: USA SEMPRE SESSIONE UTENTE ==========
    const cookieStore = cookies();
    const userSessionId = cookieStore.get('odoo_session_id')?.value;

    let authHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Usa sempre la sessione dell'utente loggato
    if (userSessionId) {
      authHeaders['Cookie'] = `session_id=${userSessionId}`;
      console.log('✅ [Furgoni] Usando session_id dell\'utente loggato');
    } else {
      console.error('❌ [Furgoni] Nessuna autenticazione disponibile - devi fare login prima');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per accedere a questa risorsa' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

    console.log('🔍 [Furgoni] Ricerca ubicazioni furgoni con prodotti...');

    // STEP 1: Cerca tutte le ubicazioni furgoni (WH/Stock/FURGONI/*)
    const searchLocationsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.location',
          method: 'search_read',
          args: [[
            ['complete_name', 'ilike', '%FURGONI%'],
            ['usage', '=', 'internal']
          ]],
          kwargs: {
            fields: ['id', 'name', 'complete_name', 'barcode'],
            order: 'name'
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    if (!searchLocationsResponse.ok) {
      throw new Error(`Errore ricerca ubicazioni: ${searchLocationsResponse.status}`);
    }

    const locationsData = await searchLocationsResponse.json();

    if (locationsData.error) {
      console.error('❌ [Furgoni] Errore Odoo:', locationsData.error);
      return NextResponse.json({ success: false, error: locationsData.error.data?.message || 'Errore Odoo' }, { status: 500 });
    }

    const locations = locationsData.result || [];
    console.log(`📦 [Furgoni] Trovate ${locations.length} ubicazioni furgoni`);

    if (locations.length === 0) {
      return NextResponse.json({ success: true, locations: [] });
    }

    // STEP 2: Per ogni ubicazione, carica i quants (prodotti in stock)
    const locationsWithProducts = await Promise.all(locations.map(async (location: any) => {
      try {
        const quantsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.quant',
              method: 'search_read',
              args: [[
                ['location_id', '=', location.id],
                ['quantity', '>', 0]
              ]],
              kwargs: {
                fields: ['product_id', 'quantity', 'lot_id', 'package_id', 'owner_id', 'reserved_quantity'],
                limit: 100
              }
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });

        if (!quantsResponse.ok) {
          console.warn(`⚠️ [Furgoni] Errore caricamento quants per ${location.name}`);
          return null;
        }

        const quantsData = await quantsResponse.json();
        const quants = quantsData.result || [];

        if (quants.length === 0) {
          return null; // Furgone vuoto, non includerlo
        }

        // Carica dettagli prodotti
        const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));

        const productsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'product.product',
              method: 'read',
              args: [productIds, ['name', 'default_code', 'barcode', 'image_128', 'uom_id']],
              kwargs: {}
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });

        const productsData = await productsResponse.json();
        const products = productsData.result || [];
        const productMap = new Map(products.map((p: any) => [p.id, p]));

        // Carica info lotti se presenti
        const lotIds = quants
          .filter((q: any) => q.lot_id && Array.isArray(q.lot_id))
          .map((q: any) => q.lot_id[0]);

        let lotMap = new Map();
        if (lotIds.length > 0) {
          const lotsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'stock.lot',
                method: 'read',
                args: [lotIds, ['name', 'expiration_date']],
                kwargs: {}
              },
              id: Math.floor(Math.random() * 1000000)
            })
          });

          const lotsData = await lotsResponse.json();
          const lots = lotsData.result || [];
          lotMap = new Map(lots.map((l: any) => [l.id, l]));
        }

        // NUOVO: Usa stock.move.line per tracciare i movimenti CON lotto
        console.log(`🔗 [Furgoni] Caricamento movimenti dettagliati (move.line) per ${location.name}...`);

        const moveLinesResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.move.line',
              method: 'search_read',
              args: [[
                ['location_dest_id', '=', location.id],
                ['state', 'in', ['assigned', 'done']]
              ]],
              kwargs: {
                fields: ['id', 'product_id', 'lot_id', 'qty_done', 'picking_id', 'move_id'],
                limit: 500
              }
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });

        const moveLinesData = await moveLinesResponse.json();
        const moveLines = moveLinesData.result || [];

        // Raggruppa move.line per prodotto+lotto
        const moveLinesByProductLot = new Map();
        for (const ml of moveLines) {
          const prodId = ml.product_id[0];
          const lotId = ml.lot_id ? ml.lot_id[0] : null;
          const key = `${prodId}_${lotId || 'no_lot'}`;

          if (!moveLinesByProductLot.has(key)) {
            moveLinesByProductLot.set(key, []);
          }
          moveLinesByProductLot.get(key).push(ml);
        }

        console.log(`📋 [Furgoni] Trovati ${moveLines.length} move lines dettagliati`);

        // Cache per i picking già caricati
        const pickingCache = new Map();

        const getOrderInfoFromPicking = async (pickingId: number | null, moveDate: string, moveId: number | null = null) => {
          try {
            if (!pickingId) return null;

            const cacheKey = `pk_${pickingId}`;
            if (pickingCache.has(cacheKey)) return pickingCache.get(cacheKey);

            // Carica info picking per ottenere partner_id e origin
            const pickingResp = await fetch(`${odooUrl}/web/dataset/call_kw`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: {
                  model: 'stock.picking',
                  method: 'read',
                  args: [[pickingId], ['name', 'partner_id', 'scheduled_date', 'date_done', 'origin']],
                  kwargs: {}
                },
                id: Math.floor(Math.random() * 1000000)
              })
            });

            const pickingData = await pickingResp.json();
            if (pickingData.result && pickingData.result[0]) {
              const picking = pickingData.result[0];

              let orderName = picking.origin || picking.name;
              let customerName = picking.partner_id ? picking.partner_id[1] : 'N/A';
              let deliveryDate = picking.scheduled_date || picking.date_done || moveDate;

              // NUOVO: Prova a cercare l'ordine di vendita per avere dati più precisi
              if (picking.origin) {
                try {
                  const orderResp = await fetch(`${odooUrl}/web/dataset/call_kw`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      method: 'call',
                      params: {
                        model: 'sale.order',
                        method: 'search_read',
                        args: [[['name', '=', picking.origin]]],
                        kwargs: {
                          fields: ['name', 'partner_id', 'commitment_date', 'date_order'],
                          limit: 1
                        }
                      },
                      id: Math.floor(Math.random() * 1000000)
                    })
                  });

                  const orderData = await orderResp.json();
                  if (orderData.result && orderData.result.length > 0) {
                    const order = orderData.result[0];
                    // Usa i dati dell'ordine se disponibili (più affidabili)
                    orderName = order.name;
                    customerName = order.partner_id[1];
                    deliveryDate = order.commitment_date || order.date_order || deliveryDate;
                    console.log(`✅ [Furgoni] Ordine trovato: ${orderName} - ${customerName}`);
                  }
                } catch (orderErr) {
                  console.log(`⚠️ [Furgoni] Origin "${picking.origin}" non è un ordine di vendita, uso dati picking`);
                }
              }

              const info = {
                orderName,
                customerName,
                deliveryDate
              };

              pickingCache.set(cacheKey, info);
              return info;
            }
          } catch (err) {
            console.error(`⚠️ [Furgoni] Errore recupero picking:`, err);
          }
          return null;
        }

        // Mappa prodotti con dettagli E ordini dal picking
        const productsWithDetailsRaw = await Promise.all(quants.map(async (quant: any) => {
          const product = productMap.get(quant.product_id[0]);
          const lot = quant.lot_id ? lotMap.get(quant.lot_id[0]) : null;
          const prodId = quant.product_id[0];
          const lotId = quant.lot_id ? quant.lot_id[0] : null;

          // Trova i move.line per questo prodotto+lotto
          const key = `${prodId}_${lotId || 'no_lot'}`;
          const prodMoveLines = moveLinesByProductLot.get(key) || [];

          console.log(`🔍 [Furgoni] Prodotto ${quant.product_id[1]}: ${prodMoveLines.length} move.line trovati (key: ${key})`);

          // Carica info ordini per ogni move.line (tramite picking)
          const orders = [];
          for (const ml of prodMoveLines) {
            const pickingId = ml.picking_id ? ml.picking_id[0] : null;

            if (!pickingId) {
              continue;
            }

            const orderInfo = await getOrderInfoFromPicking(pickingId, '', null);

            if (orderInfo) {
              orders.push({
                quantity: ml.qty_done,
                orderName: orderInfo.orderName,
                customerName: orderInfo.customerName,
                deliveryDate: orderInfo.deliveryDate
              });
            }
          }

          if (orders.length > 0) {
            console.log(`✅ [Furgoni] ${quant.product_id[1]} ${lot ? `(Lotto: ${lot.name})` : ''}: ${orders.length} ordini trovati`);
          }

          return {
            productId: quant.product_id[0],
            productName: quant.product_id[1],
            productCode: (product as any)?.default_code || '',
            productBarcode: (product as any)?.barcode || '',
            quantity: quant.quantity - (quant.reserved_quantity || 0), // Qty disponibile
            uom: (product as any)?.uom_id?.[1] || 'PZ',
            image: (product as any)?.image_128 ? `data:image/png;base64,${(product as any).image_128}` : null,
            lotName: (lot as any)?.name || undefined,
            expiryDate: (lot as any)?.expiration_date || undefined,
            orders: orders.length > 0 ? orders : undefined
          };
        }));

        const productsWithDetails = productsWithDetailsRaw.filter((p: any) => p.quantity > 0); // Solo prodotti con qty disponibile

        if (productsWithDetails.length === 0) {
          return null;
        }

        return {
          id: location.id,
          name: location.name,
          complete_name: location.complete_name,
          productCount: productsWithDetails.length,
          products: productsWithDetails
        };

      } catch (error) {
        console.error(`❌ [Furgoni] Errore per ubicazione ${location.name}:`, error);
        return null;
      }
    }));

    // Filtra ubicazioni vuote o con errori
    const validLocations = locationsWithProducts.filter(l => l !== null);

    console.log(`✅ [Furgoni] ${validLocations.length} furgoni con prodotti disponibili`);

    return NextResponse.json({
      success: true,
      locations: validLocations
    });

  } catch (error: any) {
    console.error('❌ [Furgoni] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
 
