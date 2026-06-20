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
  batchId?: number; // in modalita "batch selezionati": id del giro di destinazione
}

interface Route {
  vehicle: Vehicle;
  pickings: Picking[];
  totalWeight: number;
  totalDistance: number; // km
  totalDuration: number; // minuti (tragitto + scarichi)
  overCapacity: boolean;
  geoName?: string;
}

const DEPOT = { lat: 47.5168872, lng: 8.5971149 }; // LAPA Embrach
const SERVICE_MIN_PER_STOP = 15; // tempo medio di scarico per consegna
const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const ROAD_FACTOR = 1.35;       // correzione linea d'aria -> strada (fallback)
const FALLBACK_SPEED_KMH = 32;  // velocita media urbana CH (fallback)

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Matrice distanze (km) e tempi (minuti) tra tutti i punti.
// Prova OSRM (strade reali); se fallisce ripiega su linea d'aria.
async function buildMatrix(points: { lat: number; lng: number }[]): Promise<{ dist: number[][]; dur: number[][]; source: 'osrm' | 'haversine' }> {
  const n = points.length;

  const haversineMatrix = () => {
    const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    const dur: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const km = haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng) * ROAD_FACTOR;
        dist[i][j] = km;
        dur[i][j] = (km / FALLBACK_SPEED_KMH) * 60;
      }
    }
    return { dist, dur, source: 'haversine' as const };
  };

  // Il server pubblico OSRM (table) regge ~100 punti; sopra usa il fallback.
  if (n < 2 || n > 95) return haversineMatrix();

  try {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=duration,distance`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.durations || !data.distances) throw new Error('OSRM risposta non valida');
    const dur = data.durations.map((row: any[]) => row.map((s: number | null) => s == null ? Infinity : s / 60)); // s -> min
    const dist = data.distances.map((row: any[]) => row.map((m: number | null) => m == null ? Infinity : m / 1000)); // m -> km
    return { dist, dur, source: 'osrm' };
  } catch (e) {
    console.warn('[Smart Route AI] OSRM non disponibile, uso linea d\'aria:', (e as any)?.message);
    return haversineMatrix();
  }
}

// 2-opt: migliora l'ordine delle tappe di un giro (tour chiuso deposito->...->deposito)
function twoOpt(route: number[], dist: number[][]): number[] {
  const tourDist = (r: number[]): number => {
    if (r.length === 0) return 0;
    let d = dist[0][r[0]];
    for (let k = 0; k < r.length - 1; k++) d += dist[r[k]][r[k + 1]];
    return d + dist[r[r.length - 1]][0];
  };
  let best = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (tourDist(candidate) < tourDist(best) - 1e-9) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

// Sweep: divide le consegne in K giri per zona (angolo attorno al deposito),
// bilanciati per numero di tappe, con il peso come limite di sicurezza.
function sweepRoutes(points: { lat: number; lng: number }[], weights: number[], capacity: number, K: number): number[][] {
  const n = points.length - 1; // escluso deposito (indice 0)
  if (n === 0 || K <= 0) return [];

  const cust = [];
  for (let i = 1; i <= n; i++) {
    const ang = Math.atan2(points[i].lat - DEPOT.lat, points[i].lng - DEPOT.lng);
    cust.push({ i, ang });
  }
  cust.sort((a, b) => a.ang - b.ang);
  const order = cust.map(c => c.i);

  const per = Math.ceil(order.length / K); // tappe per giro (bilanciamento)
  const groups: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  for (const c of order) {
    const w = weights[c] || 0;
    const canOpenNew = groups.length < K - 1;
    const full = cur.length >= per;
    const overCap = curW + w > capacity;
    if (cur.length > 0 && canOpenNew && (full || overCap)) {
      groups.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(c);
    curW += w;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const allPickings: Picking[] = body.pickings || [];
    const vehicles: Vehicle[] = body.vehicles || [];
    const capacity: number = body.capacity || 1200;
    // targetRoutes: numero di giri voluto (modalita batch selezionati). Se assente, usa i veicoli (max 4).
    const requested: number = body.targetRoutes || vehicles.length || 4;

    const pickings = allPickings.filter(p => p.lat && p.lng);
    const noCoords = allPickings.filter(p => !p.lat || !p.lng);

    if (pickings.length === 0) {
      return NextResponse.json({ success: true, routes: [], unassigned: noCoords.length, unassignedNames: noCoords.map(p => p.name), matrixSource: 'haversine', totalKm: 0, totalMin: 0 });
    }

    const K = Math.max(1, Math.min(requested, pickings.length));

    // points[0] = deposito, points[1..n] = consegne
    const points = [DEPOT, ...pickings.map(p => ({ lat: p.lat, lng: p.lng }))];
    const { dist, dur, source } = await buildMatrix(points);

    const n = pickings.length;
    const weights = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) weights[i] = pickings[i - 1].weight || 0;

    const groups = sweepRoutes(points, weights, capacity, K);

    const routes: Route[] = [];
    const assignedIds = new Set<number>();

    groups.forEach((custIdx, idx) => {
      const ordered = twoOpt(custIdx, dist);
      const routePickings = ordered.map(ci => pickings[ci - 1]);
      routePickings.forEach(p => assignedIds.add(p.id));

      let totalDistance = dist[0][ordered[0]];
      let travelMin = dur[0][ordered[0]];
      for (let k = 0; k < ordered.length - 1; k++) {
        totalDistance += dist[ordered[k]][ordered[k + 1]];
        travelMin += dur[ordered[k]][ordered[k + 1]];
      }
      totalDistance += dist[ordered[ordered.length - 1]][0];
      travelMin += dur[ordered[ordered.length - 1]][0];

      const totalWeight = Math.round(routePickings.reduce((s, p) => s + (p.weight || 0), 0) * 10) / 10;
      const totalDuration = Math.round(travelMin + ordered.length * SERVICE_MIN_PER_STOP);
      const vehicle = vehicles[idx] || vehicles[vehicles.length - 1];

      routes.push({
        vehicle,
        pickings: routePickings,
        totalWeight,
        totalDistance: Math.round(totalDistance * 10) / 10,
        totalDuration,
        overCapacity: totalWeight > capacity,
        geoName: `Giro ${idx + 1}`,
      });
    });

    const unassignedList = allPickings.filter(p => !assignedIds.has(p.id));
    const totalKm = Math.round(routes.reduce((s, r) => s + r.totalDistance, 0) * 10) / 10;
    const totalMin = routes.reduce((s, r) => s + r.totalDuration, 0);
    const overCapacityCount = routes.filter(r => r.overCapacity).length;

    return NextResponse.json({
      success: true,
      routes,
      unassigned: unassignedList.length,
      unassignedNames: unassignedList.map(p => p.name),
      overCapacityCount,
      matrixSource: source,
      totalKm,
      totalMin,
    });

  } catch (error: any) {
    console.error('[Smart Route AI] Errore ottimizzazione:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore ottimizzazione',
      routes: [],
      unassigned: 0,
    }, { status: 500 });
  }
}
