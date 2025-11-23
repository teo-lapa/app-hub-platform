import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    // Ottieni email utente dal token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let userEmail: string | null = null;

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      userEmail = decoded.email;
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: 'Token non valido'
      }, { status: 401 });
    }

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email non trovata nel token'
      }, { status: 401 });
    }

    // Cerca il business associato all'email dell'utente
    const result = await sql`
      SELECT
        id,
        name,
        slug,
        owner_name,
        owner_email,
        city,
        response_mode,
        response_tone,
        response_language,
        is_active
      FROM rm_businesses
      WHERE owner_email = ${userEmail}
        AND is_active = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun business associato a questo account'
      });
    }

    const business = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        ownerName: business.owner_name,
        ownerEmail: business.owner_email,
        city: business.city,
        responseMode: business.response_mode,
        responseTone: business.response_tone,
        responseLanguage: business.response_language,
        isActive: business.is_active
      }
    });

  } catch (error) {
    console.error('Errore my-business:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero del business'
    }, { status: 500 });
  }
}
