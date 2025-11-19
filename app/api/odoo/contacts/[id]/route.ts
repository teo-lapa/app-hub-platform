import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// PUT: Update a contact in Odoo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const contactId = parseInt(params.id);

    if (isNaN(contactId)) {
      return NextResponse.json({
        success: false,
        error: 'ID contatto non valido'
      }, { status: 400 });
    }

    // Get update data from request body
    const updateData = await request.json();

    // Update the contact
    const result = await client.write('res.partner', [contactId], updateData);

    if (!result) {
      throw new Error('Errore durante l\'aggiornamento del contatto');
    }

    // Fetch the updated contact to return it
    const updatedContact = await client.read(
      'res.partner',
      [contactId],
      ['id', 'name', 'display_name', 'email', 'phone', 'parent_id', 'is_company']
    );

    return NextResponse.json({
      success: true,
      data: updatedContact[0] ? {
        id: updatedContact[0].id,
        name: updatedContact[0].name,
        display_name: updatedContact[0].display_name,
        email: updatedContact[0].email || '',
        phone: updatedContact[0].phone || '',
        parent_id: updatedContact[0].parent_id ? updatedContact[0].parent_id[0] : null,
        parent_name: updatedContact[0].parent_id ? updatedContact[0].parent_id[1] : null,
        is_company: updatedContact[0].is_company
      } : null
    });

  } catch (error) {
    console.error('Errore aggiornamento contatto in Odoo:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore aggiornamento contatto',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET: Fetch a specific contact by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const contactId = parseInt(params.id);

    if (isNaN(contactId)) {
      return NextResponse.json({
        success: false,
        error: 'ID contatto non valido'
      }, { status: 400 });
    }

    // Fetch the contact
    const contact = await client.read(
      'res.partner',
      [contactId],
      ['id', 'name', 'display_name', 'email', 'phone', 'city', 'country_id', 'is_company', 'parent_id', 'vat']
    );

    if (!contact || contact.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contatto non trovato'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: contact[0].id,
        name: contact[0].name,
        display_name: contact[0].display_name,
        email: contact[0].email || '',
        phone: contact[0].phone || '',
        city: contact[0].city || '',
        country: contact[0].country_id ? contact[0].country_id[1] : '',
        is_company: contact[0].is_company,
        parent_id: contact[0].parent_id ? contact[0].parent_id[0] : null,
        parent_name: contact[0].parent_id ? contact[0].parent_id[1] : null,
        vat: contact[0].vat || ''
      }
    });

  } catch (error) {
    console.error('Errore caricamento contatto da Odoo:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore caricamento contatto',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
