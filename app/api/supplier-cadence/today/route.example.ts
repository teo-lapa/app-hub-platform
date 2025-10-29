/**
 * API Route: Suppliers To Order Today
 *
 * Endpoint ottimizzato per dashboard "Ordini da Fare Oggi"
 *
 * GET /api/supplier-cadence/today
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSuppliersToOrderToday } from '@/lib/db/supplier-cadence-db';

export async function GET(req: NextRequest) {
  try {
    const suppliers = await getSuppliersToOrderToday();

    return NextResponse.json({
      suppliers,
      total: suppliers.length,
      date: new Date().toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('❌ [API] Error in GET /api/supplier-cadence/today:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
