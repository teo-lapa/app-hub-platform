import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/catalogo-venditori/customers
 *
 * Fetches all customers from Odoo for the Catalogo Venditori app
 *
 * Returns:
 * - List of customers with basic info and delivery addresses
 * - Sorted by name ASC
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 [CATALOGO-VENDITORI] Fetching customers from Odoo...');

    // Fetch all customers from Odoo
    const customers = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['customer_rank', '>', 0]],
        fields: [
          'id',
          'name',
          'ref',
          'email',
          'phone',
          'street',
          'city',
          'zip',
          'country_id',
          'child_ids'
        ],
        order: 'name ASC'
      }
    );

    console.log(`✅ [CATALOGO-VENDITORI] Found ${customers.length} customers`);

    // Transform data to a cleaner format
    const transformedCustomers = customers.map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      ref: customer.ref || null,
      email: customer.email || null,
      phone: customer.phone || null,
      street: customer.street || null,
      city: customer.city || null,
      zip: customer.zip || null,
      country: customer.country_id ? {
        id: customer.country_id[0],
        name: customer.country_id[1]
      } : null,
      childIds: customer.child_ids || []
    }));

    return NextResponse.json({
      success: true,
      data: transformedCustomers,
      count: transformedCustomers.length
    });

  } catch (error: any) {
    console.error('❌ [CATALOGO-VENDITORI] Error fetching customers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento dei clienti',
        details: error.message
      },
      { status: 500 }
    );
  }
}
