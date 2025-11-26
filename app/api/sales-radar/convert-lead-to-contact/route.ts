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

    // 2. Use Odoo's standard convert method
    // This method creates a partner and links the lead to it
    try {
      // Call the standard Odoo method to convert lead to opportunity/partner
      // action: 'create' creates a new partner
      const convertResult = await client.callKw(
        'crm.lead',
        'convert_opportunity',
        [[body.lead_id]],
        {
          partner_id: false, // Create new partner
          user_ids: false, // Keep current salesperson
          team_id: false // Keep current team
        }
      );

      console.log(`✅ [CONVERT-LEAD] Lead convertito, recupero partner...`);

      // 3. Get the created partner ID from the lead
      const updatedLeads = await client.searchRead(
        'crm.lead',
        [['id', '=', body.lead_id]],
        ['partner_id'],
        1
      );

      if (updatedLeads.length === 0 || !updatedLeads[0].partner_id) {
        throw new Error('Partner non creato dopo conversione');
      }

      const partnerId = Array.isArray(updatedLeads[0].partner_id)
        ? updatedLeads[0].partner_id[0]
        : updatedLeads[0].partner_id;

      console.log(`✅ [CONVERT-LEAD] Partner creato: ID ${partnerId}`);

      // 4. Get partner details
      const partners = await client.searchRead(
        'res.partner',
        [['id', '=', partnerId]],
        [
          'id', 'name', 'display_name', 'email', 'phone', 'mobile',
          'street', 'zip', 'city', 'country_id', 'state_id',
          'website', 'vat', 'is_company', 'comment'
        ],
        1
      );

      if (partners.length === 0) {
        throw new Error('Partner creato ma non recuperabile');
      }

      const partner = partners[0];

      // 5. Archive the lead (optional - keeps CRM clean)
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], { active: false }]
      );

      console.log(`🗄️ [CONVERT-LEAD] Lead archiviato`);

      return NextResponse.json({
        success: true,
        partner_id: partnerId,
        partner: {
          id: partner.id,
          name: partner.name,
          display_name: partner.display_name,
          email: partner.email || '',
          phone: partner.phone || '',
          mobile: partner.mobile || '',
          street: partner.street || '',
          zip: partner.zip || '',
          city: partner.city || '',
          country: partner.country_id ? partner.country_id[1] : '',
          state: partner.state_id ? partner.state_id[1] : '',
          website: partner.website || '',
          vat: partner.vat || '',
          is_company: partner.is_company,
          comment: partner.comment || ''
        },
        odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${partnerId}&model=res.partner&view_type=form`
      });

    } catch (odooError: any) {
      console.error('❌ [CONVERT-LEAD] Errore conversione Odoo:', odooError);

      // Fallback: create partner manually if standard method fails
      console.log('🔄 [CONVERT-LEAD] Fallback: creazione manuale partner...');

      const partnerValues: any = {
        name: lead.partner_name || lead.name,
        is_company: true,
        phone: lead.phone || false,
        mobile: lead.mobile || false,
        email: lead.email_from || false,
        website: lead.website || false,
        street: lead.street || false,
        city: lead.city || false,
        zip: lead.zip || false,
        country_id: lead.country_id ? lead.country_id[0] : false,
        state_id: lead.state_id ? lead.state_id[0] : false,
        comment: lead.description || false,
      };

      // Remove false values
      Object.keys(partnerValues).forEach(key => {
        if (partnerValues[key] === false) {
          delete partnerValues[key];
        }
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

      // Link partner to lead
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], { partner_id: newPartnerId }]
      );

      // Archive lead
      await client.callKw(
        'crm.lead',
        'write',
        [[body.lead_id], { active: false }]
      );

      // Get created partner
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

      console.log(`✅ [CONVERT-LEAD] Partner creato manualmente: ID ${newPartnerId}`);

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
