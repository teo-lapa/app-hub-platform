import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/smart-route-ai/apply-batches
 * Distribuisce le consegne nei batch (giri) selezionati esistenti, mantenendone autista/auto.
 * Sposta ogni picking nel batch deciso dall'ottimizzatore (write batch_id).
 * Body: { assignments: [{ batchId: number, pickingIds: number[] }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { assignments } = await request.json();
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ success: false, error: 'assignments richiesti' }, { status: 400 });
    }

    const sessionCookie = (await cookies()).get('odoo_session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'Nessuna sessione Odoo' }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);
    if (!(await rpcClient.testConnection())) {
      throw new Error('Impossibile connettersi a Odoo');
    }

    let applied = 0;
    let movedPickings = 0;
    for (const a of assignments) {
      const batchId = a?.batchId;
      const ids = (a?.pickingIds || []).filter((x: any) => !!x);
      if (!batchId || ids.length === 0) continue;
      await rpcClient.callKw('stock.picking', 'write', [ids, { batch_id: batchId }]);
      applied++;
      movedPickings += ids.length;
    }

    return NextResponse.json({ success: true, applied, movedPickings });

  } catch (error: any) {
    console.error('[Smart Route AI] Errore apply-batches:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore apply-batches' }, { status: 500 });
  }
}
