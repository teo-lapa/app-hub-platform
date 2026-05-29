import { callOdoo } from './odoo-auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * Estrae l'ID utente Odoo REALE dal JWT (login Google) se presente,
 * altrimenti usa lo uid della sessione. Stessa logica di delivery/list.
 */
export function getRealUid(userCookies: string | null | undefined, uid: number): number {
  let realUid: any = uid;
  if (userCookies) {
    const tokenMatch = userCookies.match(/token=([^;]+)/);
    if (tokenMatch) {
      try {
        const decoded = jwt.verify(tokenMatch[1], JWT_SECRET) as any;
        if (decoded.odooUserId) realUid = decoded.odooUserId;
      } catch {
        // JWT non valido/scaduto: si usa lo uid della sessione
      }
    }
  }
  return typeof realUid === 'string' ? parseInt(realUid) : realUid;
}

/** Risolve l'hr.employee.id del driver loggato. Null se l'utente non è un dipendente. */
export async function resolveDriverEmployeeId(cookies: string | null, uidNum: number): Promise<number | null> {
  const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
    domain: [['user_id', '=', uidNum]],
    fields: ['id'],
    limit: 1
  });
  return employees.length > 0 ? employees[0].id : null;
}

/**
 * Verifica che il picking appartenga al driver loggato (campo stock.picking.driver_id → hr.employee).
 * - Utenti senza hr.employee (admin/dispatcher) → CONSENTITO (non sono vincolati a un giro).
 * - Picking senza driver assegnato → CONSENTITO.
 * - Mismatch driver → 403.
 * - Picking inesistente → 404.
 */
export async function checkPickingOwnership(
  cookies: string | null,
  userCookies: string | null | undefined,
  uid: number,
  pickingId: number | string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const uidNum = getRealUid(userCookies, uid);
  const employeeId = await resolveDriverEmployeeId(cookies, uidNum);
  if (!employeeId) return { ok: true };

  const pickings = await callOdoo(cookies, 'stock.picking', 'read', [[Number(pickingId)]], {
    fields: ['driver_id']
  });
  if (!pickings || pickings.length === 0) {
    return { ok: false, status: 404, error: 'Consegna non trovata' };
  }
  const driver = pickings[0].driver_id;
  if (!driver) return { ok: true };
  if (driver[0] !== employeeId) {
    return { ok: false, status: 403, error: 'Non autorizzato: consegna assegnata a un altro autista' };
  }
  return { ok: true };
}

/** Verifica dimensione massima di una stringa base64 (anti-DoS). default 10 MB. */
export function assertBase64Size(data: string | null | undefined, maxBytes = 10 * 1024 * 1024): void {
  if (!data) return;
  // base64: ~3/4 della lunghezza stringa = byte reali
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > maxBytes) {
    throw new Error(`File troppo grande (${Math.round(approxBytes / 1024 / 1024)}MB, max ${Math.round(maxBytes / 1024 / 1024)}MB)`);
  }
}

/** Estrae il base64 nudo da un data URL o stringa già nuda (no crash se manca la virgola). */
export function stripBase64Prefix(data: string): string {
  return data.includes(',') ? data.split(',')[1] : data;
}
