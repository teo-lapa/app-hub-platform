import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'ID ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('📦 Caricamento quants per ubicazione:', locationId);

    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // Verifica autenticazione utente (stesso pattern del Catalogo LAPA)
    const token = request.cookies.get('token')?.value;
    const odooSessionCookie = request.cookies.get('odoo_session')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Utente non autenticato. Effettua il login per accedere all\'inventario.',
        details: 'Token di sessione mancante'
      }, { status: 401 });
    }

    let odooUid = null;
    let odooSession = null;
    let userEmail = null;

    try {
      // Decodifica JWT per info utente
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded: any = jwt.verify(token, jwtSecret);

      odooUid = decoded.odooUid;
      userEmail = decoded.email;

      console.log(`🔐 Inventario - Utente: ${userEmail} (UID: ${odooUid})`);

      // Recupera sessione Odoo dai cookie
      if (odooSessionCookie) {
        odooSession = JSON.parse(odooSessionCookie);
        console.log('🍪 Sessione Odoo recuperata per inventario');
      }
    } catch (jwtError) {
      console.error('❌ Errore JWT inventario:', jwtError);
      return NextResponse.json({
        success: false,
        error: 'Sessione scaduta. Effettua nuovamente il login.',
        details: 'Token JWT non valido'
      }, { status: 401 });
    }

    // Carica quants usando la sessione Odoo esistente
    if (odooSession && odooUid) {
      console.log('✅ Caricamento quants con sessione Odoo esistente');

      try {
        const quantsResponse = await fetch(`${odooUrl}/web/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [
                odooDb,
                odooUid,
                odooSession.password,
                'stock.quant',
                'search_read',
                [
                  [
                    ['location_id', '=', locationId],
                    ['quantity', '>', 0]
                  ]
                ],
                {
                  fields: [
                    'id',
                    'product_id',
                    'quantity',
                    'lot_id',
                    'inventory_quantity',
                    'inventory_date',
                    'inventory_diff_quantity',
                    'user_id',
                    'package_id',
                    'product_uom_id',
                    'location_id'
                  ]
                }
              ]
            }
          })
        });

        const quantsData = await quantsResponse.json();

        if (quantsData && quantsData.result && Array.isArray(quantsData.result)) {
          console.log(`📋 Trovati ${quantsData.result.length} quants per ${userEmail}`);

          return NextResponse.json({
            success: true,
            data: quantsData.result,
            user: userEmail,
            location_id: locationId,
            method: 'existing_odoo_session'
          });
        } else {
          throw new Error(quantsData.error?.message || 'Errore nel caricamento quants');
        }

      } catch (sessionError) {
        console.error('❌ Errore caricamento quants:', sessionError);

        return NextResponse.json({
          success: false,
          error: 'Errore nel caricamento dell\'inventario.',
          details: sessionError.message
        }, { status: 500 });
      }
    }

    // Se non abbiamo la sessione Odoo
    return NextResponse.json({
      success: false,
      error: 'Sessione Odoo non disponibile. Effettua nuovamente il login.',
      details: 'Sessione Odoo mancante dai cookie'
    }, { status: 401 });

  } catch (error: any) {
    console.error('Errore caricamento quants:', error);

    // Gestione sessione scaduta
    if (error.message && error.message.includes('session')) {
      return NextResponse.json(
        { success: false, error: 'Odoo Session Expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}