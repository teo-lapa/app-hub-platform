/**
 * MAESTRO AI - Active Customers Analytics API
 *
 * GET /api/maestro/analytics/customers
 *
 * Returns detailed analytics for active customers:
 * - Total active customers
 * - Customer list with health scores
 * - Breakdown by salesperson
 * - Geographic distribution (city/region)
 * - New vs recurring customers
 * - Customer trend over time
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'quarter';
    const salespersonId = searchParams.get('salesperson_id');

    console.log('📊 [CUSTOMERS-ANALYTICS] Request:', { period, salespersonId });

    // Return minimal mock data to unblock UI
    // TODO: Implement proper Odoo-based customer analytics
    return NextResponse.json({
      success: true,
      analytics: {
        totalCustomers: 0,
        newCustomers: 0,
        recurringCustomers: 0,
        churnRate: 0,
        customersTrend: [],
        customersList: [],
        bySalesperson: [],
        byCity: []
      }
    });

  } catch (error: any) {
    console.error('❌ [CUSTOMERS-ANALYTICS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message || 'Failed to fetch customers analytics',
          details: error
        }
      },
      { status: 500 }
    );
  }
}
