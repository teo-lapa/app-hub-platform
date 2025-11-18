import { NextRequest, NextResponse } from 'next/server';
import { getOdooXMLRPCClient } from '@/lib/odoo-xmlrpc';

/**
 * POST /api/scan-contatto/save
 *
 * Salva un contatto estratto in Odoo
 *
 * Request body:
 * {
 *   name: string,
 *   email?: string,
 *   phone?: string,
 *   mobile?: string,
 *   street?: string,
 *   zip?: string,
 *   city?: string,
 *   country?: string,
 *   company_name?: string,
 *   website?: string,
 *   vat?: string,
 *   function?: string,
 *   comment?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   contact: {
 *     id: number,
 *     name: string,
 *     display_name: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`💾 [SCAN-CONTATTO-SAVE] Request ${requestId} - Start`);

  try {
    // ========== NO AUTH NEEDED - Using Odoo API credentials from env ==========
    console.log(`✅ [SCAN-CONTATTO-SAVE] Request ${requestId} - Using Odoo API credentials`);

    // ========== PARSE REQUEST BODY ==========
    let contactData;

    try {
      contactData = await request.json();
    } catch (parseError) {
      console.error(`❌ [SCAN-CONTATTO-SAVE] Request ${requestId} - Failed to parse JSON:`, parseError);
      return NextResponse.json(
        {
          error: 'Formato richiesta non valido. Richiesto JSON',
          code: 'INVALID_JSON',
          requestId
        },
        { status: 400 }
      );
    }

    // Validate required field
    if (!contactData.name) {
      return NextResponse.json(
        {
          error: 'Campo "name" obbligatorio',
          code: 'MISSING_NAME',
          requestId
        },
        { status: 400 }
      );
    }

    console.log(`📋 [SCAN-CONTATTO-SAVE] Request ${requestId} - Contact data:`, contactData);

    // ========== CREATE ODOO XML-RPC CLIENT ==========
    const odoo = await getOdooXMLRPCClient();

    // ========== PREPARE PARTNER DATA ==========
    const partnerData: any = {
      name: contactData.name,
      type: 'contact'
    };

    if (contactData.email) partnerData.email = contactData.email;
    if (contactData.phone) partnerData.phone = contactData.phone;
    if (contactData.mobile) partnerData.mobile = contactData.mobile;
    if (contactData.street) partnerData.street = contactData.street;
    if (contactData.zip) partnerData.zip = contactData.zip;
    if (contactData.city) partnerData.city = contactData.city;
    if (contactData.website) partnerData.website = contactData.website;
    if (contactData.vat) partnerData.vat = contactData.vat;
    if (contactData.function) partnerData.function = contactData.function;
    if (contactData.comment) partnerData.comment = contactData.comment;

    // Company name - if present, assume it's a company
    if (contactData.company_name) {
      partnerData.is_company = true;
      partnerData.name = contactData.company_name;
    }

    // Country - try to find by name
    if (contactData.country) {
      try {
        const countries = await odoo.execute_kw(
          'res.country',
          'search_read',
          [[['name', 'ilike', contactData.country]]],
          { fields: ['id'], limit: 1 }
        );

        if (countries && countries.length > 0) {
          partnerData.country_id = countries[0].id;
        }
      } catch (err) {
        console.warn(`⚠️  [SCAN-CONTATTO-SAVE] Could not find country: ${contactData.country}`);
      }
    }

    console.log(`🔧 [SCAN-CONTATTO-SAVE] Request ${requestId} - Prepared partner data:`, partnerData);

    // ========== CREATE PARTNER IN ODOO ==========
    console.log(`💾 [SCAN-CONTATTO-SAVE] Request ${requestId} - Creating partner in Odoo...`);

    const partnerId = await odoo.execute_kw('res.partner', 'create', [[partnerData]]);

    console.log(`✅ [SCAN-CONTATTO-SAVE] Request ${requestId} - Partner created: ID ${partnerId}`);

    // ========== RETRIEVE CREATED PARTNER ==========
    const createdPartner = await odoo.execute_kw(
      'res.partner',
      'search_read',
      [[['id', '=', partnerId]]],
      { fields: ['id', 'name', 'display_name', 'email', 'phone', 'mobile'], limit: 1 }
    );

    if (!createdPartner || createdPartner.length === 0) {
      throw new Error('Partner created but not found in read');
    }

    const partner = createdPartner[0];

    // ========== CALCULATE METRICS ==========
    const duration = Date.now() - startTime;

    console.log(`✅ [SCAN-CONTATTO-SAVE] Request ${requestId} - Completed in ${duration}ms`);

    // ========== RETURN SUCCESS RESPONSE ==========
    return NextResponse.json(
      {
        success: true,
        contact: {
          id: partner.id,
          name: partner.name,
          display_name: partner.display_name,
          email: partner.email,
          phone: partner.phone,
          mobile: partner.mobile
        },
        meta: {
          requestId,
          duration,
          timestamp: new Date().toISOString()
        }
      },
      {
        status: 200,
        headers: {
          'X-Request-ID': requestId,
          'X-Processing-Time': `${duration}ms`
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(`❌ [SCAN-CONTATTO-SAVE] Request ${requestId} - Error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Errore durante il salvataggio del contatto';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: 'SAVE_ERROR',
        requestId,
        duration,
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: {
          'X-Request-ID': requestId,
          'X-Processing-Time': `${duration}ms`
        }
      }
    );
  }
}
