import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * GET /api/debug-linde
 *
 * Debug endpoint per vedere tutti i dati dei partner "linde"
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // Cerca tutti i partner con "linde" nel nome
    const allLindePartners = await rpc.searchRead(
      'res.partner',
      [['name', 'ilike', 'linde']],
      ['id', 'name', 'is_company', 'type', 'parent_id', 'active', 'customer_rank', 'email', 'phone', 'city'],
      100,
      'name ASC'
    );

    // Ora applica il filtro dell'API /api/customers per vedere cosa viene escluso
    const filteredPartners = await rpc.searchRead(
      'res.partner',
      [
        ['name', 'ilike', 'linde'],
        ['active', '=', true],
        ['type', 'not in', ['delivery', 'invoice']]
      ],
      ['id', 'name', 'is_company', 'type', 'parent_id', 'active', 'customer_rank', 'email', 'phone', 'city'],
      100,
      'name ASC'
    );

    return NextResponse.json({
      success: true,
      totalFound: allLindePartners.length,
      afterFilter: filteredPartners.length,
      allPartners: allLindePartners.map((p: any) => ({
        id: p.id,
        name: p.name,
        is_company: p.is_company,
        type: p.type,
        parent_id: p.parent_id ? { id: p.parent_id[0], name: p.parent_id[1] } : null,
        active: p.active,
        customer_rank: p.customer_rank,
        email: p.email,
        phone: p.phone,
        city: p.city
      })),
      filteredPartners: filteredPartners.map((p: any) => ({
        id: p.id,
        name: p.name,
        is_company: p.is_company,
        type: p.type,
        parent_id: p.parent_id ? { id: p.parent_id[0], name: p.parent_id[1] } : null,
        active: p.active,
        customer_rank: p.customer_rank,
        email: p.email,
        phone: p.phone,
        city: p.city
      })),
      excludedPartners: allLindePartners.filter((p: any) =>
        !filteredPartners.find((f: any) => f.id === p.id)
      ).map((p: any) => ({
        id: p.id,
        name: p.name,
        is_company: p.is_company,
        type: p.type,
        parent_id: p.parent_id ? { id: p.parent_id[0], name: p.parent_id[1] } : null,
        active: p.active,
        customer_rank: p.customer_rank,
        reason: !p.active ? 'inactive' : (p.type === 'delivery' || p.type === 'invoice') ? `type=${p.type}` : 'unknown'
      }))
    });

  } catch (error: any) {
    console.error('❌ Error in debug-linde:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
