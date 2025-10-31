import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEPOT = {
  lat: 47.5168872,
  lng: 8.5971149,
  name: "LAPA - Industriestrasse 18, 8424 Embrach"
};

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

// Haversine formula for GPS distance calculation (in km)
function calculateDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371; // Earth radius in km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total route distance including depot
function calculateRouteDistance(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateDistance(points[i], points[i + 1]);
  }
  return total;
}

// Calculate centroid of a set of points
function calculateCentroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
  const sum = points.reduce((acc, p) => ({
    lat: acc.lat + p.lat,
    lng: acc.lng + p.lng
  }), { lat: 0, lng: 0 });

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length
  };
}

// Optimize sequence using Nearest Neighbor within a cluster
function optimizeSequence(pickings: Picking[]): Picking[] {
  if (pickings.length <= 1) return pickings;

  const optimized: Picking[] = [];
  const remaining = [...pickings];
  let current: { lat: number; lng: number } = DEPOT;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDist = calculateDistance(current, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const dist = calculateDistance(current, remaining[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    current = nearest;
  }

  return optimized;
}

// ALGORITHM 1: Geographic Clustering
function geographicClustering(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];
  const unassigned = [...pickings];

  for (const vehicle of vehicles) {
    if (unassigned.length === 0) break;

    const route: Route = {
      vehicle: vehicle,
      pickings: [],
      totalWeight: 0,
      totalDistance: 0
    };

    // Find centroid of remaining orders
    const centroid = calculateCentroid(unassigned);

    // Sort by distance from centroid
    unassigned.sort((a, b) => {
      const distA = calculateDistance(centroid, a);
      const distB = calculateDistance(centroid, b);
      return distA - distB;
    });

    // Assign orders respecting capacity
    for (let i = unassigned.length - 1; i >= 0; i--) {
      const picking = unassigned[i];
      if (route.totalWeight + picking.weight <= capacity) {
        route.pickings.push(picking);
        route.totalWeight += picking.weight;
        unassigned.splice(i, 1);
      }
    }

    if (route.pickings.length > 0) {
      // Optimize sequence
      route.pickings = optimizeSequence(route.pickings);
      route.totalDistance = calculateRouteDistance([DEPOT, ...route.pickings, DEPOT]);
      routes.push(route);
    }
  }

  return routes;
}

// ALGORITHM 2: Clarke-Wright Savings Algorithm
function clarkeWrightAlgorithm(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];

  // Initialize routes with single orders
  const initialRoutes: Route[] = pickings.map(picking => ({
    vehicle: vehicles[0], // Temporary
    pickings: [picking],
    totalWeight: picking.weight,
    totalDistance: calculateDistance(DEPOT, picking) * 2
  }));

  // Calculate savings for all pairs
  const savings: { i: number; j: number; saving: number }[] = [];
  for (let i = 0; i < pickings.length; i++) {
    for (let j = i + 1; j < pickings.length; j++) {
      const saving = calculateDistance(DEPOT, pickings[i]) +
                     calculateDistance(DEPOT, pickings[j]) -
                     calculateDistance(pickings[i], pickings[j]);
      savings.push({ i, j, saving });
    }
  }

  // Sort savings in descending order
  savings.sort((a, b) => b.saving - a.saving);

  // Merge routes based on savings
  for (const s of savings) {
    const route1 = initialRoutes.find(r => r.pickings.includes(pickings[s.i]));
    const route2 = initialRoutes.find(r => r.pickings.includes(pickings[s.j]));

    if (route1 && route2 && route1 !== route2) {
      const combinedWeight = route1.totalWeight + route2.totalWeight;

      if (combinedWeight <= capacity) {
        // Merge routes
        route1.pickings.push(...route2.pickings);
        route1.totalWeight = combinedWeight;
        route1.pickings = optimizeSequence(route1.pickings);
        route1.totalDistance = calculateRouteDistance([DEPOT, ...route1.pickings, DEPOT]);

        // Remove merged route
        const index = initialRoutes.indexOf(route2);
        initialRoutes.splice(index, 1);
      }
    }
  }

  // Assign vehicles to routes
  for (let i = 0; i < Math.min(initialRoutes.length, vehicles.length); i++) {
    routes.push({
      vehicle: vehicles[i],
      pickings: initialRoutes[i].pickings,
      totalWeight: initialRoutes[i].totalWeight,
      totalDistance: initialRoutes[i].totalDistance
    });
  }

  return routes;
}

// ALGORITHM 3: Nearest Neighbor Algorithm
function nearestNeighborAlgorithm(pickings: Picking[], vehicles: Vehicle[], capacity: number): Route[] {
  const routes: Route[] = [];
  const unassigned = [...pickings];

  for (const vehicle of vehicles) {
    if (unassigned.length === 0) break;

    const route: Route = {
      vehicle: vehicle,
      pickings: [],
      totalWeight: 0,
      totalDistance: 0
    };

    let current: { lat: number; lng: number } = DEPOT;

    while (unassigned.length > 0 && route.totalWeight < capacity) {
      let nearest: Picking | null = null;
      let minDist = Infinity;
      let nearestIndex = -1;

      for (let i = 0; i < unassigned.length; i++) {
        const picking = unassigned[i];
        if (route.totalWeight + picking.weight <= capacity) {
          const dist = calculateDistance(current, picking);
          if (dist < minDist) {
            minDist = dist;
            nearest = picking;
            nearestIndex = i;
          }
        }
      }

      if (nearest) {
        route.pickings.push(nearest);
        route.totalWeight += nearest.weight;
        unassigned.splice(nearestIndex, 1);
        current = nearest;
      } else {
        break;
      }
    }

    if (route.pickings.length > 0) {
      route.totalDistance = calculateRouteDistance([DEPOT, ...route.pickings, DEPOT]);
      routes.push(route);
    }
  }

  return routes;
}

