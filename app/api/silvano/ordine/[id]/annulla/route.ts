import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EDITABLE_STATES = ['draft', 'sent'];

/**
 * POST /api/silvano/ordine/[id]/annulla
 * Annulla (action_cancel) un preventivo o un ordine confermato NON ancora
 * preparato/consegnato. Regola ricontrollata lato server (sicurezza):
 *  - draft/sent → sempre annullabile
 *  - sale → solo se nessun picking è 'assigned' o 'done'
 *  - done/cancel → mai
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [['id', '=', id]],
      fields: ['id', 'state', 'picking_ids'],
      limit: 1,
    });
    const o = orders?.[0];
    if (!o) return NextResponse.json({ success: false, error: 'Ordine non trovato' }, { status: 404 });

    let cancellable = EDITABLE_STATES.includes(o.state);
    if (o.state === 'sale') {
      const pickIds: number[] = o.picking_ids || [];
      if (pickIds.length) {
        const picks = await callOdooAsAdmin('stock.picking', 'search_read', [], {
          domain: [['id', 'in', pickIds]],
          fields: ['state'],
        });
        cancellable = !picks.some((p: any) => p.state === 'assigned' || p.state === 'done');
      } else {
        cancellable = true;
      }
    }

    if (!cancellable) {
      return NextResponse.json(
        { success: false, error: 'Non annullabile: ordine già preparato o consegnato.' },
        { status: 400 }
      );
    }

    await callOdooAsAdmin('sale.order', 'action_cancel', [[id]], {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id/annulla]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
