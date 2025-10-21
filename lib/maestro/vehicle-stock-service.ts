/**
 * MAESTRO AI - Vehicle Stock Service
 *
 * Business logic for "Cosa ho in macchina" feature
 * Handles vehicle location mapping, stock queries, and transfer operations
 */

import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vehicle stock location for a salesperson
 */
export interface VehicleLocation {
  id: number;
  name: string;
  complete_name: string;
  barcode?: string;
}

/**
 * Product in vehicle stock
 */
export interface VehicleProduct {
  product_id: number;
  name: string;
  default_code: string;
  image_url: string | null;
  quantity: number;
  uom: string;
  category: string;
  lot_id?: number;
  lot_name?: string;
  expiry_date?: string;
}

/**
 * Complete vehicle stock data
 */
export interface VehicleStock {
  location: VehicleLocation;
  products: VehicleProduct[];
  total_products: number;
  total_items: number;
  last_updated: string;
}

/**
 * Transfer product item
 */
export interface TransferProduct {
  product_id: number;
  quantity: number;
  lot_id?: number;
}

/**
 * Transfer request
 */
export interface TransferRequest {
  salesperson_id: number;
  products: TransferProduct[];
  type: 'reload' | 'request_gift';
  notes?: string;
}

/**
 * Transfer result
 */
export interface TransferResult {
  transfer_id: number;
  picking_id: number;
  state: string;
  move_ids: number[];
}

/**
 * Transfer history entry
 */
export interface TransferHistory {
  id: number;
  name: string;
  date: string;
  type: 'reload' | 'request_gift';
  state: string;
  products_count: number;
  total_quantity: number;
  notes?: string;
  origin?: string;
}

// ============================================================================
// VEHICLE LOCATION MAPPINGS
// ============================================================================

/**
 * Static mapping: salesperson_id -> vehicle location ID
 *
 * UPDATED: Real Odoo mappings from production database
 * Queried from res.users and stock.location tables
 *
 * Location IDs are more reliable than names (can't change)
 */
const SALESPERSON_VEHICLE_MAPPING: Record<number, number> = {
  // VENDITORI (Sales Representatives)
  121: 607,  // Alessandro Motta (alessandro@lapa.ch) → WH/BMW ZH542378 A
  407: 605,  // Domingos Ferreira (domingos@lapa.ch) → WH/BMW ZH638565 D
  14: 606,   // Mihai Nita (mihai@lapa.ch) → WH/BMW ZH969307 M

  // ADMIN (Can see all vendors - mapping to their personal vehicle if they need one)
  249: 608,  // Gregorio Buccolieri (gregorio@lapa.ch) - ADMIN + Vehicle → WH/COMO 6278063 G
  // Paul Teodorescu (paul@lapa.ch, ID: 7) - ADMIN only, no personal vehicle needed
  // Laura Teodorescu (laura@lapa.ch, ID: 8) - ADMIN only, no personal vehicle needed
};

/**
 * Admin users who can access ALL vehicles
 * These users will see a dropdown to select which vendor's vehicle to view
 */
export const ADMIN_USER_IDS = [7, 8, 249]; // Paul, Laura, Gregorio

/**
 * Get vehicle location ID for a salesperson
 */
export function getVehicleLocationId(salespersonId: number): number | null {
  return SALESPERSON_VEHICLE_MAPPING[salespersonId] || null;
}

/**
 * Set vehicle location mapping (used by admin or config API)
 */
export function setVehicleLocationMapping(salespersonId: number, locationId: number): void {
  SALESPERSON_VEHICLE_MAPPING[salespersonId] = locationId;
}

/**
 * Get all vehicle location mappings
 */
export function getAllVehicleMappings(): Record<number, number> {
  return { ...SALESPERSON_VEHICLE_MAPPING };
}

/**
 * Check if user is an admin (can see all vendors)
 */
export function isAdminUser(userId: number): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

/**
 * Get all vendor IDs (for admin dropdown)
 */
export function getAllVendorIds(): number[] {
  return Object.keys(SALESPERSON_VEHICLE_MAPPING).map(Number);
}

// ============================================================================
// VEHICLE STOCK SERVICE
// ============================================================================

