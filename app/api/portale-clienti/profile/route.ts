import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/portale-clienti/profile
 *
 * Recupera i dati del profilo del cliente loggato da Odoo (res.partner)
 *
 * Returns: Dati completi del cliente (anagrafica, contatti, limiti di credito, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('👤 [PROFILE-API] Recupero profilo cliente');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [PROFILE-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare il profilo' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [PROFILE-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [PROFILE-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Get partner_id using admin session
    console.log('🔍 [PROFILE-API] Fetching partner_id for user...');

    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [PROFILE-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 404 }
      );
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [PROFILE-API] Cliente identificato:', partnerId);

    // Step 2: Recupera i dati completi del partner da Odoo usando admin session
    const partnerResult = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', '=', partnerId]],
        fields: [
          'id',
          'name',
          'email',
          'phone',
          'mobile',
          'street',
          'street2',
          'city',
          'zip',
          'state_id',
          'country_id',
          'vat',
          'website',
          'comment',
          'user_id', // Agente di vendita
          'payment_term_id', // Termini di pagamento
          'property_product_pricelist', // Listino prezzi
        ],
        limit: 1,
      }
    );

    if (!partnerResult || partnerResult.length === 0) {
      console.error('❌ [PROFILE-API] Cliente non trovato');
      return NextResponse.json(
        { success: false, error: 'Dati del cliente non trovati' },
        { status: 404 }
      );
    }

    const partner = partnerResult[0];

    // Step 3: Formatta i dati per il frontend
    const profile = {
      id: partner.id,
      name: partner.name,
      email: partner.email || '',
      phone: partner.phone || '',
      mobile: partner.mobile || '',

      // Indirizzo
      address: {
        street: partner.street || '',
        street2: partner.street2 || '',
        city: partner.city || '',
        zip: partner.zip || '',
        state: partner.state_id?.[1] || '',
        country: partner.country_id?.[1] || '',
      },

      // Dati fiscali
      vat: partner.vat || '',

      // Info commerciali
      creditLimit: 0, // Not accessible to portal users
      currentCredit: 0, // Not accessible to portal users
      availableCredit: 0, // Not accessible to portal users

      // Agente e termini
      salesPerson: partner.user_id?.[1] || null,
      paymentTerm: partner.payment_term_id?.[1] || null,
      pricelist: partner.property_product_pricelist?.[1] || null,

      // Extra
      website: partner.website || '',
      notes: partner.comment || '',
    };

    console.log('✅ [PROFILE-API] Profilo recuperato con successo');

    return NextResponse.json({
      success: true,
      profile,
    });

  } catch (error: any) {
    console.error('❌ [PROFILE-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
