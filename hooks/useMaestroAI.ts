import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { CustomerAvatar } from '@/lib/maestro/types';

// Types
export interface Customer {
  id: number;
  name: string;
  city?: string;
  health_score: number;
  churn_risk: number;
  avg_order_value?: number;
  last_order_days?: number;
  recommendation?: string;
  suggested_products?: string[];
  priority?: 'urgent' | 'high' | 'medium' | 'low';
}

export interface AvatarsResponse {
  avatars: CustomerAvatar[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface RouteStop {
  customer: string;
  city: string;
  time: string;
  distance: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
}

export interface DailyPlan {
  salesperson: {
    id: number;
    name: string;
    todayStats: {
      plannedVisits: number;
      completedVisits: number;
      targetRevenue: number;
    };
  };
  urgent: Customer[];
  opportunities: Customer[];
  followUps: Customer[];
  routeOptimization: RouteStop[];
}

export interface Interaction {
  customer_id: number;
  interaction_type: 'visit' | 'call' | 'email';
  outcome: 'positive' | 'neutral' | 'negative';
  samples_given?: string[];
  sample_feedback?: 'good' | 'bad' | 'indifferent';
  order_generated?: boolean;
  notes?: string;
}

// API functions
const api = {
  getDailyPlan: async (salespersonId: number): Promise<DailyPlan> => {
    const response = await fetch(`/api/maestro/daily-plan?salesperson_id=${salespersonId}`);
    if (!response.ok) throw new Error('Failed to fetch daily plan');
    return response.json();
  },

  getDashboard: async () => {
    const response = await fetch('/api/maestro/dashboard');
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return response.json();
  },

  getCustomerDetail: async (customerId: number) => {
    const response = await fetch(`/api/maestro/customers/${customerId}`);
    if (!response.ok) throw new Error('Failed to fetch customer detail');
    return response.json();
  },

  getCustomerAvatars: async (params?: {
    salesperson_id?: number;
    health_score_min?: number;
    churn_risk_min?: number;
    limit?: number;
    offset?: number;
    sort_by?: 'health_score' | 'churn_risk_score' | 'total_revenue' | 'last_order_date';
    sort_order?: 'asc' | 'desc';
    period?: 'week' | 'month' | 'quarter' | 'year';
    start_date?: string;
    end_date?: string;
  }): Promise<AvatarsResponse> => {
    const searchParams = new URLSearchParams();

    if (params) {
      // Convert period to start_date/end_date if period is provided
      if (params.period && !params.start_date && !params.end_date) {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        let startDate: string;

        switch (params.period) {
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            break;
          default:
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        searchParams.append('start_date', startDate);
        searchParams.append('end_date', endDate);
        console.log('📅 [useMaestroAI] Period converted to dates:', { period: params.period, startDate, endDate });
      }

      // Add all other params (excluding period as it's already converted)
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && key !== 'period') {
          searchParams.append(key, String(value));
        }
      });
    }

    const url = `/api/maestro/avatars${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    console.log('🔍 [useMaestroAI] Fetching avatars:', url);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch customer avatars');
    return response.json();
  },

  createInteraction: async (interaction: Interaction) => {
    const response = await fetch('/api/maestro/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interaction),
    });
    if (!response.ok) throw new Error('Failed to create interaction');
    return response.json();
  },
};

// Hooks
export function useDailyPlan(salespersonId: number) {
  return useQuery({
    queryKey: ['daily-plan', salespersonId],
    queryFn: () => api.getDailyPlan(salespersonId),
    enabled: !!salespersonId,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: api.getDashboard,
  });
}

export function useCustomerDetail(customerId: number) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.getCustomerDetail(customerId),
    enabled: !!customerId,
  });
}

export function useCustomerAvatars(params?: {
  salesperson_id?: number;
  health_score_min?: number;
  churn_risk_min?: number;
  limit?: number;
  offset?: number;
  sort_by?: 'health_score' | 'churn_risk_score' | 'total_revenue' | 'last_order_date';
  sort_order?: 'asc' | 'desc';
  period?: 'week' | 'month' | 'quarter' | 'year';
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ['customer-avatars', params],
    queryFn: () => api.getCustomerAvatars(params),
  });
}

export function useCreateInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createInteraction,
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      queryClient.invalidateQueries({ queryKey: ['customer-avatars'] });
      toast.success('Interazione registrata con successo!');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });
}

// Advanced analytics hook - FIXED: Uses period-specific data from Odoo instead of lifetime totals
export function useAnalytics(timeRange: 'week' | 'month' | 'quarter' | 'year' = 'quarter', salespersonId?: number) {
  // Fetch period-specific KPIs and trend data from Odoo (NOT lifetime totals)
  // NOW WITH TREND CALCULATIONS (compares current vs previous period)
  const periodKPIsQuery = useQuery({
    queryKey: ['period-analytics-kpis', timeRange, salespersonId],
    queryFn: async () => {
      const params = new URLSearchParams({
        period: timeRange,
        include_trend: 'true',
        calculate_trends: 'true' // Enable trend calculations (current vs previous period)
      });
      if (salespersonId) {
        params.append('salesperson_id', salespersonId.toString());
      }

      const response = await fetch(`/api/maestro/analytics/period?${params}`);
      if (!response.ok) throw new Error('Failed to fetch period analytics');

      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || 'Period analytics failed');

      return {
        metrics: data.metrics, // { revenue, orders, customers, avgOrderValue, revenueTrend, ordersTrend, customersTrend, avgOrderValueTrend }
        trend: data.trend || [] // Array of { date, revenue, orders }
      };
    },
    enabled: true,
    staleTime: 60000 // Cache for 1 minute
  });

  // Still fetch avatars for Top Performers and Urgent Visits (using lifetime data is OK for these)
  const { data: avatarsData } = useCustomerAvatars({
    limit: 1000,
    sort_by: 'total_revenue',
    sort_order: 'desc',
    period: timeRange,
    salesperson_id: salespersonId
  });

  return useQuery({
    queryKey: ['analytics-combined', periodKPIsQuery.data, avatarsData?.avatars, timeRange, salespersonId],
    queryFn: () => {
      console.log('🔄 [useAnalytics] Combined query running:', {
        hasPeriodData: !!periodKPIsQuery.data,
        hasAvatarsData: !!avatarsData?.avatars,
        periodDataStatus: periodKPIsQuery.status,
        avatarsDataLength: avatarsData?.avatars?.length || 0
      });

      const periodData = periodKPIsQuery.data;
      const periodKPIs = periodData?.metrics;
      const trendData = periodData?.trend || [];
      const avatars = avatarsData?.avatars || [];

      console.log('📊 [useAnalytics] Data extracted:', {
        periodKPIsExists: !!periodKPIs,
        trendDataLength: trendData.length,
        avatarsLength: avatars.length
      });

      // Top Performers by Salesperson (uses lifetime data - OK for rankings)
      const salesMap = new Map<number, {
        id: number;
        name: string;
        revenue: number;
        orders: number;
        customers: number;
      }>();

      avatars.forEach(avatar => {
        if (avatar.assigned_salesperson_id && avatar.assigned_salesperson_name) {
          const existing = salesMap.get(avatar.assigned_salesperson_id);
          if (existing) {
            existing.revenue += Number(avatar.total_revenue || 0);
            existing.orders += Number(avatar.total_orders || 0);
            existing.customers += 1;
          } else {
            salesMap.set(avatar.assigned_salesperson_id, {
              id: avatar.assigned_salesperson_id,
              name: avatar.assigned_salesperson_name,
              revenue: Number(avatar.total_revenue || 0),
              orders: Number(avatar.total_orders || 0),
              customers: 1
            });
          }
        }
      });

      // Return ALL performers sorted by revenue (not just top 5)
      const topPerformers = Array.from(salesMap.values())
        .sort((a, b) => b.revenue - a.revenue);

      // ✅ FIXED: Revenue by period chart - use REAL trend data from Odoo
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

      console.log('📊 [useAnalytics] Trend data from API:', {
        timeRange,
        salespersonId,
        trendDataLength: trendData.length,
        trendDataSample: trendData.slice(0, 3)
      });

      const revenueByMonth: Array<{ month: string; revenue: number; orders: number }> = trendData.map((item: { date: string; revenue: number; orders: number }) => {
        const itemDate = new Date(item.date);
        let label: string;

        if (timeRange === 'week' || timeRange === 'month') {
          // For week/month: show day format (DD/MM)
          label = `${itemDate.getDate()}/${itemDate.getMonth() + 1}`;
        } else {
          // For quarter/year: show month name
          label = monthNames[itemDate.getMonth()] || 'N/D';
        }

        return {
          month: label,
          revenue: Math.round(item.revenue),
          orders: item.orders
        };
      });

      console.log('📊 [useAnalytics] Transformed chart data:', {
        revenueByMonthLength: revenueByMonth.length,
        revenueByMonthSample: revenueByMonth.slice(0, 3)
      });

      // Urgent visits: customers with high churn risk
      const urgentVisits = avatars
        .filter(avatar => avatar.churn_risk_score > 70)
        .sort((a, b) => b.churn_risk_score - a.churn_risk_score)
        .slice(0, 4)
        .map(avatar => ({
          customer: avatar.name,
          city: avatar.city || 'N/D',
          salesperson: avatar.assigned_salesperson_name || 'Non assegnato',
          churnRisk: Math.round(avatar.churn_risk_score),
          priority: avatar.churn_risk_score > 85 ? 'urgent' as const : 'high' as const,
          customerId: avatar.id // FIX: Use customer_avatar.id instead of odoo_partner_id
        }));

      // Aggregate Top Products across all customers
      const productMap = new Map<number, {
        product_id: number;
        name: string;
        total_quantity: number;
        total_revenue: number;
        order_count: number;
        customer_count: number;
      }>();

      avatars.forEach(avatar => {
        if (avatar.top_products && Array.isArray(avatar.top_products)) {
          avatar.top_products.forEach((product: any) => {
            const existing = productMap.get(product.product_id);
            if (existing) {
              existing.total_quantity += Number(product.total_quantity || 0);
              existing.total_revenue += Number(product.total_revenue || 0);
              existing.order_count += Number(product.order_count || 0);
              existing.customer_count += 1;
            } else {
              productMap.set(product.product_id, {
                product_id: product.product_id,
                name: product.product_name || product.name || 'Prodotto Sconosciuto',
                total_quantity: Number(product.total_quantity || 0),
                total_revenue: Number(product.total_revenue || 0),
                order_count: Number(product.order_count || 0),
                customer_count: 1
              });
            }
          });
        }
      });

      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Return combined data: period-specific KPIs + avatar-based Top Performers and Urgent Visits
      return {
        // ✅ FIXED: Use period-specific KPIs from Odoo (NOT lifetime totals)
        kpis: periodKPIs || {
          revenue: 0,
          orders: 0,
          customers: 0,
          avgOrderValue: 0
        },
        topPerformers,
        revenueByMonth,
        urgentVisits,
        topProducts
      };
    },
    // ✅ FIX: Only enable when we have either period data OR avatars data
    // This allows the query to run and provide at least some data to the dashboard
    enabled: (!!periodKPIsQuery.data && !periodKPIsQuery.isLoading) || (!!avatarsData?.avatars && avatarsData.avatars.length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}
