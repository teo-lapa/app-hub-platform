import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// GET: Fetch customers from Odoo
export async function GET(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Fetch only customers with portal access (user_id set)
    const customers = await client.searchRead(
      'res.partner',
      [
        ['customer_rank', '>', 0],
        ['active', '=', true],
        ['user_id', '!=', false]  // Solo clienti con accesso portale
      ],
      ['id', 'name', 'email', 'phone', 'city', 'country_id', 'user_id'],
      0,
      'name'
    );

    return NextResponse.json({
      success: true,
      data: customers.map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        city: customer.city || '',
        country: customer.country_id ? customer.country_id[1] : ''
      }))
    });

  } catch (error) {
    console.error('Errore caricamento clienti da Odoo:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore caricamento clienti',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
