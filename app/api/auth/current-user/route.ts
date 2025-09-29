import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Nessun token di autenticazione trovato'
      }, { status: 401 });
    }

    // Verifica il token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (!decoded || !decoded.email) {
      return NextResponse.json({
        success: false,
        error: 'Token non valido'
      }, { status: 401 });
    }

    // Restituisci solo le info necessarie per l'autenticazione
    return NextResponse.json({
      success: true,
      data: {
        email: decoded.email,
        name: decoded.name,
        authenticated: true
      }
    });

  } catch (error) {
    console.error('Errore verifica utente corrente:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore verifica autenticazione'
    }, { status: 401 });
  }
}