// Generate geographic name for route
const usedRouteNames = new Set<string>();

function generateGeographicName(pickings: Picking[], routeIndex: number): string {
  if (pickings.length === 0) return 'Vuoto';

  const cities: { [key: string]: number } = {};
  let avgLat = 0, avgLng = 0;

  pickings.forEach(p => {
    avgLat += p.lat || 0;
    avgLng += p.lng || 0;

    if (p.address) {
      let city = '';

      // Extract city from address
      const parts = p.address.split(',');
      if (parts.length > 1) {
        city = parts[parts.length - 1].trim();
      }

      // Try to extract Swiss postal code (4 digits)
      if (!city) {
        const capMatch = p.address.match(/\b([1-9]\d{3})\b/);
        if (capMatch) {
          const cap = capMatch[1];
          // Map postal codes to known zones
          if (cap >= '4000' && cap <= '4999') city = 'Basilea';
          else if (cap >= '8000' && cap <= '8099') city = 'Zurigo';
          else if (cap >= '8100' && cap <= '8199') city = 'Winterthur';
          else if (cap >= '3000' && cap <= '3999') city = 'Berna';
          else if (cap >= '1200' && cap <= '1299') city = 'Ginevra';
          else if (cap >= '6900' && cap <= '6999') city = 'Lugano';
          else if (cap >= '5000' && cap <= '5999') city = 'Argovia';
        }
      }

      // Determine zone by coordinates
      if (!city && p.lat && p.lng) {
        if (p.lat > 47.5 && p.lng < 8.0) city = 'Basilea';
        else if (p.lat > 47.3 && p.lat < 47.5 && p.lng > 8.3) city = 'Zurigo';
        else if (p.lat < 46.5) city = 'Ticino';
        else if (p.lng < 7.0) city = 'Romandia';
      }

      if (city) {
        cities[city] = (cities[city] || 0) + 1;
      }
    }
  });

  avgLat = avgLat / pickings.length;
  avgLng = avgLng / pickings.length;

  // Find predominant city
  const sortedCities = Object.entries(cities).sort((a, b) => b[1] - a[1]);

  if (sortedCities.length === 0) {
    return `Zona ${routeIndex + 1}`;
  }

  let baseName = sortedCities[0][0];
  let finalName = baseName;

  // If name already used, add suffix
  if (usedRouteNames.has(baseName)) {
    const suffixes: string[] = [];

    if (baseName === 'Zurigo') {
      if (avgLng > 8.6) suffixes.push('Est');
      else if (avgLng < 8.5) suffixes.push('Ovest');
      else if (avgLat > 47.4) suffixes.push('Nord');
      else if (avgLat < 47.35) suffixes.push('Lago');
      else suffixes.push('Centro');
    } else {
      if (avgLat > DEPOT.lat + 0.05) suffixes.push('Nord');
      else if (avgLat < DEPOT.lat - 0.05) suffixes.push('Sud');

      if (avgLng > DEPOT.lng + 0.05) suffixes.push('Est');
      else if (avgLng < DEPOT.lng - 0.05) suffixes.push('Ovest');

      if (suffixes.length === 0) suffixes.push('Centro');
    }

    for (const suffix of suffixes) {
      const testName = `${baseName} ${suffix}`;
      if (!usedRouteNames.has(testName)) {
        finalName = testName;
        break;
      }
    }

    if (usedRouteNames.has(finalName)) {
      let counter = 2;
      while (usedRouteNames.has(`${baseName} ${counter}`)) {
        counter++;
      }
      finalName = `${baseName} ${counter}`;
    }
  }

  usedRouteNames.add(finalName);
  return finalName;
}

export async function POST(request: Request) {
  try {
    const { pickings, vehicles, algorithm, capacity } = await request.json();

    if (!pickings || !vehicles || !algorithm) {
      return NextResponse.json({
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    // Reset used names for new optimization
    usedRouteNames.clear();

    let routes: Route[] = [];

    // Execute selected algorithm
    switch (algorithm) {
      case 'geographic':
        routes = geographicClustering(pickings, vehicles, capacity);
        break;
      case 'clarke-wright':
        routes = clarkeWrightAlgorithm(pickings, vehicles, capacity);
        break;
      case 'nearest':
        routes = nearestNeighborAlgorithm(pickings, vehicles, capacity);
        break;
      default:
        return NextResponse.json({
          error: 'Invalid algorithm'
        }, { status: 400 });
    }

    // Add geographic names to routes
    routes.forEach((route, index) => {
      route.geoName = generateGeographicName(route.pickings, index);
    });

    // Count unassigned pickings
    const assignedPickingIds = new Set(routes.flatMap(r => r.pickings.map(p => p.id)));
    const unassigned = pickings.filter((p: Picking) => !assignedPickingIds.has(p.id)).length;

    return NextResponse.json({
      routes: routes,
      unassigned: unassigned,
      algorithm: algorithm
    });

  } catch (error: any) {
    console.error('Error optimizing routes:', error);
    return NextResponse.json({
      error: error.message,
      routes: []
    }, { status: 500 });
  }
}
