/**
 * Shopping Cart Types
 * Complete type system for customer cart functionality
 */

import { OdooProduct } from './maestro';

/**
 * Product representation in cart
 */
export interface CartProduct {
  id: number;
  name: string;
  default_code: string | false;
  price: number; // list_price from Odoo
  image_url?: string | null;
  category: string;
  stock_available: number;
  uom: string;
}

/**
 * Single item in cart
 */
export interface CartItem {
  product: CartProduct;
  quantity: number;
  price_per_unit: number; // Price at time of adding to cart
  subtotal: number; // quantity * price_per_unit
  notes?: string; // Optional customer notes
  added_at: Date;
}

/**
 * Cart store state and actions
 */
export interface CartStore {
  // State
  items: CartItem[];
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  addItem: (product: CartProduct, quantity: number, notes?: string) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateNotes: (productId: number, notes: string) => void;
  clearCart: () => void;

  // Computed getters
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemCount: (productId: number) => number;
  isInCart: (productId: number) => boolean;

  // Hydration status
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

/**
 * Cart summary for checkout
 */
export interface CartSummary {
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  itemCount: number;
  uniqueProducts: number;
}

/**
 * API payload for creating order from cart
 */
export interface CreateOrderFromCartRequest {
  customer_id: number;
  items: {
    product_id: number;
    quantity: number;
    price_unit: number;
    notes?: string;
  }[];
  notes?: string;
  delivery_date?: string;
}
