import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { injectLangContext } from '@/lib/odoo/user-lang';

/**
 * API per verificare se un prodotto esiste già in un'ubicazione
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { productId, locationId } = await request.json();

    if (!productId || !locationId) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    // 1. Controlla se il prodotto ha tracking attivo
    const productResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          args: [[productId], ['tracking']],
          kwargs: injectLangContext({})
        },
        id: 1.5
      })
    });

    const productData = await productResponse.json();
    const tracking = productData.result?.[0]?.tracking || 'none';
    const hasTracking = tracking === 'lot' || tracking === 'serial';

    console.log(`🔍 Check prodotto ${productId} in ubicazione ${locationId} - tracking: ${tracking}`);

    // 2. Se il prodotto NON ha tracking, permetti sempre il duplicato
    if (!hasTracking) {
      console.log('✅ Prodotto senza tracking - duplicato permesso');
      return NextResponse.json({
        success: true,
        exists: false, // Permetti sempre se non ha tracking
        hasTracking: false
      });
    }

    // 3. Se ha tracking, cerca quants del prodotto in questa ubicazione
    const quantResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          method: 'search_count',
          args: [[
            ['product_id', '=', productId],
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: injectLangContext({})
        },
        id: 2
      })
    });

    const quantData = await quantResponse.json();
    const count = quantData.result || 0;

    console.log(`${count > 0 ? '⚠️' : '✅'} Prodotto con tracking - ${count > 0 ? 'GIÀ presente' : 'non presente'} in ubicazione`);

    return NextResponse.json({
      success: true,
      exists: count > 0,
      count,
      hasTracking: true
    });

  } catch (error: any) {
    console.error('❌ Errore verifica prodotto:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella verifica'
    }, { status: 500 });
  }
}
