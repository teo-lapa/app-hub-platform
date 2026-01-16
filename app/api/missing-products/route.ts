import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

// Configurazione timeout
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * API per ottenere i prodotti mancanti
 *
 * GET /api/missing-products?date=2026-01-15
 * GET /api/missing-products (default: oggi)
 *
 * Query params:
 * - date: data specifica (YYYY-MM-DD)
 * - salesperson_id: filtra per venditore
 * - group_by: 'salesperson' | 'product' | 'customer'
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    const salespersonId = searchParams.get('salesperson_id');
    const groupBy = searchParams.get('group_by') || 'salesperson';

    // Ottieni session
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Data target (default: oggi)
    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    console.log('🔍 [MISSING-PRODUCTS] Cercando mancanti per:', targetDate);

    // Prima verifica se esiste il modello lapa.missing.product
    // Se non esiste, fa la query diretta come fallback
    let missingProducts = [];

    try {
      // Prova a leggere dal modello custom
      missingProducts = await getMissingFromCustomModel(sessionId, targetDate, salespersonId);
    } catch (error) {
      console.log('⚠️ [MISSING-PRODUCTS] Modulo custom non disponibile, uso query diretta');
      // Fallback: query diretta
      missingProducts = await getMissingFromDirectQuery(sessionId, targetDate, salespersonId);
    }

    // Raggruppa i risultati
    const groupedData = groupMissingProducts(missingProducts, groupBy);

    // Calcola totali
    const totals = {
      totalMissing: missingProducts.length,
      totalOrders: new Set(missingProducts.map((p: any) => p.sale_order_id)).size,
      totalCustomers: new Set(missingProducts.map((p: any) => p.partner_id)).size,
    };

    return NextResponse.json({
      success: true,
      date: targetDate,
      totals,
      groupBy,
      data: groupedData,
      raw: missingProducts,
    });

  } catch (error: any) {
    console.error('💥 [MISSING-PRODUCTS] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * Ottiene i mancanti dal modello custom lapa.missing.product.line
 */
async function getMissingFromCustomModel(
  sessionId: string,
  targetDate: string,
  salespersonId?: string | null
): Promise<any[]> {
  const domain: any[] = [['date', '=', targetDate]];

  if (salespersonId) {
    domain.push(['salesperson_id', '=', parseInt(salespersonId)]);
  }

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/lapa.missing.product.line/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'lapa.missing.product.line',
        method: 'search_read',
        args: [],
        kwargs: {
          domain,
          fields: [
            'sale_order_id',
            'partner_id',
            'salesperson_id',
            'product_id',
            'product_default_code',
            'ordered_qty',
            'done_qty',
            'missing_qty',
            'qty_available',
            'incoming_qty',
            'expected_arrival_date',
            'action_taken',
          ],
          order: 'salesperson_id, partner_id, product_id',
        },
      },
      id: Date.now(),
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.data?.message || 'Errore lettura modello custom');
  }

  return data.result || [];
}

/**
 * Query diretta per ottenere i mancanti (fallback se modulo non installato)
 * Usa la stessa logica che abbiamo testato prima
 */
