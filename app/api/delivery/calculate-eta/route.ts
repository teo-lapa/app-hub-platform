import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination } = body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return NextResponse.json({ error: 'Coordinate mancanti' }, { status: 400 });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Google Maps API key non configurata' }, { status: 500 });
    }

    // Call Google Maps Directions API
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      return NextResponse.json({ error: 'Impossibile calcolare percorso' }, { status: 400 });
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Extract duration in minutes
    const durationSeconds = leg.duration.value;
    const durationMinutes = Math.ceil(durationSeconds / 60);

    // Extract distance in km
    const distanceMeters = leg.distance.value;
    const distanceKm = (distanceMeters / 1000).toFixed(2);

    return NextResponse.json({
      duration: durationMinutes,
      distance: parseFloat(distanceKm),
      duration_text: leg.duration.text,
      distance_text: leg.distance.text
    });
  } catch (error: any) {
    console.error('Error calculating ETA:', error);
    return NextResponse.json(
      { error: error.message || 'Errore calcolo ETA' },
      { status: 500 }
    );
  }
}
