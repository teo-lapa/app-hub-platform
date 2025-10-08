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
  x_studio_autista_del_giro?: [number, string] | false;
  x_studio_auto_del_giro?: [number, string] | false;
  picking_count?: number;
  move_line_count?: number;
  product_count?: number;
}

interface OdooStockLocation {
  id: number;
  name: string;
  complete_name: string;
  barcode?: string | false;
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
  expiry_date?: string | false;
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
      // Usa API del server locale invece di chiamare Odoo direttamente dal browser
      const endpoint = '/api/odoo/rpc';

      console.log(`🔧 [Picking] RPC Call (via server): ${model}.${method}`, args);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          model: model,
          method: method,
          args: args,
          kwargs: kwargs
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        console.error('❌ [Picking] RPC Error:', data.error);
        throw new Error(data.error || 'Errore RPC');
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
      console.log('🔄 [Picking] Caricamento batch...');

      const domain = [
        ['state', '=', 'in_progress']
      ];

      const fields = [
        'id', 'name', 'state', 'user_id', 'scheduled_date',
        'x_studio_autista_del_giro', 'x_studio_auto_del_giro',
        'picking_ids'
      ];

      const batches: OdooPickingBatch[] = await this.rpc(
        'stock.picking.batch',
        'search_read',
        [domain, fields],
        { limit: 20, order: 'name desc' }
      );

      console.log(`✅ [Picking] Trovati ${batches.length} batch`);

      // Per ogni batch, carica i dettagli dei picking per contare prodotti
      const batchesWithDetails = await Promise.all(batches.map(async (batch) => {
        let pickingCount = 0;
        let productCount = 0;

        if (batch.picking_ids && Array.isArray(batch.picking_ids)) {
          pickingCount = batch.picking_ids.length;

          // Conta i prodotti nelle move lines
          try {
            const moveLines = await this.rpc(
              'stock.move.line',
              'search_read',
              [[['picking_id', 'in', batch.picking_ids]], ['product_id']],
              {}
            );

            // Conta prodotti unici
            const uniqueProducts = new Set(moveLines.map((line: any) => line.product_id[0]));
            productCount = uniqueProducts.size;
          } catch (error) {
            console.warn('Errore conteggio prodotti per batch', batch.id, error);
          }
        }

        return {
          ...batch,
          picking_count: pickingCount,
          product_count: productCount
        };
      }));

