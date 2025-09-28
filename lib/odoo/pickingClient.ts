import { Batch, StockLocation, StockMoveLine, StockMove, Operation } from '@/lib/types/picking';

interface OdooPickingBatch {
  id: number;
  name: string;
  state: string;
  user_id?: [number, string] | false;
  picking_ids?: number[] | false;
  scheduled_date?: string | false;
  note?: string | false;
  vehicle_id?: [number, string] | false;
  driver_id?: [number, string] | false;
  picking_count?: number;
  move_line_count?: number;
  product_count?: number;
}

interface OdooStockLocation {
  id: number;
  name: string;
  complete_name: string;
  barcode?: string | false;
  parent_id?: [number, string] | false;
  child_ids?: number[] | false;
  posx?: number;
  posy?: number;
  posz?: number;
}

interface OdooStockMoveLine {
  id: number;
  move_id?: [number, string] | false;
  product_id: [number, string];
  product_uom_id?: [number, string] | false;
  location_id: [number, string];
  location_dest_id: [number, string];
  lot_id?: [number, string] | false;
  lot_name?: string | false;
  package_id?: [number, string] | false;
  quantity: number;
  qty_done: number;
  product_uom_qty?: number;
  reserved_uom_qty?: number;
  picking_id?: [number, string] | false;
  state?: string;
  reference?: string;
  result_package_id?: [number, string] | false;
  owner_id?: [number, string] | false;
  product_barcode?: string;
  product_default_code?: string;
  description_picking?: string;
}

interface OdooStockMove {
  id: number;
  name: string;
  product_id: [number, string];
  product_uom_qty: number;
  quantity_done: number;
  state: string;
  picking_id?: [number, string] | false;
  location_id: [number, string];
  location_dest_id: [number, string];
  move_line_ids?: number[] | false;
}

interface OdooProduct {
  id: number;
  name: string;
  default_code?: string | false;
  barcode?: string | false;
  image_128?: string | false;
}

export class PickingOdooClient {
  private odooUrl: string;

  constructor() {
    this.odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
  }

  private async rpc(model: string, method: string, args: any[], kwargs: any = {}) {
    try {
      const endpoint = `${this.odooUrl}/web/dataset/call_kw`;

      console.log(`🔧 [Picking] RPC Call: ${model}.${method}`, args);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs,
            context: {}
          },
          id: Math.floor(Math.random() * 1000000000)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error('❌ [Picking] RPC Error:', data.error);
        throw new Error(data.error.message || 'Errore RPC');
      }

