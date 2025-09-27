export interface OdooUser {
  id: number;
  name: string;
  email: string;
  groups: string[];
  company_id: number;
  company_name: string;
  active: boolean;
  isAdmin?: boolean;
}

export interface OdooSession {
  uid: number;
  session_id: string;
  db: string;
  login: string;
  password?: string;
}

export class OdooClient {
  private url: string;
  private db: string;

  constructor(url: string, db: string) {
    this.url = url;
    this.db = db;
  }

  async authenticate(login: string, password: string): Promise<{ session: OdooSession; authResult: any } | null> {
    try {
      console.log('🔐 Tentativo login Odoo:', login, 'su', this.url);

      const response = await fetch(`${this.url}/web/session/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: this.db,
            login,
            password,
          }
        })
      });

      console.log('📡 Risposta Odoo status:', response.status);

      if (!response.ok) {
        console.error('❌ Errore HTTP Odoo:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      console.log('📋 Dati risposta Odoo (UID):', data.result?.uid);

      if (data.error) {
        console.error('❌ Errore Odoo:', data.error);
        return null;
      }

      if (!data.result || !data.result.uid) {
        console.error('❌ Nessun UID ricevuto da Odoo');
        return null;
      }

      console.log('✅ Login Odoo riuscito! UID:', data.result.uid);

      const session = {
        uid: data.result.uid,
        session_id: data.result.session_id || `${data.result.uid}_${Date.now()}`,
        db: this.db,
        login,
        password
      };

      return {
        session,
        authResult: data.result
      };
    } catch (error) {
      console.error('💥 Errore connessione Odoo:', error);
      return null;
    }
  }

  async getUserInfo(session: OdooSession, authResult?: any): Promise<OdooUser | null> {
    try {
      // Se abbiamo dati dalla sessione di autenticazione, usali
      if (authResult && authResult.name && authResult.username) {
        console.log('🔄 Using auth result data for user info');

        const companyData = authResult.user_companies?.allowed_companies || {};
        const currentCompanyId = authResult.user_companies?.current_company || 1;
        const currentCompany = companyData[currentCompanyId];

        return {
          id: session.uid,
          name: authResult.name,
          email: authResult.username,
          groups: [], // I gruppi li mapperemo dopo o useremo is_admin
          company_id: currentCompanyId,
          company_name: currentCompany?.name || 'LAPA - finest italian food GmbH',
          active: true,
          isAdmin: authResult.is_admin || false
        };
      }

      // Fallback al metodo originale
      console.log('🔄 Fetching user info via API');
      const response = await fetch(`${this.url}/web/dataset/call_kw/res.users/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${session.session_id}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.users',
            method: 'read',
            args: [session.uid],
            kwargs: {
              fields: ['name', 'email', 'groups_id', 'company_id', 'active']
            }
          }
        })
      });

      const data = await response.json();

      if (data.error || !data.result || !data.result[0]) {
        console.error('Error fetching user info:', data.error);
        return null;
      }

      const userInfo = data.result[0];
      const groups = await this.getUserGroups(session, userInfo.groups_id);
      const companyInfo = await this.getCompanyInfo(session, userInfo.company_id[0]);

      return {
        id: session.uid,
        name: userInfo.name,
        email: userInfo.email,
        groups,
        company_id: userInfo.company_id[0],
        company_name: companyInfo?.name || '',
        active: userInfo.active
      };
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  private async getUserGroups(session: OdooSession, groupIds: number[]): Promise<string[]> {
    try {
      const response = await fetch(`${this.url}/web/dataset/call_kw/res.groups/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${session.session_id}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.groups',
            method: 'read',
            args: [groupIds],
            kwargs: {
              fields: ['name', 'full_name']
            }
          }
        })
      });

      const data = await response.json();

      if (data.error || !data.result) {
        console.error('Error fetching groups:', data.error);
        return [];
      }

      return data.result.map((group: any) => group.full_name || group.name);
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }

  private async getCompanyInfo(session: OdooSession, companyId: number): Promise<any> {
    try {
      const response = await fetch(`${this.url}/web/dataset/call_kw/res.company/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${session.session_id}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.company',
            method: 'read',
            args: [companyId],
            kwargs: {
              fields: ['name']
            }
          }
        })
      });

      const data = await response.json();

      if (data.error || !data.result) {
        console.error('Error fetching company info:', data.error);
        return null;
      }

      return data.result[0];
    } catch (error) {
      console.error('Error fetching company info:', error);
      return null;
    }
  }

  async validateSession(session: OdooSession): Promise<boolean> {
    try {
      const userInfo = await this.getUserInfo(session);
      return userInfo !== null && userInfo.active;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  mapGroupsToRole(groups: string[], isAdmin: boolean = false): string {
    // Se l'utente è admin Odoo, mappa ad admin dell'app
    if (isAdmin) {
      return 'admin';
    }

    const groupMappings = {
      'Administration / Settings': 'admin',
      'Administration / Access Rights': 'admin',
      'Human Resources / Employee': 'dipendente',
      'Human Resources / Officer': 'dipendente',
      'Sales / User': 'dipendente',
      'Sales / Manager': 'admin',
      'Accounting / Billing': 'dipendente',
      'Accounting / Accountant': 'dipendente',
      'Inventory / User': 'dipendente',
      'Contact Creation': 'cliente_premium',
      'Portal': 'cliente_gratuito',
      'Public': 'visitor'
    };

    for (const group of groups) {
      for (const [odooGroup, appRole] of Object.entries(groupMappings)) {
        if (group.includes(odooGroup)) {
          return appRole;
        }
      }
    }

    // Default per utenti interni non specificati
    return 'dipendente';
  }

  getAppPermissions(groups: string[]): string[] {
    const permissions: string[] = [];

    permissions.push('profile', 'dashboard');

    if (groups.some(g => g.includes('Administration') || g.includes('Settings'))) {
      permissions.push('admin', 'users', 'reports', 'settings');
    }

    if (groups.some(g => g.includes('Human Resources') || g.includes('Employee'))) {
      permissions.push('hr', 'timesheet', 'leave');
    }

    if (groups.some(g => g.includes('Sales') || g.includes('CRM'))) {
      permissions.push('crm', 'sales', 'leads');
    }

    if (groups.some(g => g.includes('Accounting') || g.includes('Invoicing'))) {
      permissions.push('accounting', 'invoices');
    }

    if (groups.some(g => g.includes('Inventory') || g.includes('Stock'))) {
      permissions.push('inventory', 'warehouse');
    }

    return permissions;
  }

  // Metodi aggiuntivi per compatibilità con i servizi esistenti
  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    options: {
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    // Per ora ritorna successo con array vuoto, implementazione placeholder
    return {
      success: true,
      data: []
    };
  }

  async callKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    session?: OdooSession
  ): Promise<any> {
    try {
      if (!session) {
        throw new Error('Sessione Odoo richiesta per callKw');
      }

      console.log('🔄 Odoo callKw:', model, method, 'args:', args);

      // Usa approccio diretto come l'HTML originale
      const response = await fetch(`${this.url}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Usa i cookie del browser
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model,
            method,
            args,
            kwargs,
            context: {}
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error('❌ Errore Odoo callKw:', data.error);
        throw new Error(data.error.message || 'Errore chiamata Odoo');
      }

      console.log('✅ Odoo callKw risultato:', data.result);
      return data.result;

    } catch (error: any) {
      console.error('💥 Errore callKw:', error);
      throw error;
    }
  }

  async read(
    model: string,
    ids: number[],
    fields: string[] = []
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    // Per ora ritorna successo con array vuoto, implementazione placeholder
    return {
      success: true,
      data: []
    };
  }

  async create(
    model: string,
    values: Record<string, any>
  ): Promise<{ success: boolean; data?: number; error?: string }> {
    // Per ora ritorna successo con ID fittizio, implementazione placeholder
    return {
      success: true,
      data: 1
    };
  }

  async write(
    model: string,
    ids: number[],
    values: Record<string, any>
  ): Promise<{ success: boolean; data?: boolean; error?: string }> {
    // Per ora ritorna successo, implementazione placeholder
    return {
      success: true,
      data: true
    };
  }

  async unlink(
    model: string,
    ids: number[]
  ): Promise<{ success: boolean; data?: boolean; error?: string }> {
    // Per ora ritorna successo, implementazione placeholder
    return {
      success: true,
      data: true
    };
  }

  async searchCount(
    model: string,
    domain: any[] = []
  ): Promise<{ success: boolean; data?: number; error?: string }> {
    // Per ora ritorna successo con count 0, implementazione placeholder
    return {
      success: true,
      data: 0
    };
  }
}

export const createOdooClient = (): OdooClient => {
  const url = process.env.ODOO_URL || 'http://localhost:8069';
  const db = process.env.ODOO_DB || 'odoo';

  return new OdooClient(url, db);
};

// Singleton instance
let odooClientInstance: OdooClient | null = null;

export function getOdooClient(): OdooClient {
  if (!odooClientInstance) {
    odooClientInstance = createOdooClient();
  }
  return odooClientInstance;
}

// Helper functions per operazioni comuni
export async function withOdooAuth<T>(
  callback: (client: OdooClient) => Promise<T>,
  session?: OdooSession
): Promise<T> {
  const client = getOdooClient();

  if (session) {
    // Usa la sessione fornita senza riautenticare
    return callback(client);
  }

  // Se non c'è sessione, solleva un errore
  throw new Error('Odoo session required for authenticated operations');
}