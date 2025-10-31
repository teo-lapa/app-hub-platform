import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export const maxDuration = 120;
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

export async function POST(request: NextRequest) {
  try {
    const { routes } = await request.json();

    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      }, { status: 401 });
    }

    let created = 0;

    for (const route of routes as Route[]) {
      try {
        // Create batch in Odoo
        const batchResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw/stock.picking.batch/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking.batch',
              method: 'create',
              args: [{
                name: route.geoName || `Batch ${route.vehicle.name}`,
                user_id: route.vehicle.employeeId || false,
                picking_ids: [[6, 0, route.pickings.map(p => p.id)]]
              }],
              kwargs: {}
            },
            id: Date.now(),
          }),
        });

        if (!batchResponse.ok) {
          console.error(`Failed to create batch for ${route.vehicle.name}`);
          continue;
        }

        const batchData = await batchResponse.json();

        if (batchData.error) {
          console.error(`Odoo error creating batch: ${batchData.error.data?.message}`);
          continue;
        }

        if (batchData.result) {
          created++;
          console.log(`Created batch ${batchData.result} for ${route.vehicle.name}`);
        }

      } catch (error: any) {
        console.error(`Error creating batch for ${route.vehicle.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      created
    });

  } catch (error: any) {
    console.error('Error creating batches:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore creazione batch',
      created: 0
    }, { status: 500 });
  }
}
