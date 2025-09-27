import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { locationCode } = await request.json();

    if (!locationCode) {
      return NextResponse.json(
        { success: false, error: 'Codice ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca ubicazione:', locationCode);
    console.log('🌐 ODOO_URL:', process.env.ODOO_URL);
    console.log('🗂️ ODOO_DB:', process.env.ODOO_DB);

    const odooClient = createOdooClient();

    // APPROCCIO DIRETTO: Usa username/password come fa l'HTML
    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB!;

    // Prima autentica con credenziali
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: 'paul@lapa.ch', // Usa le credenziali che funzionano
          password: 'paul' // Password dell'HTML
        }
      })
    });

    const authData = await authResponse.json();
    console.log('🔐 Auth Response:', authData.result?.uid ? 'Login OK' : 'Login FAILED');

    if (!authData.result?.uid) {
      throw new Error('Autenticazione Odoo fallita');
    }

    // Estrai session_id dai cookie di risposta
    const setCookie = authResponse.headers.get('set-cookie');
    console.log('🍪 Set-Cookie:', setCookie);

    // Ora fai la chiamata con la sessione autentica
    const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': setCookie || '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.location',
          method: 'search_read',
          args: [
            [['|'], ['barcode', '=', locationCode], ['name', 'ilike', locationCode]],
            ['id', 'name', 'complete_name', 'barcode']
          ],
          kwargs: { limit: 1 }
        }
      })
    });

    const data = await response.json();
    console.log('📍 Risposta Odoo:', data);

    if (data.error) {
      console.error('❌ Errore Odoo:', data.error);
      throw new Error(data.error.message || 'Errore Odoo');
    }

    const locations = data.result;
    console.log('📍 Ubicazioni trovate:', locations);

    if (!locations || locations.length === 0) {
      return NextResponse.json(
        { success: false, error: `Ubicazione non trovata: ${locationCode}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: locations[0]
    });

  } catch (error: any) {
    console.error('Errore ricerca ubicazione:', error);

    // Gestione sessione scaduta
    if (error.message && error.message.includes('session')) {
      return NextResponse.json(
        { success: false, error: 'Odoo Session Expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}