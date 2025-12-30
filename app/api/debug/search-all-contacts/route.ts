import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

// CORS headers per permettere chiamate da lapa.ch
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { ...init, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * DEBUG: Cerca in TUTTI i contatti, non solo fornitori
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return jsonResponse({ error: 'Sessione non valida' }, { status: 401 });
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

    return jsonResponse({
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
    return jsonResponse({
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
