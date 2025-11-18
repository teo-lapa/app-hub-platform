/**
 * Odoo XML-RPC Client
 *
 * Low-level client for Odoo XML-RPC API operations.
 * Used for server-side operations like bank statement import.
 */

import * as xmlrpc from 'xmlrpc';

export interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

export class OdooClient {
  private config: OdooConfig;
  private uid: number | null = null;
  private commonClient: any;
  private objectClient: any;

  constructor(config: OdooConfig) {
    this.config = config;

    // Parse URL to extract host and port
    const url = new URL(config.url);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
    const path = url.pathname || '/xmlrpc';

    // Create XML-RPC clients
    this.commonClient = xmlrpc.createSecureClient({
      host,
      port,
      path: `${path}/2/common`
    });

    this.objectClient = xmlrpc.createSecureClient({
      host,
      port,
      path: `${path}/2/object`
    });
  }

  /**
   * Connect and authenticate
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        'authenticate',
        [this.config.db, this.config.username, this.config.password, {}],
        (error: any, uid: number) => {
          if (error) {
            reject(new Error(`Odoo authentication failed: ${error.message}`));
            return;
          }

          if (!uid) {
            reject(new Error('Odoo authentication failed: Invalid credentials'));
            return;
          }

          this.uid = uid;
          console.log(`Connected to Odoo as user ${this.config.username} (UID: ${uid})`);
          resolve();
        }
      );
    });
  }

  /**
   * Execute a method on an Odoo model
   */
  private async executeKw(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> {
    if (!this.uid) {
      throw new Error('Not connected to Odoo. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      this.objectClient.methodCall(
        'execute_kw',
        [
          this.config.db,
          this.uid,
          this.config.password,
          model,
          method,
          args,
          kwargs
        ],
        (error: any, result: any) => {
          if (error) {
            reject(new Error(`Odoo ${method} failed: ${error.message}`));
            return;
          }

          resolve(result);
        }
      );
    });
  }

  /**
   * Search for records
   */
  async search(
    model: string,
    domain: any[] = [],
    options: {
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<number[]> {
    return this.executeKw(model, 'search', [domain], options);
  }

  /**
   * Read records by IDs
   */
  async read<T = any>(
    model: string,
    ids: number[],
    options: {
      fields?: string[];
    } = {}
  ): Promise<T[]> {
    return this.executeKw(model, 'read', [ids], options);
  }

  /**
   * Search and read in one call
   */
  async searchRead<T = any>(
    model: string,
    domain: any[] = [],
    options: {
      fields?: string[];
      offset?: number;
      limit?: number;
      order?: string;
    } = {}
  ): Promise<T[]> {
    return this.executeKw(model, 'search_read', [domain], options);
  }

  /**
   * Create a new record
   */
  async create(model: string, values: any): Promise<number> {
    return this.executeKw(model, 'create', [values]);
  }

  /**
   * Update existing records
   */
  async write(model: string, ids: number[], values: any): Promise<boolean> {
    return this.executeKw(model, 'write', [ids, values]);
  }

  /**
   * Delete records
   */
  async delete(model: string, ids: number[]): Promise<boolean> {
    return this.executeKw(model, 'unlink', [ids]);
  }

  /**
   * Execute a custom method
   */
  async execute(model: string, method: string, args: any[] = []): Promise<any> {
    return this.executeKw(model, method, args);
  }

  /**
   * Get fields metadata
   */
  async fieldsGet(
    model: string,
    fields: string[] = [],
    attributes: string[] = []
  ): Promise<any> {
    return this.executeKw(model, 'fields_get', [fields], { attributes });
  }

  /**
   * Search count
   */
  async searchCount(model: string, domain: any[] = []): Promise<number> {
    return this.executeKw(model, 'search_count', [domain]);
  }

  /**
   * Check access rights
   */
  async checkAccessRights(
    model: string,
    operation: 'read' | 'write' | 'create' | 'unlink'
  ): Promise<boolean> {
    try {
      return await this.executeKw(model, 'check_access_rights', [operation], {
        raise_exception: false
      });
    } catch {
      return false;
    }
  }

  /**
   * Get server version
   */
  async version(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.commonClient.methodCall('version', [], (error: any, result: any) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }
}
