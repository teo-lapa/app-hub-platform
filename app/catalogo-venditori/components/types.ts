/**
 * Shared TypeScript types for Catalogo Venditori components
 */

// Product matched by AI from customer message
export interface MatchedProduct {
  richiesta_originale: string;  // Original text from message
  quantita: number;              // Quantity requested
  product_id: number | null;     // Odoo product ID (null if not found)
  product_name: string | null;   // Product name (null if not found)
  confidence: 'ALTA' | 'MEDIA' | 'BASSA' | 'NON_TROVATO';
  reasoning: string;             // AI explanation for the match
  image_url?: string | null;     // Product image URL (from Odoo)
  qty_available?: number;        // Stock quantity available
  uom_name?: string;             // Unit of measure
  incoming_qty?: number;         // Incoming quantity
  incoming_date?: string | null; // Expected arrival date for incoming stock
}

// Product in shopping cart
export interface CartProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number;                // Optional price from Odoo
  confidence?: string;           // Optional confidence from AI matching
  reasoning?: string;            // Optional AI reasoning
  image_url?: string | null;     // Product image URL (from Odoo)
  qty_available?: number;        // Stock quantity available
  uom_name?: string;             // Unit of measure (es: "kg", "pz", "lt")
  incoming_qty?: number;         // Incoming quantity (qty in arrivo)
  incoming_date?: string | null; // Expected arrival date for incoming stock
}

// Customer from Odoo
export interface Customer {
  id: number;
  name: string;
  ref?: string | false;
  email?: string | false;
  phone?: string | false;
  street?: string | false;
  city?: string | false;
  zip?: string | false;
  country_id?: [number, string] | false;
}

// Delivery address from Odoo
export interface DeliveryAddress {
  id: number;
  name?: string | false;
  street?: string | false;
  street2?: string | false;
  city?: string | false;
  zip?: string | false;
  country_id?: [number, string] | false;
  phone?: string | false;
}

// API response for AI processing
export interface AIProcessResponse {
  success: boolean;
  matches?: MatchedProduct[];
  customer?: {
    id: number;
    name: string;
    ref?: string;
    email?: string;
    phone?: string;
    city?: string;
  };
  note?: string;
  stats?: {
    total_matches: number;
    found_matches: number;
    not_found: number;
    confidence_breakdown: {
      alta: number;
      media: number;
      bassa: number;
      non_trovato: number;
    };
    processing_time_ms: number;
  };
  error?: string;
  errorType?: string;
}

// API response for order creation
export interface CreateOrderResponse {
  success: boolean;
  message?: string;
  orderId?: number;
  orderName?: string;
  total?: number;
  itemsCount?: number;
  error?: string;
  details?: string;
}
