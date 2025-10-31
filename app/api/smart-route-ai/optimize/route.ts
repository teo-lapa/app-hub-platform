import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Delivery {
  id: number;
  name: string;
  customer: string;
  address: string;
  lat: number;
  lng: number;
  priority: number;
  estimatedTime: number;
}

// Calcola distanza tra due punti GPS (formula di Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Algoritmo Nearest Neighbor (punto più vicino)
function optimizeRouteNearestNeighbor(deliveries: Delivery[], startLat: number, startLng: number): Delivery[] {
  if (deliveries.length === 0) return [];

  const optimized: Delivery[] = [];
  const remaining = [...deliveries];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    // Trova il punto più vicino alla posizione corrente
    let nearestIndex = 0;
    let minDistance = calculateDistance(currentLat, currentLng, remaining[0].lat, remaining[0].lng);

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    // Aggiungi il punto più vicino al percorso ottimizzato
    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  return optimized;
}

// Calcola metriche del percorso
function calculateRouteMetrics(route: Delivery[], startLat: number, startLng: number) {
  let totalDistance = 0;
  let totalTime = 0;
  let prevLat = startLat;
  let prevLng = startLng;

  for (const delivery of route) {
    const distance = calculateDistance(prevLat, prevLng, delivery.lat, delivery.lng);
    totalDistance += distance;
    // Tempo di viaggio: assume 40 km/h media + tempo consegna
    totalTime += (distance / 40) * 60 + delivery.estimatedTime;
    prevLat = delivery.lat;
    prevLng = delivery.lng;
  }

  return { totalDistance, totalTime };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deliveries } = body;

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return NextResponse.json(
        { error: 'Nessuna consegna fornita' },
        { status: 400 }
      );
    }

    // Punto di partenza (esempio: magazzino LAPA)
    // In produzione questi dati andrebbero presi dalla configurazione
    const startLat = 47.3769; // Esempio: Zurigo
    const startLng = 8.5417;

    // Calcola percorso originale (ordine attuale)
    const originalMetrics = calculateRouteMetrics(deliveries, startLat, startLng);

    // Ottimizza il percorso usando algoritmo Nearest Neighbor
    const optimizedDeliveries = optimizeRouteNearestNeighbor(deliveries, startLat, startLng);

    // Calcola metriche percorso ottimizzato
    const optimizedMetrics = calculateRouteMetrics(optimizedDeliveries, startLat, startLng);

    // Calcola risparmi
    const savings = {
      distance: originalMetrics.totalDistance - optimizedMetrics.totalDistance,
      time: originalMetrics.totalTime - optimizedMetrics.totalTime
    };

    return NextResponse.json({
      route: {
        deliveries: optimizedDeliveries,
        totalDistance: optimizedMetrics.totalDistance,
        totalTime: optimizedMetrics.totalTime,
        savings
      },
      original: {
        totalDistance: originalMetrics.totalDistance,
        totalTime: originalMetrics.totalTime
      }
    });

  } catch (error: any) {
    console.error('[SMART-ROUTE] Errore ottimizzazione:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore ottimizzazione percorso' },
      { status: 500 }
    );
  }
}
