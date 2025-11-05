import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      }, { status: 401 });
    }

    // Fetch vehicles from Odoo (fleet.vehicle model)
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/fleet.vehicle/search_read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'fleet.vehicle',
          method: 'search_read',
          args: [[]],
          kwargs: {
            fields: ['id', 'name', 'license_plate', 'driver_id', 'driver_employee_id'],
            limit: 100
          }
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Errore HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.data?.message || 'Errore Odoo');
    }

    // Transform vehicles data
    const vehicles = (data.result || []).map((vehicle: any) => ({
      id: vehicle.id,
      name: vehicle.name || 'Veicolo senza nome',
      plate: vehicle.license_plate || 'N/A',
      driver: vehicle.driver_id ? vehicle.driver_id[1] : 'Nessun autista',
      driverId: vehicle.driver_id ? vehicle.driver_id[0] : null,
      employeeId: vehicle.driver_employee_id ? vehicle.driver_employee_id[0] : null,
      capacity: 1500, // Default capacity
      selected: true // Default selected
    }))
    // Sort vehicles: IVECO first, then BMW, then others
    .sort((a, b) => {
      const aIsIveco = a.name.toUpperCase().includes('IVECO');
      const bIsIveco = b.name.toUpperCase().includes('IVECO');
      const aIsBMW = a.name.toUpperCase().includes('BMW');
      const bIsBMW = b.name.toUpperCase().includes('BMW');
      
      if (aIsIveco && !bIsIveco) return -1;
      if (!aIsIveco && bIsIveco) return 1;
      if (aIsBMW && !bIsBMW) return -1;
      if (!aIsBMW && bIsBMW) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      vehicles
    });

  } catch (error: any) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore caricamento veicoli',
      vehicles: []
    }, { status: 500 });
  }
}
