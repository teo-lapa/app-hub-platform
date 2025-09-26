import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';
import { User } from '@/lib/types';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e password sono obbligatori' },
        { status: 400 }
      );
    }

    const odooClient = createOdooClient();

    // Autenticare con Odoo
    const authData = await odooClient.authenticate(email, password);

    if (!authData) {
      return NextResponse.json(
        { success: false, error: 'Credenziali non valide' },
        { status: 401 }
      );
    }

    const { session, authResult } = authData;

    // Ottenere informazioni utente da Odoo
    const odooUser = await odooClient.getUserInfo(session, authResult);

    if (!odooUser) {
      return NextResponse.json(
        { success: false, error: 'Impossibile recuperare informazioni utente' },
        { status: 500 }
      );
    }

    // Mappare i dati Odoo al formato dell'applicazione
    const appRole = odooClient.mapGroupsToRole(odooUser.groups, odooUser.isAdmin);
    const appPermissions = odooClient.getAppPermissions(odooUser.groups);

    const user: User = {
      id: odooUser.id.toString(),
      email: odooUser.email,
      name: odooUser.name,
      role: appRole as any,
      azienda: odooUser.company_name,
      abilitato: odooUser.active,
      appPermessi: appPermissions,
      createdAt: new Date(),
      updatedAt: new Date(),
      telefono: '',
      indirizzo: '',
      citta: '',
      cap: '',
      partitaIva: '',
      codiceCliente: '',
      note: `Utente Odoo - Gruppi: ${odooUser.groups.join(', ')}`
    };

    // Creare JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        email: user.email,
        userId: user.id,
        odooUid: odooUser.id,
        sessionId: session.session_id
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Impostare cookie per la sessione
    const response = NextResponse.json({
      success: true,
      message: 'Login Odoo effettuato con successo!',
      data: { user, token }
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400 // 24 ore
    });

    response.cookies.set('odoo_session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400 // 24 ore
    });

    return response;

  } catch (error) {
    console.error('Odoo login error:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}