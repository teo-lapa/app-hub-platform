/**
 * HOOKS - React Hooks per l'API Margini
 *
 * Custom hooks per facilitare l'utilizzo dell'API /api/margini
 * nei componenti React/Next.js
 */

import { useState, useEffect, useCallback } from 'react';

// ========================================================================
// TYPES
// ========================================================================

export interface MarginiSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  orderCount: number;
  productCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface Product {
  id: number;
  name: string;
  defaultCode: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  avgSalePrice: number;
  avgCostPrice: number;
}

export interface GiftProduct {
  id: number;
  name: string;
  defaultCode: string;
  quantity: number;
  cost: number;
  date: string;
  orderName: string;
}

export interface GiftByCustomer {
  customerId: number;
  customerName: string;
  products: GiftProduct[];
  totalCost: number;
}

export interface Trend {
  date: string;
  revenue: number;
  margin: number;
  cost: number;
  orders: number;
}

export interface MarginiResponse {
  summary: MarginiSummary;
  topProducts: Product[];
  lossProducts: Product[];
  giftsGiven: {
    totalCost: number;
    productCount: number;
    products: GiftProduct[];
    byCustomer: GiftByCustomer[];
  };
  trends: Trend[];
  groupedData?: {
    groupBy: string;
    groups: Array<{
      name: string;
      revenue: number;
      cost: number;
      margin: number;
      marginPercentage: number;
      productCount: number;
    }>;
  };
}

export interface MarginiFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: 'product' | 'category' | 'customer';
}

// ========================================================================
// MAIN HOOK
// ========================================================================

/**
 * Hook principale per recuperare i dati margini
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useMargini({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * });
 * ```
 */
