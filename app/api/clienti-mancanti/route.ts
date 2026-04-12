import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';
import * as fs from 'fs';
import * as path from 'path';

const INTERNAL_PARTNERS = [1, 12, 18, 2421, 6524, 8570, 8852, 8998];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const FEEDBACK_FILE = path.join(process.cwd(), 'data', 'clienti-mancanti-feedback.json');

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;

  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() + diffToMon);
  thisWeekStart.setHours(0, 0, 0, 0);

  const thisWeekEnd = new Date(now);
  thisWeekEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
  lastWeekEnd.setHours(23, 59, 59, 999);

  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setDate(now.getDate() - 90);

  return { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, threeMonthsAgo };
}

async function getPartnerIdsFromPickings(cookies: string | null, dateStart: string, dateEnd: string): Promise<Set<number>> {
  const pickings = await callOdoo(cookies, 'stock.picking', 'search_read',
    [[['picking_type_code', '=', 'outgoing'], ['state', '=', 'done'], ['date_done', '>=', dateStart], ['date_done', '<=', dateEnd]]],
    { fields: ['sale_id'] }
  );

  const saleIds = pickings
    .filter((p: any) => p.sale_id && p.sale_id[0])
    .map((p: any) => p.sale_id[0]);

  if (saleIds.length === 0) return new Set();

  const orders = await callOdoo(cookies, 'sale.order', 'search_read',
    [[['id', 'in', saleIds]]],
    { fields: ['commercial_partner_id'] }
  );

  return new Set(orders.map((o: any) => o.commercial_partner_id[0]));
}

function classify(ordini3m: number, fatturato3m: number): string {
  if (ordini3m >= 4 && fatturato3m >= 2000) return 'hot';
  if (ordini3m >= 4 || fatturato3m >= 1000) return 'warm';
  return 'cold';
}

function loadFeedback(): Record<string, Record<string, string>> {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveFeedback(data: Record<string, Record<string, string>>) {
  const dir = path.dirname(FEEDBACK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2));
}

async function getWeeklyData(cookies: string | null) {
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd, threeMonthsAgo } = getWeekDates();

  const thisWeekPartners = await getPartnerIdsFromPickings(cookies, formatDate(thisWeekStart), formatDate(thisWeekEnd));
  const lastWeekPartners = await getPartnerIdsFromPickings(cookies, formatDate(lastWeekStart), formatDate(lastWeekEnd));

  const missingIds = Array.from(lastWeekPartners)
    .filter(id => !thisWeekPartners.has(id) && !INTERNAL_PARTNERS.includes(id));

  if (missingIds.length === 0) {
    return {
      weekStart: formatDate(thisWeekStart),
      weekEnd: formatDate(thisWeekEnd),
      lastWeekStart: formatDate(lastWeekStart),
      lastWeekEnd: formatDate(lastWeekEnd),
      totalLastWeek: lastWeekPartners.size,
      totalThisWeek: thisWeekPartners.size,
      clients: []
    };
  }

  const [history, partners] = await Promise.all([
    callOdoo(cookies, 'sale.order', 'search_read',
      [[['commercial_partner_id', 'in', missingIds], ['date_order', '>=', formatDate(threeMonthsAgo)], ['state', 'in', ['sale', 'done']]]],
      { fields: ['commercial_partner_id', 'amount_total', 'date_order'] }
    ),
    callOdoo(cookies, 'res.partner', 'search_read',
      [[['id', 'in', missingIds]]],
      { fields: ['name', 'phone', 'mobile', 'email', 'is_company'] }
    )
  ]);

  const partnerMap = new Map<number, any>(partners.map((p: any) => [p.id, p]));

  const stats: Record<number, { fatturato: number; ordini: number }> = {};
  for (const h of history) {
    const pid = h.commercial_partner_id[0];
    if (!stats[pid]) stats[pid] = { fatturato: 0, ordini: 0 };
    stats[pid].fatturato += h.amount_total;
    stats[pid].ordini += 1;
  }

  // Daily status: check each day of current week
  const dailyDeliveries: Record<string, Map<number, { orderId: number; orderName: string; amount: number }>> = {};
  const currentDay = thisWeekEnd.getDay() === 0 ? 7 : thisWeekEnd.getDay();

  for (let i = 0; i < currentDay; i++) {
    const dayDate = new Date(thisWeekStart);
    dayDate.setDate(thisWeekStart.getDate() + i);
    const dayStr = formatDate(dayDate);
    const dayKey = DAY_KEYS[i];

    const dayPickings = await callOdoo(cookies, 'stock.picking', 'search_read',
      [[['picking_type_code', '=', 'outgoing'], ['state', '=', 'done'], ['date_done', '>=', dayStr], ['date_done', '<=', dayStr + ' 23:59:59']]],
      { fields: ['sale_id'] }
    );

    const daySaleIds = dayPickings
      .filter((p: any) => p.sale_id && p.sale_id[0])
      .map((p: any) => p.sale_id[0]);

    if (daySaleIds.length > 0) {
      const dayOrders = await callOdoo(cookies, 'sale.order', 'search_read',
        [[['id', 'in', daySaleIds]]],
        { fields: ['commercial_partner_id', 'name', 'amount_total'] }
      );

      const dayMap = new Map<number, { orderId: number; orderName: string; amount: number }>();
      for (const o of dayOrders) {
        const pid = o.commercial_partner_id[0];
        if (missingIds.includes(pid)) {
          dayMap.set(pid, { orderId: o.id, orderName: o.name, amount: o.amount_total });
        }
      }
      dailyDeliveries[dayKey] = dayMap;
    } else {
      dailyDeliveries[dayKey] = new Map();
    }
  }

  const feedbackData = loadFeedback();
  const weekFeedback = feedbackData[formatDate(thisWeekStart)] || {};

  const clients = missingIds
    .filter(id => {
      const partner = partnerMap.get(id);
      if (!partner || !partner.is_company) return false;
      const s = stats[id] || { fatturato: 0, ordini: 0 };
      return s.ordini >= 2;
    })
    .map(id => {
      const partner = partnerMap.get(id);
      const s = stats[id] || { fatturato: 0, ordini: 0 };
      const dailyStatus: Record<string, any> = {};
      let recovered = false;

      for (let i = 0; i < 7; i++) {
        const key = DAY_KEYS[i];
        const dayMap = dailyDeliveries[key];
        if (dayMap && dayMap.has(id)) {
          const d = dayMap.get(id)!;
          dailyStatus[key] = { orderId: d.orderId, orderName: d.orderName, amount: d.amount };
          recovered = true;
        } else {
          dailyStatus[key] = null;
        }
      }

      return {
        id,
        name: partner?.name || `Partner #${id}`,
        phone: partner?.phone || partner?.mobile || '',
        email: partner?.email || '',
        fatturato3m: Math.round(s.fatturato),
        ordini3m: s.ordini,
        mediaOrdine: s.ordini > 0 ? Math.round(s.fatturato / s.ordini) : 0,
        category: classify(s.ordini, s.fatturato),
        dailyStatus,
        recovered,
        feedback: weekFeedback[String(id)] || ''
      };
    });

  clients.sort((a, b) => b.fatturato3m - a.fatturato3m);

  return {
    weekStart: formatDate(thisWeekStart),
    weekEnd: formatDate(thisWeekEnd),
    lastWeekStart: formatDate(lastWeekStart),
    lastWeekEnd: formatDate(lastWeekEnd),
    totalLastWeek: lastWeekPartners.size,
    totalThisWeek: thisWeekPartners.size,
    clients
  };
}