      return batchesWithDetails.map(this.mapBatch);

    } catch (error) {
      console.error('Errore caricamento batch:', error);
      throw error;
    }
  }

  // Carica conteggi prodotti per zona per un batch
  async getBatchZoneCounts(batchId: number): Promise<{ [key: string]: number }> {
    try {
      console.log('🔄 [Picking] Caricamento conteggi zone per batch:', batchId);

      // Carica i picking del batch
      const batch: OdooPickingBatch = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['picking_ids']]
      ).then(res => res[0]);

      if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
        return { 'secco': 0, 'secco_sopra': 0, 'pingu': 0, 'frigo': 0 };
      }

      // Carica le move lines
      const moveLines = await this.rpc(
        'stock.move.line',
        'search_read',
        [[['picking_id', 'in', batch.picking_ids]], ['location_id']],
        {}
      );

      // Conta operazioni per zona usando gli ID come nell'HTML
      const zoneCounts = {
        'secco': 0,
        'secco_sopra': 0,
        'pingu': 0,
        'frigo': 0
      };

      for (const line of moveLines) {
        if (line.location_id && Array.isArray(line.location_id)) {
          const locationPath = line.location_id[1].toLowerCase();

          if (locationPath.includes('secco sopra')) {
            zoneCounts['secco_sopra']++;
          } else if (locationPath.includes('secco')) {
            zoneCounts['secco']++;
          } else if (locationPath.includes('pingu')) {
            zoneCounts['pingu']++;
          } else if (locationPath.includes('frigo')) {
            zoneCounts['frigo']++;
          }
        }
      }

      console.log('✅ [Picking] Conteggi zone:', zoneCounts);
      return zoneCounts;

    } catch (error) {
      console.error('Errore caricamento conteggi zone:', error);
      return { 'secco': 0, 'secco_sopra': 0, 'pingu': 0, 'frigo': 0 };
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
      const productIds = Array.from(new Set(moveLines.map(ml => ml.product_id[0])));
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

  // Carica le ubicazioni per una zona che hanno operazioni nel batch - COPIA DELL'HTML
  async getZoneLocationsWithOperations(batchId: number, zone: string): Promise<(StockLocation & { operationCount?: number })[]> {
    try {
      console.log(`🔄 [Picking] Caricamento ubicazioni per zona: ${zone}, batch: ${batchId} (logica HTML)`);

      // Prima carica i picking del batch
      const batch: OdooPickingBatch = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['picking_ids']]
      ).then(res => res[0]);

      if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
        return [];
      }

      // Carica le move lines per il batch (come nell'HTML)
      const moveLines = await this.rpc(
        'stock.move.line',
        'search_read',
        [[['picking_id', 'in', batch.picking_ids], ['state', 'not in', ['done', 'cancel']]], ['location_id', 'product_id', 'quantity', 'qty_done']],
        {}
      );

      console.log(`📦 [Picking] Caricate ${moveLines.length} move lines dal batch ${batchId}`);

      // Filtra le move lines per zona (COPIA ESATTA DELL'HTML)
      let relevantLines = [];

      for (const line of moveLines) {
        if (line.location_id && Array.isArray(line.location_id)) {
          const locationPath = line.location_id[1].toLowerCase();

          let belongsToZone = false;
          if (zone === 'secco' && locationPath.includes('secco') && !locationPath.includes('sopra')) {
            belongsToZone = true;
          } else if (zone === 'secco_sopra' && locationPath.includes('secco sopra')) {
            belongsToZone = true;
          } else if (zone === 'pingu' && locationPath.includes('pingu')) {
            belongsToZone = true;
          } else if (zone === 'frigo' && locationPath.includes('frigo')) {
            belongsToZone = true;
          }

          if (belongsToZone) {
            relevantLines.push(line);
          }
        }
      }

      console.log(`🔍 [Picking] Trovate ${relevantLines.length} operazioni per zona ${zone}`);

      if (relevantLines.length === 0) {
        return [];
      }

      // Raggruppa per ubicazione (COPIA ESATTA DELL'HTML)
      const sublocationMap = new Map();

      for (const line of relevantLines) {
        const locationId = line.location_id[0];
        const locationName = line.location_id[1];
        const productName = line.product_id && Array.isArray(line.product_id) ? line.product_id[1] : 'Prodotto sconosciuto';

        if (!sublocationMap.has(locationId)) {
          sublocationMap.set(locationId, {
            id: locationId,
            name: locationName,
            complete_name: locationName,
            barcode: '',
            operationCount: 0,
            productPreview: []
          });
        }

        const subloc = sublocationMap.get(locationId);
        subloc.operationCount++;

        // Aggiungi nome prodotto se non già presente
        if (!subloc.productPreview.includes(productName)) {
          subloc.productPreview.push(productName);
        }
      }

      const result = Array.from(sublocationMap.values());

      console.log(`✅ [Picking] Trovate ${result.length} ubicazioni con operazioni nella zona ${zone}`);

      return result;

    } catch (error) {
      console.error('Errore caricamento ubicazioni con operazioni:', error);
      throw error;
    }
  }

  // Carica le ubicazioni per una zona (metodo originale, mantenuto per compatibilità)
  async getZoneLocations(zone: string): Promise<StockLocation[]> {
    try {
      const domain = [
        '|',
        ['complete_name', 'ilike', `%/${zone}/%`],
        ['name', 'ilike', zone]
      ];

      const fields = [
        'name', 'complete_name', 'barcode',
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

      // Carica i dettagli dei prodotti con immagini
      const productIds = Array.from(new Set(moveLines.map(ml => ml.product_id[0])));
      const products = await this.getProducts(productIds);
      const productMap = new Map(products.map(p => [p.id, p]));

      // Carica date di scadenza per i lotti
      const lotIds = Array.from(new Set(moveLines
        .filter(ml => ml.lot_id && Array.isArray(ml.lot_id))
        .map(ml => (ml.lot_id as [number, string])[0])
      ));

      const lotMap = new Map();
      if (lotIds.length > 0) {
        const lots = await this.rpc(
          'stock.lot',
          'search_read',
          [[['id', 'in', lotIds]], ['id', 'name', 'expiration_date']]
        );
        lots.forEach((lot: any) => {
          lotMap.set(lot.id, lot.expiration_date);
        });
      }

      // Carica i dettagli dei picking per info cliente
      const pickingIds = Array.from(new Set(moveLines.map(ml => ml.picking_id && ml.picking_id[0]).filter(Boolean)));
      const pickings = await this.getPickings(pickingIds as number[]);
      const pickingMap = new Map(pickings.map(p => [p.id, p]));

      return moveLines.map((ml, index) => {
        const product = productMap.get(ml.product_id[0]);
        const picking = ml.picking_id ? pickingMap.get(ml.picking_id[0]) : null;

        return {
          id: ml.id,
          lineId: ml.id,
          moveId: ml.move_id ? ml.move_id[0] : undefined,
          productId: ml.product_id[0],
          productName: ml.product_id[1],
          productCode: product?.default_code || '',
          productBarcode: product?.barcode || '',
          locationId: ml.location_id[0],
          locationName: ml.location_id[1],
          quantity: ml.quantity || ml.product_uom_qty || 0,
          qty_done: ml.qty_done || 0,
          uom: ml.product_uom_id && typeof ml.product_uom_id[1] === 'string' ? ml.product_uom_id[1].split(' ')[0] : 'PZ',
          lot_id: ml.lot_id || undefined,
          lot_name: ml.lot_name || undefined,
          expiry_date: ml.lot_id ? lotMap.get(ml.lot_id[0]) || undefined : undefined,
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

  // Salva report di lavoro nel batch
  async saveBatchReport(batchId: number, reportText: string): Promise<boolean> {
    try {
      // Leggi la nota attuale del batch
      const batchData = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['note']]
      );

      if (!batchData || batchData.length === 0) {
        throw new Error('Batch non trovato');
      }

      const currentNote = batchData[0].note || '';

      // Aggiungi il nuovo report alla nota esistente
      const separator = currentNote ? '\n\n---\n\n' : '';
      const updatedNote = currentNote + separator + reportText;

      // Aggiorna il batch con la nuova nota
      const result = await this.rpc(
        'stock.picking.batch',
        'write',
        [[batchId], { note: updatedNote }]
      );

      console.log('✅ Report salvato nel batch:', batchId);
      return result === true;

    } catch (error) {
      console.error('❌ Errore salvataggio report nel batch:', error);
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
        [pickingIds, ['name', 'partner_id', 'origin']]
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
      x_studio_autista_del_giro: batch.x_studio_autista_del_giro || undefined,
      x_studio_auto_del_giro: batch.x_studio_auto_del_giro || undefined,
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
      parent_id: undefined,
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