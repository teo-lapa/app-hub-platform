// Types per l'app Prelievo per Zone

export interface Zone {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon?: string;
  order: number;
}

export interface Batch {
  id: number;
  name: string;
  state: 'draft' | 'in_progress' | 'done' | 'cancel';
  user_id?: [number, string];
  picking_ids?: number[];
  scheduled_date?: string;
  note?: string;
  vehicle_id?: [number, string];
  driver_id?: [number, string];
  x_studio_autista_del_giro?: [number, string];
  x_studio_auto_del_giro?: [number, string];
  picking_count?: number;
  move_line_count?: number;
  product_count?: number;
  customer_notes_count?: number; // Conteggio clienti con messaggi
}

export interface StockLocation {
  id: number;
  name: string;
  complete_name: string;
  barcode?: string;
  parent_id?: [number, string] | undefined;
  child_ids?: number[];
  quant_ids?: number[];
  posx?: number;
  posy?: number;
  posz?: number;
}

export interface StockMoveLine {
  id: number;
  move_id?: [number, string];
  product_id: [number, string];
  product_uom_id?: [number, string];
  location_id: [number, string];
  location_dest_id: [number, string];
  lot_id?: [number, string];
  lot_name?: string;
  expiry_date?: string;
  package_id?: [number, string];
  quantity: number;
  qty_done: number;
  product_uom_qty?: number;
  reserved_uom_qty?: number;
  picking_id?: [number, string];
  state?: string;
  reference?: string;
  result_package_id?: [number, string];
  owner_id?: [number, string];
  product_barcode?: string;
  product_default_code?: string;
  description_picking?: string;
}

export interface StockMove {
  id: number;
  name: string;
  product_id: [number, string];
  product_uom_qty: number;
  quantity_done: number;
  state: string;
  picking_id?: [number, string];
  location_id: [number, string];
  location_dest_id: [number, string];
  move_line_ids?: number[];
}

export interface Operation {
  id: number;
  lineId?: number;
  moveId?: number;
  productId: number;
  productName: string;
  productCode?: string;
  productBarcode?: string;
  locationId: number;
  locationName: string;
  quantity: number;
  qty_done: number;
  uom?: string;
  lot_id?: [number, string];
  lot_name?: string;
  expiry_date?: string;
  package_id?: [number, string];
  note?: string;
  customer?: string;
  image?: string;
  isCompleted?: boolean;
  needsQRVerification?: boolean;
  scannedQR?: boolean;
}

export interface WorkStats {
  zonesCompleted: number;
  totalOperations: number;
  completedOperations: number;
  startTime?: Date;
  currentZoneTime?: number;
  totalTime?: number;
}

export interface PickingConfig {
  QR_VERIFICATION: boolean;
  COLLAPSE_ON_COMPLETE: boolean;
  AUTO_NEXT: boolean;
  AUDIO_FEEDBACK: boolean;
  VIBRATION_FEEDBACK: boolean;
}

export interface PickingState {
  // Stato corrente
  currentBatch: Batch | null;
  currentZone: Zone | null;
  currentLocation: StockLocation | null;
  currentOperations: Operation[];

  // Cache dati
  batches: Batch[];
  zones: Zone[];
  locations: StockLocation[];
  allMoveLines: StockMoveLine[];
  movesCache: Map<number, StockMove>;
  linesCache: Map<number, StockMoveLine>;

  // UI State
  isLoading: boolean;
  error: string | null;
  scannerActive: boolean;
  scannerMode: 'product' | 'location' | null;
  keyboardTarget: Operation | null;

  // Statistiche
  workStats: WorkStats;

  // Configurazione
  config: PickingConfig;

  // Note e metadata
  pickingNotesMap: Record<number, string>;
  operationStartTimes: Record<number, Date>;
}

export interface ScanResult {
  type: 'product' | 'location' | 'lot' | 'package';
  value: string;
  raw?: string;
}

export interface KeyboardInput {
  operationId: number;
  currentValue: string;
  maxValue: number;
  confirmed: boolean;
}

// Zone costanti
export const ZONES: Zone[] = [
  {
    id: 'secco',
    name: 'Secco',
    displayName: '📦 Secco',
    color: '#0ea5e9',
    order: 1
  },
  {
    id: 'secco_sopra',
    name: 'Secco Sopra',
    displayName: '📦 Secco Sopra',
    color: '#7c3aed',
    order: 2
  },
  {
    id: 'pingu',
    name: 'Pingu',
    displayName: '🐧 Pingu',
    color: '#f59e0b',
    order: 3
  },
  {
    id: 'frigo',
    name: 'Frigo',
    displayName: '❄️ Frigo',
    color: '#06b6d4',
    order: 4
  }
];

// Configurazione default
export const DEFAULT_CONFIG: PickingConfig = {
  QR_VERIFICATION: false,
  COLLAPSE_ON_COMPLETE: true,
  AUTO_NEXT: true,
  AUDIO_FEEDBACK: true,
  VIBRATION_FEEDBACK: true
};

// Helper functions
export function isOperationComplete(op: Operation): boolean {
  return op.qty_done >= op.quantity;
}

export function getZoneFromLocation(locationName: string): Zone | null {
  const lowerName = locationName.toLowerCase();

  for (const zone of ZONES) {
    if (zone.id === 'secco_sopra' && lowerName.includes('secco') && lowerName.includes('sopra')) {
      return zone;
    }
    if (zone.id === 'secco' && lowerName.includes('secco') && !lowerName.includes('sopra')) {
      return zone;
    }
    if (lowerName.includes(zone.id)) {
      return zone;
    }
  }

  return null;
}

export function calculateCompletionPercentage(operations: Operation[]): number {
  if (operations.length === 0) return 0;

  const completed = operations.filter(op => isOperationComplete(op)).length;
  return Math.round((completed / operations.length) * 100);
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}