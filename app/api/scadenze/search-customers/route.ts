import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo/odoo-helper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/scadenze/search-customers?q=...
 * Ricerca clienti (res.partner con customer_rank>0) per nome, citta' o telefono.
 * Usata dall'azione "Inserisci in ordine" della Gestione Scadenze.
 */
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim();

    if (q.length < 2) {
      return NextResponse.json({ success: true, customers: [] });
    }

    const domain: any[] = [
      ['customer_rank', '>', 0],
      '|', '|',
      ['name', 'ilike', q],
      ['city', 'ilike', q],
      ['phone', 'ilike', q],
    ];

    const customers = await callOdoo('res.partner', 'search_read', [], {
      domain,
      fields: ['id', 'name', 'city', 'phone', 'street'],
      limit: 30,
      order: 'name asc',
    });

    return NextResponse.json({ success: true, customers: customers || [] });
  } catch (error: any) {
    console.error('❌ [scadenze/search-customers] Errore:', error);
    return NextResponse.json(
      { success: false, customers: [], error: error.message || 'Errore ricerca clienti' },
      { status: 500 }
    );
  }
}
