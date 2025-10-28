import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import type { WasteLocationProduct, WasteLocationProductsResponse } from '@/lib/types';

/**
 * API Endpoint: Get products in a specific waste location
 *
 * @route GET/POST /api/waste/location-products
 * @param {number} locationId - ID of the stock location (body for POST, query for GET)
 * @returns Array of products with quantities, lots, and expiration dates
 *
 * Features:
 * - Fetches stock.quant records for the location
 * - Loads product details (name, code, barcode, image)
 * - Loads lot/serial numbers with expiration dates
 * - Groups by product_id + lot_id
 * - Returns formatted data ready for waste management UI
 */

// GET handler (query params)
export async function GET(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locationId = parseInt(searchParams.get('locationId') || '0');

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'locationId è obbligatorio' },
        { status: 400 }
      );
    }

    return await fetchLocationProducts(sessionId, locationId);
  } catch (error: any) {
    console.error('❌ Errore API waste location-products (GET):', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore caricamento prodotti' },
      { status: 500 }
    );
  }
}

// Shared logic for fetching location products
async function fetchLocationProducts(sessionId: string, locationId: number) {
  const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🗑️  Caricamento prodotti waste location:', locationId);

    // 3. Fetch stock quants from location with quantity > 0
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
        id: Date.now()
      })
    });

    if (!quantsResponse.ok) {
      throw new Error(`Odoo request failed: ${quantsResponse.statusText}`);
    }

    const quantsData = await quantsResponse.json();

    if (quantsData.error) {
      throw new Error(quantsData.error.data?.message || 'Errore Odoo');
    }

    const quants = quantsData.result || [];

    console.log(`📦 Quants trovati: ${quants.length}`);

    // Early return if no products in location
    if (!quants || quants.length === 0) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }

    // 4. Extract unique product IDs
    const productIds = Array.from(
      new Set(quants.map((q: any) => q.product_id[0]))
    );

    console.log(`🔍 Caricamento dettagli per ${productIds.length} prodotti...`);

    // 5. Fetch product details in parallel with lot details
    const [productsResponse, lotsData] = await Promise.all([
      // Fetch product details
      fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          id: Date.now()
        })
      }),
      // Fetch lot details if any lots exist
      (async () => {
        const lotIds = Array.from(
          new Set(
            quants
              .filter((q: any) => q.lot_id)
              .map((q: any) => q.lot_id[0])
          )
        );

        if (lotIds.length === 0) {
          return { result: [] };
        }

        console.log(`🏷️  Caricamento ${lotIds.length} lotti...`);

        const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            id: Date.now()
          })
        });

        if (!response.ok) {
          console.error('⚠️  Errore caricamento lotti, continuo senza...');
          return { result: [] };
        }

        return response.json();
      })()
    ]);

    if (!productsResponse.ok) {
      throw new Error(`Product fetch failed: ${productsResponse.statusText}`);
    }

    const productsData = await productsResponse.json();

    if (productsData.error) {
      throw new Error(productsData.error.data?.message || 'Errore caricamento prodotti');
    }

    const products = productsData.result || [];
    const lots = lotsData.result || [];

    console.log(`✅ Prodotti caricati: ${products.length}, Lotti: ${lots.length}`);

    // 6. Build lookup maps for efficient access
    interface OdooProduct {
      id: number;
      name: string;
      default_code: string;
      barcode: string;
      image_128: string;
      uom_id: [number, string];
    }

    interface OdooLot {
      id: number;
      name: string;
      expiration_date: string;
    }

    const productMap = new Map<number, OdooProduct>(
      products.map((p: any) => [p.id, p as OdooProduct])
    );

    const lotMap = new Map<number, OdooLot>(
      lots.map((l: any) => [l.id, l as OdooLot])
    );

    // 7. Map quants to product objects with all required fields
    const locationProducts: WasteLocationProduct[] = quants.map((quant: any) => {
      const product = productMap.get(quant.product_id[0]);
      const lot = quant.lot_id ? lotMap.get(quant.lot_id[0]) : null;

      return {
        // Product identification
        id: product?.id || 0,
        name: product?.name || 'Prodotto sconosciuto',
        code: product?.default_code || '',
        barcode: product?.barcode || '',

        // Product image (base64 encoded)
        image: product?.image_128
          ? `data:image/png;base64,${product.image_128}`
          : null,

        // Quantity information
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'PZ',

        // Lot/Serial information
        lot_id: quant.lot_id ? quant.lot_id[0] : undefined,
        lot_name: quant.lot_id ? quant.lot_id[1] : undefined,

        // Expiration date from lot
        expiration_date: lot?.expiration_date || undefined,

        // Internal quant ID for reference
        quant_id: quant.id
      };
    });

    // 8. Group by product_id + lot_id (aggregate quantities)
    const groupedProducts = new Map<string, WasteLocationProduct>();

    locationProducts.forEach(product => {
      // Create unique key: product_id + lot_id (or 'null' if no lot)
      const key = `${product.id}_${product.lot_id || 'no-lot'}`;

      if (groupedProducts.has(key)) {
        // Aggregate quantity for same product + lot combination
        const existing = groupedProducts.get(key)!;
        existing.quantity += product.quantity;
      } else {
        groupedProducts.set(key, { ...product });
      }
    });

    // Convert map to array and sort by name
    const finalProducts: WasteLocationProduct[] = Array.from(groupedProducts.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`✅ Prodotti raggruppati: ${finalProducts.length} (da ${locationProducts.length} quants)`);

    // 9. Return formatted response
    const response: WasteLocationProductsResponse = {
      success: true,
      products: finalProducts,
      metadata: {
        locationId,
        totalProducts: finalProducts.length,
        totalQuants: quants.length,
        withLots: finalProducts.filter(p => p.lot_id).length,
        withExpiration: finalProducts.filter(p => p.expiration_date).length
      }
    };

    return NextResponse.json(response);
}

// POST handler (body)
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

    return await fetchLocationProducts(sessionId, locationId);
  } catch (error: any) {
    console.error('❌ Errore API waste location-products (POST):', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento prodotti'
    }, { status: 500 });
  }
}
