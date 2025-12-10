/**
 * Odoo Connector
 * Connessione a Odoo via XML-RPC per sync contenuti
 */

import xmlrpc from 'xmlrpc';
import { config } from '../utils/config.js';

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

interface BlogPost {
  id: number;
  name: string;
  subtitle?: string;
  content: string;
  website_meta_title?: string;
  website_meta_description?: string;
  website_meta_keywords?: string;
  is_published: boolean;
  create_date: string;
  write_date: string;
  author_id?: [number, string];
  blog_id?: [number, string];
}

interface Product {
  id: number;
  name: string;
  description_sale?: string;
  website_description?: string;
  website_meta_title?: string;
  website_meta_description?: string;
  website_meta_keywords?: string;
  list_price: number;
  categ_id?: [number, string];
  is_published: boolean;
  image_1920?: string;
}

interface Category {
  id: number;
  name: string;
  display_name: string;
  website_meta_title?: string;
  website_meta_description?: string;
  parent_id?: [number, string];
  child_id?: number[];
  product_count?: number;
}

export class OdooConnector {
  private config: OdooConfig;
  private uid: number | null = null;
  private commonClient: xmlrpc.Client;
  private objectClient: xmlrpc.Client;

  constructor() {
    this.config = {
      url: config.get('ODOO_URL'),
      db: config.get('ODOO_DB'),
      username: config.get('ODOO_USERNAME'),
      password: config.get('ODOO_PASSWORD'),
    };

    const url = new URL(this.config.url);
    this.commonClient = xmlrpc.createSecureClient({
      host: url.hostname,
      port: 443,
      path: '/xmlrpc/2/common',
    });
    this.objectClient = xmlrpc.createSecureClient({
      host: url.hostname,
      port: 443,
      path: '/xmlrpc/2/object',
    });
  }

  /**
   * Autenticazione con Odoo
   */
  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    return new Promise((resolve, reject) => {
      this.commonClient.methodCall(
        'authenticate',
        [this.config.db, this.config.username, this.config.password, {}],
        (error, value) => {
          if (error) {
            reject(new Error(`Autenticazione fallita: ${error.message}`));
          } else if (!value) {
            reject(new Error('Credenziali non valide'));
          } else {
            this.uid = value as number;
            resolve(this.uid);
          }
        }
      );
    });
  }

  /**
   * Esegue una chiamata al modello Odoo
   */
  private async execute<T>(
    model: string,
    method: string,
    args: any[],
    kwargs: Record<string, any> = {}
  ): Promise<T> {
    await this.authenticate();

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
          kwargs,
        ],
        (error, value) => {
          if (error) {
            reject(new Error(`Errore Odoo ${model}.${method}: ${error.message}`));
          } else {
            resolve(value as T);
          }
        }
      );
    });
  }

  /**
   * Recupera tutti gli articoli del blog
   */
  async getBlogPosts(options: {
    publishedOnly?: boolean;
    limit?: number;
    lang?: string;
  } = {}): Promise<BlogPost[]> {
    const domain: any[] = [];
    if (options.publishedOnly) {
      domain.push(['website_published', '=', true]);
    }

    const context: Record<string, any> = {};
    if (options.lang) {
      context.lang = options.lang;
    }

    const fields = [
      'id', 'name', 'subtitle', 'content',
      'website_meta_title', 'website_meta_description', 'website_meta_keywords',
      'is_published', 'create_date', 'write_date',
      'author_id', 'blog_id'
    ];

    return this.execute<BlogPost[]>(
      'blog.post',
      'search_read',
      [domain],
      {
        fields,
        limit: options.limit || 1000,
        context,
      }
    );
  }

  /**
   * Recupera tutti i prodotti
   */
  async getProducts(options: {
    publishedOnly?: boolean;
    limit?: number;
    categoryId?: number;
    lang?: string;
  } = {}): Promise<Product[]> {
    const domain: any[] = [];
    if (options.publishedOnly) {
      domain.push(['is_published', '=', true]);
    }
    if (options.categoryId) {
      domain.push(['categ_id', '=', options.categoryId]);
    }

    const context: Record<string, any> = {};
    if (options.lang) {
      context.lang = options.lang;
    }

    const fields = [
      'id', 'name', 'description_sale', 'website_description',
      'website_meta_title', 'website_meta_description', 'website_meta_keywords',
      'list_price', 'categ_id', 'is_published'
    ];

    return this.execute<Product[]>(
      'product.template',
      'search_read',
      [domain],
      {
        fields,
        limit: options.limit || 1000,
        context,
      }
    );
  }

  /**
   * Recupera le categorie prodotto
   */
  async getCategories(options: {
    lang?: string;
  } = {}): Promise<Category[]> {
    const context: Record<string, any> = {};
    if (options.lang) {
      context.lang = options.lang;
    }

    const fields = [
      'id', 'name', 'display_name',
      'website_meta_title', 'website_meta_description',
      'parent_id', 'child_id'
    ];

    return this.execute<Category[]>(
      'product.public.category',
      'search_read',
      [[]],
      {
        fields,
        context,
      }
    );
  }

  /**
   * Aggiorna i meta tag SEO di un articolo
   */
  async updateBlogPostSEO(
    postId: number,
    data: {
      website_meta_title?: string;
      website_meta_description?: string;
      website_meta_keywords?: string;
    }
  ): Promise<boolean> {
    return this.execute<boolean>(
      'blog.post',
      'write',
      [[postId], data]
    );
  }

  /**
   * Aggiorna i meta tag SEO di un prodotto
   */
  async updateProductSEO(
    productId: number,
    data: {
      website_meta_title?: string;
      website_meta_description?: string;
      website_meta_keywords?: string;
      website_description?: string;
    }
  ): Promise<boolean> {
    return this.execute<boolean>(
      'product.template',
      'write',
      [[productId], data]
    );
  }

  /**
   * Recupera le lingue installate
   */
  async getInstalledLanguages(): Promise<{ code: string; name: string }[]> {
    const langs = await this.execute<any[]>(
      'res.lang',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: ['code', 'name'],
      }
    );
    return langs.map(l => ({ code: l.code, name: l.name }));
  }

  /**
   * Recupera contenuto con traduzioni
   */
  async getContentWithTranslations(
    model: string,
    recordId: number,
    fields: string[]
  ): Promise<Record<string, Record<string, string>>> {
    const languages = await this.getInstalledLanguages();
    const result: Record<string, Record<string, string>> = {};

    for (const lang of languages) {
      const data = await this.execute<any[]>(
        model,
        'read',
        [[recordId]],
        {
          fields,
          context: { lang: lang.code },
        }
      );
      if (data.length > 0) {
        result[lang.code] = data[0];
      }
    }

    return result;
  }

  /**
   * Conta i record
   */
  async count(model: string, domain: any[] = []): Promise<number> {
    return this.execute<number>(model, 'search_count', [domain]);
  }

  /**
   * Test connessione
   */
  async testConnection(): Promise<{ success: boolean; message: string; uid?: number }> {
    try {
      const uid = await this.authenticate();
      return {
        success: true,
        message: `Connesso a Odoo come UID: ${uid}`,
        uid,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }
}

export const odoo = new OdooConnector();
