/**
 * MAESTRO AI - Sistema Permessi Venditori
 *
 * Gestisce la visibilità dei dati in base all'utente loggato:
 * - Super users (Paul, Laura, Gregorio) vedono TUTTI i venditori
 * - Altri utenti vedono SOLO i propri clienti (basato su odoo_employee_id)
 */

import { User } from '@/lib/types';

/**
 * Lista email utenti con permessi speciali (possono vedere tutti i venditori)
 */
export const MAESTRO_SUPER_USERS = [
  'paul@lapa.com',
  'laura@lapa.com',
  'gregorio@lapa.ch'  // FIX: Corrected email domain from .com to .ch
];

/**
 * Verifica se un utente può vedere tutti i venditori
 */
export function canViewAllVendors(user: User | null): boolean {
  if (!user) return false;

  // Admin possono vedere tutto
  if (user.role === 'admin') return true;

  // Super users possono vedere tutto
  return MAESTRO_SUPER_USERS.includes(user.email.toLowerCase());
}

/**
 * Restituisce gli ID dei venditori che l'utente può vedere
 *
 * @returns 'all' se può vedere tutti, array di ID se limitato, [] se nessun accesso
 */
export function getVisibleSalespersonIds(user: User | null): number[] | 'all' {
  if (!user) return [];

  // Super users e admin vedono tutti
  if (canViewAllVendors(user)) {
    return 'all';
  }

  // Altri vedono solo se stessi
  // NOTA: odoo_employee_id deve essere aggiunto alla tabella users
  const employeeId = (user as any).odoo_employee_id;

  if (employeeId) {
    return [employeeId];
  }

  // Nessun employee_id = nessun accesso
  return [];
}

/**
 * Verifica se un utente può accedere ai dati di un cliente specifico
 */
export function canAccessCustomer(
  user: User | null,
  customerAssignedSalespersonId: number | null
): boolean {
  if (!user) return false;

  // Super users possono accedere a tutto
  if (canViewAllVendors(user)) return true;

  // Se il cliente non ha un venditore assegnato, solo super users possono vederlo
  if (!customerAssignedSalespersonId) return false;

  // Verifica se il venditore assegnato è l'utente corrente
  const employeeId = (user as any).odoo_employee_id;
  return employeeId === customerAssignedSalespersonId;
}
