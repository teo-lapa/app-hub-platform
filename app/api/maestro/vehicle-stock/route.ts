/**
 * MAESTRO AI - Vehicle Stock API Endpoint
 *
 * GET /api/maestro/vehicle-stock
 * Query stock in salesperson's vehicle
 *
 * AUTHENTICATION: Uses cookie-based Odoo session (same pattern as delivery app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleStockService } from '@/lib/maestro/vehicle-stock-service';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { ADMIN_USER_IDS } from '@/lib/maestro/vehicle-stock-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/maestro/vehicle-stock
 *
 * Get vehicle stock for the logged-in salesperson
 *
 * Authentication: Extracts Odoo user from cookies (same as delivery app)
 * - Gets odoo_session from cookies
 * - Extracts uid from Odoo session
 * - Finds hr.employee linked to user_id
 * - Fallback to res.users if no employee found
 * - Admin users can see all vehicles via ?salesperson_id query param
 *
 * Query params (optional, admin only):
 * - salesperson_id: number - View another salesperson's vehicle (admin only)
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     location: {
 *       id: number,
 *       name: string,
 *       complete_name: string,
 *       barcode?: string
 *     },
 *     products: [...],
 *     total_products: number,
 *     total_items: number,
 *     last_updated: string (ISO timestamp),
 *     salesperson: {
 *       id: number,
 *       name: string
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  console.log('\n🚗 [API] GET /api/maestro/vehicle-stock');

  try {
    // 1. Get user cookies (SAME AS DELIVERY APP)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      console.warn('⚠️  [API] No cookies provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Devi effettuare il login sulla piattaforma prima di accedere al tuo magazzino'
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

    // 3. Check if user is admin (can view other salespersons' vehicles)
    const isAdmin = ADMIN_USER_IDS.includes(uidNum);

    // 4. Get target salesperson ID (either from query param if admin, or current user)
    const searchParams = request.nextUrl.searchParams;
    const requestedSalespersonId = searchParams.get('salesperson_id');

    let targetOdooUserId: number;
    let salespersonName: string;

    if (requestedSalespersonId && isAdmin) {
      // Admin viewing another salesperson's vehicle
      targetOdooUserId = parseInt(requestedSalespersonId);
      console.log(`   Admin viewing salesperson: ${targetOdooUserId}`);

      // Get salesperson name
      const users = await callOdoo(
        cookies,
        'res.users',
        'read',
        [[targetOdooUserId]],
        { fields: ['name'] }
      );
      salespersonName = users[0]?.name || 'Unknown';

    } else {
      // Regular user or admin viewing own vehicle
      targetOdooUserId = uidNum;

      // Try to find hr.employee linked to this user (SAME AS DELIVERY APP)
      const employees = await callOdoo(
        cookies,
        'hr.employee',
        'search_read',
        [],
        {
          domain: [['user_id', '=', uidNum]],
          fields: ['id', 'name'],
          limit: 1
        }
      );

      if (employees.length === 0) {
        // Fallback: use res.users if no hr.employee found (SAME AS DELIVERY APP)
        console.log(`   No hr.employee found for uid ${uidNum}, using res.users`);
        const users = await callOdoo(
          cookies,
          'res.users',
          'read',
          [[uidNum]],
          { fields: ['name'] }
        );
        salespersonName = users[0]?.name || 'Unknown';
      } else {
        salespersonName = employees[0].name;
      }
    }

    console.log(`   Target Odoo User ID: ${targetOdooUserId}`);
    console.log(`   Salesperson Name: ${salespersonName}`);

    // 5. Get vehicle stock
    const vehicleStockService = getVehicleStockService();
    const stock = await vehicleStockService.getVehicleStock(targetOdooUserId);

    console.log(`✅ [API] Vehicle stock retrieved successfully`);
    console.log(`   Location: ${stock.location.name}`);
    console.log(`   Products: ${stock.total_products}`);
    console.log(`   Total items: ${stock.total_items}`);

    // 6. Return success response with salesperson info
    return NextResponse.json({
      success: true,
      data: {
        ...stock,
        salesperson: {
          id: targetOdooUserId,
          name: salespersonName
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [API] Error fetching vehicle stock:', error);

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
          message: 'Vehicle location not found in Odoo',
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
        message: 'Failed to fetch vehicle stock',
        details: error.message
      }
    }, { status: 500 });
  }
}
