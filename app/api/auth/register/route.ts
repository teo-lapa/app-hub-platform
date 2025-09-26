import { NextRequest, NextResponse } from 'next/server';
import { createUser, generateToken } from '@/lib/auth';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Email, password e nome sono obbligatori',
      }, { status: 400 });
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Email non valida',
      }, { status: 400 });
    }

    // Validazione password
    if (password.length < 6) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'La password deve essere di almeno 6 caratteri',
      }, { status: 400 });
    }

    const user = await createUser(email, password, name);
    const token = generateToken(user);

    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: { user, token },
      message: 'Registrazione completata con successo',
    });

    // Imposta il cookie JWT
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 giorni
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}