async function getMissingFromDirectQuery(
  sessionId: string,
  targetDate: string,
  salespersonId?: string | null
): Promise<any[]> {
  // 1. Trova ordini con consegna nella data target
  const orderDomain: any[] = [
    ['commitment_date', '>=', `${targetDate} 00:00:00`],
    ['commitment_date', '<=', `${targetDate} 23:59:59`],
    ['state', 'in', ['sale', 'done']],
  ];

  const ordersResponse = await makeOdooCall(sessionId, 'sale.order', 'search_read', [], {
    domain: orderDomain,
    fields: ['name', 'partner_id', 'user_id'],
  });

  if (!ordersResponse.success || !ordersResponse.result?.length) {
    return [];
  }

  const orders = ordersResponse.result;
  const orderNames = orders.map((o: any) => o.name);

  // 2. Trova i PICK associati agli ordini
  const pickingsResponse = await makeOdooCall(sessionId, 'stock.picking', 'search_read', [], {
    domain: [
      ['origin', 'in', orderNames],
      ['picking_type_id.name', 'ilike', 'Pick'],
    ],
    fields: ['id', 'name', 'origin', 'state'],
  });

  if (!pickingsResponse.success) {
    return [];
  }

  const pickings = pickingsResponse.result || [];
  const cancelledPickingIds = pickings
    .filter((p: any) => p.state === 'cancel')
    .map((p: any) => p.id);

  // 3. Trova i movimenti annullati nei PICK
  if (cancelledPickingIds.length === 0) {
    return [];
  }

  const movesResponse = await makeOdooCall(sessionId, 'stock.move', 'search_read', [], {
    domain: [
      ['picking_id', 'in', cancelledPickingIds],
      ['state', '=', 'cancel'],
      ['product_uom_qty', '>', 0],
    ],
    fields: ['product_id', 'product_uom_qty', 'picking_id', 'origin'],
  });

  if (!movesResponse.success) {
    return [];
  }

  const cancelledMoves = movesResponse.result || [];

  // 4. Costruisci la lista dei mancanti
  const missingProducts = cancelledMoves.map((move: any) => {
    // Trova l'ordine originale
    const pickingOrigin = pickings.find((p: any) => p.id === move.picking_id[0])?.origin;
    const order = orders.find((o: any) => o.name === pickingOrigin);

    return {
      id: move.id,
      sale_order_id: order ? [order.id, order.name] : false,
      partner_id: order?.partner_id || false,
      salesperson_id: order?.user_id || false,
      product_id: move.product_id,
      product_default_code: null, // Non disponibile in questo contesto
      ordered_qty: move.product_uom_qty,
      done_qty: 0,
      missing_qty: move.product_uom_qty,
      qty_available: 0, // Da calcolare separatamente
      incoming_qty: 0,
      expected_arrival_date: null,
      action_taken: 'none',
    };
  });

  // Filtra per venditore se richiesto
  if (salespersonId) {
    return missingProducts.filter(
      (p: any) => p.salesperson_id && p.salesperson_id[0] === parseInt(salespersonId)
    );
  }

  return missingProducts;
}

/**
 * Raggruppa i prodotti mancanti per il criterio specificato
 */
function groupMissingProducts(products: any[], groupBy: string): any {
  const grouped: any = {};

  for (const product of products) {
    let key: string;
    let keyData: any;

    switch (groupBy) {
      case 'salesperson':
        key = product.salesperson_id ? product.salesperson_id[0].toString() : 'none';
        keyData = {
          id: product.salesperson_id?.[0] || null,
          name: product.salesperson_id?.[1] || 'Nessun venditore',
        };
        break;
      case 'product':
        key = product.product_id[0].toString();
        keyData = {
          id: product.product_id[0],
          name: product.product_id[1],
        };
        break;
      case 'customer':
        key = product.partner_id ? product.partner_id[0].toString() : 'none';
        keyData = {
          id: product.partner_id?.[0] || null,
          name: product.partner_id?.[1] || 'Nessun cliente',
        };
        break;
      default:
        key = 'all';
        keyData = { name: 'Tutti' };
    }

    if (!grouped[key]) {
      grouped[key] = {
        ...keyData,
        items: [],
        totalMissing: 0,
      };
    }

    grouped[key].items.push(product);
    grouped[key].totalMissing += product.missing_qty || 0;
  }

  return Object.values(grouped);
}

/**
 * Helper per chiamate Odoo
 */
async function makeOdooCall(
  sessionId: string,
  model: string,
  method: string,
  args: any[],
  kwargs: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args, kwargs: kwargs || {} },
        id: Date.now(),
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.data?.message || 'Errore Odoo' };
    }

    return { success: true, result: data.result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
