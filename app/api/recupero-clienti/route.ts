import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';

// =================================================================
// Recupero Clienti — API live
// Fonte dati: stock.picking (date_done), MAI date_order su sale.order
// Output: clienti regolari B2B (≥2 consegne in 180gg) con tier/zona/allarme
// =================================================================

const INTERNAL_PARTNERS = [1, 12, 18, 2421, 6524, 8570, 8852, 8998];
const EXCLUDED_CATEGORIES = [231, 232, 233];

// Zone LAPA (CAP → giorno visita)
const ZONA_LUNEDI = new Set(['8400', '8304', '8050', '8052', '8155', '8353', '8180', '8172', '8424', '8422', '8600', '8404', '8153', '8057', '8046', '8355', '8597', '8447']);
const ZONA_GIOVEDI = new Set(['8126', '8835', '8853', '8805', '6300', '6314', '8802', '8803', '8640', '8645', '8330', '8700', '8706', '8340', '8610', '6003']);

function getZona(zip: string | false | null | undefined): 'lunedi' | 'mercoledi' | 'giovedi' {
  if (!zip) return 'mercoledi';
  const z = String(zip).replace('CH-', '').trim();
  if (ZONA_LUNEDI.has(z)) return 'lunedi';
  if (ZONA_GIOVEDI.has(z)) return 'giovedi';
  return 'mercoledi';
}

function getTier(fat_6m: number): 'A' | 'B' | 'C' {
  const mensile = fat_6m / 6;
  if (mensile >= 2000) return 'A';
  if (mensile >= 500) return 'B';
  return 'C';
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

type Allarme = 'GRAVE' | 'SI' | 'NO';

// Chunked picks query — 2-week chunks per stare sotto il limite 200 di Odoo
async function fetchAllPicksInWindow(cookies: string | null, from: Date, to: Date): Promise<Array<{ sale_id: number; date_done: string }>> {
  const results: Array<{ sale_id: number; date_done: string }> = [];
  const totalMs = to.getTime() - from.getTime();
  const chunkMs = 14 * 86400000;
  const numChunks = Math.max(1, Math.ceil(totalMs / chunkMs));

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = new Date(from.getTime() + i * chunkMs);
    const chunkEnd = new Date(Math.min(to.getTime(), from.getTime() + (i + 1) * chunkMs - 1));
    const picks = await callOdoo(cookies, 'stock.picking', 'search_read',
      [[['picking_type_code', '=', 'outgoing'], ['state', '=', 'done'], ['date_done', '>=', formatDate(chunkStart)], ['date_done', '<=', formatDate(chunkEnd) + ' 23:59:59']]],
      { fields: ['sale_id', 'date_done'], limit: 500 }
    );
    for (const p of picks) {
      if (p.sale_id && p.sale_id[0]) {
        results.push({ sale_id: p.sale_id[0], date_done: p.date_done });
      }
    }
  }
  return results;
}

// Batch sale.order info
async function fetchSaleOrderInfo(cookies: string | null, saleIds: number[]): Promise<Map<number, { pid: number; amount: number }>> {
  const result = new Map<number, { pid: number; amount: number }>();
  const BATCH = 150;
  for (let i = 0; i < saleIds.length; i += BATCH) {
    const batch = saleIds.slice(i, i + BATCH);
    const orders = await callOdoo(cookies, 'sale.order', 'search_read',
      [[['id', 'in', batch]]],
      { fields: ['commercial_partner_id', 'amount_total'], limit: BATCH + 10 }
    );
    for (const o of orders) {
      if (o.commercial_partner_id && o.commercial_partner_id[0]) {
        result.set(o.id, { pid: o.commercial_partner_id[0], amount: o.amount_total || 0 });
      }
    }
  }
  return result;
}

