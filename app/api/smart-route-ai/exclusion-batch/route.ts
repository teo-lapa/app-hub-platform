import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const EXCLUSION_NAME = '🚫 FUORI ZONA';

/**
 * POST /api/smart-route-ai/exclusion-batch
 * Trova o crea il batch di esclusione per la data. I PICK trascinati qui dentro
 * vengono ignorati dall'ottimizzatore.
 * Body: { date: 'YYYY-MM-DD' }
 */
export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json();
    if (!date) {
      return NextResponse.json({ success: false, error: 'date richiesta' }, { status: 400 });
    }

    const sessionCookie = (await cookies()).get('odoo_session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Nessuna sessione Odoo' }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);
    if (!(await rpcClient.testConnection())) {
      throw new Error('Impossibile connettersi a Odoo');
    }

    const existing = await rpcClient.searchRead(
      'stock.picking.batch',
      [
        ['name', '=', EXCLUSION_NAME],
        ['scheduled_date', '>=', `${date} 00:00:00`],
        ['scheduled_date', '<=', `${date} 23:59:59`],
        ['state', 'in', ['draft', 'in_progress']],
      ],
      ['id', 'name'],
      1,
      'id'
    );

    if (existing.length > 0) {
      return NextResponse.json({ success: true, batchId: existing[0].id, created: false, name: EXCLUSION_NAME });
    }

    const id = await rpcClient.callKw(
      'stock.picking.batch',
      'create',
      [{ name: EXCLUSION_NAME, scheduled_date: `${date} 06:00:00` }]
    );

    return NextResponse.json({ success: true, batchId: Array.isArray(id) ? id[0] : id, created: true, name: EXCLUSION_NAME });

  } catch (error: any) {
    console.error('[Smart Route AI] Errore batch esclusione:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore batch esclusione' }, { status: 500 });
  }
}
