import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

/**
 * API per eseguire azioni sui prodotti mancanti
 *
 * POST /api/missing-products/action
 *
 * Body:
 * - action: 'contact' | 'order' | 'alternative'
 * - lineId: ID della riga mancante (se esiste nel modulo custom)
 * - productId: ID del prodotto
 * - partnerId: ID del cliente (per contact/alternative)
 * - orderId: ID dell'ordine (per contact)
 * - quantity: quantità da ordinare (per order)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, lineId, productId, partnerId, orderId, quantity } = body;

    // Ottieni session
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'contact':
        return await handleContact(sessionId, lineId, partnerId, orderId, productId);

      case 'order':
        return await handleOrder(sessionId, lineId, productId, quantity);

      case 'alternative':
        return await handleAlternative(sessionId, lineId, productId, partnerId);

      default:
        return NextResponse.json(
          { success: false, error: 'Azione non valida' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('💥 [MISSING-PRODUCTS-ACTION] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * Gestisce l'azione "Contatta Cliente"
 * - Segna la riga come "contattato" nel modulo custom
 * - Aggiunge una nota all'ordine
 */
async function handleContact(
  sessionId: string,
  lineId: number,
  partnerId: number,
  orderId: number,
  productId: number
): Promise<NextResponse> {
  try {
    // 1. Aggiorna lo stato nel modulo custom (se esiste)
    if (lineId) {
      await makeOdooCall(sessionId, 'lapa.missing.product.line', 'write', [[lineId], {
        action_taken: 'contacted',
        action_notes: `Cliente contattato via Hub il ${new Date().toLocaleDateString('it-IT')}`,
      }]);
    }

    // 2. Aggiungi un messaggio/nota all'ordine di vendita
    if (orderId) {
      // Ottieni info prodotto
      const productResult = await makeOdooCall(sessionId, 'product.product', 'read', [[productId], ['name', 'default_code']]);
      const productInfo = productResult.success && productResult.result?.[0]
        ? `${productResult.result[0].default_code || ''} - ${productResult.result[0].name}`
        : `Prodotto ID ${productId}`;

      await makeOdooCall(sessionId, 'sale.order', 'message_post', [[orderId]], {
        body: `<p><strong>📞 Cliente contattato per prodotto mancante:</strong></p><p>${productInfo}</p><p><em>Contattato via Hub LAPA il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}</em></p>`,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente segnato come contattato',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel contatto cliente',
    });
  }
}

/**
 * Gestisce l'azione "Ordina al Fornitore"
 * - Crea un ordine di acquisto per il prodotto
 */
async function handleOrder(
  sessionId: string,
  lineId: number,
  productId: number,
  quantity: number
): Promise<NextResponse> {
  try {
    // 1. Trova il fornitore principale del prodotto
    const supplierResult = await makeOdooCall(sessionId, 'product.supplierinfo', 'search_read', [], {
      domain: [['product_tmpl_id.product_variant_id', '=', productId]],
      fields: ['partner_id', 'price', 'min_qty'],
      limit: 1,
      order: 'sequence asc',
    });

    let supplierId: number;
    let price = 0;

    if (supplierResult.success && supplierResult.result?.length > 0) {
      supplierId = supplierResult.result[0].partner_id[0];
      price = supplierResult.result[0].price || 0;
    } else {
      // Fallback: cerca fornitore generico o restituisci errore
      return NextResponse.json({
        success: false,
        error: 'Nessun fornitore configurato per questo prodotto',
      });
    }

    // 2. Crea l'ordine di acquisto
    const poResult = await makeOdooCall(sessionId, 'purchase.order', 'create', [{
      partner_id: supplierId,
      origin: 'Hub LAPA - Prodotto Mancante',
    }]);

    if (!poResult.success || !poResult.result) {
      throw new Error('Errore nella creazione dell\'ordine di acquisto');
    }

    const purchaseOrderId = poResult.result;

    // 3. Aggiungi la riga con il prodotto
    await makeOdooCall(sessionId, 'purchase.order.line', 'create', [{
      order_id: purchaseOrderId,
      product_id: productId,
      product_qty: quantity,
      price_unit: price,
    }]);

    // 4. Aggiorna lo stato nel modulo custom (se esiste)
    if (lineId) {
      await makeOdooCall(sessionId, 'lapa.missing.product.line', 'write', [[lineId], {
        action_taken: 'ordered',
        action_notes: `Ordine acquisto creato: PO-${purchaseOrderId}`,
      }]);
    }

    return NextResponse.json({
      success: true,
      message: 'Ordine di acquisto creato',
      purchaseOrderId,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella creazione dell\'ordine',
    });
  }
}

/**
 * Gestisce l'azione "Proponi Alternativa"
 * - Cerca prodotti simili nella stessa categoria
 * - Restituisce una lista di alternative
 */
async function handleAlternative(
  sessionId: string,
  lineId: number,
  productId: number,
  partnerId: number
): Promise<NextResponse> {
  try {
    // 1. Ottieni info del prodotto originale
    const productResult = await makeOdooCall(sessionId, 'product.product', 'read', [[productId], ['name', 'categ_id', 'list_price']]);

    if (!productResult.success || !productResult.result?.length) {
      throw new Error('Prodotto non trovato');
    }

    const product = productResult.result[0];
    const categoryId = product.categ_id?.[0];

    if (!categoryId) {
      return NextResponse.json({
        success: true,
        alternatives: [],
        message: 'Prodotto senza categoria',
      });
    }

    // 2. Cerca prodotti alternativi nella stessa categoria con giacenza > 0
    const alternativesResult = await makeOdooCall(sessionId, 'product.product', 'search_read', [], {
      domain: [
        ['categ_id', '=', categoryId],
        ['id', '!=', productId],
        ['qty_available', '>', 0],
        ['type', '=', 'product'],
      ],
      fields: ['name', 'default_code', 'list_price', 'qty_available'],
      limit: 5,
      order: 'qty_available desc',
    });

    const alternatives = alternativesResult.success ? alternativesResult.result || [] : [];

    // 3. Aggiorna lo stato nel modulo custom (se esiste)
    if (lineId) {
      await makeOdooCall(sessionId, 'lapa.missing.product.line', 'write', [[lineId], {
        action_taken: 'alternative',
        action_notes: `Alternative proposte: ${alternatives.length} prodotti trovati`,
      }]);
    }

    return NextResponse.json({
      success: true,
      alternatives: alternatives.map((alt: any) => ({
        id: alt.id,
        name: alt.name,
        code: alt.default_code,
        price: alt.list_price,
        qty_available: alt.qty_available,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella ricerca alternative',
    });
  }
}

/**
 * Helper per chiamate Odoo
 */
async function makeOdooCall(
  sessionId: string,
  model: string,
  method: string,
  args: any[],
  kwargs?: any
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