export function useMargini(filters?: MarginiFilters) {
  const [data, setData] = useState<MarginiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMargini = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters?.groupBy) {
        params.append('groupBy', filters.groupBy);
      }

      const url = `/api/margini${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching margini:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.startDate, filters?.endDate, filters?.groupBy]);

  useEffect(() => {
    fetchMargini();
  }, [fetchMargini]);

  return {
    data,
    loading,
    error,
    refetch: fetchMargini
  };
}

// ========================================================================
// SPECIALIZED HOOKS
// ========================================================================

/**
 * Hook per ottenere solo il summary dei margini
 *
 * @example
 * ```tsx
 * const { summary, loading } = useMarginiSummary({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * });
 * ```
 */
export function useMarginiSummary(filters?: MarginiFilters) {
  const { data, loading, error, refetch } = useMargini(filters);

  return {
    summary: data?.summary || null,
    loading,
    error,
    refetch
  };
}

/**
 * Hook per ottenere i top prodotti
 *
 * @example
 * ```tsx
 * const { topProducts, loading } = useTopProducts({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * }, 5); // Top 5 prodotti
 * ```
 */
export function useTopProducts(filters?: MarginiFilters, limit?: number) {
  const { data, loading, error, refetch } = useMargini(filters);

  const topProducts = data?.topProducts
    ? limit
      ? data.topProducts.slice(0, limit)
      : data.topProducts
    : [];

  return {
    topProducts,
    loading,
    error,
    refetch
  };
}

/**
 * Hook per ottenere i prodotti in perdita
 *
 * @example
 * ```tsx
 * const { lossProducts, totalLoss, loading } = useLossProducts({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * });
 * ```
 */
export function useLossProducts(filters?: MarginiFilters) {
  const { data, loading, error, refetch } = useMargini(filters);

  const lossProducts = data?.lossProducts || [];
  const totalLoss = lossProducts.reduce((sum, p) => sum + p.totalMargin, 0);

  return {
    lossProducts,
    totalLoss,
    count: lossProducts.length,
    loading,
    error,
    refetch
  };
}

/**
 * Hook per ottenere i prodotti regalati
 *
 * @example
 * ```tsx
 * const { gifts, byCustomer, totalCost, loading } = useGiftsGiven({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * });
 * ```
 */
export function useGiftsGiven(filters?: MarginiFilters) {
  const { data, loading, error, refetch } = useMargini(filters);

  const giftsGiven = data?.giftsGiven || {
    totalCost: 0,
    productCount: 0,
    products: [],
    byCustomer: []
  };

  return {
    gifts: giftsGiven.products,
    byCustomer: giftsGiven.byCustomer,
    totalCost: giftsGiven.totalCost,
    productCount: giftsGiven.productCount,
    loading,
    error,
    refetch
  };
}

/**
 * Hook per ottenere i trend giornalieri
 *
 * @example
 * ```tsx
 * const { trends, loading } = useTrends({
 *   startDate: '2025-10-01',
 *   endDate: '2025-10-31'
 * });
 * ```
 */
export function useTrends(filters?: MarginiFilters) {
  const { data, loading, error, refetch } = useMargini(filters);

  const trends = data?.trends || [];

  // Calcola statistiche sui trend
  const avgDailyRevenue =
    trends.length > 0
      ? trends.reduce((sum, t) => sum + t.revenue, 0) / trends.length
      : 0;

  const avgDailyMargin =
    trends.length > 0
      ? trends.reduce((sum, t) => sum + t.margin, 0) / trends.length
      : 0;

  const avgDailyOrders =
    trends.length > 0
      ? trends.reduce((sum, t) => sum + t.orders, 0) / trends.length
      : 0;

  return {
    trends,
    avgDailyRevenue,
    avgDailyMargin,
    avgDailyOrders,
    loading,
    error,
    refetch
  };
}

/**
 * Hook per confrontare due periodi
 *
 * @example
 * ```tsx
 * const comparison = useMarginiComparison(
 *   { startDate: '2025-10-01', endDate: '2025-10-31' },
 *   { startDate: '2025-09-01', endDate: '2025-09-30' }
 * );
 * ```
 */
export function useMarginiComparison(
  currentPeriod: MarginiFilters,
  previousPeriod: MarginiFilters
) {
  const current = useMargini(currentPeriod);
  const previous = useMargini(previousPeriod);

  const loading = current.loading || previous.loading;
  const error = current.error || previous.error;

  // Calcola variazioni percentuali
  const revenueChange =
    current.data && previous.data
      ? calculatePercentageChange(
          previous.data.summary.totalRevenue,
          current.data.summary.totalRevenue
        )
      : 0;

  const marginChange =
    current.data && previous.data
      ? calculatePercentageChange(
          previous.data.summary.totalMargin,
          current.data.summary.totalMargin
        )
      : 0;

  const ordersChange =
    current.data && previous.data
      ? calculatePercentageChange(
          previous.data.summary.orderCount,
          current.data.summary.orderCount
        )
      : 0;

  return {
    current: current.data,
    previous: previous.data,
    comparison: {
      revenueChange,
      marginChange,
      ordersChange
    },
    loading,
    error,
    refetch: () => {
      current.refetch();
      previous.refetch();
    }
  };
}

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Genera un range di date predefinito
 */
export function getDateRange(
  range:
    | 'today'
    | 'yesterday'
    | 'last7days'
    | 'last30days'
    | 'thisMonth'
    | 'lastMonth'
    | 'thisYear'
): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  switch (range) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }

    case 'last7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDate: formatDate(weekAgo), endDate: formatDate(today) };
    }

    case 'last30days': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { startDate: formatDate(monthAgo), endDate: formatDate(today) };
    }

    case 'thisMonth': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(firstDay), endDate: formatDate(today) };
    }

    case 'lastMonth': {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(firstDayLastMonth),
        endDate: formatDate(lastDayLastMonth)
      };
    }

    case 'thisYear': {
      const firstDayYear = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(firstDayYear), endDate: formatDate(today) };
    }
  }
}

/**
 * Formatta un numero come valuta EUR
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

/**
 * Formatta una percentuale
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}
