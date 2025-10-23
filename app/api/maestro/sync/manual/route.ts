import { NextRequest, NextResponse } from 'next/server';
import { syncCustomersFromOdoo, getSyncStatus } from '@/lib/maestro/sync-odoo-v2';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti per sync completo

/**
 * POST /api/maestro/sync/manual
 * 
 * Endpoint per triggerare manualmente la sincronizzazione
 * Odoo → Maestro AI Database
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔄 [MAESTRO SYNC] Sync manuale iniziata...');

    // Parse request body (opzionale)
    let options = {
      maxCustomers: undefined as number | undefined,
      monthsBack: 4,
      dryRun: false
    };

    try {
      const body = await request.json();
      options = {
        maxCustomers: body.maxCustomers,
        monthsBack: body.monthsBack || 4,
        dryRun: body.dryRun || false
      };
    } catch {
      // Body opzionale, usiamo defaults
    }

    console.log('📋 [MAESTRO SYNC] Opzioni sync:', options);

    // STEP 1: Get status prima del sync
    const statusBefore = await getSyncStatus();
    console.log('📊 [MAESTRO SYNC] Status prima:', {
      totalAvatars: statusBefore.totalAvatars,
      activeAvatars: statusBefore.activeAvatars,
      lastSync: statusBefore.lastSync
    });

    // STEP 2: Esegui sync
    const syncResult = await syncCustomersFromOdoo(options);

    console.log('✅ [MAESTRO SYNC] Sync completata:', syncResult);

    // STEP 3: Get status dopo il sync
    const statusAfter = await getSyncStatus();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: true,
      message: options.dryRun
        ? 'Dry run completato con successo'
        : 'Sincronizzazione completata con successo',
      sync: {
        ...syncResult,
        duration_seconds: parseFloat(duration)
      },
      before: {
        totalAvatars: statusBefore.totalAvatars,
        activeAvatars: statusBefore.activeAvatars,
        lastSync: statusBefore.lastSync
      },
      after: {
        totalAvatars: statusAfter.totalAvatars,
        activeAvatars: statusAfter.activeAvatars,
        lastSync: statusAfter.lastSync
      }
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO SYNC] Errore:', error);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la sincronizzazione',
      duration_seconds: parseFloat(duration)
    }, { status: 500 });
  }
}

/**
 * GET /api/maestro/sync/manual
 * 
 * Ottiene lo status corrente del database senza eseguire sync
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 [MAESTRO SYNC] Richiesta status database...');

    const status = await getSyncStatus();

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO SYNC] Errore get status:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante recupero status'
    }, { status: 500 });
  }
}
