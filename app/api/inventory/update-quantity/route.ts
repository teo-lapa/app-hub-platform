import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantId, quantity, lotId, lotNumber, lotName, expiryDate } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Parametri mancanti' });
    }

    // Autenticazione Odoo
    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD },
        id: 1
      })
    });

    const authData = await authResponse.json();
    if (authData.error || !authData.result?.uid) {
      return NextResponse.json({ success: false, error: 'Autenticazione fallita' }, { status: 401 });
    }

    const setCookieHeader = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch?.[1];

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID non trovato' }, { status: 500 });
    }

    const actualLotName = lotName || lotNumber;

    // Helper per chiamate Odoo
    const callOdoo = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: { model, method, args, kwargs },
          id: Date.now()
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
      }
      return data.result;
    };

    // Aggiorna quant specifico
    if (quantId) {
      console.log(`🎯 Aggiornamento quant ${quantId}`);

      let actualLotId = lotId;
      if (actualLotName) {
        const existingLots = await callOdoo('stock.lot', 'search_read',
          [[['product_id', '=', productId], ['name', '=', actualLotName]]],
          { fields: ['id'], limit: 1 }
        );

        if (existingLots?.length > 0) {
          actualLotId = existingLots[0].id;
          if (expiryDate) {
            await callOdoo('stock.lot', 'write', [[actualLotId], { expiration_date: expiryDate }]);
          }
        } else {
          const lotData: any = { product_id: productId, name: actualLotName, company_id: 1 };
          if (expiryDate) lotData.expiration_date = expiryDate;
          const newLotIds = await callOdoo('stock.lot', 'create', [[lotData]]);
          actualLotId = newLotIds[0];
        }
      }

      await callOdoo('stock.quant', 'write', [[quantId], { inventory_quantity: quantity }]);
      console.log(`✅ Salvato`);

      return NextResponse.json({ success: true, message: 'Salvato con successo' });
    }

    // Logica per nuovi prodotti
    let actualLotId = lotId;
    if (!lotId && actualLotName && quantity > 0) {
      const existingLots = await callOdoo('stock.lot', 'search_read',
        [[['product_id', '=', productId], ['name', '=', actualLotName]]],
        { fields: ['id'], limit: 1 }
      );

      if (existingLots?.length > 0) {
        actualLotId = existingLots[0].id;
        if (expiryDate) {
          await callOdoo('stock.lot', 'write', [[actualLotId], { expiration_date: expiryDate }]);
        }
      } else {
        const lotData: any = { product_id: productId, name: actualLotName, company_id: 1 };
        if (expiryDate) lotData.expiration_date = expiryDate;
        const newLotIds = await callOdoo('stock.lot', 'create', [[lotData]]);
        actualLotId = newLotIds[0];
      }
    }

    const domain: any[] = [['product_id', '=', productId], ['location_id', '=', locationId]];
    if (actualLotId) {
      domain.push(['lot_id', '=', actualLotId]);
    } else {
      domain.push(['lot_id', '=', false]);
    }

    const quants = await callOdoo('stock.quant', 'search_read', [domain], { fields: ['id'], limit: 1 });

    if (quants?.length > 0) {
      await callOdoo('stock.quant', 'write', [[quants[0].id], { inventory_quantity: quantity }]);
      return NextResponse.json({ success: true, message: 'Salvato' });
    } else {
      await callOdoo('stock.quant', 'create', [[{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity
      }]]);
      return NextResponse.json({ success: true, message: 'Creato' });
    }

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({ success: false, error: `${error.message}` });
  }
}
