/**
 * Auth Helper Functions per API Routes
 *
 * Utility per gestire autenticazione nelle API routes
 */

import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { User } from '@/lib/types';
import { getUserById } from '@/lib/auth';

/**
 * Estrae e verifica il token JWT dai cookie della richiesta
 * Restituisce l'utente completo se autenticato, altrimenti null
 */
export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  try {
    // Ottieni il token dal cookie 'auth_token'
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return null;
    }

    // Verifica il token JWT
    const decoded = verifyToken(token);

    if (!decoded) {
      return null;
    }

    // Carica l'utente completo dal database
    const user = await getUserById(decoded.id);

    return user;
  } catch (error) {
    console.error('❌ [AUTH-HELPER] Error getting user from request:', error);
    return null;
  }
}

/**
 * Alias per compatibilità
 */
export const getUserFromCookie = getUserFromRequest;
