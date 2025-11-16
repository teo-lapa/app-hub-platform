// Types per sistema Controllo Prezzi (ispirato da review-prices di Catalogo Venditori)

export interface PriceCheckProduct {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string; // base64 from Odoo image_128

  // Prezzo venduto
  soldPrice: number; // Prezzo effettivamente venduto
  discount: number; // Sconto applicato (%)

  // Prezzi di riferimento
  costPrice: number; // Prezzo d'acquisto (Punto Critico base)
  criticalPrice: number; // Punto Critico = costPrice * 1.4
  avgSellingPrice: number; // Prezzo medio vendita ultimi 3 mesi
  listPrice: number; // Prezzo listino base

  // Info ordine
  orderId: number;
  orderName: string;
  orderDate: string; // YYYY-MM-DD
  customerId: number;
  customerName: string;
  quantity: number;
  uom: string;
  lineId: number; // ID riga ordine (sale.order.line) per modifiche

  // Status controllo
  status: 'pending' | 'reviewed' | 'blocked';
  reviewedBy?: string; // Email chi ha controllato
  reviewedAt?: string; // ISO timestamp
  blockedBy?: string; // Email chi ha bloccato
  blockedAt?: string; // ISO timestamp
  note?: string; // Nota del venditore

  // Categoria prezzo
  priceCategory: 'below_critical' | 'critical_to_avg' | 'above_avg';

  // Prezzo bloccato nel listino cliente
  isLocked: boolean; // true = prezzo fisso nel listino cliente (da NON mostrare in dashboard)
}

export interface PriceCategory {
  id: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all';
  name: string;
  icon: string;
  description: string;
  gradient: string;
  count: number;
}

export interface PriceSummary {
  total: number;
  totalRevenue: number;
  byCategory: {
    below_critical: number;
    critical_to_avg: number;
    above_avg: number;
  };
  byStatus: {
    pending: number;
    reviewed: number;
    blocked: number;
  };
}

// Request/Response types per API

export interface GetPriceChecksRequest {
  category?: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all';
  status?: 'pending' | 'reviewed' | 'blocked';
  days?: number; // Ultimi N giorni (default 7)
  limit?: number;
}

export interface GetPriceChecksResponse {
  success: boolean;
  products: PriceCheckProduct[];
  summary: PriceSummary;
  error?: string;
}

export interface GetPriceCheckCountsResponse {
  success: boolean;
  counts: {
    byCategory: {
      below_critical: number;
      critical_to_avg: number;
      above_avg: number;
      blocked: number;
      all: number;
    };
  };
  error?: string;
}

export interface MarkAsReviewedRequest {
  productId: number;
  orderId: number;
  reviewedBy: string;
  note?: string;
}

export interface MarkAsReviewedResponse {
  success: boolean;
  error?: string;
}

export interface BlockPriceRequest {
  productId: number;
  orderId: number;
  blockedBy: string;
  note?: string;
}

export interface BlockPriceResponse {
  success: boolean;
  error?: string;
}

export interface UnblockPriceRequest {
  productId: number;
  orderId: number;
}

export interface UnblockPriceResponse {
  success: boolean;
  error?: string;
}
