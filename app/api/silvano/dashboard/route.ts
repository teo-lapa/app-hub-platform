import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, resolveSalesperson, getClientPrice } from '@/lib/silvano/odoo';
import { computeMarginInfo, marginAtPrice } from '@/lib/silvano/margin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/silvano/dashboard?from=&to=
 * KPI del venditore: fatturato, ordini, provvigioni maturate (margine), top clienti, andamento.
 * Default: mese corrente.
 */
export async function GET(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const sp = request.nextUrl.searchParams;

    const now = new Date();
    const defFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defTo = now.toISOString().slice(0, 10);
    const from = sp.get('from') || defFrom;
    const to = sp.get('to') || defTo;

    // Finestra precedente di pari durata (per il trend)
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
    const prevTo = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(from).getTime() - days * 86400000).toISOString().slice(0, 10);

    // Clienti del portafoglio del venditore (res.partner.user_id). Il fatturato di
    // questi clienti conta per il venditore ANCHE se l'ordine lo fa il cliente da solo
    // (sito) o un altro venditore. Si aggrega per azienda madre (commercial_partner_id).
    let clientIds: number[] = [];
    if (seller.userId) {
      const myPartners = await callOdooAsAdmin('res.partner', 'search_read', [], {
        domain: [['user_id', '=', seller.userId]],
        fields: ['commercial_partner_id'],
        limit: 5000,
      });
      clientIds = Array.from(new Set(
        myPartners
          .map((p: any) => (p.commercial_partner_id ? p.commercial_partner_id[0] : null))
          .filter((x: any): x is number => !!x)
      ));
    }

    const baseDomain = (f: string, t: string): any[] => {
      const d: any[] = [
        ['date_order', '>=', `${f} 00:00:00`],
        ['date_order', '<=', `${t} 23:59:59`],
        ['state', 'in', ['sale', 'done']],
      ];
      if (clientIds.length) d.push(['commercial_partner_id', 'in', clientIds]);
      else if (seller.userId) d.push(['user_id', '=', seller.userId]);
      return d;
    };

    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: baseDomain(from, to),
      fields: ['id', 'name', 'partner_id', 'commercial_partner_id', 'amount_untaxed', 'pricelist_id', 'order_line', 'date_order'],
      limit: 2000,
    });

    const prevOrders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: baseDomain(prevFrom, prevTo),
      fields: ['amount_untaxed'],
      limit: 1000,
    });

    const fatturato = orders.reduce((s: number, o: any) => s + (o.amount_untaxed || 0), 0);
    const fatturatoPrev = prevOrders.reduce((s: number, o: any) => s + (o.amount_untaxed || 0), 0);

    // Top clienti
    const perCliente = new Map<number, { name: string; revenue: number; orders: number }>();
    const perMese = new Map<string, number>();
    for (const o of orders) {
      const cp = o.commercial_partner_id || o.partner_id;
      if (cp) {
        const cid = cp[0];
        const cur = perCliente.get(cid) || { name: cp[1], revenue: 0, orders: 0 };
        cur.revenue += o.amount_untaxed || 0;
        cur.orders += 1;
        perCliente.set(cid, cur);
      }
      const ym = (o.date_order || '').slice(0, 7); // YYYY-MM
      if (ym) perMese.set(ym, (perMese.get(ym) || 0) + (o.amount_untaxed || 0));
    }
    const andamento = Array.from(perMese.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, revenue]) => ({ ym, revenue }));
    const topClienti = Array.from(perCliente.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Provvigioni maturate (margine venditore sulle righe) — dataset piccolo al lancio
    const lineIds: number[] = orders.flatMap((o: any) => o.order_line || []);
    let provvigioni = 0;
    if (lineIds.length) {
      const lines = await callOdooAsAdmin('sale.order.line', 'search_read', [], {
        domain: [['id', 'in', lineIds], ['display_type', '=', false], ['product_id', '!=', false]],
        fields: ['product_id', 'product_uom_qty', 'price_unit', 'order_id'],
        limit: 5000,
      });
      const orderMap = new Map(orders.map((o: any) => [o.id, o]));
      const productIds = Array.from(new Set(lines.map((l: any) => l.product_id[0])));
      const products = await callOdooAsAdmin('product.product', 'search_read', [], {
        domain: [['id', 'in', productIds]],
        fields: ['id', 'standard_price', 'list_price'],
      });
      const pmap = new Map(products.map((p: any) => [p.id, p]));
      const baseCache = new Map<string, number>();
      const MAX_PRICE_LOOKUPS = 400; // tetto anti-timeout (anteprima admin su tutta l'azienda)

      for (const l of lines) {
        const pid = l.product_id[0];
        const prod: any = pmap.get(pid);
        if (!prod) continue;
        const ord: any = orderMap.get(l.order_id[0]);
        const pricelistId = ord?.pricelist_id ? ord.pricelist_id[0] : null;
        const partnerId = ord?.partner_id ? ord.partner_id[0] : null;
        let base = prod.list_price || l.price_unit || 0;
        if (pricelistId) {
          const key = `${pricelistId}:${pid}`;
          if (baseCache.has(key)) base = baseCache.get(key)!;
          else if (baseCache.size < MAX_PRICE_LOOKUPS) {
            const cp = await getClientPrice(pricelistId, pid, l.product_uom_qty || 1, partnerId);
            if (cp != null) base = cp;
            baseCache.set(key, base);
          }
        }
        const info = computeMarginInfo(base, prod.standard_price || 0);
        provvigioni += marginAtPrice(l.price_unit || 0, info.floor) * (l.product_uom_qty || 0);
      }
    }

    const trend = fatturatoPrev > 0 ? ((fatturato - fatturatoPrev) / fatturatoPrev) * 100 : null;

    return NextResponse.json({
      success: true,
      seller,
      periodo: { from, to },
      kpi: {
        fatturato,
        fatturatoPrev,
        trendPct: trend,
        ordini: orders.length,
        clientiAttivi: perCliente.size,
        provvigioni,
        ticketMedio: orders.length ? fatturato / orders.length : 0,
      },
      topClienti,
      andamento,
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/dashboard]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