      console.log(`✅ [Picking] RPC Success:`, data.result);
      return data.result;

    } catch (error) {
      console.error('💥 [Picking] RPC Error:', error);
      throw error;
    }
  }

  // Carica tutti i batch disponibili
  async getBatches(): Promise<Batch[]> {
    try {
      const domain = [
        ['state', 'in', ['draft', 'in_progress', 'done']]
      ];

      const fields = [
        'name', 'state', 'user_id', 'picking_ids', 'scheduled_date',
        'note', 'vehicle_id', 'driver_id'
      ];

      const batches: OdooPickingBatch[] = await this.rpc(
        'stock.picking.batch',
        'search_read',
        [domain, fields]
      );

      // Conta i picking e le linee per ogni batch
      const batchesWithCounts = await Promise.all(batches.map(async (batch) => {
        let pickingCount = 0;
        let moveLineCount = 0;
        let productCount = 0;

        if (batch.picking_ids && Array.isArray(batch.picking_ids) && batch.picking_ids.length > 0) {
          pickingCount = batch.picking_ids.length;

          // Conta le move lines per tutti i picking del batch
          const moveLines = await this.rpc(
            'stock.move.line',
            'search_count',
            [[['picking_id', 'in', batch.picking_ids]]]
          );
          moveLineCount = moveLines || 0;

          // Conta i prodotti unici
          const products = await this.rpc(
            'stock.move.line',
            'read_group',
            [
              [['picking_id', 'in', batch.picking_ids]],
              ['product_id'],
              ['product_id']
            ]
          );
          productCount = products ? products.length : 0;
        }

        return {
          ...batch,
          picking_count: pickingCount,
          move_line_count: moveLineCount,
          product_count: productCount
        };
      }));

      return batchesWithCounts.map(this.mapBatch);

    } catch (error) {
      console.error('Errore caricamento batch:', error);
      throw error;
    }
  }

  // Carica le move lines per un batch e una zona
  async getBatchMoveLines(batchId: number, zone?: string): Promise<StockMoveLine[]> {
    try {
      // Prima ottieni i picking del batch
      const batch: OdooPickingBatch = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['picking_ids']]
      ).then(res => res[0]);

      if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
        return [];
      }

      // Costruisci il dominio per le move lines
      let domain: any[] = [
        ['picking_id', 'in', batch.picking_ids],
        ['state', 'not in', ['done', 'cancel']]
      ];

      // Se specificata una zona, filtra per quella zona
      if (zone) {
        // Le zone sono nel nome della location (es. "WH/Stock/Secco/A/01")
        domain.push(['location_id.complete_name', 'ilike', zone]);
      }

      const fields = [
        'move_id', 'product_id', 'product_uom_id', 'location_id', 'location_dest_id',
        'lot_id', 'lot_name', 'package_id', 'quantity', 'qty_done',
        'product_uom_qty', 'reserved_uom_qty', 'picking_id', 'state',
        'reference', 'result_package_id', 'owner_id'
      ];

      const moveLines: OdooStockMoveLine[] = await this.rpc(
        'stock.move.line',
        'search_read',
        [domain, fields]
      );

      // Aggiungi informazioni sui prodotti
      const productIds = [...new Set(moveLines.map(ml => ml.product_id[0]))];
      const products = await this.getProducts(productIds);
      const productMap = new Map(products.map(p => [p.id, p]));

      return moveLines.map(ml => {
        const product = productMap.get(ml.product_id[0]);
        return {
          ...this.mapMoveLine(ml),
          product_barcode: product?.barcode || undefined,
          product_default_code: product?.default_code || undefined
        };
      });

    } catch (error) {
      console.error('Errore caricamento move lines:', error);
      throw error;
    }
  }

  // Carica le ubicazioni per una zona
  async getZoneLocations(zone: string): Promise<StockLocation[]> {
    try {
      const domain = [
        '|',
        ['complete_name', 'ilike', `%/${zone}/%`],
        ['name', 'ilike', zone]
      ];

      const fields = [
        'name', 'complete_name', 'barcode', 'parent_id',
        'child_ids', 'posx', 'posy', 'posz'
      ];

      const locations: OdooStockLocation[] = await this.rpc(
        'stock.location',
        'search_read',
        [domain, fields],
        { order: 'complete_name' }
      );

      return locations.map(this.mapLocation);

    } catch (error) {
      console.error('Errore caricamento ubicazioni:', error);
      throw error;
    }
  }

  // Carica le operazioni per un'ubicazione specifica
  async getLocationOperations(batchId: number, locationId: number): Promise<Operation[]> {
    try {
      // Prima ottieni i picking del batch
      const batch: OdooPickingBatch = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['picking_ids']]
      ).then(res => res[0]);

      if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
        return [];
      }

      // Carica le move lines per questa ubicazione
      const domain = [
        ['picking_id', 'in', batch.picking_ids],
        ['location_id', '=', locationId],
        ['state', 'not in', ['done', 'cancel']]
      ];

      const moveLines: OdooStockMoveLine[] = await this.rpc(
        'stock.move.line',
        'search_read',
        [domain]
      );

      // Carica i dettagli dei prodotti
      const productIds = [...new Set(moveLines.map(ml => ml.product_id[0]))];
      const products = await this.getProducts(productIds);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Carica i dettagli dei picking per info cliente
      const pickingIds = [...new Set(moveLines.map(ml => ml.picking_id?.[0]).filter(Boolean))];
      const pickings = await this.getPickings(pickingIds as number[]);
      const pickingMap = new Map(pickings.map(p => [p.id, p]));

      return moveLines.map((ml, index) => {
        const product = productMap.get(ml.product_id[0]);
        const picking = ml.picking_id ? pickingMap.get(ml.picking_id[0]) : null;

        return {
          id: ml.id,
          lineId: ml.id,
          moveId: ml.move_id?.[0],
          productId: ml.product_id[0],
          productName: ml.product_id[1],
          productCode: product?.default_code || '',
          productBarcode: product?.barcode || '',
          locationId: ml.location_id[0],
          locationName: ml.location_id[1],
          quantity: ml.quantity || ml.product_uom_qty || 0,
          qty_done: ml.qty_done || 0,
          uom: ml.product_uom_id?.[1]?.split(' ')[0] || 'PZ',
          lot_id: ml.lot_id || undefined,
          lot_name: ml.lot_name || undefined,
          package_id: ml.package_id || undefined,
          note: ml.description_picking || '',
          customer: picking?.partner_name || '',
          image: product?.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
          isCompleted: ml.qty_done >= (ml.quantity || 0),
          needsQRVerification: false,
          scannedQR: false
        };
      });

    } catch (error) {
      console.error('Errore caricamento operazioni:', error);
      throw error;
    }
  }

  // Aggiorna quantità prelevata
  async updateOperationQuantity(operationId: number, qtyDone: number): Promise<boolean> {
    try {
      const result = await this.rpc(
        'stock.move.line',
        'write',
        [[operationId], { qty_done: qtyDone }]
      );

      return result === true;

    } catch (error) {
      console.error('Errore aggiornamento quantità:', error);
      throw error;
    }
  }

  // Helper: carica prodotti
  private async getProducts(productIds: number[]): Promise<OdooProduct[]> {
    if (productIds.length === 0) return [];

    try {
      const products = await this.rpc(
        'product.product',
        'read',
        [productIds, ['name', 'default_code', 'barcode', 'image_128']]
      );

      return products;
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      return [];
    }
  }

  // Helper: carica picking
  private async getPickings(pickingIds: number[]): Promise<any[]> {
    if (pickingIds.length === 0) return [];

    try {
      const pickings = await this.rpc(
        'stock.picking',
        'read',
        [pickingIds, ['name', 'partner_id', 'origin', 'note']]
      );

      return pickings.map((p: any) => ({
        id: p.id,
        name: p.name,
        partner_name: p.partner_id?.[1] || '',
        origin: p.origin || '',
        note: p.note || ''
      }));
    } catch (error) {
      console.error('Errore caricamento picking:', error);
      return [];
    }
  }

  // Mappers
  private mapBatch(batch: OdooPickingBatch): Batch {
    return {
      id: batch.id,
      name: batch.name,
      state: batch.state as any,
      user_id: batch.user_id || undefined,
      picking_ids: batch.picking_ids || undefined,
      scheduled_date: batch.scheduled_date || undefined,
      note: batch.note || undefined,
      vehicle_id: batch.vehicle_id || undefined,
      driver_id: batch.driver_id || undefined,
      picking_count: batch.picking_count,
      move_line_count: batch.move_line_count,
      product_count: batch.product_count
    };
  }

  private mapLocation(location: OdooStockLocation): StockLocation {
    return {
      id: location.id,
      name: location.name,
      complete_name: location.complete_name,
      barcode: location.barcode || undefined,
      parent_id: location.parent_id || undefined,
      child_ids: location.child_ids || undefined,
      posx: location.posx,
      posy: location.posy,
      posz: location.posz
    };
  }

  private mapMoveLine(line: OdooStockMoveLine): StockMoveLine {
    return {
      id: line.id,
      move_id: line.move_id || undefined,
      product_id: line.product_id,
      product_uom_id: line.product_uom_id || undefined,
      location_id: line.location_id,
      location_dest_id: line.location_dest_id,
      lot_id: line.lot_id || undefined,
      lot_name: line.lot_name || undefined,
      package_id: line.package_id || undefined,
      quantity: line.quantity || line.product_uom_qty || 0,
      qty_done: line.qty_done || 0,
      product_uom_qty: line.product_uom_qty,
      reserved_uom_qty: line.reserved_uom_qty,
      picking_id: line.picking_id || undefined,
      state: line.state,
      reference: line.reference,
      result_package_id: line.result_package_id || undefined,
      owner_id: line.owner_id || undefined
    };
  }
}

// Singleton instance
let pickingClientInstance: PickingOdooClient | null = null;

export function getPickingClient(): PickingOdooClient {
  if (!pickingClientInstance) {
    pickingClientInstance = new PickingOdooClient();
  }
  return pickingClientInstance;
}