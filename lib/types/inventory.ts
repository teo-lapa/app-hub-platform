// Tipi condivisi per l'inventario

export interface Location {
  id: number;
  name: string;
  complete_name?: string;
  barcode?: string;
}

export interface BasicProduct {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string | null;
  uom: string;
}

export interface Product extends BasicProduct {
  quant_id?: number; // ID del quant Odoo (stock.quant)
  quantity: number; // Quantità attuale in stock
  reserved: number; // Quantità riservata
  uom_id?: number;
  totalQty: number;

  // Dati lotto (ogni Product ora rappresenta un solo lotto)
  lot_id?: number | null;
  lot_name?: string | null;
  lot_expiration_date?: string | null;

  // Stato inventario
  inventory_quantity?: number | null; // Quantità contata
  inventory_diff_quantity?: number | null; // Differenza
  inventory_date?: string | null; // Data inventario
  write_date?: string | null; // Ultima modifica
  lastCountDate?: string | null;
  lastCountUser?: string | null;
  isCounted: boolean;
  isCountedRecent: boolean;

  // Legacy (per compatibilità temporanea)
  lots?: Lot[];
  inventoryQuantity?: number | null;
  inventoryDiff?: number | null;
}

export interface Lot {
  id: number;
  name: string;
  quantity: number;
  inventoryQuantity?: number | null;
  inventoryDiff?: number | null;
  expirationDate?: string | null;
}

export interface AppState {
  currentLocation: Location | null;
  products: Product[];
  selectedProduct: Product | null;
  selectedLot: Lot | null;
  scannerActive: boolean;
  scannerMode: 'location' | 'product';
  searchMode: 'location' | 'warehouse';
  transferProduct: Product | null;
  currentUser: any | null;
}

export interface InventoryConfig {
  bufferLocation: {
    id: number;
    name: string;
  };
  refreshInterval: number;
  defaultUOM: string;
}