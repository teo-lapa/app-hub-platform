import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { productId, locationId, quantId, quantity, lotId, lotNumber, lotName, expiryDate } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({ success: false, error: 'Parametri mancanti' });
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

      await callOdoo('stock.quant', 'write', [[quantId], {
        inventory_quantity: quantity,
        inventory_date: new Date().toISOString()
      }]);
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
      await callOdoo('stock.quant', 'write', [[quants[0].id], {
        inventory_quantity: quantity,
        inventory_date: new Date().toISOString()
      }]);
      return NextResponse.json({ success: true, message: 'Salvato' });
    } else {
      await callOdoo('stock.quant', 'create', [[{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity,
        inventory_date: new Date().toISOString()
      }]]);
      return NextResponse.json({ success: true, message: 'Creato' });
    }

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({ success: false, error: `${error.message}` });
  }
}
