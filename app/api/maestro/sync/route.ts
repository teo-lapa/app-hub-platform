/**
 * MAESTRO AI - Sync API Endpoint
 *
 * POST /api/maestro/sync - Trigger sync from Odoo
 * GET /api/maestro/sync/status - Get sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncCustomersFromOdoo, getSyncStatus } from '@/lib/maestro/sync-odoo-v2';
import { syncAllCustomers } from '@/lib/maestro/sync-engine';

// Global sync state management
let syncInProgress = false;
let lastSyncResult: any = null;

/**
 * POST /api/maestro/sync
 *
 * Trigger Odoo → Postgres sync
 *
 * Query params:
 * - fullSync: true = sync tutti i 231 clienti attivi, false = solo ultimi 7 giorni (default: false)
 * - maxCustomers: limit number of customers (optional, for testing)
 * - monthsBack: how many months of data to sync (default: 4)
 * - dryRun: if true, simulate without writing to DB (default: false)
 * - batchSize: batch processing size (default: 20)
 * - useV2: true = usa vecchio engine, false = usa nuovo engine (default: false = nuovo)
 *
 * Authentication:
 * - Requires Bearer token matching CRON_SECRET env variable
 * - Used by Vercel Cron Jobs for automated daily sync
 */
export async function POST(request: NextRequest) {
  console.log('\n📡 [API] POST /api/maestro/sync - Sync request received');

  // Verify CRON_SECRET for production security
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('⚠️  [API] Unauthorized sync attempt - invalid CRON_SECRET');
    return NextResponse.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authorization token'
      }
    }, { status: 401 });
  }

  // Prevent concurrent syncs
  if (syncInProgress) {
    console.log('⚠️  [API] Sync already in progress, rejecting request');
    return NextResponse.json({
      success: false,
      error: {
        code: 'SYNC_IN_PROGRESS',
        message: 'A sync operation is already running. Please wait for it to complete.'
      }
    }, { status: 409 });
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const fullSync = searchParams.get('fullSync') === 'true';
    const maxCustomers = searchParams.get('maxCustomers');
    const monthsBack = searchParams.get('monthsBack');
    const dryRun = searchParams.get('dryRun') === 'true';
    const batchSize = searchParams.get('batchSize');
    const useV2 = searchParams.get('useV2') === 'true';

    const options = {
      fullSync,
      maxCustomers: maxCustomers ? parseInt(maxCustomers) : undefined,
      monthsBack: monthsBack ? parseInt(monthsBack) : 4,
      dryRun,
      batchSize: batchSize ? parseInt(batchSize) : 20
    };

    console.log('⚙️  [API] Sync options:', options);
    console.log(`   Engine: ${useV2 ? 'v2 (old)' : 'v3 (new batch engine)'}`);

    // Mark sync as in progress
    syncInProgress = true;

    // Execute sync (choose engine)
    let result: any;

    if (useV2) {
      // Use old engine (sync-odoo-v2.ts)
      result = await syncCustomersFromOdoo(options);
    } else {
      // Use new engine (sync-engine.ts) - DEFAULT
      result = await syncAllCustomers(options);
    }

    // Store result
    lastSyncResult = result;

    // Reset flag
    syncInProgress = false;

    if (result.success) {
      console.log('✅ [API] Sync completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Sync completed successfully',
        stats: {
          totalProcessed: result.totalProcessed || result.synced || 0,
          inserted: result.inserted || result.created || 0,
          updated: result.updated || 0,
          skipped: result.skipped || 0,
          errors: result.errors || (result.errorMessages?.length || 0)
        },
        duration: result.duration || result.duration_seconds + 's',
        timestamp: result.timestamp,
        errorMessages: result.errorMessages || [],
        data: result
      });
    } else {
      console.error('❌ [API] Sync failed with errors');

      return NextResponse.json({
        success: false,
        message: 'Sync completed with errors',
        stats: {
          totalProcessed: result.totalProcessed || result.synced || 0,
          inserted: result.inserted || result.created || 0,
          updated: result.updated || 0,
          skipped: result.skipped || 0,
          errors: result.errors || (result.errorMessages?.length || 0)
        },
        duration: result.duration || result.duration_seconds + 's',
        errorMessages: result.errorMessages || result.errors || [],
        data: result
      }, { status: 500 });
    }

  } catch (error: any) {
    syncInProgress = false;

    console.error('❌ [API] Sync failed:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        message: error.message || 'Sync operation failed',
        details: error.stack
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/maestro/sync/status
 *
 * Get current sync status and database statistics
 */
export async function GET(request: NextRequest) {
  console.log('📊 [API] GET /api/maestro/sync/status - Status request received');

  try {
    // Get database statistics
    const dbStats = await getSyncStatus();

    // Prepare response
    const status = {
      success: true,
      syncInProgress,
      lastSyncResult,
      database: {
        totalAvatars: dbStats.totalAvatars,
        activeAvatars: dbStats.activeAvatars,
        lastSyncTime: dbStats.lastSync,
        avgHealthScore: dbStats.avgHealthScore,
        highChurnRiskCount: dbStats.highChurnRiskCount
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ [API] Status retrieved successfully');
    console.log(`   - Total avatars: ${dbStats.totalAvatars}`);
    console.log(`   - Active avatars: ${dbStats.activeAvatars}`);
    console.log(`   - Avg health score: ${dbStats.avgHealthScore}`);
    console.log(`   - High churn risk: ${dbStats.highChurnRiskCount}`);

    return NextResponse.json(status);

  } catch (error: any) {
    console.error('❌ [API] Failed to get status:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'STATUS_FAILED',
        message: error.message || 'Failed to retrieve sync status'
      }
    }, { status: 500 });
  }
}

/**
 * DELETE /api/maestro/sync
 *
 * Cancel running sync (if possible) or clear sync state
 */
export async function DELETE(request: NextRequest) {
  console.log('🗑️  [API] DELETE /api/maestro/sync - Cancel/reset request received');

  if (!syncInProgress) {
    return NextResponse.json({
      success: true,
      message: 'No sync in progress to cancel'
    });
  }

  // Reset sync state
  syncInProgress = false;

  console.log('⚠️  [API] Sync state reset (note: running sync may still complete)');

  return NextResponse.json({
    success: true,
    message: 'Sync state reset. Note: if a sync was running, it may still complete in the background.'
  });
}
