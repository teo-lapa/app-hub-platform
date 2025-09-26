import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token di accesso non trovato',
      }, { status: 401 });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Token non valido',
      }, { status: 401 });
    }

    const user = getUserById(decoded.id);

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Utente non trovato',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}