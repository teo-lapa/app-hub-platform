import { NextRequest, NextResponse } from 'next/server';
import { searchReadOdoo, getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const { locationCode } = await request.json();

    if (!locationCode) {
      return NextResponse.json(
        { success: false, error: 'Codice ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca ubicazione:', locationCode);

    // NUOVO: Usa il session_id dell'utente loggato (NO credenziali hardcoded!)
    const sessionId = await getOdooSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua nuovamente il login.' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';

    console.log('✅ Usando session_id dell\'utente loggato');

    // STEP 1: Cerca ubicazione
    const locations = await searchReadOdoo(
      'stock.location',
      [
        '|',
        ['barcode', '=', locationCode],
        ['name', 'ilike', locationCode]
      ],
      ['id', 'name', 'complete_name', 'barcode'],
      1
    );

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ubicazione non trovata',
        details: `Nessuna ubicazione trovata per: ${locationCode}`
      }, { status: 404 });
    }

    const location = locations[0];
    console.log(`📍 Ubicazione trovata: ${location.name}`);

    // STEP 2: Cerca prodotti in questa ubicazione
    const quants = await searchReadOdoo(
      'stock.quant',
      [['location_id', '=', location.id]],
      ['product_id', 'quantity', 'reserved_quantity', 'lot_id', 'product_uom_id', 'inventory_quantity', 'inventory_diff_quantity', 'inventory_date', 'write_date'],
      100
    );

    console.log(`📦 Trovati ${quants.length} quant (righe inventario) nell'ubicazione`);

    let products: any[] = [];

    // Se ci sono quants, recupera dettagli prodotti E lotti
    if (quants.length > 0) {
      const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));
      const lotIds = Array.from(new Set(quants.filter((q: any) => q.lot_id).map((q: any) => q.lot_id[0])));

      console.log(`🖼️ Recupero dettagli per ${productIds.length} prodotti e ${lotIds.length} lotti...`);

      // Recupera dettagli prodotti
      const productsDetailResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            args: [
              [['id', 'in', productIds]]
            ],
            kwargs: {
              fields: ['id', 'image_128', 'default_code', 'barcode', 'uom_id'],
              limit: 100
            }
          },
          id: Math.random()
        })
      });

      const productsDetailData = await productsDetailResponse.json();

      // Crea mappe per accesso rapido
      const productDetailsMap = new Map();
      const lotDetailsMap = new Map();

      if (!productsDetailData.error && productsDetailData.result) {
        productsDetailData.result.forEach((p: any) => {
          productDetailsMap.set(p.id, {
            image_128: p.image_128,
            default_code: p.default_code,
            barcode: p.barcode,
            uom_id: p.uom_id
          });
        });
      }

      // Recupera dettagli lotti con scadenze
      if (lotIds.length > 0) {
        const lotsDetailResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
              args: [
                [['id', 'in', lotIds]]
              ],
              kwargs: {
                fields: ['id', 'name', 'expiration_date', 'product_id'],
                limit: 100
              }
            },
            id: Math.random()
          })
        });

        const lotsDetailData = await lotsDetailResponse.json();

        if (!lotsDetailData.error && lotsDetailData.result) {
          lotsDetailData.result.forEach((lot: any) => {
            lotDetailsMap.set(lot.id, {
              name: lot.name,
              expiration_date: lot.expiration_date,
              product_id: lot.product_id
            });
          });
        }
      }

      // Combina tutti i dati: quant + prodotto + lotto
      products = quants.map((q: any) => {
        const productDetails = productDetailsMap.get(q.product_id[0]);
        const lotDetails = q.lot_id ? lotDetailsMap.get(q.lot_id[0]) : null;

        return {
          quant_id: q.id,
          product_id: q.product_id[0],
          product_name: q.product_id[1],
          quantity: q.quantity || 0,
          reserved_quantity: q.reserved_quantity || 0,
          inventory_quantity: q.inventory_quantity,
          inventory_diff_quantity: q.inventory_diff_quantity,
          inventory_date: q.inventory_date,
          write_date: q.write_date,

          // Dettagli prodotto
          image_128: productDetails?.image_128 || null,
          default_code: productDetails?.default_code || null,
          barcode: productDetails?.barcode || null,
          uom_id: productDetails?.uom_id || q.product_uom_id,

          // Dettagli lotto
          lot_id: q.lot_id ? q.lot_id[0] : null,
          lot_name: q.lot_id ? q.lot_id[1] : null,
          lot_expiration_date: lotDetails?.expiration_date || null,
        };
      });

      console.log(`✅ Dati combinati: ${products.length} righe con prodotti, lotti e scadenze`);
    }

    // Se non ci sono prodotti, cerca alcuni prodotti del catalogo per gestione inventario
    if (products.length === 0) {
      console.log('🔍 Nessun inventario esistente, carico prodotti del catalogo per gestione...');

      const catalogProducts = await searchReadOdoo(
        'product.product',
        [['active', '=', true], ['type', '=', 'product']],
        ['id', 'name', 'default_code', 'barcode'],
        20
      );

      if (catalogProducts) {
        products = catalogProducts.map((product: any) => ({
          product_id: [product.id, product.name],
          quantity: 0,
          reserved_quantity: 0,
          lot_id: false,
          barcode: product.barcode,
          default_code: product.default_code,
          _catalog_item: true
        }));
        console.log(`📋 Caricati ${products.length} prodotti del catalogo per gestione inventario`);
      }
    }

    return NextResponse.json({
      success: true,
      location: location,
      inventory: products,
      method: 'user_session'  // Ora usa il session dell'utente!
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca ubicazione:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
