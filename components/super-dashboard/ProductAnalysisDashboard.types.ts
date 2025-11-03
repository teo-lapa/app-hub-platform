// Type definitions for ProductAnalysisDashboard component

export interface ProductInfo {
  id: string;
  name: string;
  code: string;
  category: string;
}

export interface PeriodInfo {
  start: string; // ISO date string 'YYYY-MM-DD'
  end: string; // ISO date string 'YYYY-MM-DD'
  label: string; // Human readable label 'Ottobre 2024'
}

export interface KPIMetrics {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  marginPercent: number;
  quantitySold: number;
  currentStock: number;
}

export interface TrendMetrics {
  revenueChange: number; // Percentage change (12.5 = +12.5%)
  profitChange: number; // Percentage change
  marginChange: number; // Percentage change
}

export interface SalesVsPurchasesDataPoint {
  date: string; // 'DD/MM' or 'YYYY-MM-DD'
  sales: number; // Sales value in CHF
  purchases: number; // Purchase value in CHF
}

export interface TopCustomer {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface CustomerDistribution {
  customer: string;
  value: number;
  percentage: number;
}

export interface Supplier {
  id: string;
  name: string;
  price: number;
  leadTime: number; // Days
  isPreferred: boolean;
}

export interface InventoryLocation {
  location: string;
  quantity: number;
}

export interface InventoryInfo {
  currentStock: number;
  locations: InventoryLocation[];
  incoming: number;
  outgoing: number;
  reorderPoint: number;
  safetyStock: number;
}

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Recommendations {
  reorderNeeded: boolean;
  action: string;
  reason: string;
  priority: RecommendationPriority;
}

export interface ProductData {
  product: ProductInfo;
  period: PeriodInfo;
  kpis: KPIMetrics;
  trends: TrendMetrics;
  salesVsPurchases: SalesVsPurchasesDataPoint[];
  topCustomers: TopCustomer[];
  customerDistribution: CustomerDistribution[];
  suppliers: Supplier[];
  inventory: InventoryInfo;
  recommendations: Recommendations;
}

export interface ProductAnalysisDashboardProps {
  data: ProductData | null;
  isLoading: boolean;
  error: string | null;
}

// API Response types
export interface ProductAnalysisAPIResponse {
  success: boolean;
  data?: ProductData;
  error?: string;
  timestamp?: string;
}

// Utility type for partial updates
export type PartialProductData = Partial<ProductData>;

// Example: Mock data generator helper type
export interface MockDataOptions {
  productId?: string;
  productName?: string;
  periodStart?: string;
  periodEnd?: string;
  generateCriticalScenario?: boolean;
  generateOptimalScenario?: boolean;
}

// Helper type for chart data
export interface ChartTooltipPayload {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}

// Color scheme types
export type GradientColor =
  | 'from-emerald-500 to-teal-600'
  | 'from-orange-500 to-red-600'
  | 'from-purple-500 to-pink-600'
  | 'from-blue-500 to-cyan-600'
  | 'from-violet-500 to-purple-600'
  | 'from-amber-500 to-orange-600';

export type PriorityColor = {
  bg: string;
  text: string;
  border: string;
  icon: string;
};

export const PRIORITY_COLORS: Record<RecommendationPriority, PriorityColor> = {
  low: {
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    border: 'border-green-500',
    icon: 'text-green-400',
  },
  medium: {
    bg: 'bg-yellow-900/30',
    text: 'text-yellow-400',
    border: 'border-yellow-500',
    icon: 'text-yellow-400',
  },
  high: {
    bg: 'bg-orange-900/30',
    text: 'text-orange-400',
    border: 'border-orange-500',
    icon: 'text-orange-400',
  },
  critical: {
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-500',
    icon: 'text-red-400',
  },
};

// Chart colors constant
export const CHART_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

// Validation helper types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Type guard functions
export function isValidProductData(data: any): data is ProductData {
  return (
    data &&
    typeof data === 'object' &&
    data.product &&
    data.period &&
    data.kpis &&
    data.trends &&
    Array.isArray(data.salesVsPurchases) &&
    Array.isArray(data.topCustomers) &&
    Array.isArray(data.customerDistribution) &&
    Array.isArray(data.suppliers) &&
    data.inventory &&
    data.recommendations
  );
}

export function isValidAPIResponse(response: any): response is ProductAnalysisAPIResponse {
  return (
    response &&
    typeof response === 'object' &&
    typeof response.success === 'boolean' &&
    (response.success === false || isValidProductData(response.data))
  );
}

// Export all types as a namespace
export namespace ProductAnalysisTypes {
  export type Props = ProductAnalysisDashboardProps;
  export type Data = ProductData;
  export type APIResponse = ProductAnalysisAPIResponse;
  export type Priority = RecommendationPriority;
  export type Gradient = GradientColor;
}
