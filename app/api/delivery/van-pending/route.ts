import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { injectLangContext } from '@/lib/odoo/user-lang';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');
    if (!userCookies) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid || !cookies) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // Get real UID from JWT (same logic as delivery/list)
    let realUid = uid;
    const tokenMatch = userCookies.match(/token=([^;]+)/);
    if (tokenMatch) {
      try {
        const decoded = jwt.verify(tokenMatch[1], JWT_SECRET) as any;
        if (decoded.odooUserId) realUid = decoded.odooUserId;
      } catch {}
    }

    const uidNum = typeof realUid === 'string' ? parseInt(realUid) : realUid;

    // Get driver name
    let driverName = '';
    const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
      domain: [['user_id', '=', uidNum]],
      fields: ['id', 'name'],
      limit: 1
    });

    if (employees.length > 0) {
      driverName = employees[0].name;
    } else {
      const users = await callOdoo(cookies, 'res.users', 'read', [[uidNum]], {
        fields: ['name']
      });
      if (users.length > 0) driverName = users[0].name;
    }

    if (!driverName) {
      return NextResponse.json({ success: true, orders: [], count: 0 });
    }

    console.log(`🚛 [VAN-PENDING] Driver: ${driverName}`);

    // Find all OUT pickings in "assigned" state
    const pickingsResidui = await callOdoo(cookies, 'stock.picking', 'search_read', [], {
      domain: [
        ['picking_type_code', '=', 'outgoing'],
        ['state', '=', 'assigned']
      ],
      fields: ['id', 'name', 'partner_id', 'scheduled_date', 'origin', 'move_ids_without_package', 'batch_id', 'location_id'],
      order: 'scheduled_date desc'
    });

    const pickingsValidi = pickingsResidui.filter((p: any) => p.origin);
    console.log(`📦 [VAN-PENDING] ${pickingsValidi.length} picking residui trovati`);

    const BATCH_SIZE = 10;
    const ordini = [];

    for (let i = 0; i < pickingsValidi.length; i += BATCH_SIZE) {
      const batch = pickingsValidi.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (picking: any) => {
        const batchId = picking.batch_id ? picking.batch_id[0] : null;
        const locationName = picking.location_id ? picking.location_id[1] : null;

        // Get driver info for this picking
        const autista = await getAutista(cookies, picking.id, batchId, locationName);

        // Filter: only this driver's pickings
        if (!autista) return null;
        const driverFirstName = driverName.split(' ')[0].toLowerCase();
        const autistaLower = autista.toLowerCase();
        if (!autistaLower.includes(driverFirstName) && !driverFirstName.includes(autistaLower.split(' ')[0])) {
          return null;
        }

        // Get products still in van
        const prodotti = await getProdottiNelFurgone(cookies, picking.id);
        if (prodotti.length === 0) return null;

        // Check if OUT completato exists (scarico parziale precedente)
        const outCompletato = await trovaOutCompletato(cookies, picking.origin);
        if (!outCompletato) return null;

        // Check if return already created
        const returnCreated = await checkReturnCreated(cookies, picking.name);

        return {
          pickingId: picking.id,
          pickingName: picking.name,
          cliente: picking.partner_id ? picking.partner_id[1] : 'Sconosciuto',
          clienteId: picking.partner_id ? picking.partner_id[0] : 0,
          dataPrevisita: picking.scheduled_date,
          salesOrder: picking.origin,
          outCompletato: outCompletato.name,
          prodotti,
          autista,
          returnCreated
        };
      }));

      ordini.push(...results.filter(Boolean));
    }

    console.log(`✅ [VAN-PENDING] ${ordini.length} ordini pendenti per ${driverName}`);

    return NextResponse.json({
      success: true,
      orders: ordini,
      count: ordini.length,
      driverName
    });

  } catch (error: any) {
    console.error('❌ [VAN-PENDING] Errore:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getAutista(sessionId: string, pickingId: number, batchId: number | null, locationName: string | null): Promise<string | null> {
  if (batchId) {
    try {
      const batch = await callOdoo(sessionId, 'stock.picking.batch', 'read', [[batchId]], {
        fields: ['x_studio_autista_del_giro']
      });
      if (batch?.[0]?.x_studio_autista_del_giro) {
        return batch[0].x_studio_autista_del_giro[1];
      }
    } catch {}
  }

  if (locationName && locationName.includes('Furgon')) {
    const parts = locationName.split('/');
    if (parts.length >= 3) return parts[2];
  }

  return null;
}

async function getProdottiNelFurgone(sessionId: string, pickingId: number) {
  const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [], {
    domain: [
      ['picking_id', '=', pickingId],
      ['state', '!=', 'cancel']
    ],
    fields: ['product_id', 'quantity', 'qty_done', 'product_uom_id', 'lot_id']
  });

  return moveLines
    .filter((ml: any) => ml.qty_done === 0)
    .map((ml: any) => ({
      productId: ml.product_id[0],
      nome: ml.product_id[1],
      quantita: ml.quantity,
      uom: ml.product_uom_id?.[1] || 'Unit',
      lotId: ml.lot_id?.[0] || null,
      lotName: ml.lot_id?.[1] || null
    }));
}

async function trovaOutCompletato(sessionId: string, salesOrderName: string) {
  const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [], {
    domain: [
      ['origin', '=', salesOrderName],
      ['picking_type_code', '=', 'outgoing'],
      ['state', '=', 'done']
    ],
    fields: ['id', 'name', 'date_done'],
    order: 'date_done desc',
    limit: 1
  });
  return pickings.length > 0 ? pickings[0] : null;
}

async function checkReturnCreated(sessionId: string, pickingName: string) {
  try {
    const returns = await callOdoo(sessionId, 'stock.picking', 'search_read', [], {
      domain: [
        ['picking_type_code', '=', 'internal'],
        ['origin', 'ilike', `RESO_${pickingName}`]
      ],
      fields: ['id'],
      limit: 1
    });
    return returns.length > 0;
  } catch {
    return false;
  }
}
