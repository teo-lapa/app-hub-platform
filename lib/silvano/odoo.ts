/**
 * Helper Odoo per l'Area Venditore (Silvano).
 * Tutto server-side via sessione admin; il filtro per venditore è SEMPRE esplicito.
 */
import { NextRequest } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { computeMarginInfo } from './margin';
import { SILVANO_ODOO_USER_ID, LAPA_COMPANY_ID } from './config';

export interface Salesperson {
  userId: number;        // res.users.id da filtrare
  name: string;
  isOverride: boolean;   // true se admin sta guardando con ?sp=
}

function decodeToken(token?: string): any | null {
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch {
    // fallback: decodifica payload senza verifica (come il middleware Edge)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    } catch {
      return null;
    }
  }
}

/**
 * Determina il venditore "corrente":
 *  1. odooUserId dal JWT (login agente)
 *  2. override admin ?sp=<id>
 *  3. fallback SILVANO_ODOO_USER_ID (config/env)
 */
export async function resolveSalesperson(request: NextRequest): Promise<Salesperson> {
  const token = request.cookies.get('token')?.value;
  const payload = decodeToken(token);
  const role = payload?.role;
  const isAdmin = role === 'admin' || role === 'dipendente';

  const sp = request.nextUrl.searchParams.get('sp');
  if (isAdmin && sp && !isNaN(Number(sp))) {
    return { userId: Number(sp), name: `Venditore #${sp}`, isOverride: true };
  }

  const odooUserId = payload?.odooUserId;
  if (role === 'agente' && odooUserId) {
    return { userId: Number(odooUserId), name: payload?.name || 'Venditore', isOverride: false };
  }

  return {
    userId: SILVANO_ODOO_USER_ID,
    name: payload?.name || 'Silvano Barbera',
    isOverride: false,
  };
}

/** Domain di base per i clienti del venditore. */
export function salespersonPartnerDomain(userId: number): any[] {
  const d: any[] = [['customer_rank', '>', 0]];
  if (userId) d.push(['user_id', '=', userId]);
  return d;
}

/** Listino (pricelist) del cliente. */
export async function getClientPricelistId(clientId: number): Promise<number | null> {
  const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
    domain: [['id', '=', clientId]],
    fields: ['property_product_pricelist'],
    limit: 1,
  });
  const pl = partners?.[0]?.property_product_pricelist;
  return pl && pl[0] ? pl[0] : null;
}

/**
 * Prezzo di listino del cliente per un singolo prodotto (metodo provato in lapa-agents).
 * Ritorna il prezzo o null se non calcolabile.
 */
export async function getClientPrice(
  pricelistId: number,
  productId: number,
  qty: number,
  partnerId: number
): Promise<number | null> {
  try {
    const res = await callOdooAsAdmin(
      'product.pricelist',
      'get_product_price_rule',
      [[pricelistId], productId, qty, partnerId || false],
      {}
    );
    const entry = res?.[productId];
    if (entry && typeof entry[0] === 'number') return entry[0];
  } catch (e) {
    // fallback gestito dal chiamante
  }
  return null;
}

/**
 * Arricchisce una lista di prodotti col prezzo di listino del cliente e le info margine.
 * `products` deve contenere id, standard_price, list_price.
 */
export async function enrichWithMargin(
  products: any[],
  pricelistId: number | null,
  partnerId: number
) {
  return Promise.all(
    products.map(async (p) => {
      let base = p.list_price || 0;
      if (pricelistId) {
        const price = await getClientPrice(pricelistId, p.id, 1, partnerId);
        if (price != null) base = price;
      }
      const margin = computeMarginInfo(base, p.standard_price || 0);
      return { ...p, ...margin, base };
    })
  );
}

export { callOdooAsAdmin, LAPA_COMPANY_ID };
