import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';

// Import aggregate function (we'll call it internally)
import { GET as getAggregate } from '../aggregate/route';

/**
 * GET /api/controllo-prezzi/counts
 *
 * Ritorna i conteggi dei prodotti per ogni categoria di prezzo
 * Chiama aggregate API e mappa i risultati
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`🔢 [COUNTS-API] Fetching counts...`);

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    // Call aggregate API
    console.log(`🔄 [COUNTS-API] Calling aggregate API...`);
    const aggregateRequest = new NextRequest(
      new URL('/api/controllo-prezzi/aggregate', request.url),
      {
        headers: { cookie: cookieHeader || '' }
      }
    );

    const aggregateResponse = await getAggregate(aggregateRequest);
    const aggregateData = await aggregateResponse.json();

    if (!aggregateData.success) {
      throw new Error('Failed to fetch aggregate data');
    }

    const { stats } = aggregateData;

    // Map to expected format
    const counts = {
      byCategory: {
        below_critical: stats.sotto_pc || 0,
        critical_to_avg: stats.tra_pc_medio || 0,
        above_avg: stats.sopra_medio || 0,
        blocked: stats.richieste_blocco || 0,
        all: stats.total_products || 0
      }
    };

    console.log(`✅ [COUNTS-API] Counts:`, counts.byCategory);

    return NextResponse.json({
      success: true,
      counts,
      timestamp: aggregateData.timestamp
    });

  } catch (error: any) {
    console.error('❌ [COUNTS-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel caricamento dei conteggi'
      },
      { status: 500 }
    );
  }
}
