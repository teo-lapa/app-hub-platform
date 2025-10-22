/**
 * MAESTRO AI - Vehicle Stock API Endpoint
 *
 * GET /api/maestro/vehicle-stock
 * Query stock in salesperson's vehicle
 *
 * AUTHENTICATION: Uses cookie-based Odoo session (same pattern as delivery app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleLocationId, ADMIN_USER_IDS, getAllVendorIds } from '@/lib/maestro/vehicle-stock-service';
import { getOdooSessionId, callOdoo as callOdooHelper } from '@/lib/odoo/odoo-helper';

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
    // 1. Get Odoo session_id (SAME AS UBICAZIONI APP)
    const sessionId = await getOdooSessionId();

    if (!sessionId) {
      console.warn('⚠️  [API] No valid session_id');
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Sessione non valida. Effettua il login.'
        }
      }, { status: 401 });
    }

    console.log(`✅ Session ID ottenuto`);

    // 2. Get current user UID from session
    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    const sessionInfoResponse = await fetch(`${odooUrl}/web/session/get_session_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      })
    });

    const sessionInfoData = await sessionInfoResponse.json();
    const uidNum = sessionInfoData.result?.uid;

    if (!uidNum) {
      console.warn('⚠️  [API] Cannot get UID from session');
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Sessione non valida. Effettua nuovamente il login.'
        }
      }, { status: 401 });
    }

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
      const usersResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.users',
            method: 'read',
            args: [[targetOdooUserId]],
            kwargs: { fields: ['name'] }
          }
        })
      });
      const usersData = await usersResponse.json();
      salespersonName = usersData.result?.[0]?.name || 'Unknown';

    } else {
      // Regular user or admin viewing own vehicle
      targetOdooUserId = uidNum;

      // Try to find hr.employee linked to this user
      const employeesResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'hr.employee',
            method: 'search_read',
            args: [[['user_id', '=', uidNum]]],
            kwargs: { fields: ['id', 'name'], limit: 1 }
          }
        })
      });
      const employeesData = await employeesResponse.json();
      const employees = employeesData.result || [];

      if (employees.length === 0) {
        // Fallback: use res.users if no hr.employee found
        console.log(`   No hr.employee found for uid ${uidNum}, using res.users`);
        const usersResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'res.users',
              method: 'read',
              args: [[uidNum]],
              kwargs: { fields: ['name'] }
            }
          })
        });
        const usersData = await usersResponse.json();
        salespersonName = usersData.result?.[0]?.name || 'Unknown';
      } else {
        salespersonName = employees[0].name;
      }
    }

    console.log(`   Target Odoo User ID: ${targetOdooUserId}`);
    console.log(`   Salesperson Name: ${salespersonName}`);
    console.log(`   Is Admin: ${isAdmin}`);

    // 5. Check if user has a vehicle location mapped
    const hasVehicleLocation = getVehicleLocationId(targetOdooUserId) !== null;
    console.log(`   Has Vehicle Location: ${hasVehicleLocation}`);

    if (!hasVehicleLocation && !isAdmin) {
      // Non-admin without vehicle location
      console.warn(`⚠️  User ${targetOdooUserId} has no vehicle location mapped`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_VEHICLE_LOCATION',
          message: 'Non hai una ubicazione veicolo assegnata. Contatta l\'amministratore.'
        }
      }, { status: 404 });
    }

    if (!hasVehicleLocation && isAdmin) {
      // Admin without vehicle location - return list of available vendors
      console.log('   Admin without personal vehicle - returning vendor list');
      const vendorIds = getAllVendorIds();

      return NextResponse.json({
        success: true,
        data: {
          isAdmin: true,
          hasOwnVehicle: false,
          availableVendors: vendorIds,
          message: 'Seleziona un venditore per visualizzare il suo veicolo',
          products: [],
          total_products: 0,
          total_items: 0
        },
        salesperson: {
          id: targetOdooUserId,
          name: salespersonName
        },
        timestamp: new Date().toISOString()
      });
    }

    // 6. Get vehicle location ID
    const locationId = getVehicleLocationId(targetOdooUserId);

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_VEHICLE_LOCATION',
          message: `No vehicle location mapped for salesperson ${targetOdooUserId}`
        }
      }, { status: 404 });
    }

    // 7. Get location details
    const locationResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.location',
          method: 'read',
          args: [[locationId]],
          kwargs: { fields: ['id', 'name', 'complete_name', 'barcode'] }
        }
      })
    });
    const locationData = await locationResponse.json();
    const location = locationData.result?.[0];

    if (!location) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: `Vehicle location ID ${locationId} not found in Odoo`
        }
      }, { status: 404 });
    }

    console.log(`📍 Location: ${location.complete_name} (ID: ${locationId})`);

    // 8. Query stock.quant
    const quantsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.quant',
          method: 'search_read',
          args: [[
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: {
            fields: ['id', 'product_id', 'quantity', 'product_uom_id', 'lot_id'],
            order: 'product_id'
          }
        }
      })
    });
    const quantsData = await quantsResponse.json();
    const quants = quantsData.result || [];

    console.log(`📦 Found ${quants.length} quants`);

    if (quants.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          location: {
            id: location.id,
            name: location.name,
            complete_name: location.complete_name,
            barcode: location.barcode || undefined
          },
          products: [],
          total_products: 0,
          total_items: 0,
          last_updated: new Date().toISOString(),
          salesperson: {
            id: targetOdooUserId,
            name: salespersonName
          }
        },
        timestamp: new Date().toISOString()
      });
    }

    // 9. Get product details
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));
    const productsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'read',
          args: [productIds],
          kwargs: { fields: ['id', 'name', 'default_code', 'image_128', 'uom_id', 'categ_id', 'barcode'] }
        }
      })
    });
    const productsData = await productsResponse.json();
    const products = productsData.result || [];

    // 10. Get lot details if any quants have lots
    const lotIds = Array.from(new Set(
      quants.filter((q: any) => q.lot_id).map((q: any) => q.lot_id[0])
    ));

    let lotMap = new Map();
    if (lotIds.length > 0) {
      const lotsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.lot',
            method: 'read',
            args: [lotIds],
            kwargs: { fields: ['id', 'name', 'expiration_date'] }
          }
        })
      });
      const lotsData = await lotsResponse.json();
      const lots = lotsData.result || [];
      lotMap = new Map(lots.map((lot: any) => [lot.id, lot]));
    }

    // 11. Map to final product format
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const vehicleProducts = quants.map((quant: any) => {
      const product: any = productMap.get(quant.product_id[0]);
      const lot: any = quant.lot_id ? lotMap.get(quant.lot_id[0]) : null;

      return {
        id: quant.product_id[0],
        name: product?.name || quant.product_id[1],
        code: product?.default_code || '',
        barcode: product?.barcode || '',
        image_url: product?.image_128 ? `data:image/png;base64,${product.image_128}` : null,
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'Units',
        lot_name: lot?.name || (quant.lot_id ? quant.lot_id[1] : undefined),
        expiry_date: lot?.expiration_date ? new Date(lot.expiration_date).toLocaleDateString('it-IT') : undefined
      };
    });

    console.log(`✅ [API] Vehicle stock retrieved successfully`);
    console.log(`   Location: ${location.name}`);
    console.log(`   Products: ${vehicleProducts.length}`);
    console.log(`   Total items: ${vehicleProducts.reduce((sum: number, p: any) => sum + p.quantity, 0)}`);

    // 12. Return success response
    return NextResponse.json({
      success: true,
      data: {
        location: {
          id: location.id,
          name: location.name,
          complete_name: location.complete_name,
          barcode: location.barcode || undefined
        },
        products: vehicleProducts,
        total_products: vehicleProducts.length,
        total_items: vehicleProducts.reduce((sum: number, p: any) => sum + p.quantity, 0),
        last_updated: new Date().toISOString(),
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
