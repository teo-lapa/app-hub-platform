import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ECOMMERCE_TAG = 232;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const giorniTra = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

/**
 * GET /api/portafogli/dettaglio?id=<commercial_partner_id>
 * Dati ricchi per l'analisi di UN cliente (aggregati su azienda).
 */
export async function GET(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ success: false, error: 'id mancante' }, { status: 400 });

    const now = new Date();
    const oggi = ymd(now);
    const start18 = `${now.getUTCFullYear() - 1}-01-01`; // da gen anno scorso (18 mesi)
    const start12 = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)));

    const baseDomain = [['commercial_partner_id', '=', id], ['state', 'in', ['sale', 'done']]];

    const [partnerArr, serieRows, totAll, primo, ultimo, topRows] = await Promise.all([
      callOdooAsAdmin('res.partner', 'read', [[id]], {
        fields: ['name', 'city', 'state_id', 'user_id', 'credit', 'total_due', 'category_id', 'is_company'],
      }),
      callOdooAsAdmin('sale.order', 'read_group', [
        [['commercial_partner_id', '=', id], ['state', 'in', ['sale', 'done']], ['date_order', '>=', start18]],
        ['amount_untaxed:sum'], ['date_order:month'],
      ], { lazy: false }),
      callOdooAsAdmin('sale.order', 'read_group', [baseDomain, ['amount_untaxed:sum'], []], { lazy: false }),
      callOdooAsAdmin('sale.order', 'search_read', [], {
        domain: baseDomain, fields: ['date_order'], order: 'date_order asc', limit: 1,
      }),
      callOdooAsAdmin('sale.order', 'search_read', [], {
        domain: baseDomain, fields: ['date_order'], order: 'date_order desc', limit: 1,
      }),
      callOdooAsAdmin('sale.order.line', 'read_group', [
        [['order_id.commercial_partner_id', '=', id], ['order_id.state', 'in', ['sale', 'done']], ['order_id.date_order', '>=', start12]],
        ['price_subtotal:sum', 'product_uom_qty:sum'], ['product_id'],
      ], { lazy: false, orderby: 'price_subtotal desc', limit: 8 }),
    ]);

    const p = partnerArr[0] || {};

    // Tag/stato (nomi), escluso e-commerce
    const catIds: number[] = (p.category_id || []).filter((x: number) => x !== ECOMMERCE_TAG);
    let tags: string[] = [];
    if (catIds.length) {
      const cats = await callOdooAsAdmin('res.partner.category', 'read', [catIds], { fields: ['name'] });
      tags = cats.map((c: any) => c.name);
    }

    // Serie mensile 18 mesi (chiave YYYY-MM)
    const mp: Record<string, number> = {};
    for (const r of serieRows) {
      const from: string = r.__range?.['date_order:month']?.from || '';
      const m = from.slice(0, 7);
      if (m) mp[m] = r.amount_untaxed || 0;
    }
    // genera tutti i mesi da start18 a mese corrente
    const months: string[] = [];
    let cur = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cur <= end) {
      months.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`);
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
    const valori = months.map(m => mp[m] || 0);

    // YoY: anno corrente (gen..mese corrente) vs stesso periodo anno scorso
    const annoCur = now.getUTCFullYear();
    const meseCur = now.getUTCMonth(); // 0-based
    let ytdCur = 0, ytdPrev = 0;
    months.forEach((m, i) => {
      const [yy, mm] = m.split('-').map(Number);
      if (yy === annoCur && mm - 1 <= meseCur) ytdCur += valori[i];
      if (yy === annoCur - 1 && mm - 1 <= meseCur) ytdPrev += valori[i];
    });
    const yoyPct = ytdPrev ? Math.round(((ytdCur - ytdPrev) / ytdPrev) * 100) : null;

    const ordiniTotali = totAll[0]?.__count || 0;
    const fatturatoTotale = totAll[0]?.amount_untaxed || 0;
    const primoOrdine = primo[0]?.date_order ? String(primo[0].date_order).slice(0, 10) : null;
    const ultimoOrdine = ultimo[0]?.date_order ? String(ultimo[0].date_order).slice(0, 10) : null;
    const giorniDaUltimo = ultimoOrdine ? giorniTra(ultimoOrdine, oggi) : null;
    const freqGiorni = primoOrdine && ultimoOrdine && ordiniTotali > 1
      ? Math.round(giorniTra(primoOrdine, ultimoOrdine) / (ordiniTotali - 1)) : null;

    return NextResponse.json({
      success: true,
      info: {
        name: p.name, venditore: Array.isArray(p.user_id) ? p.user_id[1] : '',
        credit: p.credit || 0, totalDue: p.total_due || 0, tags,
        primoOrdine, ultimoOrdine, giorniDaUltimo,
        ordiniTotali, fatturatoTotale,
        ticketMedio: ordiniTotali ? fatturatoTotale / ordiniTotali : 0,
        freqGiorni,
      },
      serie: { months, valori },
      yoy: { ytdCur, ytdPrev, pct: yoyPct },
      topProdotti: topRows.map((r: any) => ({
        name: Array.isArray(r.product_id) ? r.product_id[1] : '',
        subtotal: r.price_subtotal || 0, qty: r.product_uom_qty || 0, count: r.__count || 0,
      })),
    });
  } catch (error: any) {
    console.error('💥 [PORTAFOGLI/dettaglio]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
