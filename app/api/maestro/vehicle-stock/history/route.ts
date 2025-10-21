/**
 * MAESTRO AI - Vehicle Stock Transfer History API Endpoint
 *
 * GET /api/maestro/vehicle-stock/history
 * Query transfer history for auditing
 *
 * AUTHENTICATION: Cookie-based Odoo session (same pattern as delivery app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleStockService } from '@/lib/maestro/vehicle-stock-service';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { ADMIN_USER_IDS } from '@/lib/maestro/vehicle-stock-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/maestro/vehicle-stock/history
 *
 * Get transfer history for the logged-in salesperson's vehicle
 *
 * Authentication: Extracts Odoo user from cookies (same as delivery app)
 * - Admin users can view other salespersons' history via ?salesperson_id query param
 * - Regular users only see their own history
 *
 * Query params (optional):
 * - salesperson_id: number - View another salesperson's history (admin only)
 * - limit: number (default: 20, max: 100) - Number of records to return
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
 *   count: number,
 *   salesperson: { id: number, name: string }
 * }
 */
export async function GET(request: NextRequest) {
  console.log('\n📜 [API] GET /api/maestro/vehicle-stock/history');

  try {
    // 1. Get user cookies (AUTHENTICATION)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      console.warn('⚠️  [API] No cookies provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Devi effettuare il login per accedere alla cronologia'
        }
      }, { status: 401 });
    }

    // 2. Get Odoo session and uid
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

    // 3. Check if user is admin
    const isAdmin = ADMIN_USER_IDS.includes(uidNum);

    // 4. Get target salesperson ID
    const searchParams = request.nextUrl.searchParams;
    const requestedSalespersonId = searchParams.get('salesperson_id');
    const limit = parseInt(searchParams.get('limit') || '20');

    let targetOdooUserId: number;
    let salespersonName: string;

    if (requestedSalespersonId && isAdmin) {
      // Admin viewing another salesperson's history
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

    } else if (requestedSalespersonId && !isAdmin) {
      // Non-admin trying to view someone else's history - FORBIDDEN
      console.warn(`⚠️  [API] Non-admin user ${uidNum} tried to access history of ${requestedSalespersonId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Non hai i permessi per visualizzare la cronologia di altri venditori'
        }
      }, { status: 403 });

    } else {
      // Regular user or admin viewing own history
      targetOdooUserId = uidNum;

      // Get salesperson name
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
    console.log(`   Limit: ${limit}`);

    // 5. Get transfer history
    const vehicleStockService = getVehicleStockService();
    const history = await vehicleStockService.getTransferHistory(targetOdooUserId, limit);

    console.log(`✅ [API] Transfer history retrieved successfully`);
    console.log(`   Records: ${history.length}`);

    // 6. Return success response with salesperson info
    return NextResponse.json({
      success: true,
      data: history,
      count: history.length,
      salesperson: {
        id: targetOdooUserId,
        name: salespersonName
      },
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
