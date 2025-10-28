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
    // Ottieni il token dal cookie 'token' (usato dal sistema di login Odoo)
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.log('❌ [AUTH-HELPER] No token cookie found');
      return null;
    }

    // Prova prima con verifyToken (utenti locali)
    try {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await getUserById(decoded.id);
        if (user) {
          console.log('✅ [AUTH-HELPER] Local user authenticated:', user.email);
          return user;
        }
      }
    } catch (localError) {
      // Ignora, prova con JWT diretto per utenti Odoo
    }

    // Fallback: Prova a decodificare JWT per utenti Odoo
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    try {
      const jwtDecoded = jwt.verify(token, jwtSecret) as any;

      if (jwtDecoded && jwtDecoded.email && jwtDecoded.id) {
        // Ricostruisce l'utente Odoo dai dati del token
        const user: User = {
          id: jwtDecoded.id,
          email: jwtDecoded.email,
          name: jwtDecoded.name || jwtDecoded.email || 'Utente Odoo',
          role: jwtDecoded.role || 'admin',
          azienda: jwtDecoded.azienda || 'LAPA',
          abilitato: true,
          appPermessi: ['profile', 'dashboard', 'admin'],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        console.log('✅ [AUTH-HELPER] Odoo user authenticated:', user.email);
        return user;
      }
    } catch (jwtError) {
      console.error('❌ [AUTH-HELPER] JWT verification failed:', jwtError);
    }

    return null;
  } catch (error) {
    console.error('❌ [AUTH-HELPER] Error getting user from request:', error);
    return null;
  }
}

/**
 * Alias per compatibilità
 */
export const getUserFromCookie = getUserFromRequest;
