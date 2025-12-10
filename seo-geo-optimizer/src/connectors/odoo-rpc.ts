/**
 * Odoo RPC Connector
 * Connessione a Odoo via JSON-RPC (stesso metodo del progetto LAPA principale)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '..', '.env') });

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

export interface OdooProduct {
  id: number;
  name: string;
  description_sale?: string;
  website_description?: string;
  website_meta_title?: string;
  website_meta_description?: string;
  website_meta_keywords?: string;
  list_price: number;
  default_code?: string;
  categ_id?: [number, string];
  qty_available?: number;
  is_published?: boolean;
  website_url?: string;
  image_1920?: boolean;
}

export interface OdooArticle {
  id: number;
  name: string;
  subtitle?: string;
  content: string;
  website_meta_title?: string;
  website_meta_description?: string;
  website_meta_keywords?: string;
  is_published?: boolean;
  website_published?: boolean;
  create_date?: string;
  write_date?: string;
  author_id?: [number, string];
  blog_id?: [number, string];
}

class OdooRPC {
  private uid: number | null = null;
  private cookies: string | null = null;

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: ODOO_DB,
            login: ODOO_USERNAME,
            password: ODOO_PASSWORD
          },
          id: Date.now()
        })
      });

      // Estrai cookies
      const cookieHeader = response.headers.get('set-cookie');
      if (cookieHeader) {
        this.cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
      }

      const data = await response.json();

      if (data.result?.uid) {
        this.uid = data.result.uid;
        if (!this.cookies && data.result.session_id) {
          this.cookies = `session_id=${data.result.session_id}`;
        }
        return true;
      }

      throw new Error('Authentication failed');
    } catch (error) {
      console.error('Odoo auth error:', error);
      throw error;
    }
  }

  private async ensureAuth() {
    if (!this.uid) await this.authenticate();
  }

  async searchRead<T>(
    model: string,
    domain: any[],
    fields: string[],
    options: { limit?: number; offset?: number; order?: string; context?: any } = {}
  ): Promise<T[]> {
    await this.ensureAuth();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'search_read',
          args: [],
          kwargs: {
            domain,
            fields,
            limit: options.limit || 1000,
            offset: options.offset || 0,
            order: options.order,
            context: options.context
          }
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Search failed');
    return data.result || [];
  }

  async write(model: string, ids: number[], values: any): Promise<boolean> {
    await this.ensureAuth();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method: 'write',
          args: [ids, values],
          kwargs: {}
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Write failed');
    return data.result || false;
  }

  async call(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
    await this.ensureAuth();

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args, kwargs },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Call failed');
    return data.result;
  }

  // ============ METODI SPECIFICI LAPA ============

  async getProducts(options: {
    publishedOnly?: boolean;
    limit?: number;
    categoryId?: number;
  } = {}): Promise<OdooProduct[]> {
    const domain: any[] = [];
    if (options.publishedOnly !== false) {
      domain.push(['is_published', '=', true]);
    }
    if (options.categoryId) {
      domain.push(['categ_id', '=', options.categoryId]);
    }

    return this.searchRead<OdooProduct>('product.template', domain, [
      'id', 'name', 'description_sale', 'website_description',
      'website_meta_title', 'website_meta_description', 'website_meta_keywords',
      'list_price', 'default_code', 'categ_id', 'qty_available',
      'is_published', 'website_url', 'image_1920'
    ], { limit: options.limit });
  }

  async getArticles(options: {
    publishedOnly?: boolean;
    limit?: number;
  } = {}): Promise<OdooArticle[]> {
    const domain: any[] = [];
    if (options.publishedOnly) {
      domain.push(['website_published', '=', true]);
    }

    return this.searchRead<OdooArticle>('blog.post', domain, [
      'id', 'name', 'subtitle', 'content',
      'website_meta_title', 'website_meta_description', 'website_meta_keywords',
      'is_published', 'website_published', 'create_date', 'write_date',
      'author_id', 'blog_id'
    ], { limit: options.limit });
  }

  async getCategories(): Promise<any[]> {
    return this.searchRead('product.public.category', [], [
      'id', 'name', 'display_name', 'parent_id', 'child_id',
      'website_meta_title', 'website_meta_description'
    ]);
  }

  async updateProductSEO(productId: number, data: {
    website_meta_title?: string;
    website_meta_description?: string;
    website_meta_keywords?: string;
    website_description?: string;
  }): Promise<boolean> {
    return this.write('product.template', [productId], data);
  }

  async updateArticleSEO(articleId: number, data: {
    website_meta_title?: string;
    website_meta_description?: string;
    website_meta_keywords?: string;
    content?: string;
  }): Promise<boolean> {
    return this.write('blog.post', [articleId], data);
  }

  async getWebsiteConfig(): Promise<any> {
    const configs = await this.searchRead('website', [], [
      'id', 'name', 'domain', 'google_analytics_key', 'google_search_console',
      'social_facebook', 'social_twitter', 'social_instagram', 'social_linkedin'
    ], { limit: 1 });
    return configs[0] || null;
  }
}

// Singleton instance
let instance: OdooRPC | null = null;

export function getOdooRPC(): OdooRPC {
  if (!instance) {
    instance = new OdooRPC();
  }
  return instance;
}

export const odooRPC = getOdooRPC();
