import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * DEBUG: Cerca in TUTTI i contatti, non solo fornitori
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    console.log('🔍 Cercando in TUTTI i contatti:', name);

    // Cerca in TUTTI i partner (senza filtro supplier_rank)
    const allContacts = await callOdoo(cookies, 'res.partner', 'search_read', [
      [['name', 'ilike', name]],
      ['id', 'name', 'vat', 'supplier_rank', 'customer_rank', 'is_company']
    ]);

    console.log(`   Trovati ${allContacts.length} contatti`);

    return NextResponse.json({
      success: true,
      query: name,
      total_found: allContacts.length,
      contacts: allContacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        vat: c.vat,
        supplier_rank: c.supplier_rank,
        customer_rank: c.customer_rank,
        is_company: c.is_company,
        type: c.supplier_rank > 0 ? 'FORNITORE' : c.customer_rank > 0 ? 'CLIENTE' : 'CONTATTO'
      }))
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
