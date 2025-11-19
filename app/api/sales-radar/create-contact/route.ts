import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface CreateContactBody {
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  zip?: string;
  country?: string;
  types?: string[]; // Google Places types
  rating?: number;
  google_maps_url?: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
  comment?: string;
}

/**
 * POST /api/sales-radar/create-contact
 *
 * Crea un nuovo contatto/azienda in Odoo da dati Google Places
 *
 * Body:
 * - name: string (obbligatorio)
 * - phone: string
 * - website: string
 * - address: string
 * - city: string
 * - zip: string
 * - country: string
 * - types: string[] - Google Places types
 * - rating: number
 * - google_maps_url: string
 * - place_id: string
 * - latitude: number
 * - longitude: number
 * - comment: string
 *
 * Risposta:
 * - success: boolean
 * - contact: oggetto contatto creato
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: CreateContactBody = await request.json();

    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: 'Campo "name" richiesto'
      }, { status: 400 });
    }

    console.log('🏢 [CREATE-CONTACT] Creazione contatto:', body.name);

    // Cerca paese Odoo
    let countryId = null;
    if (body.country) {
      try {
        const countries = await client.searchRead(
          'res.country',
          [
            '|',
            ['name', 'ilike', body.country],
            ['code', 'ilike', body.country]
          ],
          ['id', 'name', 'code'],
          1
        );

        if (countries.length > 0) {
          countryId = countries[0].id;
          console.log(`🌍 Paese trovato: ${countries[0].name} (${countries[0].code})`);
        }
      } catch (error) {
        console.warn('⚠️ Errore ricerca paese:', error);
      }
    }

    // Prepara commento con info Google Places
    let comment = body.comment || '';

    if (body.rating) {
      comment += `\n📊 Rating Google: ${body.rating}/5`;
    }

    if (body.types && body.types.length > 0) {
      comment += `\n🏷️ Tipo attività: ${body.types.join(', ')}`;
    }

    if (body.google_maps_url) {
      comment += `\n🗺️ Google Maps: ${body.google_maps_url}`;
    }

    if (body.place_id) {
      comment += `\n🆔 Google Place ID: ${body.place_id}`;
    }

    if (body.latitude && body.longitude) {
      comment += `\n📍 Coordinate: ${body.latitude}, ${body.longitude}`;
    }

    comment += `\n\n⚡ Creato automaticamente da Sales Radar il ${new Date().toLocaleDateString('it-IT')}`;

    // Prepara valori per Odoo
    const contactValues: any = {
      name: body.name,
      is_company: true, // Sempre azienda per Sales Radar
      phone: body.phone || false,
      website: body.website || false,
      street: body.address || false,
      city: body.city || false,
      zip: body.zip || false,
      country_id: countryId || false,
      comment: comment.trim(),
      // Tags per identificare come "prospect da Sales Radar"
      category_id: [[6, 0, []]] // Vuoto per ora, potremmo aggiungere tag custom
    };

    // Rimuovi campi false (Odoo non li vuole)
    Object.keys(contactValues).forEach(key => {
      if (contactValues[key] === false) {
        delete contactValues[key];
      }
    });

    console.log('📝 Valori contatto:', contactValues);

    // Crea contatto in Odoo
    const newContactId = await client.callKw(
      'res.partner',
      'create',
      [contactValues]
    );

    if (!newContactId) {
      throw new Error('Creazione contatto fallita - nessun ID ritornato');
    }

    console.log(`✅ [CREATE-CONTACT] Contatto creato! ID: ${newContactId}`);

    // Recupera il contatto appena creato per ritornare dati completi
    const createdContacts = await client.searchRead(
      'res.partner',
      [['id', '=', newContactId]],
      [
        'id', 'name', 'display_name', 'email', 'phone', 'mobile',
        'street', 'zip', 'city', 'country_id', 'state_id',
        'website', 'vat', 'is_company', 'comment'
      ],
      1
    );

    if (createdContacts.length === 0) {
      throw new Error('Contatto creato ma non recuperabile');
    }

    const createdContact = createdContacts[0];

    return NextResponse.json({
      success: true,
      contact: {
        id: createdContact.id,
        name: createdContact.name,
        display_name: createdContact.display_name,
        email: createdContact.email || '',
        phone: createdContact.phone || '',
        mobile: createdContact.mobile || '',
        street: createdContact.street || '',
        zip: createdContact.zip || '',
        city: createdContact.city || '',
        country: createdContact.country_id ? createdContact.country_id[1] : '',
        state: createdContact.state_id ? createdContact.state_id[1] : '',
        website: createdContact.website || '',
        vat: createdContact.vat || '',
        is_company: createdContact.is_company,
        comment: createdContact.comment || ''
      },
      odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${newContactId}&model=res.partner&view_type=form`
    });

  } catch (error) {
    console.error('❌ [CREATE-CONTACT] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la creazione contatto',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
