import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24517859';

/**
 * TEST ENDPOINT - Verifica se la sessione Odoo è valida
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST-ODOO-SESSION] Verifica sessione Odoo...');

    // 1. Verifica se c'è un session_id nel cookie
    const sessionId = await getOdooSessionId();

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Nessun session_id trovato. Devi fare login prima.',
        details: {
          hasSessionId: false,
          odooUrl: ODOO_URL,
          odooDb: ODOO_DB
        }
      }, { status: 401 });
    }

    console.log('✅ [TEST-ODOO-SESSION] Session ID trovato:', sessionId.substring(0, 20) + '...');

    // 2. Verifica che la sessione sia valida facendo una chiamata test a Odoo
    try {
      const testResponse = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: 1
        })
      });

      const sessionInfo = await testResponse.json();

      if (sessionInfo.error || !sessionInfo.result?.uid) {
        console.error('❌ [TEST-ODOO-SESSION] Sessione non valida:', sessionInfo);
        return NextResponse.json({
          success: false,
          error: 'Session ID non valido o scaduto. Devi rifare login.',
          details: {
            hasSessionId: true,
            sessionValid: false,
            odooUrl: ODOO_URL,
            odooDb: ODOO_DB,
            odooError: sessionInfo.error
          }
        }, { status: 401 });
      }

      console.log('✅ [TEST-ODOO-SESSION] Sessione valida! UID:', sessionInfo.result.uid);

      return NextResponse.json({
        success: true,
        message: 'Sessione Odoo valida!',
        details: {
          hasSessionId: true,
          sessionValid: true,
          uid: sessionInfo.result.uid,
          username: sessionInfo.result.username,
          name: sessionInfo.result.name,
          db: sessionInfo.result.db,
          odooUrl: ODOO_URL,
          odooDb: ODOO_DB
        }
      });

    } catch (odooError: any) {
      console.error('❌ [TEST-ODOO-SESSION] Errore chiamata Odoo:', odooError);
      return NextResponse.json({
        success: false,
        error: 'Errore connessione a Odoo',
        details: {
          hasSessionId: true,
          sessionValid: false,
          odooUrl: ODOO_URL,
          odooDb: ODOO_DB,
          errorMessage: odooError.message
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('💥 [TEST-ODOO-SESSION] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore test sessione'
    }, { status: 500 });
  }
}
