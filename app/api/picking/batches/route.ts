import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export async function GET(request: NextRequest) {
  try {
    console.log('🚛 [API] Recupero batch REALI da Odoo via RPC...');

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session');

    if (!sessionCookie?.value) {
      console.log('⚠️ Nessuna sessione Odoo, uso dati di esempio');

      // Dati di esempio quando non c'è sessione
      const exampleBatches = [
        {
          id: 1,
          name: 'BATCH/2025/001 - GIRO ZURIGO',
          state: 'in_progress',
          picking_count: 5,
          product_count: 15,
          scheduled_date: '2025-09-28T08:00:00',
          user_id: [1, 'Operatore'],
          driver_id: [2, 'Mario Rossi'],
          vehicle: null
        },
        {
          id: 2,
          name: 'BATCH/2025/002 - GIRO TICINO',
          state: 'draft',
          picking_count: 3,
          product_count: 8,
          scheduled_date: '2025-09-29T07:00:00',
          user_id: [1, 'Operatore'],
          driver_id: [3, 'Luigi Bianchi'],
          vehicle: null
        }
      ];

      return NextResponse.json({
        batches: exampleBatches,
        count: 2,
        source: 'example-no-session'
      });
    }

    const sessionData = JSON.parse(sessionCookie.value);

    // Crea client RPC con session ID
    const rpcClient = createOdooRPCClient(sessionData.sessionId);

    // Test connessione
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Impossibile connettersi a Odoo');
    }

    // Recupera batch REALI tramite RPC (come fa l'HTML)
    const batches = await rpcClient.getBatches();

    console.log(`✅ Recuperati ${batches.length} batch REALI da Odoo via RPC`);

    // Trasforma nel formato atteso dal frontend
    const formattedBatches = batches.map((batch: any) => ({
      id: batch.id,
      name: batch.name,
      state: batch.state,
      picking_count: batch.picking_ids?.length || 0,
      product_count: batch.move_line_ids?.length || 0,
      scheduled_date: batch.scheduled_date,
      user_id: batch.user_id || null,
      driver_id: batch.x_studio_autista_del_giro || batch.user_id || null,
      vehicle: batch.x_studio_auto_del_giro || null
    }));

    return NextResponse.json({
      batches: formattedBatches,
      count: formattedBatches.length,
      source: 'odoo-rpc-live'
    });

  } catch (error: any) {
    console.error('❌ Errore API RPC Odoo:', error);

    // Se la sessione non è valida, ritorna 401
    if (error.message?.includes('Session') || error.message?.includes('401')) {
      return NextResponse.json(
        { error: 'Sessione scaduta - effettua nuovamente il login' },
        { status: 401 }
      );
    }

    // Altrimenti ritorna errore generico
    return NextResponse.json(
      {
        error: 'Errore nel recupero dei batch',
        details: error.message,
        batches: [],
        count: 0
      },
      { status: 500 }
    );
  }
}