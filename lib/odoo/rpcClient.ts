import { callOdoo } from '../odoo-auth';
import { getOdooSessionManager } from './sessionManager';

// Client RPC per Odoo con AUTO-RECONNECT quando sessione scade
export class OdooRPCClient {
  private odooUrl: string;
  private sessionId?: string;
  private csrfToken?: string;
  private useSessionManager: boolean;

  constructor(odooUrl: string, sessionId?: string, useSessionManager: boolean = true) {
    this.odooUrl = odooUrl;
    this.sessionId = sessionId;
    this.useSessionManager = useSessionManager;
  }

  // Chiamata RPC generica con AUTO-RECONNECT integrato
  async callKw(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    console.log('📡 RPC Request:', { model, method, args: args.length, kwargs: Object.keys(kwargs).length });

    try {
      // NEW: Use session manager for automatic session refresh and retry
      if (this.useSessionManager && !this.sessionId) {
        const sessionManager = getOdooSessionManager();
        const result = await sessionManager.callKw(model, method, args, kwargs, 2); // 2 retries max

        console.log('✅ RPC Success (via SessionManager):', {
          model,
          method,
          resultCount: Array.isArray(result) ? result.length : 'single'
        });

        return result;
      }

      // FALLBACK: Use legacy callOdoo for backward compatibility
      const cookies = this.sessionId ? `session_id=${this.sessionId}` : null;

      // callOdoo ora richiede che l'utente sia loggato
      const result = await callOdoo(cookies, model, method, args, kwargs);

      console.log('✅ RPC Success (via legacy):', {
        model,
        method,
        resultCount: Array.isArray(result) ? result.length : 'single'
      });

      return result;

    } catch (error: any) {
      console.error('❌ RPC Error:', error);
      throw error;
    }
  }

  // search_read come nell'HTML
  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    limit: number = 0,
    order: string = ''
  ): Promise<any[]> {
    return this.callKw(model, 'search_read', [domain], { fields, limit, order });
  }

  // Metodi specifici per picking

  // Recupera batch in corso
  async getBatches(): Promise<any[]> {
    return this.searchRead(
      'stock.picking.batch',
      [['state', 'in', ['in_progress', 'draft']]],
      ['id', 'name', 'state', 'user_id', 'picking_ids', 'move_line_ids',
       'x_studio_autista_del_giro', 'x_studio_auto_del_giro', 'scheduled_date'],
      20,
      'name desc'
    );
  }

  // Recupera picking di un batch
  async getBatchPickings(batchId: number): Promise<any[]> {
    return this.searchRead(
      'stock.picking',
      [['batch_id', '=', batchId]],
      ['id', 'name', 'partner_id', 'state', 'move_ids', 'move_line_ids'],
      0,
      'id'
    );
  }

  // Recupera move lines per ubicazione
  async getMoveLinesByLocation(pickingIds: number[], locationId?: number): Promise<any[]> {
    const domain: any[] = [
      ['picking_id', 'in', pickingIds],
      ['quantity', '>', 0]
    ];

    if (locationId) {
      domain.push(['location_id', '=', locationId]);
    }

    return this.searchRead(
      'stock.move.line',
      domain,
      ['id', 'product_id', 'location_id', 'location_dest_id', 'quantity',
       'qty_done', 'product_uom_id', 'move_id', 'picking_id', 'lot_id'],
      0,
      'location_id,product_id'
    );
  }

  // Recupera ubicazioni di una zona
  async getLocationsByZone(parentPath: string): Promise<any[]> {
    // Cerca ubicazioni il cui percorso completo contiene il path della zona
    return this.searchRead(
      'stock.location',
      [
        ['complete_name', 'ilike', `%${parentPath}%`],
        ['usage', '=', 'internal']
      ],
      ['id', 'name', 'complete_name', 'barcode'],
      0,
      'complete_name'
    );
  }

  // Aggiorna quantità prelevata
  async updateQuantityDone(lineId: number, qtyDone: number): Promise<boolean> {
    try {
      await this.callKw('stock.move.line', 'write', [[lineId], { qty_done: qtyDone }]);
      return true;
    } catch (error) {
      console.error('Errore aggiornamento quantità:', error);
      return false;
    }
  }

  // Valida picking
  async validatePicking(pickingId: number): Promise<boolean> {
    try {
      await this.callKw('stock.picking', 'button_validate', [[pickingId]]);
      return true;
    } catch (error) {
      console.error('Errore validazione picking:', error);
      return false;
    }
  }

  // Test connessione
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.searchRead('stock.location', [], ['id'], 1);
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Recupera info utente corrente
  async getCurrentUser(): Promise<any> {
    try {
      const context = await this.callKw('res.users', 'context_get', []);
      if (context?.uid) {
        const users = await this.searchRead(
          'res.users',
          [['id', '=', context.uid]],
          ['id', 'name', 'login'],
          1
        );
        return users[0] || null;
      }
      return null;
    } catch (error) {
      console.error('Errore recupero utente:', error);
      return null;
    }
  }
}

// Factory per creare client RPC
export function createOdooRPCClient(sessionId?: string): OdooRPCClient {
  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
  return new OdooRPCClient(odooUrl, sessionId);
}