import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface ConvertLeadBody {
  lead_id: number;
}

/**
 * POST /api/sales-radar/convert-lead-to-contact
 *
 * Converte un lead (crm.lead) in un contatto (res.partner) in Odoo.
 * Utilizza il metodo standard di Odoo per convertire il lead.
 *
 * Body:
 * - lead_id: number (obbligatorio) - ID del lead da convertire
 *
 * Risposta:
 * - success: boolean
 * - partner_id: number - ID del contatto creato
 * - partner: oggetto contatto creato
 * - odoo_url: string - URL per aprire il contatto in Odoo
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
    const body: ConvertLeadBody = await request.json();

    if (!body.lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Campo "lead_id" richiesto'
      }, { status: 400 });
    }

    console.log(`🔄 [CONVERT-LEAD] Conversione lead ID: ${body.lead_id}`);

    // 1. Get lead data
    const leads = await client.searchRead(
      'crm.lead',
      [['id', '=', body.lead_id]],
      [
        'id', 'name', 'partner_name', 'email_from', 'phone', 'mobile',
        'street', 'city', 'zip', 'country_id', 'state_id',
        'website', 'description', 'tag_ids', 'partner_latitude', 'partner_longitude'
      ],
      1
    );

    if (leads.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Lead con ID ${body.lead_id} non trovato`
      }, { status: 404 });
    }

    const lead = leads[0];
    console.log(`📋 [CONVERT-LEAD] Lead trovato: ${lead.name}`);

    // 2. Parse address to extract city, province, zip from the full address string
    // Address format from Google: "Via Example 123, 6900 Lugano, Switzerland"
    let parsedCity = lead.city || '';
    let parsedZip = lead.zip || '';
    let parsedStreet = lead.street || '';
    let parsedState = lead.state_id || false;

    if (!parsedCity && lead.street) {
      // Try to parse city and zip from address string
      // Common formats: "Via Example 123, 6900 Lugano, Switzerland"
      // or "Via Example 123, Lugano, Ticino"
      const addressParts = lead.street.split(',').map((s: string) => s.trim());

      if (addressParts.length >= 2) {
        // Last part is usually country
        // Second to last is usually "ZIP City" or "City, Province"
        const cityPart = addressParts[addressParts.length - 2];

        // Try to extract ZIP + City (e.g., "6900 Lugano")
        const zipCityMatch = cityPart.match(/^(\d{4,5})\s+(.+)$/);
        if (zipCityMatch) {
          parsedZip = zipCityMatch[1];
          parsedCity = zipCityMatch[2];
        } else {
          // No ZIP, just city name
          parsedCity = cityPart;
        }

        // First part is the street address
        parsedStreet = addressParts[0];

        console.log(`📍 [CONVERT-LEAD] Address parsed: street="${parsedStreet}", city="${parsedCity}", zip="${parsedZip}"`);
      }
    }

    // If still no city, try to get it from the address in description
    if (!parsedCity && lead.description) {
      const addressMatch = lead.description.match(/Indirizzo:\s*(.+?)(?:\n|$)/);
      if (addressMatch) {
        const fullAddress = addressMatch[1];
        const parts = fullAddress.split(',').map((s: string) => s.trim());
        if (parts.length >= 2) {
          const cityPart = parts[parts.length - 2];
          const zipCityMatch = cityPart.match(/^(\d{4,5})\s+(.+)$/);
          if (zipCityMatch) {
            parsedZip = zipCityMatch[1];
            parsedCity = zipCityMatch[2];
            parsedStreet = parts[0];
          }
        }
      }
    }

    // Get Switzerland country and Ticino state IDs
    let switzerlandId = lead.country_id ? (Array.isArray(lead.country_id) ? lead.country_id[0] : lead.country_id) : false;
    let ticinoId = parsedState;

    // If no country, search for Switzerland
    if (!switzerlandId) {
      try {
        const countries = await client.searchRead(
          'res.country',
          [['code', '=', 'CH']],
          ['id', 'name'],
          1
        );
        if (countries.length > 0) {
          switzerlandId = countries[0].id;
          console.log(`🇨🇭 [CONVERT-LEAD] Switzerland ID: ${switzerlandId}`);
        }
      } catch (e) {
        console.warn('⚠️ [CONVERT-LEAD] Cannot find Switzerland country');
      }
    }

    // Search for Ticino state (provincia)
    if (!ticinoId && switzerlandId) {
      try {
        const states = await client.searchRead(
          'res.country.state',
          [
            ['country_id', '=', switzerlandId],
            '|',
            ['name', 'ilike', 'Ticino'],
            ['code', '=', 'TI']
          ],
          ['id', 'name', 'code'],
          1
        );
        if (states.length > 0) {
          ticinoId = states[0].id;
          console.log(`📍 [CONVERT-LEAD] Ticino state ID: ${ticinoId}`);
        }
      } catch (e) {
        console.warn('⚠️ [CONVERT-LEAD] Cannot find Ticino state');
      }
    }

    // 3. Create partner manually with properly parsed address fields
    console.log('🔄 [CONVERT-LEAD] Creating partner with parsed address...');

    try {
      const partnerValues: any = {
        name: lead.partner_name || lead.name,
        is_company: true,
        phone: lead.phone || false,
        mobile: lead.mobile || false,
        email: lead.email_from || false,
        website: lead.website || false,
        street: parsedStreet || false,
        city: parsedCity || false,
        zip: parsedZip || false,
        country_id: switzerlandId || false,
        state_id: ticinoId || false,
        comment: lead.description || false,
        partner_latitude: lead.partner_latitude || false,
        partner_longitude: lead.partner_longitude || false,
      };

      // Add Google Place ID to comment if present in description
      if (lead.description && lead.description.includes('Place ID:')) {
        const placeIdMatch = lead.description.match(/Place ID:\s*([^\n]+)/);
        if (placeIdMatch) {
          const placeId = placeIdMatch[1].trim();
          partnerValues.comment = `Google Place ID: ${placeId}\n\n${lead.description}`;
        }
      }

      // Remove false values
      Object.keys(partnerValues).forEach(key => {
        if (partnerValues[key] === false) {
          delete partnerValues[key];
        }
      });

      console.log(`📋 [CONVERT-LEAD] Partner values:`, {
        name: partnerValues.name,
        street: partnerValues.street,
        city: partnerValues.city,
        zip: partnerValues.zip,
        state_id: partnerValues.state_id,
        country_id: partnerValues.country_id
      });

      // Create partner
      const newPartnerId = await client.callKw(
        'res.partner',
        'create',
        [partnerValues]
      );

      if (!newPartnerId) {
        throw new Error('Creazione partner fallita');
      }

      console.log(`✅ [CONVERT-LEAD] Partner created: ID ${newPartnerId}`);

      // 4. Link partner to lead and archive lead
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], { partner_id: newPartnerId, active: false }]
      );

      console.log(`🗄️ [CONVERT-LEAD] Lead archived and linked to partner`);

      // 5. Get created partner with all details
      const createdPartners = await client.searchRead(
        'res.partner',
        [['id', '=', newPartnerId]],
        [
          'id', 'name', 'display_name', 'email', 'phone', 'mobile',
          'street', 'zip', 'city', 'country_id', 'state_id',
          'website', 'vat', 'is_company', 'comment'
        ],
        1
      );

      const createdPartner = createdPartners[0];

      return NextResponse.json({
        success: true,
        partner_id: newPartnerId,
        partner: {
          id: createdPartner.id,
          name: createdPartner.name,
          display_name: createdPartner.display_name,
          email: createdPartner.email || '',
          phone: createdPartner.phone || '',
          mobile: createdPartner.mobile || '',
          street: createdPartner.street || '',
          zip: createdPartner.zip || '',
          city: createdPartner.city || '',
          country: createdPartner.country_id ? createdPartner.country_id[1] : '',
          state: createdPartner.state_id ? createdPartner.state_id[1] : '',
          website: createdPartner.website || '',
          vat: createdPartner.vat || '',
          is_company: createdPartner.is_company,
          comment: createdPartner.comment || ''
        },
        odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${newPartnerId}&model=res.partner&view_type=form`
      });

    } catch (createError: any) {
      console.error('❌ [CONVERT-LEAD] Errore creazione partner:', createError);

      // Ultimate fallback: create with minimal data
      console.log('🔄 [CONVERT-LEAD] Ultimate fallback: minimal partner...');

      const minimalValues: any = {
        name: lead.partner_name || lead.name,
        is_company: true,
        comment: `Converted from lead ${body.lead_id}\n\nNote: Address parsing failed, please update manually.`
      };

      // Create partner with minimal data
      const minimalPartnerId = await client.callKw(
        'res.partner',
        'create',
        [minimalValues]
      );

      if (!minimalPartnerId) {
        throw new Error('Creazione partner (minimal) fallita');
      }

      // Link partner to lead and archive
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], { partner_id: minimalPartnerId, active: false }]
      );

      // Get created partner
      const minimalPartners = await client.searchRead(
        'res.partner',
        [['id', '=', minimalPartnerId]],
        [
          'id', 'name', 'display_name', 'email', 'phone', 'mobile',
          'street', 'zip', 'city', 'country_id', 'state_id',
          'website', 'vat', 'is_company', 'comment'
        ],
        1
      );

      const minimalPartner = minimalPartners[0];

      console.log(`✅ [CONVERT-LEAD] Partner minimal creato: ID ${minimalPartnerId}`);

      return NextResponse.json({
        success: true,
        partner_id: minimalPartnerId,
        partner: {
          id: minimalPartner.id,
          name: minimalPartner.name,
          display_name: minimalPartner.display_name,
          email: minimalPartner.email || '',
          phone: minimalPartner.phone || '',
          mobile: minimalPartner.mobile || '',
          street: minimalPartner.street || '',
          zip: minimalPartner.zip || '',
          city: minimalPartner.city || '',
          country: minimalPartner.country_id ? minimalPartner.country_id[1] : '',
          state: minimalPartner.state_id ? minimalPartner.state_id[1] : '',
          website: minimalPartner.website || '',
          vat: minimalPartner.vat || '',
          is_company: minimalPartner.is_company,
          comment: minimalPartner.comment || ''
        },
        odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${minimalPartnerId}&model=res.partner&view_type=form`,
        warning: 'Address parsing failed. Please update address manually in Odoo.'
      });
    }

  } catch (error) {
    console.error('❌ [CONVERT-LEAD] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la conversione del lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
