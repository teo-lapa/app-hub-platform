import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// GET: Search contacts in Odoo
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

    // Get search query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || ''; // 'company' or 'person'
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build domain filter
    const domain: any[] = [
      ['active', '=', true],
    ];

    // Add search filter if provided
    if (search) {
      domain.push(['name', 'ilike', search]);
    }

    // Add type filter
    if (type === 'company') {
      domain.push(['is_company', '=', true]);
    } else if (type === 'person') {
      domain.push(['is_company', '=', false]);
    }

    // Search contacts
    const contacts = await client.searchRead(
      'res.partner',
      domain,
      ['id', 'name', 'display_name', 'email', 'phone', 'city', 'country_id', 'is_company', 'parent_id', 'vat'],
      limit,
      'name'
    );

    return NextResponse.json({
      success: true,
      data: contacts.map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        display_name: contact.display_name,
        email: contact.email || '',
        phone: contact.phone || '',
        city: contact.city || '',
        country: contact.country_id ? contact.country_id[1] : '',
        is_company: contact.is_company,
        parent_id: contact.parent_id ? contact.parent_id[0] : null,
        parent_name: contact.parent_id ? contact.parent_id[1] : null,
        vat: contact.vat || ''
      }))
    });

  } catch (error) {
    console.error('Errore ricerca contatti da Odoo:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore ricerca contatti',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
