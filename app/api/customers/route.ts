import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPC } from '@/lib/odoo-rpc';

/**
 * GET /api/customers
 *
 * Carica tutti i clienti attivi da Odoo
 */
export async function GET(request: NextRequest) {
  try {
    const rpc = await createOdooRPC();

    // Carica tutti i partner che sono clienti (customer = true)
    const customers = await rpc.searchRead(
      'res.partner',
      [
        ['customer_rank', '>', 0], // È un cliente
        ['active', '=', true],
        ['parent_id', '=', false] // Solo aziende principali, non contatti
      ],
      ['id', 'name', 'email', 'phone', 'city'],
      { limit: 1000, order: 'name ASC' }
    );

    return NextResponse.json({
      success: true,
      customers: customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        city: c.city || null
      })),
      totalCount: customers.length
    });

  } catch (error: any) {
    console.error('❌ Error loading customers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
