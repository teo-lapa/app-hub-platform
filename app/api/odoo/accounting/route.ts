/**
 * Odoo Accounting API Endpoint
 *
 * Permette query dirette su dati contabili Odoo:
 * - account.account (Piano dei conti)
 * - account.move (Registrazioni contabili)
 * - account.move.line (Righe contabili)
 * - account.journal (Giornali)
 *
 * Backend Specialist: Query ottimizzate per analisi contabile
 */

import { NextRequest, NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

// Odoo config
const ODOO_URL = process.env.ODOO_URL || 'https://erp.alpenpur.ch';
const ODOO_DB = process.env.ODOO_DB || 'alpenpur';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'apphubplatform2025';

interface OdooRPCParams {
  model: string;
  method: 'search_read' | 'read' | 'search' | 'search_count';
  domain?: any[];
  fields?: string[];
  limit?: number;
  offset?: number;
  order?: string;
  context?: Record<string, any>;
}

/**
 * Odoo XML-RPC Client
 */
class OdooClient {
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;

  constructor() {
    this.url = ODOO_URL;
    this.db = ODOO_DB;
    this.username = ODOO_USERNAME;
    this.password = ODOO_PASSWORD;
  }

  /**
   * Authenticate and get UID
   */
  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.url}/xmlrpc/2/common`);
      const client = xmlrpc.createSecureClient({
        host: url.hostname,
        port: parseInt(url.port) || 443,
        path: url.pathname,
        cookies: true,
      });

      client.methodCall(
        'authenticate',
        [this.db, this.username, this.password, {}],
        (error: Error | null, value: any) => {
          if (error) {
            reject(new Error(`Authentication failed: ${error.message}`));
            return;
          }

          if (!value) {
            reject(new Error('Authentication failed: Invalid credentials'));
            return;
          }

          this.uid = value;
          resolve(value);
        }
      );
    });
  }

  /**
   * Execute Odoo RPC call
   */
  async execute(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: Record<string, any> = {}
  ): Promise<any> {
    const uid = await this.authenticate();

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.url}/xmlrpc/2/object`);
      const client = xmlrpc.createSecureClient({
        host: url.hostname,
        port: parseInt(url.port) || 443,
        path: url.pathname,
        cookies: true,
      });

      client.methodCall(
        'execute_kw',
        [this.db, uid, this.password, model, method, args, kwargs],
        (error: Error | null, value: any) => {
          if (error) {
            reject(new Error(`RPC call failed: ${error.message}`));
            return;
          }

          resolve(value);
        }
      );
    });
  }

  /**
   * Search and read records
   */
  async searchRead(params: OdooRPCParams): Promise<any[]> {
    const {
      model,
      domain = [],
      fields = [],
      limit,
      offset,
      order,
      context = {},
    } = params;

    const kwargs: Record<string, any> = { context };

    if (fields.length > 0) kwargs.fields = fields;
    if (limit) kwargs.limit = limit;
    if (offset) kwargs.offset = offset;
    if (order) kwargs.order = order;

    return this.execute(model, 'search_read', [domain], kwargs);
  }

  /**
   * Search record IDs
   */
  async search(
    model: string,
    domain: any[] = [],
    options: { limit?: number; offset?: number; order?: string } = {}
  ): Promise<number[]> {
    const kwargs: Record<string, any> = {};
    if (options.limit) kwargs.limit = options.limit;
    if (options.offset) kwargs.offset = options.offset;
    if (options.order) kwargs.order = options.order;

    return this.execute(model, 'search', [domain], kwargs);
  }

  /**
   * Count records
   */
  async searchCount(model: string, domain: any[] = []): Promise<number> {
    return this.execute(model, 'search_count', [domain]);
  }

  /**
   * Read records by IDs
   */
  async read(
    model: string,
    ids: number[],
    fields: string[] = []
  ): Promise<any[]> {
    const kwargs: Record<string, any> = {};
    if (fields.length > 0) kwargs.fields = fields;

    return this.execute(model, 'read', [ids], kwargs);
  }
}

/**
 * POST /api/odoo/accounting
 *
 * Query dati contabili Odoo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, method, domain, fields, limit, offset, order, context } = body;

    // Validazione
    if (!model || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: model, method' },
        { status: 400 }
      );
    }

    // Solo modelli contabili allowed
    const allowedModels = [
      'account.account',
      'account.move',
      'account.move.line',
      'account.journal',
      'account.payment',
      'account.bank.statement',
      'account.bank.statement.line',
      'res.partner',
      'res.currency',
    ];

    if (!allowedModels.includes(model)) {
      return NextResponse.json(
        { error: `Model ${model} not allowed. Allowed: ${allowedModels.join(', ')}` },
        { status: 403 }
      );
    }

    // Crea client
    const client = new OdooClient();

    let result: any;

    switch (method) {
      case 'search_read':
        result = await client.searchRead({
          model,
          domain,
          fields,
          limit,
          offset,
          order,
          context,
          method: 'search_read',
        });
        break;

      case 'search':
        result = await client.search(model, domain, { limit, offset, order });
        break;

      case 'search_count':
        result = await client.searchCount(model, domain);
        break;

      case 'read':
        const ids = body.ids;
        if (!ids || !Array.isArray(ids)) {
          return NextResponse.json(
            { error: 'Method read requires ids array' },
            { status: 400 }
          );
        }
        result = await client.read(model, ids, fields);
        break;

      default:
        return NextResponse.json(
          { error: `Method ${method} not supported` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      model,
      method,
      count: Array.isArray(result) ? result.length : null,
      data: result,
    });

  } catch (error: any) {
    console.error('Odoo accounting API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query Odoo',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/odoo/accounting?model=account.account&method=search_read
 *
 * Query via GET per quick tests
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const model = searchParams.get('model');
    const method = searchParams.get('method') || 'search_read';

    if (!model) {
      return NextResponse.json(
        { error: 'Missing model parameter' },
        { status: 400 }
      );
    }

    const client = new OdooClient();

    const result = await client.searchRead({
      model,
      domain: [],
      fields: [],
      limit: 10,
      method: 'search_read',
    });

    return NextResponse.json({
      success: true,
      model,
      method,
      count: result.length,
      data: result,
    });

  } catch (error: any) {
    console.error('Odoo accounting API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query Odoo',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
