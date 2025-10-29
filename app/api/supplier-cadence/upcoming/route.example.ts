/**
 * API Route: Upcoming Supplier Orders
 *
 * Endpoint per prossimi ordini pianificati (range date)
 *
 * GET /api/supplier-cadence/upcoming?days=7
 * GET /api/supplier-cadence/upcoming?start_date=2025-10-29&end_date=2025-11-05
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSuppliersToOrderInRange } from '@/lib/db/supplier-cadence-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    let startDate: string;
    let endDate: string;

    // Option 1: days parameter (es: ?days=7 per prossimi 7 giorni)
    const daysParam = searchParams.get('days');
    if (daysParam) {
      const days = parseInt(daysParam);
      startDate = new Date().toISOString().split('T')[0];
      const end = new Date();
      end.setDate(end.getDate() + days);
      endDate = end.toISOString().split('T')[0];
    }
    // Option 2: explicit start_date e end_date
    else {
      startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
      const defaultEnd = new Date();
      defaultEnd.setDate(defaultEnd.getDate() + 30); // Default: prossimi 30 giorni
      endDate = searchParams.get('end_date') || defaultEnd.toISOString().split('T')[0];
    }

    const suppliers = await getSuppliersToOrderInRange(startDate, endDate);

    return NextResponse.json({
      suppliers,
      total: suppliers.length,
      start_date: startDate,
      end_date: endDate,
    });
  } catch (error: any) {
    console.error('❌ [API] Error in GET /api/supplier-cadence/upcoming:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
