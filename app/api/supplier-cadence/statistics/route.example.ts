/**
 * API Route: Cadence Statistics
 *
 * Endpoint per statistiche dashboard cadenze
 *
 * GET /api/supplier-cadence/statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCadenceStatistics } from '@/lib/db/supplier-cadence-db';

export async function GET(req: NextRequest) {
  try {
    const stats = await getCadenceStatistics();

    return NextResponse.json({
      statistics: stats,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [API] Error in GET /api/supplier-cadence/statistics:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
