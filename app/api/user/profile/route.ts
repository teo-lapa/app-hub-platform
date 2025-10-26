import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/user/profile
 *
 * Recupera profilo completo utente per Stella AI
 * Usa callOdooAsAdmin invece del vecchio /api/odoo/rpc
 */
export async function GET(request: NextRequest) {
  console.log('========================================');
  console.log('👤 [USER-PROFILE-API] ===START===');
  console.log('========================================');

  try {
    console.log('👤 [USER-PROFILE-API] Step 1: Richiesta profilo utente');

    // Get JWT from cookie
    const token = request.cookies.get('token')?.value;
    console.log('👤 [USER-PROFILE-API] Step 2: Token presente?', !!token);

    if (!token) {
      console.error('❌ [USER-PROFILE-API] Token non trovato');
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Verify JWT and get user email
    let userEmail: string | null = null;

    console.log('👤 [USER-PROFILE-API] Step 3: Decodifica JWT...');
    try {
      const jwtSecret = process.env.JWT_SECRET;
      console.log('👤 [USER-PROFILE-API] Step 3a: JWT_SECRET presente?', !!jwtSecret);

      const jwtDecoded = jwt.verify(token, jwtSecret!) as any;
      userEmail = jwtDecoded.email;
      console.log('✅ [USER-PROFILE-API] Step 3b: JWT decodificato OK. Email:', userEmail);
    } catch (error: any) {
      console.error('❌ [USER-PROFILE-API] JWT non valido. Errore:', error.message);
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email not found in token'
      }, { status: 401 });
    }

    console.log(`👤 [USER-PROFILE-API] Step 4: Caricamento profilo per: ${userEmail}`);

    // Load user/contact data from Odoo using admin session
    console.log('👤 [USER-PROFILE-API] Step 5: Chiamata callOdooAsAdmin...');
    const userData = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', userEmail]],
        fields: ['id', 'name', 'phone', 'mobile', 'email', 'parent_id', 'is_company', 'street', 'city', 'vat', 'ref'],
        limit: 1
      }
    );
    console.log('👤 [USER-PROFILE-API] Step 6: callOdooAsAdmin completato. Risultato:', userData ? userData.length : 'null');

    if (!userData || userData.length === 0) {
      console.error('❌ [USER-PROFILE-API] Utente non trovato in Odoo');
      return NextResponse.json({
        success: false,
        error: 'User not found in Odoo'
      }, { status: 404 });
    }

    const user = userData[0];
    console.log('✅ [USER-PROFILE-API] Step 7: Utente trovato:', user.name);

    let companyData = null;
    const isContact = user.parent_id && user.parent_id[0];
    console.log('👤 [USER-PROFILE-API] Step 8: isContact?', isContact);

    // If user is a contact (child), load parent company data
    if (isContact) {
      console.log(`👤 [USER-PROFILE-API] Step 9: Contatto rilevato: ${user.name} - Carico azienda padre ID: ${user.parent_id[0]}`);

      const companyResult = await callOdooAsAdmin(
        'res.partner',
        'search_read',
        [],
        {
          domain: [['id', '=', user.parent_id[0]]],
          fields: ['name', 'phone', 'email', 'street', 'city', 'vat', 'ref'],
          limit: 1
        }
      );
      console.log('👤 [USER-PROFILE-API] Step 10: Company data loaded:', companyResult ? companyResult.length : 'null');

      if (companyResult && companyResult.length > 0) {
        companyData = companyResult[0];
        console.log(`✅ [USER-PROFILE-API] Step 11: Azienda padre trovata: ${companyData.name}`);
      }
    } else {
      console.log(`👤 [USER-PROFILE-API] Step 9: Azienda principale (non contatto): ${user.name}`);
      companyData = user;
    }

    // Build response with user and company data
    const response = {
      success: true,
      data: {
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone || user.mobile,
          isContact,
        },
        company: companyData ? {
          name: companyData.name,
          vat: companyData.vat,
          ref: companyData.ref,
          street: companyData.street,
          city: companyData.city
        } : null
      }
    };

    console.log('✅ [USER-PROFILE-API] Step 12: Profilo completo recuperato:', response.data.user.name);
    console.log('========================================');
    console.log('👤 [USER-PROFILE-API] ===SUCCESS===');
    console.log('========================================');

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('========================================');
    console.error('❌ [USER-PROFILE-API] ===ERROR===');
    console.error('========================================');
    console.error('❌ [USER-PROFILE-API] Errore tipo:', error.constructor.name);
    console.error('❌ [USER-PROFILE-API] Errore messaggio:', error.message);
    console.error('❌ [USER-PROFILE-API] Stack completo:', error.stack);
    console.error('========================================');

    return NextResponse.json({
      success: false,
      error: 'Failed to load profile',
      details: error.message
    }, { status: 500 });
  }
}
