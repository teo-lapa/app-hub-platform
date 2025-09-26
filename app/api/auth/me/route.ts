import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { ApiResponse, User } from '@/lib/types';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token di accesso non trovato',
      }, { status: 401 });
    }

    // Prova prima con JWT standard per utenti locali
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await getUserById(decoded.id);
        if (user) {
          return NextResponse.json<ApiResponse>({
            success: true,
            data: { user },
          });
        }
      }
    } catch (localError) {
      // Ignora errori per utenti locali, prova con Odoo
      console.log('Local user not found, trying Odoo...');
    }

    // Se non trova con verifyToken, prova con jwt.verify diretto per utenti Odoo
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    try {
      const jwtDecoded = jwt.verify(token, jwtSecret) as any;

      if (jwtDecoded && jwtDecoded.email && jwtDecoded.userId) {
        console.log('🔍 JWT decoded for Odoo user:', jwtDecoded.email);

        // Ricostruisce l'utente dai dati del token
        const user: User = {
          id: jwtDecoded.userId,
          email: jwtDecoded.email,
          name: jwtDecoded.name || 'Utente Odoo',
          role: jwtDecoded.role || 'admin',
          azienda: jwtDecoded.azienda || 'LAPA',
          abilitato: true,
          appPermessi: ['profile', 'dashboard', 'admin'],
          createdAt: new Date(),
          updatedAt: new Date(),
          telefono: '',
          indirizzo: '',
          citta: '',
          cap: '',
          partitaIva: '',
          codiceCliente: '',
          note: 'Utente Odoo'
        };

        return NextResponse.json<ApiResponse>({
          success: true,
          data: { user },
        });
      }
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Token non valido',
    }, { status: 401 });

  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}