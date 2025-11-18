const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-25408900';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

interface OdooClient {
  uid: number | null;
  sessionId: string | null;
  searchRead: (model: string, domain: any[], fields: string[], limit?: number, offset?: number) => Promise<any[]>;
  create: (model: string, values: any[]) => Promise<number[]>;
  write: (model: string, ids: number[], values: any) => Promise<boolean>;
  call: (model: string, method: string, args: any[]) => Promise<any>;
}

class OdooRPC implements OdooClient {
  uid: number | null = null;
  sessionId: string | null = null;

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

      const data = await response.json();

      if (data.result && data.result.uid) {
        this.uid = data.result.uid;
        this.sessionId = data.result.session_id;
        return true;
      }

      throw new Error('Authentication failed');
    } catch (error) {
      console.error('Odoo authentication error:', error);
      throw error;
    }
  }

  private async ensureAuthenticated() {
    if (!this.uid) {
      await this.authenticate();
    }
  }

  async searchRead(model: string, domain: any[], fields: string[], limit: number = 100, offset: number = 0): Promise<any[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
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

  async create(model: string, values: any[]): Promise<number[]> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
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
        'Cookie': `session_id=${this.sessionId}`
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
      console.error('Odoo write error:', data.error);
      throw new Error(data.error.message || 'Write failed');
    }

    return data.result || false;
  }

  async call(model: string, method: string, args: any[]): Promise<any> {
    await this.ensureAuthenticated();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: {}
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