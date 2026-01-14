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
  customer_notes_count?: number; // Conteggio clienti con messaggi
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
  // Cache condivisa per batch - riduce chiamate ripetute
  private batchCache: Map<number, { picking_ids: number[]; timestamp: number }> = new Map();
  private productCache: Map<number, OdooProduct> = new Map();
  private pickingCache: Map<number, any> = new Map();
  private lotCache: Map<number, any> = new Map();

  constructor() {
    // Usa sempre la variabile d'ambiente - non fare fallback a staging!
    this.odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || '';
    if (!this.odooUrl) {
      console.error('⚠️ NEXT_PUBLIC_ODOO_URL non configurata!');
    }
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

  // Carica tutti i WH/PICK pronti che sono in un batch
  async getReadyPickings(): Promise<any[]> {
    try {
      console.log('🔄 [Picking] Caricamento WH/PICK pronti (in batch)...');

      // Filtro: solo WH/PICK pronti che sono GIÀ in un batch (no residui)
      const domain: any[] = [
        ['state', '=', 'assigned'],
        ['picking_type_code', '=', 'internal'],  // Solo WH/PICK
        ['batch_id', '!=', false]  // Solo quelli IN un batch (no residui)
      ];

      const fields = [
        'id', 'name', 'state', 'partner_id', 'origin',
        'scheduled_date', 'move_line_ids', 'note', 'batch_id'
      ];

      const pickings = await this.rpc(
        'stock.picking',
        'search_read',
        [domain, fields],
        { limit: 50, order: 'scheduled_date asc, name asc' }
      );

      console.log(`✅ [Picking] Trovati ${pickings.length} WH/PICK pronti`);

      // Per ogni picking, conta i prodotti e aggiungi info batch
      const pickingsWithCounts = pickings.map((picking: any) => {
        const productCount = picking.move_line_ids?.length || 0;

        return {
          id: picking.id,
          name: picking.name,
          state: picking.state,
          partner_name: picking.partner_id ? picking.partner_id[1] : 'N/A',
          origin: picking.origin || '',
          scheduled_date: picking.scheduled_date || '',
          product_count: productCount,
          note: picking.note || '',
          batch_id: picking.batch_id ? picking.batch_id[0] : null,
          batch_name: picking.batch_id ? picking.batch_id[1] : null
        };
      });

      return pickingsWithCounts;

    } catch (error) {
      console.error('Errore caricamento WH/PICK:', error);
      throw error;
    }
  }

  // Carica le ubicazioni per un picking singolo (senza batch)
  async getSinglePickingLocations(pickingId: number): Promise<(StockLocation & { operationCount?: number })[]> {
    try {
      console.log(`🔄 [Picking] Caricamento ubicazioni per picking singolo: ${pickingId}`);

      // Carica le move lines per il picking
      const moveLines = await this.rpc(
        'stock.move.line',
        'search_read',
        [[['picking_id', '=', pickingId], ['state', 'not in', ['done', 'cancel']]], ['location_id', 'product_id', 'quantity', 'qty_done']],
        {}
      );

      console.log(`📦 [Picking] Caricate ${moveLines.length} move lines dal picking ${pickingId}`);

      if (moveLines.length === 0) {
        return [];
      }

      // Raggruppa per ubicazione
      const sublocationMap = new Map();

      for (const line of moveLines) {
        const locationId = line.location_id[0];
        const locationName = line.location_id[1];
        const productName = line.product_id && Array.isArray(line.product_id) ? line.product_id[1] : 'Prodotto sconosciuto';
        const qtyDone = line.qty_done || 0;
        const quantity = line.quantity || 0;
        const isCompleted = qtyDone >= quantity;

        if (!sublocationMap.has(locationId)) {
          sublocationMap.set(locationId, {
            id: locationId,
            name: locationName,
            complete_name: locationName,
            barcode: '',
            operationCount: 0,
            completedOps: 0,
            totalOps: 0,
            productPreview: []
          });
        }

        const subloc = sublocationMap.get(locationId);
        subloc.totalOps++;

        if (isCompleted) {
          subloc.completedOps++;
        }

        subloc.isFullyCompleted = subloc.totalOps > 0 && subloc.completedOps === subloc.totalOps;
        subloc.operationCount = subloc.totalOps;

        if (!subloc.productPreview.includes(productName)) {
          subloc.productPreview.push(productName);
        }
      }

      const result = Array.from(sublocationMap.values());

      console.log(`✅ [Picking] Trovate ${result.length} ubicazioni per picking singolo`);

      return result;

    } catch (error) {
      console.error('Errore caricamento ubicazioni picking singolo:', error);
      throw error;
    }
  }

  // Carica operazioni per picking singolo e ubicazione
  async getSinglePickingLocationOperations(pickingId: number, locationId: number): Promise<Operation[]> {
    try {
      const domain = [
        ['picking_id', '=', pickingId],
        ['location_id', '=', locationId],
        ['state', 'not in', ['done', 'cancel']]
      ];

      const moveLines: OdooStockMoveLine[] = await this.rpc(
        'stock.move.line',
        'search_read',
        [domain]
      );

      if (moveLines.length === 0) {
        return [];
      }

      // Raccogli ID unici necessari
      const productIds = Array.from(new Set(moveLines.map(ml => ml.product_id[0])));
      const lotIds = Array.from(new Set(moveLines
        .filter(ml => ml.lot_id && Array.isArray(ml.lot_id))
        .map(ml => (ml.lot_id as [number, string])[0])
      ));

      // Carica prodotti
      const uncachedProductIds = productIds.filter(id => !this.productCache.has(id));
      if (uncachedProductIds.length > 0) {
        const products = await this.getProducts(uncachedProductIds);
        products.forEach(p => this.productCache.set(p.id, p));
      }

      // Carica lotti
      const uncachedLotIds = lotIds.filter(id => !this.lotCache.has(id));
      if (uncachedLotIds.length > 0) {
        const lots = await this.rpc(
          'stock.lot',
          'search_read',
          [[['id', 'in', uncachedLotIds]], ['id', 'name', 'expiration_date']]
        );
        lots.forEach((lot: any) => this.lotCache.set(lot.id, lot));
      }

      // Carica info picking
      if (!this.pickingCache.has(pickingId)) {
        const pickings = await this.getPickings([pickingId]);
        pickings.forEach(p => this.pickingCache.set(p.id, p));
      }

      const picking = this.pickingCache.get(pickingId);

      return moveLines.map((ml) => {
        const product = this.productCache.get(ml.product_id[0]);
        const lot = ml.lot_id ? this.lotCache.get((ml.lot_id as [number, string])[0]) : null;

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
          quantity: ml.quantity || 0,
          qty_done: ml.qty_done || 0,
          uom: ml.product_uom_id && typeof ml.product_uom_id[1] === 'string' ? ml.product_uom_id[1].split(' ')[0] : 'PZ',
          lot_id: ml.lot_id || undefined,
          lot_name: ml.lot_name || undefined,
          expiry_date: lot?.expiration_date || undefined,
          package_id: ml.package_id || undefined,
          note: picking?.note || '',
          customer: picking?.partner_name || '',
          image: product?.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
          isCompleted: ml.qty_done >= (ml.quantity || 0),
          needsQRVerification: false,
          scannedQR: false
        };
      });

    } catch (error) {
      console.error('Errore caricamento operazioni picking singolo:', error);
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

      // Per ogni batch, carica i dettagli dei picking per contare prodotti e messaggi clienti
      const batchesWithDetails = await Promise.all(batches.map(async (batch) => {
        let pickingCount = 0;
        let productCount = 0;
        let customerNotesCount = 0; // Conteggio clienti con messaggi

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

          // Conta i picking con messaggi cliente (note non vuote)
          try {
            const pickingsWithNotes = await this.rpc(
              'stock.picking',
              'search_count',
              [[
                ['id', 'in', batch.picking_ids],
                ['note', '!=', false]
              ]]
            );
            customerNotesCount = pickingsWithNotes;
          } catch (error) {
            console.warn('Errore conteggio messaggi clienti per batch', batch.id, error);
          }
        }

        return {
          ...batch,
          picking_count: pickingCount,
          product_count: productCount,
          customer_notes_count: customerNotesCount
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
        'picking_id', 'state',
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
        const qtyDone = line.qty_done || 0;
        const quantity = line.quantity || 0;
        const isCompleted = qtyDone >= quantity;

        if (!sublocationMap.has(locationId)) {
          sublocationMap.set(locationId, {
            id: locationId,
            name: locationName,
            complete_name: locationName,
            barcode: '',
            operationCount: 0,
            completedOps: 0,
            totalOps: 0,
            productPreview: []
          });
        }

        const subloc = sublocationMap.get(locationId);
        subloc.totalOps++;

        // Conta quanti prodotti hanno il check completato (qty_done >= quantity)
        if (isCompleted) {
          subloc.completedOps++;
        }

        // Calcola se ubicazione completamente finita
        subloc.isFullyCompleted = subloc.totalOps > 0 && subloc.completedOps === subloc.totalOps;

        // Mantieni operationCount per compatibilità
        subloc.operationCount = subloc.totalOps;

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

  // Carica le operazioni raggruppate per prodotto (per controllo diretto)
  async getProductGroupedOperations(batchId: number, zone: string): Promise<any[]> {
    try {
      console.log(`🔄 [Picking] Caricamento prodotti raggruppati per zona: ${zone}, batch: ${batchId}`);

      // Prima ottieni i picking del batch
      const batch: OdooPickingBatch = await this.rpc(
        'stock.picking.batch',
        'read',
        [[batchId], ['picking_ids']]
      ).then(res => res[0]);

      if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
        return [];
      }

      // Carica le move lines per questa zona
      const moveLines = await this.rpc(
        'stock.move.line',
        'search_read',
        [[['picking_id', 'in', batch.picking_ids], ['state', 'not in', ['done', 'cancel']]], ['location_id', 'product_id', 'quantity', 'qty_done', 'picking_id', 'product_uom_id', 'move_id']],
        {}
      );

      // Carica TUTTI i moves dai pickings per ottenere la quantità richiesta
      // Non ci fidiamo solo delle move_id nelle move lines perché potrebbero essere null
      const allMoves = await this.rpc(
        'stock.move',
        'search_read',
        [[
          ['picking_id', 'in', batch.picking_ids],
          ['state', 'not in', ['done', 'cancel']]
        ], ['id', 'product_uom_qty', 'product_id', 'picking_id']],
        {}
      );

      // Crea una mappa: picking_id + product_id => move
      const moveByPickingProductMap = new Map();
      allMoves.forEach((m: any) => {
        const pickingId = Array.isArray(m.picking_id) ? m.picking_id[0] : m.picking_id;
        const productId = Array.isArray(m.product_id) ? m.product_id[0] : m.product_id;
        const key = `${pickingId}_${productId}`;
        moveByPickingProductMap.set(key, m);
      });

      const moveMap = new Map(allMoves.map((m: any) => [m.id, m]));

      // Filtra per zona
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

      // Prima raggruppa per prodotto + picking (cliente) usando move_id per la qty richiesta
      const productPickingMap = new Map();

      for (const line of relevantLines) {
        const productId = line.product_id[0];
        const pickingId = line.picking_id ? line.picking_id[0] : 0;
        const moveId = line.move_id ? line.move_id[0] : null;
        const key = `${productId}_${pickingId}`;
        const qtyDone = line.qty_done || 0;

        // Ottieni la quantità richiesta dal move, non dalla move line!
        let move: any = null;

        // Prima prova con move_id
        if (moveId) {
          move = moveMap.get(moveId);
        }

        // Se non trovato, cerca per picking_id + product_id
        if (!move) {
          const moveKey = `${pickingId}_${productId}`;
          move = moveByPickingProductMap.get(moveKey);
        }

        if (!productPickingMap.has(key)) {
          // Prendi la qty richiesta dal move.product_uom_qty (non dalla move line!)
          let qtyRequested = 0;

          if (move && move.product_uom_qty != null) {
            qtyRequested = move.product_uom_qty;
          } else {
            // Fallback: se il move non c'è, usa la qty della move line
            qtyRequested = line.quantity || 0;
          }

          productPickingMap.set(key, {
            productId: productId,
            productName: line.product_id[1],
            pickingId: pickingId,
            pickingName: line.picking_id ? line.picking_id[1] : '',
            customerName: '', // Verrà riempito dopo
            totalQtyRequested: qtyRequested, // Qty richiesta dal cliente (dal move!)
            totalQtyPicked: 0,
            moveLines: []
          });
        } else {
          // Se il gruppo esiste già ma totalQtyRequested è 0, prova ad aggiornarlo
          const group = productPickingMap.get(key);
          if (group.totalQtyRequested === 0 && move && move.product_uom_qty != null) {
            group.totalQtyRequested = move.product_uom_qty;
          }
        }

        const group = productPickingMap.get(key);

        group.totalQtyPicked += qtyDone;
        group.moveLines.push({
          id: line.id,
          locationName: line.location_id[1],
          quantity: line.quantity || 0, // Qty della singola move line
          qty_done: qtyDone,
          uom: line.product_uom_id && typeof line.product_uom_id[1] === 'string' ? line.product_uom_id[1].split(' ')[0] : 'PZ'
        });
      }

      // Ora raggruppa per prodotto
      const productMap = new Map();

      productPickingMap.forEach((group) => {
        const productId = group.productId;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            productId: productId,
            productName: group.productName,
            totalQtyRequested: 0,
            totalQtyPicked: 0,
            clientCount: 0,
            image: null,
            lines: []
          });
        }

        const product = productMap.get(productId);
        product.totalQtyRequested += group.totalQtyRequested;
        product.totalQtyPicked += group.totalQtyPicked;
        product.clientCount++;

        product.lines.push({
          pickingId: group.pickingId,
          pickingName: group.pickingName,
          customerName: '', // Verrà riempito dopo
          quantityRequested: group.totalQtyRequested,
          quantityPicked: group.totalQtyPicked,
          moveLines: group.moveLines
        });
      });

      // Carica immagini prodotti
      const productIds = Array.from(productMap.keys());
      const products = await this.getProducts(productIds);
      const productImageMap = new Map(products.map(p => [p.id, p.image_128]));

      // Aggiungi immagini ai prodotti
      productMap.forEach((product, productId) => {
        const imageBase64 = productImageMap.get(productId);
        product.image = imageBase64 ? `data:image/png;base64,${imageBase64}` : null;
      });

      // Carica info picking per i clienti
      const pickingIds = Array.from(new Set(relevantLines
        .filter(l => l.picking_id)
        .map(l => l.picking_id[0])
      ));

      const pickings = await this.getPickings(pickingIds as number[]);
      const pickingMap = new Map(pickings.map(p => [p.id, p]));

      // Aggiungi info cliente a ogni linea e CREA NUOVO OGGETTO
      const result = Array.from(productMap.values()).map(product => {
        const linesWithCustomers = product.lines.map((line: any) => {
          const customerName = line.pickingId ? pickingMap.get(line.pickingId)?.partner_name || 'N/A' : 'N/A';
          // CREA NUOVO OGGETTO invece di modificare product
          return {
            pickingId: line.pickingId,
            pickingName: line.pickingName,
            customerName: customerName,
            quantityRequested: line.quantityRequested,
            quantityPicked: line.quantityPicked,
            moveLines: line.moveLines
          };
        });

        return {
          ...product,
          lines: linesWithCustomers
        };
      });

      return result;

    } catch (error) {
      console.error('Errore caricamento prodotti raggruppati:', error);
      throw error;
    }
  }

  // Carica le operazioni per un'ubicazione specifica - OTTIMIZZATO CON CACHE
  async getLocationOperations(batchId: number, locationId: number): Promise<Operation[]> {
    try {
      //  ========== CHIAMATA 1: Batch picking_ids (con cache) ==========
      let pickingIds: number[] = [];

      // Usa cache se disponibile (5 minuti validità)
      const cachedBatch = this.batchCache.get(batchId);
      const now = Date.now();

      if (cachedBatch && (now - cachedBatch.timestamp < 300000)) {
        pickingIds = cachedBatch.picking_ids;
      } else {
        const batch: OdooPickingBatch = await this.rpc(
          'stock.picking.batch',
          'read',
          [[batchId], ['picking_ids']]
        ).then(res => res[0]);

        if (!batch.picking_ids || !Array.isArray(batch.picking_ids) || batch.picking_ids.length === 0) {
          return [];
        }

        pickingIds = batch.picking_ids;
        this.batchCache.set(batchId, { picking_ids: pickingIds, timestamp: now });
      }

      //  ========== CHIAMATA 2: Move lines per ubicazione ==========
      const domain = [
        ['picking_id', 'in', pickingIds],
        ['location_id', '=', locationId],
        ['state', 'not in', ['done', 'cancel']]
      ];

      const moveLines: OdooStockMoveLine[] = await this.rpc(
        'stock.move.line',
        'search_read',
        [domain]
      );

      if (moveLines.length === 0) {
        return [];
      }

      // Raccogli ID unici necessari
      const productIds = Array.from(new Set(moveLines.map(ml => ml.product_id[0])));
      const lotIds = Array.from(new Set(moveLines
        .filter(ml => ml.lot_id && Array.isArray(ml.lot_id))
        .map(ml => (ml.lot_id as [number, string])[0])
      ));
      const pickingIdsToFetch = Array.from(new Set(moveLines
        .map(ml => ml.picking_id && ml.picking_id[0])
        .filter(Boolean) as number[]
      ));

      // Filtra solo gli ID che NON sono in cache
      const uncachedProductIds = productIds.filter(id => !this.productCache.has(id));
      const uncachedLotIds = lotIds.filter(id => !this.lotCache.has(id));
      const uncachedPickingIds = pickingIdsToFetch.filter(id => !this.pickingCache.has(id));

      //  ========== CHIAMATE BATCH (solo dati non in cache) ==========
      // Carica prodotti mancanti
      if (uncachedProductIds.length > 0) {
        const products = await this.getProducts(uncachedProductIds);
        products.forEach(p => this.productCache.set(p.id, p));
      }

      // Carica lotti mancanti
      if (uncachedLotIds.length > 0) {
        const lots = await this.rpc(
          'stock.lot',
          'search_read',
          [[['id', 'in', uncachedLotIds]], ['id', 'name', 'expiration_date']]
        );
        lots.forEach((lot: any) => this.lotCache.set(lot.id, lot));
      }

      // Carica picking mancanti
      if (uncachedPickingIds.length > 0) {
        const pickings = await this.getPickings(uncachedPickingIds);
        pickings.forEach(p => this.pickingCache.set(p.id, p));
      }

      // Mappa finale - USA SOLO CACHE!
      return moveLines.map((ml) => {
        const product = this.productCache.get(ml.product_id[0]);
        const picking = ml.picking_id ? this.pickingCache.get(ml.picking_id[0]) : null;
        const lot = ml.lot_id ? this.lotCache.get((ml.lot_id as [number, string])[0]) : null;

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
          quantity: ml.quantity || 0,
          qty_done: ml.qty_done || 0,
          uom: ml.product_uom_id && typeof ml.product_uom_id[1] === 'string' ? ml.product_uom_id[1].split(' ')[0] : 'PZ',
          lot_id: ml.lot_id || undefined,
          lot_name: ml.lot_name || undefined,
          expiry_date: lot?.expiration_date || undefined,
          package_id: ml.package_id || undefined,
          note: picking?.note || '', // Messaggio del CLIENTE dal picking
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

  // 🆕 Invia messaggio nel chatter del batch (invece di file TXT)
  async postBatchChatterMessage(batchId: number, message: string): Promise<boolean> {
    try {
      console.log('📝 [Picking] Invio messaggio nel chatter del batch:', batchId);

      // Usa message_post per inviare un messaggio nel chatter di Odoo
      await this.rpc(
        'stock.picking.batch',
        'message_post',
        [[batchId]],
        {
          body: message.replace(/\n/g, '<br/>'), // Converti newline in HTML
          message_type: 'comment',
          subtype_xmlid: 'mail.mt_note' // Nota interna
        }
      );

      console.log('✅ [Picking] Messaggio inviato nel chatter!');
      return true;

    } catch (error) {
      console.error('❌ [Picking] Errore invio messaggio chatter:', error);
      return false;
    }
  }

  // Salva report di lavoro nel batch come attachment (DEPRECATO - usa postBatchChatterMessage)
  async saveBatchReport(batchId: number, reportText: string): Promise<boolean> {
    try {
      // Salva il report come attachment invece che nel campo note (che non esiste)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `zona_report_${timestamp}.txt`;

      // Converti il testo in base64
      const base64Report = btoa(unescape(encodeURIComponent(reportText)));

      // Crea l'attachment
      const result = await this.rpc(
        'ir.attachment',
        'create',
        [{
          name: filename,
          datas: base64Report,
          res_model: 'stock.picking.batch',
          res_id: batchId,
          type: 'binary'
        }]
      );

      return true;

    } catch (error) {
      // Non bloccare l'utente per questo errore - il report è comunque mostrato a schermo
      return false;
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
        [pickingIds, ['name', 'partner_id', 'origin', 'note']]  // ✅ Aggiunto 'note'
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
      product_count: batch.product_count,
      customer_notes_count: batch.customer_notes_count || 0
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
      quantity: line.quantity || 0,
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