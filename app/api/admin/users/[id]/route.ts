import { NextRequest, NextResponse } from 'next/server';
import { updateUser, deleteUser, verifyToken, getUserByEmail, getUserById } from '@/lib/auth';

// PUT - Aggiorna utente specifico (solo admin)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const currentUser = await getUserByEmail(decoded.email);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accesso negato. Solo gli amministratori possono modificare gli utenti.' },
        { status: 403 }
      );
    }

    const updateData = await request.json();
    const updatedUser = await updateUser(params.id, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Utente aggiornato con successo!',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante l\'aggiornamento dell\'utente' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina utente (solo admin)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const currentUser = await getUserByEmail(decoded.email);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accesso negato. Solo gli amministratori possono eliminare gli utenti.' },
        { status: 403 }
      );
    }

    // Non permettere di eliminare se stesso
    if (params.id === currentUser.id) {
      return NextResponse.json(
        { success: false, error: 'Non puoi eliminare il tuo stesso account' },
        { status: 400 }
      );
    }

    const deleted = await deleteUser(params.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Utente eliminato con successo!'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante l\'eliminazione dell\'utente' },
      { status: 500 }
    );
  }
}

// GET - Ottieni utente specifico (solo admin)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    const currentUser = await getUserByEmail(decoded.email);
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Accesso negato. Solo gli amministratori possono visualizzare gli utenti.' },
        { status: 403 }
      );
    }

    const user = await getUserById(params.id);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante il recupero dell\'utente' },
      { status: 500 }
    );
  }
}