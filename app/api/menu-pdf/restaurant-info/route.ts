import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/menu-pdf/restaurant-info
 *
 * Recupera nome ristorante e logo dall'azienda madre in Odoo
 * per l'utente loggato
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [RESTAURANT-INFO] Fetching restaurant data');

    // 1. Authenticate user
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    console.log('👤 [RESTAURANT-INFO] User email:', decoded.email);

    // 2. Get partner from email
    const partners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name', 'parent_id', 'image_1920'],
        limit: 1
      }
    );

    if (!partners || partners.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Partner not found'
      }, { status: 404 });
    }

    const partner = partners[0];
    console.log('✅ [RESTAURANT-INFO] Partner found:', partner.name, 'Parent ID:', partner.parent_id);

    // 3. Determina nome ristorante e logo
    let restaurantName = partner.name;
    let logoBase64 = null;

    // Se ha un parent (azienda madre), usa il nome del partner (indirizzo consegna)
    // e il logo del parent
    if (partner.parent_id && partner.parent_id.length > 0) {
      const parentId = partner.parent_id[0];
      console.log('👨‍👦 [RESTAURANT-INFO] Fetching parent company:', parentId);

      // Prendi il logo dal parent
      const parentCompany = await callOdooAsAdmin(
        'res.partner',
        'search_read',
        [],
        {
          domain: [['id', '=', parentId]],
          fields: ['name', 'image_1920'],
          limit: 1
        }
      );

      if (parentCompany && parentCompany.length > 0 && parentCompany[0].image_1920) {
        logoBase64 = parentCompany[0].image_1920;
        console.log('📷 [RESTAURANT-INFO] Logo found from parent company');
      }
    } else {
      // Se non ha parent, usa il logo del partner stesso
      if (partner.image_1920) {
        logoBase64 = partner.image_1920;
        console.log('📷 [RESTAURANT-INFO] Logo found from partner');
      }
    }

    console.log('✅ [RESTAURANT-INFO] Restaurant data ready:', {
      name: restaurantName,
      hasLogo: !!logoBase64
    });

    return NextResponse.json({
      success: true,
      data: {
        restaurantName,
        logo: logoBase64 ? `data:image/png;base64,${logoBase64}` : null,
        partnerId: partner.id
      }
    });

  } catch (error: any) {
    console.error('❌ [RESTAURANT-INFO] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch restaurant info'
    }, { status: 500 });
  }
}
