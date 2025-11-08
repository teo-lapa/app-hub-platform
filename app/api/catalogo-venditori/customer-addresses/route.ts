import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/catalogo-venditori/customer-addresses
 *
 * Fetches delivery addresses for a specific customer from Odoo
 *
 * Body:
 * - customerId: number - The customer's partner ID
 *
 * Returns:
 * - List of delivery addresses for the customer
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CATALOGO-VENDITORI] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerId } = body;

    console.log('📍 [CATALOGO-VENDITORI] Fetching addresses for customer:', customerId);

    // Validate input
    if (!customerId || typeof customerId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'customerId è richiesto e deve essere un numero'
        },
        { status: 400 }
      );
    }

    // Fetch delivery addresses from Odoo
    const addresses = await callOdoo(cookies, 
      'res.partner',
      'search_read',
      [],
      {
        domain: [
          ['parent_id', '=', customerId],
          ['type', '=', 'delivery']
        ],
        fields: [
          'id',
          'name',
          'street',
          'street2',
          'city',
          'zip',
          'country_id',
          'phone'
        ]
      }
    );

    console.log(`✅ [CATALOGO-VENDITORI] Found ${addresses.length} delivery addresses for customer ${customerId}`);

    // Transform data to a cleaner format
    const transformedAddresses = addresses.map((address: any) => ({
      id: address.id,
      name: address.name,
      street: address.street || null,
      street2: address.street2 || null,
      city: address.city || null,
      zip: address.zip || null,
      country: address.country_id ? {
        id: address.country_id[0],
        name: address.country_id[1]
      } : null,
      phone: address.phone || null
    }));

    return NextResponse.json({
      success: true,
      data: transformedAddresses,
      count: transformedAddresses.length
    });

  } catch (error: any) {
    console.error('❌ [CATALOGO-VENDITORI] Error fetching customer addresses:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento degli indirizzi',
        details: error.message
      },
      { status: 500 }
    );
  }
}
