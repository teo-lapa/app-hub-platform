import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// Mock database - in production usare un vero database
const users = new Map();

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // In un'app reale, qui otterresti l'ID utente dal token JWT
    // Per ora simulo l'aggiornamento
    console.log('Updating profile with:', { name, email, hasPassword: !!password });

    // Simula l'aggiornamento dell'utente
    const updatedUser = {
      id: 'mock-user-id',
      name,
      email,
      role: 'free_user',
      createdAt: new Date('2023-01-01'),
      lastLogin: new Date(),
    };

    // Se c'è una password, aggiorna anche quella (hashata)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      console.log('Password updated (hashed)');
    }

    return NextResponse.json({
      success: true,
      message: 'Profilo aggiornato con successo!',
      data: { user: updatedUser }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante l\'aggiornamento del profilo'
      },
      { status: 500 }
    );
  }
}