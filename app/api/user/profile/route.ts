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
  try {
    console.log('👤 [USER-PROFILE-API] Richiesta profilo utente');

    // Get JWT from cookie
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [USER-PROFILE-API] Token non trovato');
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Verify JWT and get user email
    let userEmail: string | null = null;

    try {
      const jwtDecoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      userEmail = jwtDecoded.email;
      console.log('✅ [USER-PROFILE-API] JWT decodificato:', userEmail);
    } catch (error) {
      console.error('❌ [USER-PROFILE-API] JWT non valido');
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

    console.log(`📋 [USER-PROFILE-API] Caricamento profilo per: ${userEmail}`);

    // Load user/contact data from Odoo using admin session
    const userData = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', userEmail]],
        fields: ['id', 'name', 'phone', 'mobile', 'email', 'parent_id', 'is_company', 'total_invoiced', 'street', 'city', 'vat', 'ref'],
        limit: 1
      }
    );

    if (!userData || userData.length === 0) {
      console.error('❌ [USER-PROFILE-API] Utente non trovato in Odoo');
      return NextResponse.json({
        success: false,
        error: 'User not found in Odoo'
      }, { status: 404 });
    }

    const user = userData[0];
    console.log('✅ [USER-PROFILE-API] Utente trovato:', user.name);

    let companyData = null;
    const isContact = user.parent_id && user.parent_id[0];

    // If user is a contact (child), load parent company data
    if (isContact) {
      console.log(`👤 [USER-PROFILE-API] Contatto: ${user.name} - Carico azienda padre ID: ${user.parent_id[0]}`);

      const companyResult = await callOdooAsAdmin(
        'res.partner',
        'read',
        [user.parent_id[0]],
        {
          fields: ['name', 'phone', 'email', 'total_invoiced', 'street', 'city', 'vat', 'ref']
        }
      );

      if (companyResult && companyResult.length > 0) {
        companyData = companyResult[0];
        console.log(`🏢 [USER-PROFILE-API] Azienda padre: ${companyData.name}`);
      }
    } else {
      console.log(`🏢 [USER-PROFILE-API] Azienda principale: ${user.name}`);
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
          totalInvoiced: companyData.total_invoiced,
          street: companyData.street,
          city: companyData.city
        } : null
      }
    };

    console.log('✅ [USER-PROFILE-API] Profilo completo recuperato:', response.data.user.name);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [USER-PROFILE-API] Errore:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: 'Failed to load profile'
    }, { status: 500 });
  }
}
