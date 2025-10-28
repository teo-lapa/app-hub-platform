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
  id: 'expired' | 'expiring' | 'ok' | 'all';
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
  urgency?: 'expired' | 'expiring' | 'ok' | 'all';
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
