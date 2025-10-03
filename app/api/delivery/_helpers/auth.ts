export async function getOdooSessionId(request: Request): Promise<string> {
  // Prova prima a prendere dal cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionMatch = cookieHeader.match(/session_id=([^;]+)/);

  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Se non c'è, ottieni tramite autenticazione unificata
  console.log('🔑 Session ID non trovata, ottengo tramite autenticazione unificata...');
  const authResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/auth/unified-odoo`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader
    }
  });

  const authData = await authResponse.json();
  if (authData.success && authData.data?.session_id) {
    console.log('✅ Session ID ottenuta tramite unified-odoo');
    return authData.data.session_id;
  }

  throw new Error('Autenticazione Odoo fallita');
}
