import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * SIMPLIFIED VERSION - Dashboard Details API
 * Returns mock data for testing
 */
export async function GET(request: NextRequest) {
  console.log('📋 [DASHBOARD-DETAILS-API] Request received');

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    console.log('Type:', type);

    // Mock data responses
    const mockData: Record<string, any> = {
      orders: {
        orders: [
          {
            id: 1,
            name: 'SO001',
            date_order: '2025-10-15',
            amount_total: 150.50,
            state: 'sale',
            state_label: 'Confermato'
          }
        ]
      },
      revenue: {
        monthly_revenue: [
          { month: '2025-01', month_name: 'Gennaio', revenue: 5000 },
          { month: '2025-02', month_name: 'Febbraio', revenue: 6500 }
        ],
        previous_year_total: 50000
      },
      avg: {
        avg_comparison: {
          current_avg: 1500,
          historical_avg: 1200,
          percentage_diff: 25
        },
        recent_orders_for_avg: []
      },
      credit: {
        credit_info: {
          total_limit: 10000,
          used_credit: 2000,
          available_credit: 8000,
          usage_percentage: 20
        }
      },
      overdue: {
        invoices: [],
        all_recent_invoices: []
      }
    };

    const data = mockData[type || 'orders'] || mockData.orders;

    console.log('✅ [DASHBOARD-DETAILS-API] Returning mock data');

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('❌ [DASHBOARD-DETAILS-API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch details'
    }, { status: 500 });
  }
}
