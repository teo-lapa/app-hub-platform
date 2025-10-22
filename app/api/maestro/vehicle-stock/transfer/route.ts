/**
 * MAESTRO AI - Vehicle Stock Transfer API Endpoint
 *
 * POST /api/maestro/vehicle-stock/transfer
 * Create stock transfer (reload or gift request)
 *
 * AUTHENTICATION: Uses cookie-based Odoo session (same pattern as delivery app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleStockService } from '@/lib/maestro/vehicle-stock-service';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { ADMIN_USER_IDS } from '@/lib/maestro/vehicle-stock-service';
import {
  createTransferSchema,
  validateRequest
} from '@/lib/maestro/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/maestro/vehicle-stock/transfer
 *
 * Create a stock transfer for the logged-in salesperson's vehicle
 *
 * Authentication: Extracts Odoo user from cookies (same as delivery app)
 * - Gets odoo_session from cookies
 * - Extracts uid from Odoo session
 * - Uses that uid as salesperson_id for the transfer
 *
 * Request body:
 * {
 *   products: [
 *     {
 *       product_id: number,
 *       quantity: number,
 *       lot_id?: number
 *     }
 *   ],
 *   type: "reload" | "request_gift",
 *   notes?: string
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     transfer_id: number,
 *     picking_id: number,
 *     state: string,
 *     move_ids: number[]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  console.log('\n📤 [API] POST /api/maestro/vehicle-stock/transfer');

  try {
    // 1. Get user cookies (SAME AS DELIVERY APP)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      console.warn('⚠️  [API] No cookies provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Devi effettuare il login sulla piattaforma'
        }
      }, { status: 401 });
    }

    // 2. Get Odoo session and uid (SAME AS DELIVERY APP)
    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid || !cookies) {
      console.warn('⚠️  [API] Invalid Odoo session');
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Sessione non valida. Effettua nuovamente il login.'
        }
      }, { status: 401 });
    }

    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;
    console.log(`   Odoo UID: ${uidNum}`);

    // 3. Check if user is admin (can transfer for other salespersons)
    const isAdmin = ADMIN_USER_IDS.includes(uidNum);

    // 4. Parse and validate request body
    const body = await request.json();

    const validation = validateRequest(createTransferSchema, body);

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

    const validatedData = validation.data;

    // 5. Determine target salesperson ID
    // Admin can specify salesperson_id via query param OR use their own ID
    const searchParams = request.nextUrl.searchParams;
    const requestedSalespersonId = searchParams.get('salesperson_id');

    let targetSalespersonId: number;
    if (requestedSalespersonId && isAdmin) {
      targetSalespersonId = parseInt(requestedSalespersonId);
      console.log(`   Admin creating transfer for salesperson: ${targetSalespersonId}`);
    } else {
      targetSalespersonId = uidNum;
      console.log(`   Regular user creating transfer for self: ${targetSalespersonId}`);
    }

    // 6. Build TransferRequest with target salesperson ID
    const transferRequest: import('@/lib/maestro/vehicle-stock-service').TransferRequest = {
      salesperson_id: targetSalespersonId,
      products: validatedData.products,
      type: validatedData.type,
      notes: validatedData.notes
    };

    console.log(`   Target Salesperson ID: ${transferRequest.salesperson_id}`);
    console.log(`   Transfer type: ${transferRequest.type}`);
    console.log(`   Products count: ${transferRequest.products.length}`);

    // 7. Create transfer
    const vehicleStockService = getVehicleStockService();
    const result = await vehicleStockService.createTransfer(transferRequest);

    console.log(`✅ [API] Transfer created successfully`);
    console.log(`   Picking ID: ${result.picking_id}`);
    console.log(`   State: ${result.state}`);
    console.log(`   Moves: ${result.move_ids.length}`);

    // 3. Return success response
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [API] Error creating transfer:', error);

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

    if (error.message?.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Required location not found in Odoo',
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

    // Product validation errors
    if (error.message?.includes('product') || error.message?.includes('Product')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PRODUCT_ERROR',
          message: 'Invalid product data',
          details: error.message
        }
      }, { status: 400 });
    }

    // Generic error
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create transfer',
        details: error.message
      }
    }, { status: 500 });
  }
}
