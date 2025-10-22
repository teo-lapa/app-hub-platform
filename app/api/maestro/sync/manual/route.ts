/**
 * Manual Sync Endpoint - Protected with CRON_SECRET
 * Used by GitHub Actions nightly sync job
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllCustomers } from '@/lib/maestro/sync-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  // Verify CRON_SECRET header for security
  const cronSecret = request.headers.get('X-CRON-SECRET');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || cronSecret !== expectedSecret) {
    console.error('❌ [MANUAL SYNC] Unauthorized - Invalid CRON_SECRET');
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('\n🚀 [MANUAL SYNC] Starting manual sync...\n');

  try {
    const body = await request.json();
    const force = body.force || false;

    const result = await syncAllCustomers({
      fullSync: force,      // Full sync if force=true
      monthsBack: 6,        // 6 mesi
      batchSize: 20,
      dryRun: false
    });

    console.log('\n✅ [MANUAL SYNC] Completed successfully!\n');

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('\n❌ [MANUAL SYNC] Failed:', error.message);

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Keep GET for backward compatibility (local testing only)
export async function GET() {
  console.log('\n🚀 [MANUAL SYNC] Starting manual sync (GET - local testing)...\n');

  try {
    const result = await syncAllCustomers({
      fullSync: false,
      monthsBack: 6,
      batchSize: 20,
      dryRun: false
    });

    console.log('\n✅ [MANUAL SYNC] Completed successfully!\n');

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('\n❌ [MANUAL SYNC] Failed:', error.message);

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
