import { OdooConfig, OdooResponse, OdooAuthResponse, ODOO_ENDPOINTS, OdooModel, getOdooConfig } from './config';

export class OdooClient {
  private config: OdooConfig;
  private sessionId: string | null = null;
  private uid: number | null = null;
  private baseUrl: string;

  constructor(config?: Partial<OdooConfig>) {
    this.config = { ...getOdooConfig(), ...config };
    this.baseUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
  }

  // Costruisce l'URL completo per un endpoint
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  // Gestisce le richieste HTTP con headers comuni
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<OdooResponse<T>> {
    try {
      const url = this.buildUrl(endpoint);
      const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (this.sessionId) {
        defaultHeaders['Cookie'] = `session_id=${this.sessionId}`;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP Error: ${response.status} ${response.statusText}`,
          error_code: 'HTTP_ERROR'
        };
      }

      const data = await response.json();

      // Gestione errori Odoo
      if (data.error) {
        return {
          success: false,
          error: data.error.data?.message || data.error.message || 'Unknown Odoo error',
          error_code: data.error.code || 'ODOO_ERROR'
        };
      }

      return {
        success: true,
        data: data.result || data
      };

    } catch (error) {
      console.error('Odoo request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        error_code: 'NETWORK_ERROR'
      };
    }
  }

  // Autenticazione
  async authenticate(): Promise<OdooResponse<OdooAuthResponse>> {
    const response = await this.makeRequest<OdooAuthResponse>(ODOO_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: this.config.database,
          login: this.config.username,
          password: this.config.password,
        }
      })
    });

    if (response.success && response.data) {
      this.uid = response.data.uid;
      this.sessionId = response.data.session_id;
    }

    return response;
  }

  // Logout
  async logout(): Promise<OdooResponse<any>> {
    const response = await this.makeRequest(ODOO_ENDPOINTS.LOGOUT, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {}
      })
    });

    if (response.success) {
      this.uid = null;
      this.sessionId = null;
    }

    return response;
  }

  // Verifica se il client è autenticato
  isAuthenticated(): boolean {
    return this.uid !== null && this.sessionId !== null;
  }

  // Chiamata generica a metodi Odoo
  async callKw(
    model: OdooModel,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<OdooResponse<any>> {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        error: 'Client not authenticated',
        error_code: 'NOT_AUTHENTICATED'
      };
    }

    return this.makeRequest(ODOO_ENDPOINTS.CALL_KW, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs
        }
      })
    });
  }

  // Search records
  async search(
    model: OdooModel,
    domain: any[] = [],
    options: {
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<OdooResponse<number[]>> {
    return this.callKw(model, 'search', [domain], options);
  }

  // Read records
  async read(
    model: OdooModel,
    ids: number[],
    fields: string[] = []
  ): Promise<OdooResponse<any[]>> {
    return this.callKw(model, 'read', [ids], { fields });
  }

  // Search and read in one call
  async searchRead(
    model: OdooModel,
    domain: any[] = [],
    fields: string[] = [],
    options: {
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<OdooResponse<any[]>> {
    return this.callKw(model, 'search_read', [domain], { fields, ...options });
  }

  // Create records
  async create(
    model: OdooModel,
    values: Record<string, any>
  ): Promise<OdooResponse<number>> {
    return this.callKw(model, 'create', [values]);
  }

  // Update records
  async write(
    model: OdooModel,
    ids: number[],
    values: Record<string, any>
  ): Promise<OdooResponse<boolean>> {
    return this.callKw(model, 'write', [ids, values]);
  }

  // Delete records
  async unlink(
    model: OdooModel,
    ids: number[]
  ): Promise<OdooResponse<boolean>> {
    return this.callKw(model, 'unlink', [ids]);
  }

  // Get fields definition
  async fieldsGet(
    model: OdooModel,
    fields: string[] = []
  ): Promise<OdooResponse<Record<string, any>>> {
    return this.callKw(model, 'fields_get', [], { allfields: fields });
  }

  // Count records
  async searchCount(
    model: OdooModel,
    domain: any[] = []
  ): Promise<OdooResponse<number>> {
    return this.callKw(model, 'search_count', [domain]);
  }
}

// Singleton instance
let odooClientInstance: OdooClient | null = null;

export function getOdooClient(config?: Partial<OdooConfig>): OdooClient {
  if (!odooClientInstance) {
    odooClientInstance = new OdooClient(config);
  }
  return odooClientInstance;
}

// Helper functions per operazioni comuni
export async function withOdooAuth<T>(
  callback: (client: OdooClient) => Promise<T>
): Promise<T> {
  const client = getOdooClient();

  if (!client.isAuthenticated()) {
    const authResult = await client.authenticate();
    if (!authResult.success) {
      throw new Error(`Odoo authentication failed: ${authResult.error}`);
    }
  }

  return callback(client);
}