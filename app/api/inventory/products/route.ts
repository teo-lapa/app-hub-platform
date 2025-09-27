import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { productIds, searchQuery } = await request.json();

    console.log('🔍 Ricerca prodotti:', { productIds, searchQuery });

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
          login: 'paul@lapa.ch',
          password: 'paul'
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

    let products = [];

    if (productIds && Array.isArray(productIds)) {
      // Cerca prodotti per ID specifici
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
            model: 'product.product',
            method: 'search_read',
            args: [
              [['id', 'in', productIds]],
              ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
            ],
            kwargs: {}
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Errore Odoo');
      }
      products = data.result;
    } else if (searchQuery) {
      // Cerca prodotti per query
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
            model: 'product.product',
            method: 'search_read',
            args: [
              [
                '|', '|', '|',
                ['name', 'ilike', searchQuery],
                ['default_code', 'ilike', searchQuery],
                ['barcode', '=', searchQuery],
                ['barcode', 'ilike', searchQuery]
              ],
              ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
            ],
            kwargs: { limit: 20 }
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'Errore Odoo');
      }
      products = data.result;
    }

    console.log(`📦 Trovati ${products.length} prodotti`);

    return NextResponse.json({
      success: true,
      data: products
    });

  } catch (error: any) {
    console.error('Errore ricerca prodotti:', error);

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