/**
 * PRODUCTS AGENT - Type Definitions
 *
 * Definizioni TypeScript condivise per il Products Agent
 * Separa i tipi per facilitare l'importazione senza dipendenze circolari
 */

// ============= CORE TYPES =============

export interface Product {
  id: number;
  name: string;
  default_code?: string;  // SKU/Codice prodotto
  barcode?: string;
  categ_id: [number, string];  // [id, nome categoria]
  list_price: number;  // Prezzo listino
  standard_price: number;  // Costo
  type: 'product' | 'consu' | 'service';
  description?: string;
  description_sale?: string;
  uom_id: [number, string];  // Unità di misura
  image_1920?: string;  // Immagine base64
  active: boolean;
}

export interface ProductAvailability {
  productId: number;
  productName: string;
  qty_available: number;  // Quantità disponibile
  virtual_available: number;  // Quantità prevista (considerando ordini in arrivo)
  outgoing_qty: number;  // Quantità in uscita (ordini da evadere)
  incoming_qty: number;  // Quantità in arrivo (ordini da fornitori)
  free_qty: number;  // Quantità libera (disponibile - impegnata)
  warehouse?: string;
  locations?: LocationStock[];
}

export interface LocationStock {
  locationId: number;
  locationName: string;
  quantity: number;
}

export interface ProductPrice {
  productId: number;
  productName: string;
  customerType: 'B2B' | 'B2C';
  basePrice: number;
  discountPercent?: number;
  finalPrice: number;
  currency: string;
  pricelistName?: string;
  taxIncluded: boolean;
  minQuantity?: number;
}

export interface SimilarProduct {
  product: Product;
  similarityScore: number;  // 0-100
  reason: string;  // Perché è simile
}

export interface Promotion {
  id: number;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  product_ids?: number[];
  category_ids?: number[];
  min_quantity?: number;
  active: boolean;
}

// ============= REQUEST/RESPONSE TYPES =============

export interface SearchFilters {
  query?: string;
  category_id?: number;
  barcode?: string;
  default_code?: string;  // SKU
  min_price?: number;
  max_price?: number;
  available_only?: boolean;
  active_only?: boolean;
}

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  timestamp: Date;
  language: 'it' | 'en' | 'fr' | 'de';
}

// ============= ODOO INTEGRATION TYPES =============

/**
 * Rappresenta un prodotto come ritornato da Odoo via XML-RPC
 */
export interface OdooProduct {
  id: number;
  name: string;
  default_code: string | false;
  barcode: string | false;
  categ_id: [number, string] | false;
  list_price: number;
  standard_price: number;
  type: string;
  description: string | false;
  description_sale: string | false;
  uom_id: [number, string] | false;
  image_1920: string | false;
  active: boolean;
  qty_available?: number;
  virtual_available?: number;
  outgoing_qty?: number;
  incoming_qty?: number;
  free_qty?: number;
}

/**
 * Rappresenta un quant (stock in ubicazione) come ritornato da Odoo
 */
export interface OdooQuant {
  id: number;
  product_id: [number, string];
  location_id: [number, string];
  quantity: number;
  reserved_quantity: number;
}

/**
 * Rappresenta un listino prezzi Odoo
 */
export interface OdooPricelist {
  id: number;
  name: string;
  currency_id: [number, string];
  active: boolean;
  discount_policy?: string;
  item_ids?: number[];
}

/**
 * Rappresenta una categoria prodotto Odoo
 */
export interface OdooProductCategory {
  id: number;
  name: string;
  complete_name: string;
  parent_id: [number, string] | false;
  child_id: number[];
}

// ============= UTILITY TYPES =============

/**
 * Opzioni per la ricerca prodotti
 */
export interface ProductSearchOptions {
  filters: SearchFilters;
  limit?: number;
  offset?: number;
  order?: string;
  language?: 'it' | 'en' | 'fr' | 'de';
}

/**
 * Risultato paginato per ricerche multiple
 */
export interface PaginatedResponse<T> extends AgentResponse<T[]> {
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Dettagli completi prodotto (include disponibilità, prezzo, promozioni)
 */
export interface ProductDetails {
  product: Product;
  availability: ProductAvailability;
  priceB2C: ProductPrice;
  priceB2B: ProductPrice;
  promotions: Promotion[];
  similar: SimilarProduct[];
}

/**
 * Statistiche prodotto (per analytics)
 */
export interface ProductStats {
  productId: number;
  viewCount: number;
  purchaseCount: number;
  averageRating?: number;
  lastPurchaseDate?: Date;
  popularityScore: number;  // 0-100
}

// ============= CONSTANTS =============

/**
 * Tipi di prodotto Odoo
 */
export const PRODUCT_TYPES = {
  PRODUCT: 'product',      // Prodotto stoccabile
  CONSU: 'consu',          // Consumabile (non stoccato)
  SERVICE: 'service',      // Servizio
} as const;

/**
 * Stati stock
 */
export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  ON_ORDER: 'on_order',
} as const;

export type StockStatus = typeof STOCK_STATUS[keyof typeof STOCK_STATUS];

/**
 * Tipi di sconto
 */
export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
} as const;

export type DiscountType = typeof DISCOUNT_TYPE[keyof typeof DISCOUNT_TYPE];

// ============= HELPER TYPES =============

/**
 * Extract type dal response per evitare ripetizioni
 */
export type ProductsSearchResult = AgentResponse<Product[]>;
export type ProductDetailsResult = AgentResponse<Product>;
export type AvailabilityResult = AgentResponse<ProductAvailability>;
export type PriceResult = AgentResponse<ProductPrice>;
export type SimilarProductsResult = AgentResponse<SimilarProduct[]>;
export type PromotionsResult = AgentResponse<Promotion[]>;
