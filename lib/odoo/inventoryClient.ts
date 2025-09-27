import { createOdooClient } from './client';

interface OdooLocation {
  id: number;
  name: string;
  complete_name: string;
  barcode?: string;
}

interface OdooQuant {
  id: number;
  product_id: [number, string];
  quantity: number;
  lot_id?: [number, string] | false;
  inventory_quantity?: number | null;
  inventory_date?: string | null;
  inventory_diff_quantity?: number | null;
  user_id?: [number, string] | false;
  package_id?: [number, string] | false;
  product_uom_id?: [number, string] | false;
  location_id: [number, string];
}

interface OdooProduct {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  image_128?: string;
  uom_id?: [number, string] | false;
}

interface OdooLot {
  id: number;
  name: string;
  product_id: [number, string];
  expiration_date?: string | null;
  use_date?: string | null;
  removal_date?: string | null;
  alert_date?: string | null;
}

export class InventoryOdooClient {
  private odooClient: ReturnType<typeof createOdooClient>;

  constructor() {
    this.odooClient = createOdooClient();
  }

  async rpc(model: string, method: string, args: any[]) {
    try {
      // Utilizza la sessione Odoo corrente dall'auth store
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('odoo_session='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('Sessione Odoo non trovata');
      }

      const session = JSON.parse(decodeURIComponent(token));

      // URL completo per l'endpoint Odoo
      const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
      const endpoint = `${odooUrl}/web/dataset/call_kw`;

      console.log(`🔧 RPC Call: ${model}.${method}`, args);

      // Chiamata RPC tramite web/dataset/call_kw
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': session.csrf_token || '',
          'Cookie': document.cookie
        },
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: model,
            method: method,
            args: args,
            kwargs: {},
            context: session.user_context || {}
          },
          id: Math.floor(Math.random() * 1000000000)
        })
      });

      console.log(`📡 RPC Response Status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📋 RPC Result:`, data);

      if (data.error) {
        console.error('RPC Error:', data.error);
        throw new Error(data.error.data?.message || data.error.message || 'Errore RPC');
      }

      return data.result;
    } catch (error) {
      console.error('RPC Error:', error);
      throw error;
    }
  }

  async searchRead(model: string, domain: any[], fields: string[], limit: number | false = false): Promise<any[]> {
    const args: any[] = [domain, fields];
    if (limit) {
      args.push(0);
      args.push(limit);
    }
    return await this.rpc(model, 'search_read', args);
  }

  // Cerca ubicazione per codice o barcode
  async findLocation(locationCode: string): Promise<OdooLocation | null> {
    try {
      const response = await fetch('/api/inventory/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ locationCode })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (error) {
      console.error('Errore ricerca ubicazione:', error);
      throw error;
    }
  }

  // Ottieni quants di un'ubicazione
  async getLocationQuants(locationId: number): Promise<OdooQuant[]> {
    try {
      const response = await fetch('/api/inventory/quants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ locationId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (error) {
      console.error('Errore caricamento quants:', error);
      throw error;
    }
  }

  // Ottieni dettagli prodotto
  async getProduct(productId: number): Promise<OdooProduct | null> {
    try {
      const response = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ productIds: [productId] })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data.length > 0 ? data.data[0] : null;
    } catch (error) {
      console.error('Errore caricamento prodotto:', error);
      throw error;
    }
  }

  // Cerca prodotti per nome, codice o barcode
  async searchProducts(query: string, limit: number = 20): Promise<OdooProduct[]> {
    try {
      const response = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ searchQuery: query })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      return data.data;
    } catch (error) {
      console.error('Errore ricerca prodotti:', error);
      throw error;
    }
  }

  // Ottieni lotti di un prodotto
  async getProductLots(productId: number): Promise<OdooLot[]> {
    try {
      return await this.searchRead(
        'stock.production.lot',
        [['product_id', '=', productId]],
        ['id', 'name', 'product_id', 'expiration_date', 'use_date', 'removal_date', 'alert_date']
      );
    } catch (error) {
      console.error('Errore caricamento lotti:', error);
      throw error;
    }
  }

  // Crea un nuovo lotto
  async createLot(productId: number, lotName: string, expirationDate?: string): Promise<number> {
    try {
      const lotData: any = {
        product_id: productId,
        name: lotName
      };

      if (expirationDate) {
        lotData.expiration_date = expirationDate;
      }

      const lotId = await this.rpc('stock.production.lot', 'create', [lotData]);
      return lotId;
    } catch (error) {
      console.error('Errore creazione lotto:', error);
      throw error;
    }
  }

  // Aggiorna quantità inventario di un quant
  async updateInventoryQuantity(quantId: number, newQuantity: number, lotId?: number): Promise<boolean> {
    try {
      const updateData: any = {
        inventory_quantity: newQuantity,
        inventory_date: new Date().toISOString()
      };

      if (lotId) {
        updateData.lot_id = lotId;
      }

      await this.rpc('stock.quant', 'write', [[quantId], updateData]);
      return true;
    } catch (error) {
      console.error('Errore aggiornamento inventario:', error);
      throw error;
    }
  }

  // Crea movimento di stock per trasferimento
  async createStockMove(
    productId: number,
    sourceLocationId: number,
    destLocationId: number,
    quantity: number,
    lotId?: number
  ): Promise<number> {
    try {
      const moveData: any = {
        product_id: productId,
        location_id: sourceLocationId,
        location_dest_id: destLocationId,
        product_uom_qty: quantity,
        name: `Trasferimento inventario: ${new Date().toISOString()}`
      };

      if (lotId) {
        moveData.lot_ids = [[6, 0, [lotId]]];
      }

      const moveId = await this.rpc('stock.move', 'create', [moveData]);

      // Conferma il movimento
      await this.rpc('stock.move', 'action_confirm', [moveId]);
      await this.rpc('stock.move', 'action_done', [moveId]);

      return moveId;
    } catch (error) {
      console.error('Errore creazione movimento stock:', error);
      throw error;
    }
  }

  // Ottieni informazioni buffer location
  async getBufferLocation(): Promise<OdooLocation | null> {
    try {
      const locations = await this.searchRead(
        'stock.location',
        [['name', 'ilike', 'buffer']],
        ['id', 'name', 'complete_name', 'barcode'],
        1
      );

      return locations.length > 0 ? locations[0] : null;
    } catch (error) {
      console.error('Errore ricerca buffer location:', error);
      return null;
    }
  }

  // Applica aggiustamenti inventario
  async applyInventoryAdjustment(adjustments: Array<{
    quantId: number;
    newQuantity: number;
    lotId?: number;
    reason?: string;
  }>): Promise<boolean> {
    try {
      for (const adj of adjustments) {
        await this.updateInventoryQuantity(adj.quantId, adj.newQuantity, adj.lotId);
      }
      return true;
    } catch (error) {
      console.error('Errore applicazione aggiustamenti:', error);
      throw error;
    }
  }
}

// Singleton instance
let inventoryClient: InventoryOdooClient | null = null;

export function getInventoryClient(): InventoryOdooClient {
  if (!inventoryClient) {
    inventoryClient = new InventoryOdooClient();
  }
  return inventoryClient;
}