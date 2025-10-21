/**
 * MAESTRO AI - Vehicle Stock Transfer History API Endpoint
 *
 * GET /api/maestro/vehicle-stock/history
 * Query transfer history for auditing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleStockService } from '@/lib/maestro/vehicle-stock-service';
import {
  getTransferHistoryQuerySchema,
  validateRequest
} from '@/lib/maestro/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/maestro/vehicle-stock/history
 *
 * Get transfer history for a salesperson's vehicle
 *
 * Query params:
 * - salesperson_id: number (required) - Odoo user ID of the salesperson
 * - limit: number (optional, default: 20, max: 100) - Number of records to return
 *
 * Returns:
 * {
 *   success: true,
 *   data: [
 *     {
 *       id: number,
 *       name: string,
 *       date: string (ISO timestamp),
 *       type: "reload" | "request_gift",
 *       state: string,
 *       products_count: number,
 *       total_quantity: number,
 *       notes?: string,
 *       origin?: string
 *     }
 *   ],
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  console.log('\n📜 [API] GET /api/maestro/vehicle-stock/history');

  try {
    // 1. Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      salesperson_id: searchParams.get('salesperson_id'),
      limit: searchParams.get('limit')
    };

    const validation = validateRequest(getTransferHistoryQuerySchema, queryParams);

    if (!validation.success) {
      console.warn('⚠️  [API] Validation failed:', validation.error);
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error
        }
      }, { status: 400 });
    }

    const { salesperson_id, limit } = validation.data;

    console.log(`   Salesperson ID: ${salesperson_id}`);
    console.log(`   Limit: ${limit}`);

    // 2. Get transfer history
    const vehicleStockService = getVehicleStockService();
    const history = await vehicleStockService.getTransferHistory(salesperson_id, limit);

    console.log(`✅ [API] Transfer history retrieved successfully`);
    console.log(`   Records: ${history.length}`);

    // 3. Return success response
    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching transfer history:', error);

    // Handle specific error types
    if (error.message?.includes('No vehicle location mapped')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_VEHICLE_MAPPING',
          message: 'No vehicle location mapped for this salesperson',
          details: error.message
        }
      }, { status: 404 });
    }

    // Odoo session errors
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ODOO_SESSION_ERROR',
          message: 'Odoo session error. Please re-authenticate.',
          details: error.message
        }
      }, { status: 401 });
    }

    // Generic error
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch transfer history',
        details: error.message
      }
    }, { status: 500 });
  }
}
