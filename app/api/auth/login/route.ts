import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    console.log('🔐 API Login: Received login request for:', email);

    if (!email || !password) {
      console.log('❌ API Login: Missing credentials');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Email e password sono obbligatori',
      }, { status: 400 });
    }

    console.log('🔍 API Login: Attempting authentication for:', email);
    const user = await authenticateUser(email, password);

    if (!user) {
      console.log('❌ API Login: Authentication failed for:', email);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Credenziali non valide',
      }, { status: 401 });
    }

    console.log('✅ API Login: Authentication successful for:', user.name);

    const token = generateToken(user);

    const response = NextResponse.json<ApiResponse>({
      success: true,
      data: { user, token },
      message: 'Login effettuato con successo',
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
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}