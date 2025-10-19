/**
 * Manual Sync Endpoint - For local testing
 * NO CRON_SECRET required - for development only
 */

import { NextResponse } from 'next/server';
import { syncAllCustomers } from '@/lib/maestro/sync-engine';

export const dynamic = 'force-dynamic'; // This is a dynamic route
export const maxDuration = 300; // 5 minutes timeout

export async function GET() {
  console.log('\n🚀 [MANUAL SYNC] Starting manual sync...\n');

  try {
    const result = await syncAllCustomers({
      fullSync: false,      // Incrementale
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
