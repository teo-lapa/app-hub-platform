import { NextRequest, NextResponse } from 'next/server';
import { updateUser, getUserByEmail, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verifica il token dall'header o cookie
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token di autenticazione richiesto' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    const updateData = await request.json();
    console.log('Profile update request for user:', decoded.id, 'Data:', Object.keys(updateData));

    // Solo gli admin possono modificare ruoli e permessi
    const currentUser = await getUserByEmail(decoded.email);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Controlla se l'utente può modificare i campi amministrativi
    if ((updateData.role || updateData.abilitato !== undefined || updateData.appPermessi) &&
        currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per modificare questi campi' },
        { status: 403 }
      );
    }

    // Aggiorna l'utente
    const updatedUser = await updateUser(decoded.id, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'Errore durante l\'aggiornamento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profilo aggiornato con successo!',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}