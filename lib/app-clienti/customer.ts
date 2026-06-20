import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

// Partner "spazzatura" che condividono l'email ma non sono il cliente vero
const JUNK = /anonymous|express checkout|magazzino|consegna|delivery|point of sale|pos\b/i;

export interface CustomerRef {
  commercialId: number; // azienda/entità commerciale (per ordini/fatture di tutto il gruppo)
  partnerId: number;
  name: string;
}

/**
 * Risolve il cliente loggato dal cookie JWT.
 * Una stessa email può avere più partner in Odoo (es. "Anonymous express checkout"):
 * scartiamo i partner spazzatura, preferiamo aziende e contatti con azienda padre,
 * e usiamo il commercial_partner_id per coprire tutto il gruppo aziendale.
 */
export async function resolveCustomer(request: NextRequest): Promise<CustomerRef | null> {
  const token = request.cookies.get('token')?.value;
  if (!token) return null;

  let email: string | null = null;
  try {
    email = (jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any)?.email || null;
  } catch {
    return null;
  }
  if (!email) return null;

  const partners: any[] = await callOdooAsAdmin('res.partner', 'search_read', [], {
    domain: [['email', '=', email]],
    fields: ['id', 'name', 'is_company', 'parent_id', 'commercial_partner_id'],
    limit: 10,
  });
  if (!partners || partners.length === 0) return null;

  const chosen = [...partners].sort((a, b) => {
    const aj = JUNK.test(a.name || '') ? 1 : 0;
    const bj = JUNK.test(b.name || '') ? 1 : 0;
    if (aj !== bj) return aj - bj;
    const ac = a.is_company ? 0 : 1;
    const bc = b.is_company ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const ap = a.parent_id ? 0 : 1;
    const bp = b.parent_id ? 0 : 1;
    return ap - bp;
  })[0];

  const commercialId = Array.isArray(chosen.commercial_partner_id) ? chosen.commercial_partner_id[0] : chosen.id;
  return { commercialId, partnerId: chosen.id, name: chosen.name };
}
