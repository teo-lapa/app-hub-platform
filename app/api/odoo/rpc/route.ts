import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * API generica per chiamare Odoo RPC
 * Usa la sessione Odoo dell'utente se disponibile, altrimenti fallback
 */
export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log('🔧 [API-ODOO-RPC] Chiamata:', model, method);

    // Ottieni cookies dall'utente
    const userCookies = request.headers.get('cookie') || undefined;

    // Autentica con Odoo (usa sessione utente o fallback)
    const { cookies } = await getOdooSession(userCookies);

    // Chiama Odoo
    const result = await callOdoo(cookies, model, method, args, kwargs);

    console.log('✅ [API-ODOO-RPC] Successo');
    return NextResponse.json({ result });

  } catch (error: any) {
    console.error('💥 [API-ODOO-RPC] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
