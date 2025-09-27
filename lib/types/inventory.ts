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
  uom_id?: number;
  totalQty: number;
  lots: Lot[];
  lastCountDate?: string | null;
  lastCountUser?: string | null;
  inventoryQuantity?: number | null;
  inventoryDiff?: number | null;
  isCounted: boolean;
  isCountedRecent: boolean;
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