export class VehicleStockService {
  private sessionManager = getOdooSessionManager();

  /**
   * Get vehicle stock for a salesperson
   *
   * @param salespersonIdOrEmail - Can be Odoo user ID (number) OR email (string)
   */
  async getVehicleStock(salespersonIdOrEmail: number | string): Promise<VehicleStock> {
    console.log(`🚗 [VehicleStock] Fetching stock for: ${salespersonIdOrEmail}`);

    // 1. If email provided, resolve to Odoo user ID first
    let odooUserId: number;

    if (typeof salespersonIdOrEmail === 'string') {
      // Email provided - find Odoo user
      const users = await this.sessionManager.callKw(
        'res.users',
        'search_read',
        [[['login', '=', salespersonIdOrEmail]]],
        { fields: ['id'], limit: 1 }
      );

      if (!users || users.length === 0) {
        throw new Error(`No Odoo user found with email ${salespersonIdOrEmail}`);
      }

      odooUserId = users[0].id;
      console.log(`  ✓ Resolved email ${salespersonIdOrEmail} to Odoo user ID ${odooUserId}`);
    } else {
      odooUserId = salespersonIdOrEmail;
    }

    // 2. Get vehicle location ID for this Odoo user
    const locationId = getVehicleLocationId(odooUserId);

    if (!locationId) {
      throw new Error(`No vehicle location mapped for salesperson ${odooUserId}`);
    }

    // 3. Get location details from Odoo
    const locations = await this.sessionManager.callKw(
      'stock.location',
      'read',
      [[locationId]],
      {
        fields: ['id', 'name', 'complete_name', 'barcode']
      }
    );

    if (!locations || locations.length === 0) {
      throw new Error(`Vehicle location ID ${locationId} not found in Odoo`);
    }

    const location: VehicleLocation = {
      id: locations[0].id,
      name: locations[0].name,
      complete_name: locations[0].complete_name,
      barcode: locations[0].barcode || undefined
    };

    console.log(`📍 [VehicleStock] Found location: ${location.complete_name} (ID: ${locationId})`);

    // 3. Query stock.quant for this location (only positive quantities)
    const quants = await this.sessionManager.callKw(
      'stock.quant',
      'search_read',
      [[
        ['location_id', '=', location.id],
        ['quantity', '>', 0]
      ]],
      {
        fields: [
          'id',
          'product_id',
          'quantity',
          'product_uom_id',
          'lot_id',
          'package_id',
          'inventory_quantity'
        ],
        order: 'product_id'
      }
    );

    console.log(`📦 [VehicleStock] Found ${quants.length} quants`);

    if (quants.length === 0) {
      return {
        location,
        products: [],
        total_products: 0,
        total_items: 0,
        last_updated: new Date().toISOString()
      };
    }

    // 4. Fetch product details (batch operation)
    const productIds = quants.map((q: any) => q.product_id[0]);
    const uniqueProductIds = Array.from(new Set(productIds));

    const products = await this.sessionManager.callKw(
      'product.product',
      'read',
      [uniqueProductIds],
      {
        fields: [
          'id',
          'name',
          'default_code',
          'image_128',
          'uom_id',
          'categ_id'
        ]
      }
    );

    // Create product map for fast lookup
    const productMap = new Map(
      products.map((p: any) => [p.id, p])
    );

    // 5. Fetch lot details if present
    const lotIds = quants
      .filter((q: any) => q.lot_id && Array.isArray(q.lot_id))
      .map((q: any) => q.lot_id[0]);

    const uniqueLotIds = Array.from(new Set(lotIds));
    let lotMap = new Map();

    if (uniqueLotIds.length > 0) {
      const lots = await this.sessionManager.callKw(
        'stock.lot',
        'read',
        [uniqueLotIds],
        {
          fields: ['id', 'name', 'expiration_date']
        }
      );

      lotMap = new Map(
        lots.map((l: any) => [l.id, l])
      );
    }

    // 6. Map to VehicleProduct format
    const vehicleProducts: VehicleProduct[] = quants.map((quant: any) => {
      const product = productMap.get(quant.product_id[0]) as any;
      const lot = quant.lot_id ? (lotMap.get(quant.lot_id[0]) as any) : null;

      return {
        product_id: quant.product_id[0],
        name: product?.name || quant.product_id[1],
        default_code: product?.default_code || '',
        image_url: product?.image_128
          ? `data:image/png;base64,${product.image_128}`
          : null,
        quantity: quant.quantity || 0,
        uom: quant.product_uom_id ? quant.product_uom_id[1] : 'Units',
        category: product?.categ_id ? product.categ_id[1] : 'Uncategorized',
        lot_id: lot?.id,
        lot_name: lot?.name,
        expiry_date: lot?.expiration_date || undefined
      };
    });

    // 7. Calculate totals
    const totalProducts = vehicleProducts.length;
    const totalItems = vehicleProducts.reduce((sum, p) => sum + p.quantity, 0);

    console.log(`✅ [VehicleStock] Returning ${totalProducts} products, ${totalItems} total items`);

    return {
      location,
      products: vehicleProducts,
      total_products: totalProducts,
      total_items: totalItems,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Create stock transfer (reload or gift request)
   */
  async createTransfer(request: TransferRequest): Promise<TransferResult> {
    console.log(`📤 [VehicleStock] Creating ${request.type} transfer for salesperson ${request.salesperson_id}`);
    console.log(`   Products: ${request.products.length}`);

    // 1. Get vehicle location ID
    const locationId = getVehicleLocationId(request.salesperson_id);

    if (!locationId) {
      throw new Error(`No vehicle location mapped for salesperson ${request.salesperson_id}`);
    }

    // Get location details using ID directly
    const locations = await this.sessionManager.callKw(
      'stock.location',
      'read',
      [[locationId]],
      {
        fields: ['id', 'name', 'complete_name', 'barcode']
      }
    );

    if (!locations || locations.length === 0) {
      throw new Error(`Vehicle location with ID ${locationId} not found`);
    }

    const vehicleLocation = locations[0];

    // 2. Get main warehouse stock location (source for reload, destination for gift request)
    const warehouseLocations = await this.sessionManager.callKw(
      'stock.location',
      'search_read',
      [[
        ['usage', '=', 'internal'],
        ['name', 'ilike', 'stock']
      ]],
      {
        fields: ['id', 'name', 'complete_name'],
        limit: 1,
        order: 'id'
      }
    );

    if (!warehouseLocations || warehouseLocations.length === 0) {
      throw new Error('Main warehouse stock location not found');
    }

    const warehouseLocation = warehouseLocations[0];

    // 3. Determine source and destination based on transfer type
    let sourceLocationId: number;
    let destLocationId: number;
    let pickingTypeCode: string;
    let origin: string;

    if (request.type === 'reload') {
      // Reload: Warehouse -> Vehicle
      sourceLocationId = warehouseLocation.id;
      destLocationId = vehicleLocation.id;
      pickingTypeCode = 'internal';
      origin = `RELOAD-${request.salesperson_id}`;
    } else {
      // Gift request: Vehicle -> Warehouse (return for gift samples)
      sourceLocationId = vehicleLocation.id;
      destLocationId = warehouseLocation.id;
      pickingTypeCode = 'internal';
      origin = `GIFT-REQ-${request.salesperson_id}`;
    }

    // 4. Get picking type for internal transfer
    const pickingTypes = await this.sessionManager.callKw(
      'stock.picking.type',
      'search_read',
      [[
        ['code', '=', pickingTypeCode]
      ]],
      {
        fields: ['id', 'name', 'default_location_src_id', 'default_location_dest_id'],
        limit: 1
      }
    );

    const pickingTypeId = pickingTypes && pickingTypes.length > 0
      ? pickingTypes[0].id
      : false;

    // 5. Create stock.picking (transfer order)
    const pickingData: any = {
      picking_type_id: pickingTypeId || 5, // Fallback to default internal transfer type
      location_id: sourceLocationId,
      location_dest_id: destLocationId,
      origin: origin,
      move_type: 'direct', // Process all at once
      state: 'draft'
    };

    if (request.notes) {
      pickingData.note = request.notes;
    }

    const pickingId = await this.sessionManager.callKw(
      'stock.picking',
      'create',
      [pickingData]
    );

    console.log(`📋 [VehicleStock] Created picking ${pickingId}`);

    // 6. Create stock.move for each product
    const moveIds: number[] = [];

    for (const product of request.products) {
      const moveData: any = {
        name: `${request.type.toUpperCase()}: Product ${product.product_id}`,
        product_id: product.product_id,
        product_uom_qty: product.quantity,
        product_uom: 1, // Will be set by Odoo based on product
        location_id: sourceLocationId,
        location_dest_id: destLocationId,
        picking_id: pickingId,
        state: 'draft'
      };

      const moveId = await this.sessionManager.callKw(
        'stock.move',
        'create',
        [moveData]
      );

      moveIds.push(moveId);

      console.log(`  ✓ Created move ${moveId} for product ${product.product_id} (qty: ${product.quantity})`);
    }

    // 7. Confirm the picking (makes it ready to process)
    await this.sessionManager.callKw(
      'stock.picking',
      'action_confirm',
      [[pickingId]]
    );

    console.log(`✅ [VehicleStock] Transfer confirmed: picking ${pickingId}, ${moveIds.length} moves`);

    // 8. Get final state
    const picking = await this.sessionManager.callKw(
      'stock.picking',
      'read',
      [[pickingId]],
      {
        fields: ['state', 'name']
      }
    );

    return {
      transfer_id: pickingId,
      picking_id: pickingId,
      state: picking[0].state,
      move_ids: moveIds
    };
  }

  /**
   * Get transfer history for a salesperson
   */
  async getTransferHistory(
    salespersonId: number,
    limit: number = 20
  ): Promise<TransferHistory[]> {
    console.log(`📜 [VehicleStock] Fetching transfer history for salesperson ${salespersonId}, limit: ${limit}`);

    // 1. Get vehicle location ID
    const locationId = getVehicleLocationId(salespersonId);

    if (!locationId) {
      throw new Error(`No vehicle location mapped for salesperson ${salespersonId}`);
    }

    const vehicleLocationId = locationId;

    // 2. Query stock.picking where vehicle location is source or destination
    const pickings = await this.sessionManager.callKw(
      'stock.picking',
      'search_read',
      [[
        '|',
        ['location_id', '=', vehicleLocationId],
        ['location_dest_id', '=', vehicleLocationId]
      ]],
      {
        fields: [
          'id',
          'name',
          'create_date',
          'state',
          'origin',
          'note',
          'location_id',
          'location_dest_id',
          'move_ids_without_package'
        ],
        limit: limit,
        order: 'create_date desc'
      }
    );

    console.log(`📋 [VehicleStock] Found ${pickings.length} transfers`);

    // 3. For each picking, get move count and total quantity
    const history: TransferHistory[] = [];

    for (const picking of pickings) {
      // Determine transfer type based on direction
      let type: 'reload' | 'request_gift';

      if (picking.location_dest_id && picking.location_dest_id[0] === vehicleLocationId) {
        type = 'reload'; // Incoming to vehicle
      } else {
        type = 'request_gift'; // Outgoing from vehicle
      }

      // Count products and total quantity
      let productsCount = 0;
      let totalQuantity = 0;

      if (picking.move_ids_without_package && Array.isArray(picking.move_ids_without_package)) {
        const moveIds = picking.move_ids_without_package;

        if (moveIds.length > 0) {
          const moves = await this.sessionManager.callKw(
            'stock.move',
            'read',
            [moveIds],
            {
              fields: ['product_uom_qty']
            }
          );

          productsCount = moves.length;
          totalQuantity = moves.reduce((sum: number, m: any) => sum + (m.product_uom_qty || 0), 0);
        }
      }

      history.push({
        id: picking.id,
        name: picking.name,
        date: picking.create_date,
        type: type,
        state: picking.state,
        products_count: productsCount,
        total_quantity: totalQuantity,
        notes: picking.note || undefined,
        origin: picking.origin || undefined
      });
    }

    console.log(`✅ [VehicleStock] Returning ${history.length} history entries`);

    return history;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let vehicleStockServiceInstance: VehicleStockService | null = null;

export function getVehicleStockService(): VehicleStockService {
  if (!vehicleStockServiceInstance) {
    vehicleStockServiceInstance = new VehicleStockService();
  }
  return vehicleStockServiceInstance;
}
