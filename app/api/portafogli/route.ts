import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Venditori target
const MIHAI = 14;
const SILVANO = 450;
const PAUL = 7;
const LAURA = 8;
const ECOMMERCE_TAG = 232; // res.partner.category "E-commerce B2C"
const DA = '2026-01-01'; // acquisti da gennaio

function colFromUser(userId: number | null): 'mihai' | 'silvano' | 'centro' {
  if (userId === MIHAI) return 'mihai';
  if (userId === SILVANO) return 'silvano';
  return 'centro';
}

/**
 * GET /api/portafogli
 * Pool clienti (aziende + privati) che hanno acquistato da gennaio,
 * ESCLUSI quelli col tag E-commerce. Pre-divisi per venditore attuale.
 */
export async function GET(_request: NextRequest) {
  try {
    // 1) Clienti distinti con ordini confermati da gennaio + fatturato
    const groups = await callOdooAsAdmin('sale.order', 'read_group', [
      [['date_order', '>=', DA], ['state', 'in', ['sale', 'done']]],
      ['amount_untaxed:sum'],
      ['commercial_partner_id'],
    ], { lazy: false });

    const fatturato: Record<number, number> = {};
    const ordini: Record<number, number> = {};
    for (const g of groups) {
      const cp = g.commercial_partner_id;
      if (!cp) continue;
      const id = Array.isArray(cp) ? cp[0] : cp;
      fatturato[id] = g.amount_untaxed || 0;
      ordini[id] = g.__count ?? g.commercial_partner_id_count ?? 0;
    }

    const ids = Object.keys(fatturato).map(Number);
    if (ids.length === 0) return NextResponse.json({ success: true, clienti: [] });

    // 2) Dettagli partner (escludi quelli col tag e-commerce)
    const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['id', 'in', ids], ['category_id', 'not in', [ECOMMERCE_TAG]]],
      fields: ['id', 'name', 'city', 'state_id', 'user_id', 'is_company'],
      limit: 2000,
    });

    const clienti = partners.map((p: any) => ({
      id: p.id,
      name: p.name,
      city: p.city || '',
      cantone: Array.isArray(p.state_id) ? p.state_id[1] : '',
      isCompany: !!p.is_company,
      venditore: Array.isArray(p.user_id) ? p.user_id[1] : '',
      venditoreId: Array.isArray(p.user_id) ? p.user_id[0] : null,
      fatturato: fatturato[p.id] || 0,
      ordini: ordini[p.id] || 0,
      col: colFromUser(Array.isArray(p.user_id) ? p.user_id[0] : null),
    }));

    // Ordina per fatturato decrescente (i piu' importanti in alto)
    clienti.sort((a: any, b: any) => b.fatturato - a.fatturato);

    return NextResponse.json({ success: true, count: clienti.length, clienti });
  } catch (error: any) {
    console.error('💥 [PORTAFOGLI/GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/portafogli
 * body: { changes: [{ id, target: 'mihai'|'silvano'|'centro', cur: venditoreId|null }] }
 * Scrive il venditore (user_id). 'centro' = Paul, ma se ha gia' Laura la lascia.
 */
export async function POST(request: NextRequest) {
  try {
    const { changes } = await request.json();
    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: false, error: 'Nessuna modifica' }, { status: 400 });
    }

    const toMihai = changes.filter((c: any) => c.target === 'mihai').map((c: any) => c.id);
    const toSilvano = changes.filter((c: any) => c.target === 'silvano').map((c: any) => c.id);
    // Centro = Paul, tranne chi ha gia' Laura (resta Laura)
    const toPaul = changes.filter((c: any) => c.target === 'centro' && c.cur !== LAURA).map((c: any) => c.id);

    let scritti = 0;
    if (toMihai.length) {
      await callOdooAsAdmin('res.partner', 'write', [toMihai, { user_id: MIHAI }]);
      scritti += toMihai.length;
    }
    if (toSilvano.length) {
      await callOdooAsAdmin('res.partner', 'write', [toSilvano, { user_id: SILVANO }]);
      scritti += toSilvano.length;
    }
    if (toPaul.length) {
      await callOdooAsAdmin('res.partner', 'write', [toPaul, { user_id: PAUL }]);
      scritti += toPaul.length;
    }

    return NextResponse.json({ success: true, scritti });
  } catch (error: any) {
    console.error('💥 [PORTAFOGLI/POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
