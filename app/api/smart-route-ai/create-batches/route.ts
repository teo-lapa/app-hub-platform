import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo';

export const dynamic = 'force-dynamic';

interface Picking {
  id: number;
  name: string;
  partnerId: number;
  partnerName: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
  scheduledDate: string;
  state: string;
}

interface Vehicle {
  id: number;
  name: string;
  plate: string;
  driver: string;
  driverId: number;
  employeeId: number | null;
  capacity: number;
  selected: boolean;
}

interface Route {
  vehicle: Vehicle;
  pickings: Picking[];
  totalWeight: number;
  totalDistance: number;
  geoName?: string;
}

export async function POST(request: Request) {
  try {
    const { routes } = await request.json();

    if (!routes || !Array.isArray(routes) || routes.length === 0) {
      return NextResponse.json({
        error: 'No routes provided'
      }, { status: 400 });
    }

    const cookieStore = cookies();
    const createdBatches: any[] = [];

    // Get current user ID for batch assignment
    let userId: number | null = null;
    try {
      const odooUrl = process.env.ODOO_URL || 'https://lapa.odoo.com';
      const sessionCookie = cookieStore.get('session_id');

      if (sessionCookie) {
        const sessionResponse = await fetch(`${odooUrl}/web/session/get_session_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionCookie.value}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {},
            id: Math.floor(Math.random() * 1e9)
          })
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData.result && sessionData.result.uid) {
            userId = sessionData.result.uid;
          }
        }
      }
    } catch (err) {
      console.log('Could not get user ID, proceeding without it');
    }

    // Create batches for each route
    for (let i = 0; i < routes.length; i++) {
      const route: Route = routes[i];
      const pickingIds = route.pickings.map((p: Picking) => p.id);

      // Generate batch name with geographic zone
      const batchName = `${route.geoName || `Percorso ${i + 1}`} - ${new Date().toLocaleDateString('it-IT')}`;

      // Prepare batch data
      const batchData: any = {
        name: batchName,
        picking_ids: [[6, 0, pickingIds]], // Odoo many2many syntax: [(6, 0, [ids])]
      };

      // Add custom fields for driver and vehicle if employee ID exists
      if (route.vehicle.employeeId) {
        batchData.x_studio_autista_del_giro = route.vehicle.employeeId; // hr.employee ID
      }

      if (route.vehicle.id) {
        batchData.x_studio_auto_del_giro = route.vehicle.id; // fleet.vehicle ID
      }

      // Add user ID if available
      if (userId) {
        batchData.user_id = userId;
      }

      try {
        // Create batch in Odoo
        const batchId = await callOdoo(
          cookieStore,
          'stock.picking.batch',
          'create',
          [[batchData]],
          {}
        );

        console.log(`✅ Created batch "${batchName}" with ${pickingIds.length} pickings`);

        createdBatches.push({
          id: batchId,
          name: batchName,
          vehicle: route.vehicle.name,
          pickings: pickingIds.length
        });

        // Assign driver and vehicle to individual pickings
        if (route.vehicle.employeeId && route.vehicle.id) {
          for (const pickingId of pickingIds) {
            try {
              await callOdoo(
                cookieStore,
                'stock.picking',
                'write',
                [[pickingId], {
                  driver_id: route.vehicle.employeeId,  // hr.employee ID
                  vehicle_id: route.vehicle.id         // fleet.vehicle ID
                }],
                {}
              );

              console.log(`✅ Updated picking ${pickingId} with driver and vehicle`);
            } catch (err: any) {
              console.error(`❌ Error updating picking ${pickingId}:`, err.message);
            }
          }
        }

      } catch (err: any) {
        console.error(`❌ Error creating batch "${batchName}":`, err.message);
        return NextResponse.json({
          error: `Error creating batch: ${err.message}`,
          created: createdBatches.length
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      created: createdBatches.length,
      batches: createdBatches,
      success: true
    });

  } catch (error: any) {
    console.error('Error creating batches:', error);
    return NextResponse.json({
      error: error.message,
      created: 0
    }, { status: 500 });
  }
}
