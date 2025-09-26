import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, createUser, updateUser, deleteUser, verifyToken, getUserByEmail } from '@/lib/auth';

// GET - Ottieni tutti gli utenti (solo admin)
export async function GET(request: NextRequest) {
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

    const users = await getAllUsers();
    return NextResponse.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

// POST - Crea nuovo utente (solo admin)
export async function POST(request: NextRequest) {
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
        { success: false, error: 'Accesso negato. Solo gli amministratori possono creare utenti.' },
        { status: 403 }
      );
    }

    const userData = await request.json();

    // Valida i dati richiesti
    if (!userData.email || !userData.password || !userData.name) {
      return NextResponse.json(
        { success: false, error: 'Email, password e nome sono obbligatori' },
        { status: 400 }
      );
    }

    const newUser = await createUser(userData.email, userData.password, userData.name);

    // Se ci sono dati aggiuntivi, aggiorna l'utente
    if (userData.telefono || userData.azienda || userData.role || userData.appPermessi) {
      const updates: any = {};
      if (userData.telefono) updates.telefono = userData.telefono;
      if (userData.azienda) updates.azienda = userData.azienda;
      if (userData.indirizzo) updates.indirizzo = userData.indirizzo;
      if (userData.citta) updates.citta = userData.citta;
      if (userData.cap) updates.cap = userData.cap;
      if (userData.partitaIva) updates.partitaIva = userData.partitaIva;
      if (userData.codiceCliente) updates.codiceCliente = userData.codiceCliente;
      if (userData.note) updates.note = userData.note;
      if (userData.role) updates.role = userData.role;
      if (userData.appPermessi) updates.appPermessi = userData.appPermessi;
      if (userData.abilitato !== undefined) updates.abilitato = userData.abilitato;

      await updateUser(newUser.id, updates);
    }

    return NextResponse.json({
      success: true,
      message: 'Utente creato con successo!',
      data: { user: newUser }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante la creazione dell\'utente' },
      { status: 500 }
    );
  }
}