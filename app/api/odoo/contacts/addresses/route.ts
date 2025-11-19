import { NextRequest, NextResponse } from 'next/server';
import { createOdoo } from '@/lib/odoo/odoo-helper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/odoo/contacts/addresses
 *
 * Creates a new address (delivery or invoice) for a contact in Odoo
 *
 * Body:
 * - parent_id: number - The parent contact ID
 * - type: 'delivery' | 'invoice' - Type of address
 * - street: string - Street address
 * - city: string - City
 * - zip: string - Postal code
 * - country_id: number - Country ID (default: 43 for Switzerland)
 * - name?: string - Optional name for the address
 *
 * Returns:
 * - success: boolean
 * - data: { id: number } - Created address ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parent_id, type, street, city, zip, country_id, name } = body;

    console.log('📍 [CREATE-ADDRESS] Creating address:', { parent_id, type, street, city, zip });

    // Validate required fields
    if (!parent_id || typeof parent_id !== 'number') {
      return NextResponse.json(
        { success: false, error: 'parent_id è richiesto e deve essere un numero' },
        { status: 400 }
      );
    }

    if (!type || !['delivery', 'invoice'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type deve essere "delivery" o "invoice"' },
        { status: 400 }
      );
    }

    // Prepare address data
    const addressData: any = {
      parent_id,
      type,
      name: name || (type === 'delivery' ? 'Indirizzo di consegna' : 'Indirizzo di fatturazione'),
    };

    // Add optional fields if provided
    if (street) addressData.street = street;
    if (city) addressData.city = city;
    if (zip) addressData.zip = zip;
    if (country_id) addressData.country_id = country_id;

    // Create address in Odoo
    const addressId = await createOdoo('res.partner', addressData);

    console.log(`✅ [CREATE-ADDRESS] Address created successfully: ${addressId}`);

    return NextResponse.json({
      success: true,
      data: { id: addressId }
    });

  } catch (error: any) {
    console.error('❌ [CREATE-ADDRESS] Error creating address:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nella creazione dell\'indirizzo',
        details: error.message
      },
      { status: 500 }
    );
  }
}
