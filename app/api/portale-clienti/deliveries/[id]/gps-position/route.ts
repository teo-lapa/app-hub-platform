import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Genera posizione GPS simulata lungo la route
function generateSimulatedPosition(
  warehouseLat: number,
  warehouseLng: number,
  customerLat: number,
  customerLng: number,
  progress: number // 0-1
): { latitude: number; longitude: number; speed: number; heading: number } {
  // Interpolazione lineare tra warehouse e cliente
  const latitude = warehouseLat + (customerLat - warehouseLat) * progress;
  const longitude = warehouseLng + (customerLng - warehouseLng) * progress;

  // Velocità simulata (km/h) - più lenta vicino al cliente
  const speed = progress < 0.9 ? 50 + Math.random() * 20 : 20 + Math.random() * 10;

  // Calcola heading (direzione) verso il cliente
  const deltaLat = customerLat - warehouseLat;
  const deltaLng = customerLng - warehouseLng;
  const heading = (Math.atan2(deltaLng, deltaLat) * 180) / Math.PI;

  return {
    latitude: parseFloat(latitude.toFixed(6)),
    longitude: parseFloat(longitude.toFixed(6)),
    speed: parseFloat(speed.toFixed(1)),
    heading: parseFloat(((heading + 360) % 360).toFixed(1)),
  };
}

// Calcola distanza tra due coordinate (formula Haversine)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raggio Terra in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/portale-clienti/deliveries/[id]/gps-position?warehouseLat=50.1&warehouseLng=8.6&customerLat=52.5&customerLng=13.4
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliveryId = parseInt(params.id);
    const { searchParams } = new URL(request.url);

    const warehouseLat = parseFloat(searchParams.get('warehouseLat') || '50.1109');
    const warehouseLng = parseFloat(searchParams.get('warehouseLng') || '8.6821');
    const customerLat = parseFloat(searchParams.get('customerLat') || '52.52');
    const customerLng = parseFloat(searchParams.get('customerLng') || '13.405');

    // Usa delivery ID per generare progresso deterministico ma variabile
    // Progress basato su timestamp + deliveryId per simulare movimento continuo
    const now = Date.now();
    const minutesSinceEpoch = Math.floor(now / 60000); // Cambia ogni minuto
    const seed = deliveryId + minutesSinceEpoch;

    // Progress: 0-100% basato su seed (simula avanzamento nel tempo)
    // Ogni 10 minuti avanza di ~10%
    const progressPercent = (seed % 100) / 100;

    // Genera posizione simulata
    const position = generateSimulatedPosition(
      warehouseLat,
      warehouseLng,
      customerLat,
      customerLng,
      progressPercent
    );

    // Calcola distanza rimanente
    const remainingDistance = calculateDistance(
      position.latitude,
      position.longitude,
      customerLat,
      customerLng
    );

    // Calcola ETA (minuti) basato su distanza e velocità media
    const avgSpeed = 50; // km/h
    const etaMinutes = Math.ceil((remainingDistance / avgSpeed) * 60);

    // Status consegna
    let status = 'in_transit';
    if (progressPercent < 0.1) {
      status = 'preparing';
    } else if (progressPercent > 0.95) {
      status = 'near_destination';
    }

    return NextResponse.json({
      success: true,
      position: {
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed,
        heading: position.heading,
        accuracy: 10, // metri
        timestamp: new Date().toISOString(),
      },
      status,
      eta: {
        minutes: etaMinutes,
        arrival_time: new Date(Date.now() + etaMinutes * 60000).toISOString(),
      },
      distance: {
        remaining_km: parseFloat(remainingDistance.toFixed(2)),
        total_km: parseFloat(
          calculateDistance(warehouseLat, warehouseLng, customerLat, customerLng).toFixed(2)
        ),
        progress_percent: parseFloat((progressPercent * 100).toFixed(1)),
      },
    });
  } catch (error: any) {
    console.error('💥 [GPS Position] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get GPS position',
      },
      { status: 500 }
    );
  }
}
