import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { ApiResponse, User } from '@/lib/types';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API-ME] Controllo autenticazione utente...');

    const token = request.cookies.get('token')?.value;
    const odooSessionId = request.cookies.get('odoo_session_id')?.value;

    console.log('🍪 [API-ME] Cookies ricevuti:', {
      hasToken: !!token,
      hasOdooSession: !!odooSessionId,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      odooSessionPreview: odooSessionId ? odooSessionId.substring(0, 20) + '...' : 'none'
    });

    if (!token) {
      console.error('❌ [API-ME] Token JWT non trovato nei cookies');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token di accesso non trovato',
      }, { status: 401 });
    }

    // Prova prima con JWT standard per utenti locali
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        console.log('🔓 [API-ME] Token JWT decodificato (utente locale):', decoded.id);
        const user = await getUserById(decoded.id);
        if (user) {
          console.log('✅ [API-ME] Utente locale trovato:', user.email);
          return NextResponse.json<ApiResponse>({
            success: true,
            data: { user },
          });
        } else {
          console.log('⚠️ [API-ME] Utente locale non trovato nel database');
        }
      }
    } catch (localError: any) {
      // Ignora errori per utenti locali, prova con Odoo
      console.log('⚠️ [API-ME] Utente locale non trovato:', localError.message);
    }

    // Se non trova con verifyToken, prova con jwt.verify diretto per utenti Odoo
    console.log('🔧 [API-ME] Tentativo decodifica JWT per utente Odoo...');
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    try {
      const jwtDecoded = jwt.verify(token, jwtSecret) as any;

      if (jwtDecoded && jwtDecoded.email && jwtDecoded.id) {
        console.log('✅ [API-ME] JWT decodificato per utente Odoo:', {
          email: jwtDecoded.email,
          userId: jwtDecoded.id,
          name: jwtDecoded.name
        });

        // Ricostruisce l'utente dai dati del token
        const user: User = {
          id: jwtDecoded.id,
          email: jwtDecoded.email,
          name: jwtDecoded.name || jwtDecoded.email || 'Utente Odoo',
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

        console.log('✅ [API-ME] Utente Odoo ricostruito con successo!');
        return NextResponse.json<ApiResponse>({
          success: true,
          data: { user },
        });
      } else {
        console.error('❌ [API-ME] JWT decodificato ma dati mancanti:', {
          hasEmail: !!jwtDecoded?.email,
          hasId: !!jwtDecoded?.id
        });
      }
    } catch (jwtError: any) {
      console.error('❌ [API-ME] JWT verification failed:', jwtError.message);
    }

    console.error('❌ [API-ME] Nessun metodo di autenticazione è riuscito - ritorno 401');
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
