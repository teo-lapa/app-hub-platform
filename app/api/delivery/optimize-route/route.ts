import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, deliveries } = body;

    if (!origin || !deliveries || deliveries.length === 0) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Google Maps API key non configurata' }, { status: 500 });
    }

    // Prepare waypoints
    const waypoints = deliveries
      .filter((d: any) => d.lat && d.lng)
      .map((d: any) => `${d.lat},${d.lng}`)
      .join('|');

    if (!waypoints) {
      return NextResponse.json({ error: 'Nessuna consegna con coordinate valide' }, { status: 400 });
    }

    // Use last delivery as destination
    const lastDelivery = deliveries[deliveries.length - 1];
    const destination = `${lastDelivery.lat},${lastDelivery.lng}`;

    // Remove last from waypoints
    const waypointsWithoutLast = deliveries
      .slice(0, -1)
      .filter((d: any) => d.lat && d.lng)
      .map((d: any) => `${d.lat},${d.lng}`)
      .join('|');

    // Call Google Maps Directions API with optimize:true
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination}&waypoints=optimize:true|${waypointsWithoutLast}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return NextResponse.json({ error: 'Impossibile ottimizzare percorso' }, { status: 400 });
    }

    const route = data.routes[0];

    // Get optimized waypoint order
    const waypointOrder = data.routes[0].waypoint_order;

    // Map back to delivery IDs
    const optimizedOrder = waypointOrder.map((index: number) => deliveries[index].id);

    // Add last delivery
    optimizedOrder.push(lastDelivery.id);

    // Calculate total distance and duration
    let totalDistance = 0;
    let totalDuration = 0;

    route.legs.forEach((leg: any) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
    });

    return NextResponse.json({
      optimized_order: optimizedOrder,
      total_distance_km: (totalDistance / 1000).toFixed(2),
      total_duration_minutes: Math.ceil(totalDuration / 60),
      route_polyline: route.overview_polyline?.points
    });
  } catch (error: any) {
    console.error('Error optimizing route:', error);
    return NextResponse.json(
      { error: error.message || 'Errore ottimizzazione percorso' },
      { status: 500 }
    );
  }
}
