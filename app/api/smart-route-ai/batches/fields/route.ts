import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/smart-route-ai/batches/fields
 * Get all available fields for stock.picking.batch model
 * This helps us understand which fields exist for vehicle/driver assignment
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'No Odoo session'
      }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    // Test connection
    const isConnected = await rpcClient.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Odoo');
    }

    // Get all fields for stock.picking.batch model
    const fields = await rpcClient.callKw(
      'stock.picking.batch',
      'fields_get',
      [],
      {
        attributes: ['string', 'type', 'relation', 'help']
      }
    );

    // Filter to only show fields related to vehicle, driver, user, employee
    const relevantFields: any = {};
    const keywords = ['vehicle', 'driver', 'user', 'employee', 'responsible', 'assigned'];

    for (const [fieldName, fieldInfo] of Object.entries(fields)) {
      const fieldStr = JSON.stringify(fieldInfo).toLowerCase();
      if (keywords.some(keyword => fieldStr.includes(keyword) || fieldName.toLowerCase().includes(keyword))) {
        relevantFields[fieldName] = fieldInfo;
      }
    }

    console.log('[Smart Route AI] Relevant fields found:', Object.keys(relevantFields));

    return NextResponse.json({
      success: true,
      allFieldsCount: Object.keys(fields).length,
      relevantFields,
      allFields: fields // Include all fields for complete reference
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Error fetching fields:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error fetching fields'
    }, { status: 500 });
  }
}
