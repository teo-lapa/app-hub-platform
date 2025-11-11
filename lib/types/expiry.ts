// Types per sistema controllo scadenze prodotti

export interface ExpiryProduct {
  id: number;
  name: string;
  code: string;
  barcode: string;
  image?: string; // base64 from Odoo image_128
  quantity: number;
  uom: string;

  // Lotto e scadenza
  lotId?: number;
  lotName?: string;
  expirationDate: string; // YYYY-MM-DD
  daysUntilExpiry: number; // Negativo se scaduto

  // Ubicazione
  locationId: number;
  locationName: string; // es. "FR02-A-01-002"
  locationCompleteName: string; // es. "Frigo/Scaffale A/Livello 1/FR02"
  zoneId?: string; // 'frigo' | 'secco' | 'pingu' | 'secco-sopra'

  // Urgenza calcolata
  urgencyLevel: 'expired' | 'expiring' | 'ok';

  // Valore stimato (opzionale)
  estimatedValue?: number;
}

export interface ExpiryZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  bufferId: number;
  bufferName: string;
  gradient: string;
  count: number;
}

export interface UrgencyCategory {
  id: 'expired' | 'expiring' | 'ok' | 'all' | 'no-movement-30' | 'no-movement-90';
  name: string;
  icon: string;
  description: string;
  gradient: string;
  count: number;
  daysThreshold?: number; // Per 'expiring'
}

export interface ExpirySummary {
  total: number;
  totalValue: number;
  byUrgency: {
    expired: number;
    expiring: number;
    ok: number;
  };
  byZone?: {
    [zoneId: string]: number;
  };
}

export interface ExpiryReview {
  id: number;
  productId: number;
  lotId: number;
  locationId: number;
  reviewedAt: Date;
  reviewedBy: string;
  note?: string;
}

// Request/Response types per API

export interface GetExpiryProductsRequest {
  urgency?: 'expired' | 'expiring' | 'ok' | 'all' | 'no-movement-30' | 'no-movement-90';
  zone?: string;
  days?: number; // Default 7
  limit?: number;
}

export interface GetExpiryProductsResponse {
  success: boolean;
  products: ExpiryProduct[];
  summary: ExpirySummary;
  error?: string;
}

export interface GetExpiryCountsResponse {
  success: boolean;
  counts: {
    byUrgency: {
      expired: number;
      expiring: number;
      ok: number;
      all: number;
      'no-movement-30': number;
      'no-movement-90': number;
    };
    byZone: {
      [zoneId: string]: number;
    };
  };
  error?: string;
}

export interface TransferToWasteRequest {
  productId: number;
  lotId: number;
  sourceLocationId: number;
  destLocationId?: number; // Location "Scarti" (opzionale, default 648 in route)
  quantity: number;
  reason?: string; // Motivo del trasferimento (opzionale)
}

export interface TransferToWasteResponse {
  success: boolean;
  pickingId?: number;
  moveId?: number;
  error?: string;
}

export interface MarkAsReviewedRequest {
  productId: number;
  lotId: number;
  locationId: number;
  reviewedBy: string;
  note?: string;
}

export interface MarkAsReviewedResponse {
  success: boolean;
  reviewId?: number;
  error?: string;
}

// ========== URGENT PRODUCTS SYSTEM ==========

export interface UrgentProduct {
  id: string; // Unique ID: {productId}:{lotId}:{timestamp}
  productId: number;
  productName: string;
  productCode?: string;
  productBarcode?: string;
  image?: string; // base64 image
  lotId: number;
  lotName: string;
  quantity: number;
  uom: string;
  expirationDate: string; // YYYY-MM-DD
  daysUntilExpiry: number;
  urgencyLevel: 'expired' | 'expiring';
  locationId: number;
  locationName: string;
  zoneId?: string;
  note: string; // Nota dell'operatore magazzino
  addedBy: string; // Email operatore
  addedAt: string; // ISO timestamp
  estimatedValue?: number;
  suggestedPrice?: number; // Prezzo suggerito vendita
}

export interface AddUrgentProductRequest {
  productId: number;
  productName: string;
  productCode?: string;
  productBarcode?: string;
  image?: string;
  lotId: number;
  lotName: string;
  quantity: number;
  uom: string;
  expirationDate: string;
  daysUntilExpiry: number;
  urgencyLevel: 'expired' | 'expiring';
  locationId: number;
  locationName: string;
  zoneId?: string;
  note: string;
  addedBy: string;
  estimatedValue?: number;
  suggestedPrice?: number;
}

export interface AddUrgentProductResponse {
  success: boolean;
  urgentProduct?: UrgentProduct;
  error?: string;
}

export interface GetUrgentProductsResponse {
  success: boolean;
  products: UrgentProduct[];
  count: number;
  error?: string;
}

export interface RemoveUrgentProductRequest {
  id: string; // ID del prodotto urgente
}

export interface RemoveUrgentProductResponse {
  success: boolean;
  error?: string;
}