async function getClientProducts(cookies: string | null, partnerId: number) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

  const lines = await callOdoo(cookies, 'sale.order.line', 'search_read',
    [[['order_id.commercial_partner_id', '=', partnerId], ['order_id.state', 'in', ['sale', 'done']], ['order_id.date_order', '>=', formatDate(threeMonthsAgo)]]],
    { fields: ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal'] }
  );

  const grouped: Record<number, { name: string; qty: number; total: number; count: number }> = {};
  for (const l of lines) {
    const pid = l.product_id[0];
    const pname = l.product_id[1];
    if (!grouped[pid]) grouped[pid] = { name: pname, qty: 0, total: 0, count: 0 };
    grouped[pid].qty += l.product_uom_qty;
    grouped[pid].total += l.price_subtotal;
    grouped[pid].count += 1;
  }

  const products = Object.entries(grouped)
    .map(([id, g]) => ({
      productId: Number(id),
      name: g.name,
      qty: Math.round(g.qty * 100) / 100,
      times: g.count,
      totalAmount: Math.round(g.total),
      avgPrice: g.qty > 0 ? Math.round(g.total / g.qty * 100) / 100 : 0
    }))
    .sort((a, b) => b.times - a.times)
    .slice(0, 20);

  return { products };
}

async function getClientOrders(cookies: string | null, partnerId: number) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

  const orders = await callOdoo(cookies, 'sale.order', 'search_read',
    [[['commercial_partner_id', '=', partnerId], ['state', 'in', ['sale', 'done']], ['date_order', '>=', formatDate(sixMonthsAgo)]]],
    { fields: ['id', 'name', 'date_order', 'amount_total'], order: 'date_order asc' }
  );

  const weekMap: Record<string, { amount: number; orders: number }> = {};
  for (const o of orders) {
    const d = new Date(o.date_order);
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const wk = `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
    if (!weekMap[wk]) weekMap[wk] = { amount: 0, orders: 0 };
    weekMap[wk].amount += o.amount_total;
    weekMap[wk].orders += 1;
  }

  const trends = Object.entries(weekMap).map(([week, v]) => ({
    week,
    amount: Math.round(v.amount),
    orders: v.orders
  }));

  return { trends, orders };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const cookies = request.cookies.get('odoo_session_id')?.value || null;

    switch (action) {
      case 'get_weekly_data':
        return NextResponse.json(await getWeeklyData(cookies));

      case 'get_client_products':
        if (!body.partnerId) return NextResponse.json({ error: 'partnerId required' }, { status: 400 });
        return NextResponse.json(await getClientProducts(cookies, body.partnerId));

      case 'get_client_orders':
        if (!body.partnerId) return NextResponse.json({ error: 'partnerId required' }, { status: 400 });
        return NextResponse.json(await getClientOrders(cookies, body.partnerId));

      case 'save_feedback': {
        if (!body.partnerId || !body.weekStart) return NextResponse.json({ error: 'partnerId and weekStart required' }, { status: 400 });
        const data = loadFeedback();
        if (!data[body.weekStart]) data[body.weekStart] = {};
        data[body.weekStart][String(body.partnerId)] = body.feedback || '';
        saveFeedback(data);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[clienti-mancanti]', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
