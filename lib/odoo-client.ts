// Fallback allineati con sessionManager - usa DB main
const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
// Supporta sia ODOO_USERNAME che ODOO_ADMIN_EMAIL per retrocompatibilità
const ODOO_USERNAME = process.env.ODOO_USERNAME || process.env.ODOO_ADMIN_EMAIL || 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || process.env.ODOO_ADMIN_PASSWORD || 'apphubplatform2025';

interface OdooClient {
  uid: number | null;
  sessionId: string | null;
  searchRead: (model: string, domain: any[], fields: string[], limit?: number, offset?: number) => Promise<any[]>;
  searchReadKw: (model: string, domain: any[], fields: string[], kwargs?: { limit?: number; offset?: number; order?: string }) => Promise<any[]>;
  read: (model: string, ids: number[], fields: string[]) => Promise<any[]>;
  search: (model: string, domain: any[], kwargs?: { limit?: number; offset?: number; order?: string }) => Promise<number[]>;
  searchCount: (model: string, domain: any[]) => Promise<number>;
  create: (model: string, values: any[]) => Promise<number[]>;
  write: (model: string, ids: number[], values: any) => Promise<boolean>;
  unlink: (model: string, ids: number[]) => Promise<boolean>;
  call: (model: string, method: string, args: any[], kwargs?: any) => Promise<any>;
}

class OdooRPC implements OdooClient {
  uid: number | null = null;
  sessionId: string | null = null;
  private cookies: string | null = null;

  private async authenticate() {
    try {
      const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: ODOO_DB,
            login: ODOO_USERNAME,
            password: ODOO_PASSWORD
          },
          id: 1
        })
      });

      // Estrai TUTTI i cookies dalla risposta
      // Usa getSetCookie() se disponibile (Node 18.16+), altrimenti fallback a get('set-cookie')
      let setCookies: string[] = [];
      if (typeof response.headers.getSetCookie === 'function') {
        setCookies = response.headers.getSetCookie();
      } else {
        // Fallback per versioni più vecchie di Node.js
        const cookieHeader = response.headers.get('set-cookie');
        if (cookieHeader) {
          setCookies = cookieHeader.split(',').map(c => c.trim());
        }
      }

      if (setCookies && setCookies.length > 0) {
        // Estrai solo la parte nome=valore dai cookies (rimuovi expires, path, etc)
        this.cookies = setCookies
          .map(cookie => cookie.split(';')[0])
          .join('; ');
      }

      const data = await response.json();

      if (data.result && data.result.uid) {
        this.uid = data.result.uid;
        this.sessionId = data.result.session_id;

        // Se non abbiamo cookies dalla risposta HTTP, usa almeno il session_id dal JSON
        if (!this.cookies && this.sessionId) {
          this.cookies = `session_id=${this.sessionId}`;
        }

        return true;
      }

      throw new Error('Authentication failed');
    } catch (error) {
      console.error('Odoo authentication error:', error);
      throw error;
    }
  }

  private async ensureAuthenticated() {
    // SEMPRE autentica ad ogni chiamata in ambiente serverless
    // perché le sessioni non persistono tra le richieste
    await this.authenticate();
  }

  async searchRead(model: string, domain: any[], fields: string[], limit: number = 100, offset: number = 0): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'search_read',
          args: [],
          kwargs: {
            domain: domain,
            fields: fields,
            limit: limit,
            offset: offset
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo searchRead error:', data.error);
      throw new Error(data.error.message || 'Search failed');
    }

    return data.result || [];
  }

  async searchReadKw(model: string, domain: any[], fields: string[], kwargs: { limit?: number; offset?: number; order?: string } = {}): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'search_read',
          args: [],
          kwargs: {
            domain: domain,
            fields: fields,
            ...kwargs
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo searchReadKw error:', data.error);
      throw new Error(data.error.message || 'Search failed');
    }

    return data.result || [];
  }

  async read(model: string, ids: number[], fields: string[]): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'read',
          args: [ids],
          kwargs: { fields: fields }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo read error:', data.error);
      throw new Error(data.error.message || 'Read failed');
    }

    return data.result || [];
  }

  async search(model: string, domain: any[], kwargs: { limit?: number; offset?: number; order?: string } = {}): Promise<number[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'search',
          args: [domain],
          kwargs: kwargs
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo search error:', data.error);
      throw new Error(data.error.message || 'Search failed');
    }

    return data.result || [];
  }

  async searchCount(model: string, domain: any[]): Promise<number> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'search_count',
          args: [domain],
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo searchCount error:', data.error);
      throw new Error(data.error.message || 'Search count failed');
    }

    return data.result || 0;
  }

  async create(model: string, values: any[]): Promise<number[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'create',
          args: values,
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo create error:', data.error);
      throw new Error(data.error.message || 'Create failed');
    }

    return data.result || [];
  }

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'write',
          args: [ids, values],
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Odoo write error:', JSON.stringify(data.error, null, 2));
      throw new Error(data.error.data?.message || data.error.message || 'Write failed');
    }

    return data.result || false;
  }

  async unlink(model: string, ids: number[]): Promise<boolean> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: 'unlink',
          args: [ids],
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Odoo unlink error:', JSON.stringify(data.error, null, 2));
      throw new Error(data.error.data?.message || data.error.message || 'Unlink failed');
    }

    return data.result || false;
  }

  async call(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: kwargs
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Odoo call error:', data.error);
      throw new Error(data.error.message || 'Call failed');
    }

    return data.result;
  }
}

let clientInstance: OdooRPC | null = null;

export async function getOdooClient(): Promise<OdooClient> {
  if (!clientInstance) {
    clientInstance = new OdooRPC();
  }
  return clientInstance;
}