import { NextRequest, NextResponse } from 'next/server';

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

const DEPOT = { lat: 47.5168872, lng: 8.5971149 };

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geographic optimization algorithm
function optimizeGeographic(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];
  const geoZones = ['Nord', 'Sud', 'Est', 'Ovest', 'Centro'];
  
  // Assign pickings to geographic zones
  const zones = geoZones.map(zoneName => ({
    name: zoneName,
    pickings: [] as Picking[],
    centerLat: DEPOT.lat,
    centerLng: DEPOT.lng
  }));

  // Simple geographic distribution
  pickings.forEach(picking => {
    const angle = Math.atan2(picking.lng - DEPOT.lng, picking.lat - DEPOT.lat);
    const zoneIndex = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 5) % 5;
    zones[zoneIndex].pickings.push(picking);
  });

  // Assign zones to vehicles
  vehicles.forEach((vehicle, index) => {
    if (zones[index] && zones[index].pickings.length > 0) {
      const routePickings = [];
      let totalWeight = 0;

      for (const picking of zones[index].pickings) {
        if (totalWeight + picking.weight <= capacity) {
          routePickings.push(picking);
          totalWeight += picking.weight;
        }
      }

      if (routePickings.length > 0) {
        let totalDistance = calculateDistance(DEPOT.lat, DEPOT.lng, routePickings[0].lat, routePickings[0].lng);
        for (let i = 0; i < routePickings.length - 1; i++) {
          totalDistance += calculateDistance(
            routePickings[i].lat, routePickings[i].lng,
            routePickings[i + 1].lat, routePickings[i + 1].lng
          );
        }
        totalDistance += calculateDistance(
          routePickings[routePickings.length - 1].lat,
          routePickings[routePickings.length - 1].lng,
          DEPOT.lat, DEPOT.lng
        );

        routes.push({
          vehicle,
          pickings: routePickings,
          totalWeight,
          totalDistance,
          geoName: `Zona ${zones[index].name}`
        });
      }
    }
  });

  return routes;
}

// Nearest neighbor algorithm
function optimizeNearest(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];
  const remaining = [...pickings];

  for (const vehicle of vehicles) {
    if (remaining.length === 0) break;

    const routePickings: Picking[] = [];
    let totalWeight = 0;
    let currentLat = DEPOT.lat;
    let currentLng = DEPOT.lng;
    let totalDistance = 0;

    while (remaining.length > 0) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      // Find nearest picking
      remaining.forEach((picking, index) => {
        if (totalWeight + picking.weight <= capacity) {
          const distance = calculateDistance(currentLat, currentLng, picking.lat, picking.lng);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        }
      });

      if (nearestIndex === -1) break;

      const picking = remaining.splice(nearestIndex, 1)[0];
      routePickings.push(picking);
      totalWeight += picking.weight;
      totalDistance += nearestDistance;
      currentLat = picking.lat;
      currentLng = picking.lng;
    }

    if (routePickings.length > 0) {
      totalDistance += calculateDistance(currentLat, currentLng, DEPOT.lat, DEPOT.lng);

      routes.push({
        vehicle,
        pickings: routePickings,
        totalWeight,
        totalDistance,
        geoName: `Percorso ${vehicle.name}`
      });
    }
  }

  return routes;
}

// Clarke-Wright Savings algorithm (simplified)
function optimizeClarkeWright(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];
  const remaining = [...pickings];

  // Distribute pickings across vehicles
  for (const vehicle of vehicles) {
    if (remaining.length === 0) break;

    const routePickings: Picking[] = [];
    let totalWeight = 0;

    // Greedy assignment
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (totalWeight + remaining[i].weight <= capacity) {
        routePickings.push(remaining[i]);
        totalWeight += remaining[i].weight;
        remaining.splice(i, 1);
      }
    }

    if (routePickings.length > 0) {
      // Calculate route distance
      let totalDistance = calculateDistance(DEPOT.lat, DEPOT.lng, routePickings[0].lat, routePickings[0].lng);
      for (let i = 0; i < routePickings.length - 1; i++) {
        totalDistance += calculateDistance(
          routePickings[i].lat, routePickings[i].lng,
          routePickings[i + 1].lat, routePickings[i + 1].lng
        );
      }
      totalDistance += calculateDistance(
        routePickings[routePickings.length - 1].lat,
        routePickings[routePickings.length - 1].lng,
        DEPOT.lat, DEPOT.lng
      );

      routes.push({
        vehicle,
        pickings: routePickings,
        totalWeight,
        totalDistance,
        geoName: `Percorso ${vehicle.name}`
      });
    }
  }

  return routes;
}

export async function POST(request: NextRequest) {
  try {
    const { pickings, vehicles, algorithm, capacity } = await request.json();

    let routes: Route[] = [];
    let unassigned = 0;

    switch (algorithm) {
      case 'geographic':
        routes = optimizeGeographic(pickings, vehicles, capacity);
        break;
      case 'nearest':
        routes = optimizeNearest(pickings, vehicles, capacity);
        break;
      case 'clarke-wright':
        routes = optimizeClarkeWright(pickings, vehicles, capacity);
        break;
      default:
        routes = optimizeGeographic(pickings, vehicles, capacity);
    }

    // Count unassigned pickings
    const assignedIds = new Set(routes.flatMap(r => r.pickings.map(p => p.id)));
    unassigned = pickings.filter((p: Picking) => !assignedIds.has(p.id)).length;

    return NextResponse.json({
      success: true,
      routes,
      unassigned
    });

  } catch (error: any) {
    console.error('Error optimizing routes:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore ottimizzazione',
      routes: [],
      unassigned: 0
    }, { status: 500 });
  }
}
