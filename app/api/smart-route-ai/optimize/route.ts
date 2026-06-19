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
  totalDistance: number; // km
  totalDuration: number; // minuti (tragitto + scarichi)
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

// Clarke-Wright Savings con vincolo di capacita; consolida fino a maxRoutes giri.
function clarkeWright(n: number, dist: number[][], weights: number[], capacity: number, maxRoutes: number): number[][] {
  let routes: (number[] | null)[] = [];
  const routeIndexOf = new Array(n + 1).fill(-1);
  for (let i = 1; i <= n; i++) {
    routeIndexOf[i] = routes.length;
    routes.push([i]);
  }
  const weightOf = (r: number[]) => r.reduce((s, c) => s + weights[c], 0);

  const savings: [number, number, number][] = [];
  for (let i = 1; i <= n; i++) {
    for (let j = i + 1; j <= n; j++) {
      savings.push([dist[0][i] + dist[0][j] - dist[i][j], i, j]);
    }
  }
  savings.sort((a, b) => b[0] - a[0]);

  for (const [s, i, j] of savings) {
    if (s <= 0) break;
    const ai = routeIndexOf[i], aj = routeIndexOf[j];
    if (ai === aj || ai < 0 || aj < 0) continue;
    const ri = routes[ai], rj = routes[aj];
    if (!ri || !rj) continue;
    if (weightOf(ri) + weightOf(rj) > capacity) continue;

    const iStart = ri[0] === i, iEnd = ri[ri.length - 1] === i;
    const jStart = rj[0] === j, jEnd = rj[rj.length - 1] === j;
    if (!(iStart || iEnd) || !(jStart || jEnd)) continue;

    let merged: number[] | null = null;
    if (iEnd && jStart) merged = ri.concat(rj);
    else if (iStart && jEnd) merged = rj.concat(ri);
    else if (iEnd && jEnd) merged = ri.concat([...rj].reverse());
    else if (iStart && jStart) merged = [...ri].reverse().concat(rj);
    if (!merged) continue;

    routes[ai] = merged;
    routes[aj] = null;
    for (const c of merged) routeIndexOf[c] = ai;
  }

  let result = routes.filter((r): r is number[] => !!r && r.length > 0);

  // Consolida i giri in eccesso (oltre maxRoutes) unendo quelli che stanno nella capacita,
  // scegliendo ogni volta la cucitura piu corta.
  while (result.length > maxRoutes) {
    let best: [number, number] | null = null;
    let bestCost = Infinity;
    for (let a = 0; a < result.length; a++) {
      for (let b = 0; b < result.length; b++) {
        if (a === b) continue;
        if (weightOf(result[a]) + weightOf(result[b]) > capacity) continue;
        const cost = dist[result[a][result[a].length - 1]][result[b][0]];
        if (cost < bestCost) { bestCost = cost; best = [a, b]; }
      }
    }
    if (!best) break; // non si puo consolidare oltre: overflow di capacita
    const [a, b] = best;
    result[a] = result[a].concat(result[b]);
    result.splice(b, 1);
  }

  // Se ancora oltre maxRoutes (capacita totale > maxRoutes x 1200): tieni i giri piu carichi,
  // gli altri finiscono tra i non assegnati.
  if (result.length > maxRoutes) {
    result.sort((a, b) => weightOf(b) - weightOf(a));
    result = result.slice(0, maxRoutes);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const allPickings: Picking[] = body.pickings || [];
    const vehicles: Vehicle[] = body.vehicles || [];
    const capacity: number = body.capacity || 1200;
    const maxVehicles: number = Math.max(1, Math.min(body.maxVehicles || vehicles.length || 4, vehicles.length || 4));

    // Solo i picking con coordinate valide entrano nell'ottimizzazione
    const pickings = allPickings.filter(p => p.lat && p.lng);
    const noCoords = allPickings.filter(p => !p.lat || !p.lng);

    if (pickings.length === 0) {
      return NextResponse.json({ success: true, routes: [], unassigned: noCoords.length, unassignedNames: noCoords.map(p => p.name), matrixSource: 'haversine', totalKm: 0, totalMin: 0 });
    }

    // points[0] = deposito, points[1..n] = consegne
    const points = [DEPOT, ...pickings.map(p => ({ lat: p.lat, lng: p.lng }))];
    const { dist, dur, source } = await buildMatrix(points);

    const n = pickings.length;
    const weights = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) weights[i] = pickings[i - 1].weight || 0;

    const rawRoutes = clarkeWright(n, dist, weights, capacity, maxVehicles);

    const routes: Route[] = [];
    const assignedIds = new Set<number>();

    rawRoutes.forEach((custIdx, idx) => {
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
        geoName: `Giro ${idx + 1}`,
      });
    });

    const unassignedList = allPickings.filter(p => !assignedIds.has(p.id));
    const totalKm = Math.round(routes.reduce((s, r) => s + r.totalDistance, 0) * 10) / 10;
    const totalMin = routes.reduce((s, r) => s + r.totalDuration, 0);

    return NextResponse.json({
      success: true,
      routes,
      unassigned: unassignedList.length,
      unassignedNames: unassignedList.map(p => p.name),
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
