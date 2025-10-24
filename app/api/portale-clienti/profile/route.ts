import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

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

    // Ottieni session_id
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [PROFILE-API] Utente non loggato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare il profilo' },
        { status: 401 }
      );
    }

    // Step 1: Ottieni l'utente corrente
    const userInfo = await getCurrentUserInfo(sessionId);

    if (!userInfo.success || !userInfo.partnerId) {
      console.error('❌ [PROFILE-API] Impossibile identificare il cliente');
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userInfo.partnerId;
    console.log('✅ [PROFILE-API] Cliente identificato:', partnerId);

    // Step 2: Recupera i dati completi del partner da Odoo
    const partnerResult = await callOdoo(
      sessionId,
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
          'credit_limit',
          'credit',
          'user_id', // Agente di vendita
          'payment_term_id', // Termini di pagamento
          'property_product_pricelist', // Listino prezzi
        ],
        limit: 1,
      }
    );

    if (!partnerResult.success || !partnerResult.result || partnerResult.result.length === 0) {
      console.error('❌ [PROFILE-API] Cliente non trovato');
      return NextResponse.json(
        { success: false, error: 'Dati del cliente non trovati' },
        { status: 404 }
      );
    }

    const partner = partnerResult.result[0];

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
      creditLimit: partner.credit_limit || 0,
      currentCredit: partner.credit || 0,
      availableCredit: (partner.credit_limit || 0) - (partner.credit || 0),

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

/**
 * Ottieni informazioni utente corrente
 */
async function getCurrentUserInfo(sessionId: string) {
  try {
    const userResult = await callOdoo(sessionId, 'res.users', 'search_read', [], {
      domain: [['id', '=', 'user_id']],
      fields: ['id', 'partner_id'],
      limit: 1,
    });

    if (!userResult.success || !userResult.result || userResult.result.length === 0) {
      return { success: false, partnerId: null };
    }

    const user = userResult.result[0];
    return {
      success: true,
      partnerId: user.partner_id?.[0] || null,
    };
  } catch (error) {
    console.error('❌ Errore getCurrentUserInfo:', error);
    return { success: false, partnerId: null };
  }
}

/**
 * Chiama l'API JSON-RPC di Odoo
 */
async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  try {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs,
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Errore Odoo:', data.error);
      return { success: false, error: data.error.data?.message || data.error.message };
    }

    return { success: true, result: data.result };
  } catch (error: any) {
    console.error('❌ Errore callOdoo:', error);
    return { success: false, error: error.message };
  }
}
