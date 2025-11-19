import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    console.log('[VOICE-CONTACT] Creating contact:', data);

    // Validate required field
    if (!data.name) {
      return NextResponse.json(
        { success: false, error: 'Nome è obbligatorio' },
        { status: 400 }
      );
    }

    // Import Odoo helper
    const { createOdoo, readOdoo } = await import('@/lib/odoo/odoo-helper');

    // Prepare contact data
    const contactData: any = {
      name: data.name,
      is_company: false, // Voice contacts are always persons
    };

    // Add optional fields
    if (data.phone) contactData.phone = data.phone;
    if (data.mobile) contactData.mobile = data.mobile;
    if (data.email) contactData.email = data.email;
    if (data.street) contactData.street = data.street;
    if (data.zip) contactData.zip = data.zip;
    if (data.city) contactData.city = data.city;
    if (data.state) contactData.state_id = data.state;
    if (data.country) contactData.country_id = data.country;
    if (data.comment) contactData.comment = data.comment;

    // Create contact in Odoo
    const contactId = await createOdoo('res.partner', contactData);

    // Read back the created contact
    const contactArray = await readOdoo('res.partner', [contactId], [
      'id',
      'name',
      'display_name',
      'email',
      'phone',
      'mobile',
    ]);

    const contact = contactArray && contactArray.length > 0 ? contactArray[0] : null;

    if (!contact) {
      throw new Error('Errore nella lettura del contatto creato');
    }

    console.log('[VOICE-CONTACT] Contact created:', contact);

    return NextResponse.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('[VOICE-CONTACT] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Errore durante la creazione del contatto';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
