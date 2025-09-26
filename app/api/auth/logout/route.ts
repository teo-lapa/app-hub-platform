import { NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';

export async function POST() {
  const response = NextResponse.json<ApiResponse>({
    success: true,
    message: 'Logout effettuato con successo',
  });

  // Rimuove il cookie JWT
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  });

  return response;
}