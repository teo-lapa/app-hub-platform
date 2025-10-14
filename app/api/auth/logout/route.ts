import { NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';

export async function POST() {
  const response = NextResponse.json<ApiResponse>({
    success: true,
    message: 'Logout effettuato con successo',
  });

  // Rimuove tutti i cookie di autenticazione
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  });

  response.cookies.set('odoo_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  });

  // IMPORTANTE: Rimuovi anche il cookie odoo_session_id (nuovo formato)
  response.cookies.set('odoo_session_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}