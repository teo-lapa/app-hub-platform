import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo';

export const dynamic = 'force-dynamic';

const VEHICLE_CATEGORY = "Mezzi di trasporto refrigerati";
const DEFAULT_CAPACITY = 1500;

export async function GET() {
  try {
    const cookieStore = cookies();
    let vehicles: any[] = [];

    // Step 1: Try to find vehicles by category
    try {
      const categories = await callOdoo(
        cookieStore,
        'fleet.vehicle.model.category',
        'search_read',
        [],
        {
          domain: [['name', 'ilike', VEHICLE_CATEGORY]],
          fields: ['id', 'name'],
          limit: 10
        }
      );

      if (categories && categories.length > 0) {
        // Search vehicles by category
        vehicles = await callOdoo(
          cookieStore,
          'fleet.vehicle',
          'search_read',
          [],
          {
            domain: [['model_id.category_id', '=', categories[0].id]],
            fields: ['id', 'name', 'license_plate', 'model_id', 'driver_id', 'tag_ids'],
            limit: 100
          }
        );
      }
    } catch (err) {
      console.log('Category search failed, trying tags...');
    }

    // Step 2: If no vehicles found, try tags
    if (vehicles.length === 0) {
      try {
        const tags = await callOdoo(
          cookieStore,
          'fleet.vehicle.tag',
          'search_read',
          [],
          {
            domain: [['name', 'ilike', VEHICLE_CATEGORY]],
            fields: ['id', 'name'],
            limit: 10
          }
        );

        if (tags && tags.length > 0) {
          vehicles = await callOdoo(
            cookieStore,
            'fleet.vehicle',
            'search_read',
            [],
            {
              domain: [['tag_ids', 'in', [tags[0].id]]],
              fields: ['id', 'name', 'license_plate', 'model_id', 'driver_id'],
              limit: 100
            }
          );
        }
      } catch (err) {
        console.log('Tag search failed, loading all vehicles with drivers...');
      }
    }

    // Step 3: If still no vehicles, load all vehicles WITH drivers
    if (vehicles.length === 0) {
      vehicles = await callOdoo(
        cookieStore,
        'fleet.vehicle',
        'search_read',
        [],
        {
          domain: [['driver_id', '!=', false]], // Only vehicles with driver
          fields: ['id', 'name', 'license_plate', 'model_id', 'driver_id'],
          limit: 30
        }
      );
    }

    // Step 4: Process vehicles and find hr.employee
    const processedVehicles: any[] = [];

    for (const v of vehicles.filter((v: any) => v.driver_id && v.driver_id[0])) {
      let employeeId = null;

      // Search hr.employee linked to res.partner driver
      try {
        const employees = await callOdoo(
          cookieStore,
          'hr.employee',
          'search_read',
          [],
          {
            domain: [['work_contact_id', '=', v.driver_id[0]]],
            fields: ['id', 'name'],
            limit: 1
          }
        );

        if (employees && employees.length > 0) {
          employeeId = employees[0].id;
        } else {
          // Skip vehicle if no employee found
          continue;
        }
      } catch (err) {
        console.error(`Error finding employee for driver ${v.driver_id[1]}:`, err);
        continue;
      }

      // Extract short vehicle name (first word only, max 10 chars)
      let shortName = v.name.split(' ')[0];
      if (shortName.length > 10) shortName = shortName.substring(0, 10);

      // Extract driver name (remove company prefix if present)
      let driverName = v.driver_id[1];
      if (driverName.includes(',')) {
        const parts = driverName.split(',');
        driverName = parts[1] ? parts[1].trim() : parts[0].trim();
      }

      processedVehicles.push({
        id: v.id,
        name: `${shortName} ${v.license_plate || ''}`.trim(),
        fullName: v.name,
        plate: v.license_plate || 'N/D',
        driver: driverName,
        driverId: v.driver_id[0],
        employeeId: employeeId,
        capacity: DEFAULT_CAPACITY,
        selected: false
      });
    }

    return NextResponse.json({
      vehicles: processedVehicles,
      count: processedVehicles.length
    });

  } catch (error: any) {
    console.error('Error loading vehicles:', error);
    return NextResponse.json({
      error: error.message,
      vehicles: []
    }, { status: 500 });
  }
}
