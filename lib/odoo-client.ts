/**
 * 🚨🚨🚨 DEPRECATED - NON USARE QUESTO FILE 🚨🚨🚨
 *
 * Questo file viola le regole di autenticazione.
 * USA INVECE: lib/odoo-auth.ts con getOdooSession() e callOdoo()
 *
 * MOTIVAZIONE:
 * - Questo file si autenticava con credenziali hardcoded
 * - Violava il principio "Utente loggato = accesso Odoo"
 * - NON rispettava il cookie odoo_session_id dell'utente
 *
 * MIGRAZIONE:
 * Prima:
 *   const client = await getOdooClient();
 *   const data = await client.searchRead('res.partner', [], ['id', 'name']);
 *
 * Dopo:
 *   import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
 *   import { cookies } from 'next/headers';
 *
 *   const userCookies = cookies().toString();
 *   const { cookies: odooCookies } = await getOdooSession(userCookies);
 *   const data = await callOdoo(odooCookies, 'res.partner', 'search_read', [], {
 *     fields: ['id', 'name']
 *   });
 *
 * Vedi: ODOO_AUTH_SYSTEM.md per dettagli completi
 */

// Lazy eval env vars
const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
const ODOO_DB = process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB;

if (!ODOO_URL) {
  throw new Error('ODOO_URL or NEXT_PUBLIC_ODOO_URL environment variable is required');
}
if (!ODOO_DB) {
  throw new Error('ODOO_DB or NEXT_PUBLIC_ODOO_DB environment variable is required');
}

interface OdooClient {
  searchRead: (model: string, domain: any[], fields: string[], limit?: number, offset?: number) => Promise<any[]>;
  create: (model: string, values: any[]) => Promise<number[]>;
  write: (model: string, ids: number[], values: any) => Promise<boolean>;
  call: (model: string, method: string, args: any[]) => Promise<any>;
}

class OdooRPC implements OdooClient {
  async searchRead(model: string, domain: any[], fields: string[], limit: number = 100, offset: number = 0): Promise<any[]> {
    throw new Error('🚨 DEPRECATED: Usa lib/odoo-auth.ts invece. Vedi documentazione in questo file.');
  }

  async create(model: string, values: any[]): Promise<number[]> {
    throw new Error('🚨 DEPRECATED: Usa lib/odoo-auth.ts invece. Vedi documentazione in questo file.');
  }

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    throw new Error('🚨 DEPRECATED: Usa lib/odoo-auth.ts invece. Vedi documentazione in questo file.');
  }

  async call(model: string, method: string, args: any[]): Promise<any> {
    throw new Error('🚨 DEPRECATED: Usa lib/odoo-auth.ts invece. Vedi documentazione in questo file.');
  }
}

let clientInstance: OdooRPC | null = null;

export async function getOdooClient(): Promise<OdooClient> {
  console.warn('⚠️ DEPRECATION WARNING: getOdooClient() è deprecated. Usa lib/odoo-auth.ts invece.');
  if (!clientInstance) {
    clientInstance = new OdooRPC();
  }
  return clientInstance;
}
