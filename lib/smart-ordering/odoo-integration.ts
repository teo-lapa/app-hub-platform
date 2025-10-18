/**
 * LAPA Smart Ordering - Odoo Integration
 *
 * Gestisce integrazione con Odoo per:
 * - Creazione ordini acquisto
 * - Aggiornamento stock real-time
 * - Tracking ordini
 */

import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export interface PurchaseOrderLine {
  productId: number;
  productName: string;
  quantity: number;
  priceUnit?: number;
}

export interface PurchaseOrder {
  supplierId: number;
  supplierName: string;
  orderLines: PurchaseOrderLine[];
  dateOrder: Date;
  notes?: string;
}

export interface PurchaseOrderResult {
  orderId: number;
  orderName: string;
  supplierId: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'purchase' | 'done' | 'cancel';
  createdAt: Date;
}

class OdooIntegration {
  private odooUrl: string | null = null;
  private dbName: string | null = null;
  private sessionId: string | null = null;

  private ensureConfig(): void {
    if (this.odooUrl && this.dbName) return;

    this.odooUrl = process.env.ODOO_URL || '';
    this.dbName = process.env.ODOO_DB || '';

    if (!this.odooUrl || !this.dbName) {
      throw new Error('❌ Configurazione Odoo mancante in .env');
    }
  }

  /**
   * Authenticate with Odoo
   */
  private async authenticate(): Promise<void> {
    this.ensureConfig();

    if (this.sessionId) return;

    console.log('🔑 Autenticazione Odoo...');
    this.sessionId = await getOdooSessionId();

    if (!this.sessionId) {
      throw new Error('Sessione Odoo non valida. Login richiesto.');
    }

    console.log('✅ Autenticato');
  }

  /**
   * RPC call to Odoo
   */
  private async rpc(model: string, method: string, args: any[]): Promise<any> {
    await this.authenticate();

    const fetchOptions: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${this.sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: {}
        },
        id: Math.floor(Math.random() * 1000000)
      })
    };

    // Disable SSL verification in development
    if (process.env.NODE_ENV === 'development') {
      const https = await import('https');
      fetchOptions.agent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    const response = await fetch(`${this.odooUrl}/web/dataset/call_kw`, fetchOptions);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message || 'Errore RPC');
    }

    return data.result;
  }

  /**
   * Search and read
   */
  private async searchRead(
    model: string,
    domain: any[],
    fields: string[],
    limit?: number
  ): Promise<any[]> {
    const args: any = [domain, fields];
    if (limit) {
      args.push(0);
      args.push(limit);
    }
    return await this.rpc(model, 'search_read', args);
  }

  /**
   * Create record
   */
  private async create(model: string, values: any): Promise<number> {
    return await this.rpc(model, 'create', [values]);
  }

  /**
   * MAIN: Crea ordine acquisto in Odoo
   */
  async createPurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrderResult> {
    console.log('🛒 Creazione ordine acquisto in Odoo...');
    console.log(`   Fornitore: ${order.supplierName}`);
    console.log(`   Righe: ${order.orderLines.length}`);

    try {
      // 1. Prepara righe ordine
      const orderLines = [];

      for (const line of order.orderLines) {
        // Get product info from Odoo
        const products = await this.searchRead(
          'product.product',
          [['id', '=', line.productId]],
          ['name', 'default_code', 'list_price']
        );

        if (products.length === 0) {
          console.warn(`⚠️  Prodotto ${line.productId} non trovato in Odoo`);
          continue;
        }

        const product = products[0];

        orderLines.push([0, 0, {
          product_id: line.productId,
          name: product.name,
          product_qty: line.quantity,
          price_unit: line.priceUnit || product.list_price || 0,
          date_planned: new Date().toISOString().split('T')[0]
        }]);
      }

      if (orderLines.length === 0) {
        throw new Error('Nessuna riga ordine valida');
      }

      // 2. Crea Purchase Order
      const poValues = {
        partner_id: order.supplierId,
        date_order: order.dateOrder.toISOString().split('T')[0],
        order_line: orderLines,
        notes: order.notes || 'Creato da LAPA Smart Ordering AI'
      };

      const poId = await this.create('purchase.order', poValues);

      console.log(`✅ Ordine creato: ID ${poId}`);

      // 3. Leggi ordine creato per ottenere dettagli
      const createdPO = await this.searchRead(
        'purchase.order',
        [['id', '=', poId]],
        ['name', 'partner_id', 'amount_total', 'state', 'create_date']
      );

      if (createdPO.length === 0) {
        throw new Error('Errore lettura ordine creato');
      }

      const po = createdPO[0];

      return {
        orderId: poId,
        orderName: po.name,
        supplierId: po.partner_id[0],
        totalAmount: po.amount_total || 0,
        status: po.state || 'draft',
        createdAt: new Date(po.create_date)
      };
    } catch (error: any) {
      console.error('❌ Errore creazione ordine:', error);
      throw error;
    }
  }

  /**
   * Crea multipli ordini (raggruppati per fornitore)
   */
  async createBulkOrders(orders: PurchaseOrder[]): Promise<PurchaseOrderResult[]> {
    console.log(`📦 Creazione ${orders.length} ordini acquisto...`);

    const results: PurchaseOrderResult[] = [];

    for (const order of orders) {
      try {
        const result = await this.createPurchaseOrder(order);
        results.push(result);
        console.log(`✅ Ordine ${result.orderName} creato`);
      } catch (error: any) {
        console.error(`❌ Errore ordine ${order.supplierName}:`, error.message);
      }
    }

    console.log(`✅ ${results.length}/${orders.length} ordini creati con successo`);
    return results;
  }

  /**
   * Get stock attuale prodotto
   */
  async getProductStock(productId: number): Promise<number> {
    const products = await this.searchRead(
      'product.product',
      [['id', '=', productId]],
      ['qty_available']
    );

    if (products.length === 0) {
      throw new Error(`Prodotto ${productId} non trovato`);
    }

    return products[0].qty_available || 0;
  }

  /**
   * Get info fornitore
   */
  async getSupplierInfo(supplierId: number): Promise<any> {
    const partners = await this.searchRead(
      'res.partner',
      [['id', '=', supplierId]],
      ['name', 'email', 'phone', 'street', 'city']
    );

    if (partners.length === 0) {
      throw new Error(`Fornitore ${supplierId} non trovato`);
    }

    return partners[0];
  }

  /**
   * Get storico ordini acquisto
   */
  async getPurchaseOrderHistory(limit: number = 10): Promise<any[]> {
    return await this.searchRead(
      'purchase.order',
      [],
      ['name', 'partner_id', 'date_order', 'amount_total', 'state'],
      limit
    );
  }

  /**
   * Confirm purchase order (invia a fornitore)
   */
  async confirmPurchaseOrder(orderId: number): Promise<void> {
    console.log(`📧 Conferma ordine ${orderId}...`);

    await this.rpc('purchase.order', 'button_confirm', [[orderId]]);

    console.log('✅ Ordine confermato e inviato a fornitore');
  }
}

// Export singleton
export const odooIntegration = new OdooIntegration();
