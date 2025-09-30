import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// Get complete user profile with company data from Odoo
export async function GET(request: NextRequest) {
  try {
    // Get JWT from cookie
    const token = request.cookies.get('token')?.value;

    if (!token) {
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
    } catch (error) {
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
    console.log(`📋 Caricamento profilo completo per: ${userEmail}`);

    // Load user/contact data from Odoo
    const odooResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'res.partner',
        method: 'search_read',
        args: [
          [['email', '=', userEmail]],
          ['id', 'name', 'phone', 'mobile', 'email', 'parent_id', 'is_company', 'total_invoiced', 'street', 'city', 'vat', 'ref']
        ],
        kwargs: { limit: 1 }
      })
    });

    if (!odooResponse.ok) {
      throw new Error('Failed to load user from Odoo');
    }

    const data = await odooResponse.json();
    const userData = data.result?.[0] || null;

    if (!userData) {
      return NextResponse.json({
        success: false,
        error: 'User not found in Odoo'
      }, { status: 404 });
    }

    let companyData = null;
    const isContact = userData.parent_id && userData.parent_id[0];

    // If user is a contact (child), load parent company data
    if (isContact) {
      console.log(`👤 Contatto: ${userData.name} - Carico azienda padre ID: ${userData.parent_id[0]}`);

      const companyResponse = await fetch(`${request.nextUrl.origin}/api/odoo/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'res.partner',
          method: 'read',
          args: [
            [userData.parent_id[0]],
            ['name', 'phone', 'email', 'total_invoiced', 'street', 'city', 'vat', 'ref', 'x_studio_credit_limit']
          ]
        })
      });

      if (companyResponse.ok) {
        const companyDataResponse = await companyResponse.json();
        companyData = companyDataResponse.result?.[0] || null;
        console.log(`🏢 Azienda padre: ${companyData?.name}`);
      }
    } else {
      console.log(`🏢 Azienda principale: ${userData.name}`);
      companyData = userData;
    }

    // Build response with user and company data
    return NextResponse.json({
      success: true,
      data: {
        user: {
          name: userData.name,
          email: userData.email,
          phone: userData.phone || userData.mobile,
          isContact,
        },
        company: companyData ? {
          name: companyData.name,
          vat: companyData.vat,
          ref: companyData.ref,
          totalInvoiced: companyData.total_invoiced,
          street: companyData.street,
          city: companyData.city,
          creditLimit: companyData.x_studio_credit_limit
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Error loading user profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load profile'
    }, { status: 500 });
  }
}