async function getClientsLive(cookies: string | null) {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setDate(now.getDate() - 180);
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setDate(now.getDate() - 90);

  const picks = await fetchAllPicksInWindow(cookies, sixMonthsAgo, now);
  const uniqueSaleIds = Array.from(new Set(picks.map(p => p.sale_id)));
  const saleInfo = await fetchSaleOrderInfo(cookies, uniqueSaleIds);

  const threeMonthsAgoStr = formatDate(threeMonthsAgo);
  type Stat = { fat_6m: number; fat_3m: number; cons_6m: number; cons_3m: number; ultimaConsegna: string; };
  const stats = new Map<number, Stat>();

  for (const p of picks) {
    const info = saleInfo.get(p.sale_id);
    if (!info) continue;
    let s = stats.get(info.pid);
    if (!s) {
      s = { fat_6m: 0, fat_3m: 0, cons_6m: 0, cons_3m: 0, ultimaConsegna: '' };
      stats.set(info.pid, s);
    }
    s.fat_6m += info.amount;
    s.cons_6m += 1;
    if (p.date_done >= threeMonthsAgoStr) {
      s.fat_3m += info.amount;
      s.cons_3m += 1;
    }
    if (p.date_done > s.ultimaConsegna) s.ultimaConsegna = p.date_done;
  }

  const regularIds: number[] = [];
  stats.forEach((s, pid) => {
    if (INTERNAL_PARTNERS.includes(pid)) return;
    if (s.cons_6m >= 2) regularIds.push(pid);
  });

  if (regularIds.length === 0) return { clients: [], stats: { total: 0, byZona: {} } };

  const partners: any[] = [];
  const PBATCH = 200;
  for (let i = 0; i < regularIds.length; i += PBATCH) {
    const batch = regularIds.slice(i, i + PBATCH);
    const res = await callOdoo(cookies, 'res.partner', 'search_read',
      [[['id', 'in', batch]]],
      { fields: ['name', 'phone', 'mobile', 'email', 'street', 'city', 'zip', 'partner_latitude', 'partner_longitude', 'is_company', 'category_id', 'customer_rank'], limit: PBATCH + 10 }
    );
    partners.push(...res);
  }
  const partnerMap = new Map<number, any>(partners.map((p: any) => [p.id, p]));

  const todayMs = now.getTime();
  const MS_PER_DAY = 86400000;

  const clients = regularIds.map(pid => {
    const s = stats.get(pid)!;
    const p = partnerMap.get(pid);
    if (!p) return null;
    const cats: number[] = p.category_id || [];
    if (cats.some((c: number) => EXCLUDED_CATEGORIES.includes(c))) return null;

    const consPerSettimana = s.cons_3m / 12.857;
    const giorniAttesi = s.cons_3m > 0 ? 90 / s.cons_3m : 999;
    const silenzioGiorni = s.ultimaConsegna ? Math.floor((todayMs - new Date(s.ultimaConsegna).getTime()) / MS_PER_DAY) : 999;
    const rapporto = giorniAttesi > 0 ? silenzioGiorni / giorniAttesi : 0;
    const allarme: Allarme = rapporto >= 2.0 ? 'GRAVE' : rapporto >= 1.5 ? 'SI' : 'NO';

    return {
      id: pid,
      name: p.name || `Partner #${pid}`,
      phone: p.phone || p.mobile || '',
      email: p.email || '',
      street: p.street || '',
      city: p.city || '',
      zip: p.zip || '',
      lat: p.partner_latitude || 0,
      lng: p.partner_longitude || 0,
      fatturato_6m: Math.round(s.fat_6m),
      fatturato_3m: Math.round(s.fat_3m),
      consegne_6m: s.cons_6m,
      consegne_3m: s.cons_3m,
      consPerSettimana: Math.round(consPerSettimana * 10) / 10,
      ultimaConsegna: s.ultimaConsegna ? s.ultimaConsegna.slice(0, 10) : '',
      silenzioGiorni,
      allarme,
      zona: getZona(p.zip),
      tier: getTier(s.fat_6m),
    };
  }).filter((c): c is NonNullable<typeof c> => c !== null);

  clients.sort((a, b) => b.fatturato_6m - a.fatturato_6m);

  const byZona: Record<string, number> = { lunedi: 0, mercoledi: 0, giovedi: 0 };
  for (const c of clients) byZona[c.zona]++;

  return { clients, stats: { total: clients.length, byZona } };
}

export async function GET(request: NextRequest) {
  try {
    const cookies = request.cookies.get('odoo_session_id')?.value || null;
    return NextResponse.json(await getClientsLive(cookies));
  } catch (e: any) {
    console.error('[recupero-clienti]', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookies = request.cookies.get('odoo_session_id')?.value || null;
    const body = await request.json().catch(() => ({} as any));
    const action = body.action || 'get_clients_live';

    switch (action) {
      case 'get_clients_live':
        return NextResponse.json(await getClientsLive(cookies));
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[recupero-clienti]', e);
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
