export interface OrderLine {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  uom: string;

  // Current prices (from order line)
  currentPriceUnit: number;
  currentDiscount: number;
  currentSubtotal: number;
  currentTotal: number;

  // Standard prices (for comparison)
  standardPrice: number;
  costPrice: number;
  avgSellingPrice: number; // 3-month average selling price from actual sales

  // Product info
  imageUrl: string | null;
  qtyAvailable: number;

  // Editable status
  isLocked: boolean;

  // Tax info
  taxIds: number[];
}

export interface PricelistInfo {
  id: number;
  name: string;
  currency: string;
  discountPolicy: string;
}

export interface OrderTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export interface OrderData {
  id: number;
  name: string;
  state: string;
  customerId: number;
  customerName: string;
  deliveryDate: string | null;
  notes: string;
  pricelist: PricelistInfo | null;
  lines: OrderLine[];
  totals: OrderTotals;
}

export interface PriceUpdate {
  lineId: number;
  priceUnit?: number;
  discount?: number;
}
