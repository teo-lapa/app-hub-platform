// Customer Types
export interface Customer {
  id: number;
  name: string;
  ref: string;
  city: string;
  phone: string;
}

export interface DeliveryAddress {
  id: number;
  address: string;
  city: string;
  cap: string;
}

// Product Types
export interface MatchedProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  confidence: string;
  reasoning: string;
}

export interface CartProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number;
}

// Order Types
export interface OrderData {
  customerId: number;
  customerName: string;
  addressId: number | null;
  products: CartProduct[];
  notes: string;
  totalAmount?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CustomersApiResponse {
  customers: Customer[];
}

export interface AddressesApiResponse {
  addresses: DeliveryAddress[];
}

export interface AIMatchApiResponse {
  products: MatchedProduct[];
  confidence: string;
  message?: string;
}

export interface CreateOrderApiResponse {
  orderId: number;
  message: string;
}
