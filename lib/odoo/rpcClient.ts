// Client RPC per Odoo - connessione REALE come nell'HTML
export class OdooRPCClient {
  private odooUrl: string;
  private sessionId?: string;
  private csrfToken?: string;

  constructor(odooUrl: string, sessionId?: string) {
    this.odooUrl = odooUrl;
    this.sessionId = sessionId;
  }

  // Chiamata RPC generica come nell'HTML
  async callKw(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
    const headers: any = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (this.sessionId) {
      headers['Cookie'] = `session_id=${this.sessionId}`;
    }

    if (this.csrfToken) {
      headers['X-CSRFToken'] = this.csrfToken;
    }

    const requestData = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
      },
      id: Date.now()
    };

    console.log('📡 RPC Request:', { model, method, args });

    try {
      const response = await fetch(`${this.odooUrl}/web/dataset/call_kw/${model}/${method}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestData),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.data?.message || data.error.message || 'RPC Error');
      }

      console.log('✅ RPC Success:', { model, method, resultCount: Array.isArray(data.result) ? data.result.length : 'single' });
      return data.result;

    } catch (error) {
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
  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
  return new OdooRPCClient(odooUrl, sessionId);
}