import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * API per ottenere i dati della sessione Odoo dell'utente loggato
 * USA SOLO IL SESSION_ID DELL'UTENTE (no credenziali hardcoded!)
 */
export async function POST(request: NextRequest) {
  try {
    // NUOVO: Usa il session_id dell'utente loggato
    const sessionId = await getOdooSessionId();

    if (!sessionId) {
      console.error('❌ [UNIFIED-ODOO] Nessun session_id trovato. L\'utente deve fare login.');
      return NextResponse.json(
        {
          success: false,
          error: 'Sessione non valida. Effettua nuovamente il login alla piattaforma.'
        },
        { status: 401 }
      );
    }

    console.log('✅ [UNIFIED-ODOO] Session ID trovato, utente autenticato');

    // Ritorna i dati della sessione
    return NextResponse.json({
      success: true,
      data: {
        session_id: sessionId,
        authenticated: true
      },
      method: 'user_session'
    });

  } catch (error) {
    console.error('❌ [UNIFIED-ODOO] Errore:', error);

    return NextResponse.json({
      success: false,
      error: 'Errore di autenticazione',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}
