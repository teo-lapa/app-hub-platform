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
  }): Promise<AvatarsResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }
    const url = `/api/maestro/avatars${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
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

// Advanced analytics hook - aggregates data from customer_avatars
export function useAnalytics(timeRange: 'week' | 'month' | 'quarter' | 'year' = 'quarter') {
  const { data: avatarsData, isLoading, error } = useCustomerAvatars({
    limit: 1000, // Get all customers for accurate analytics
    sort_by: 'total_revenue',
    sort_order: 'desc',
    period: timeRange
  });

  return useQuery({
    queryKey: ['analytics', avatarsData?.avatars, timeRange],
    queryFn: () => {
      if (!avatarsData?.avatars) {
        throw new Error('No avatar data available');
      }

      const avatars = avatarsData.avatars;

      // Top Performers by Salesperson
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

      // Revenue aggregation based on time range
      const now = new Date();
      let startDate: Date;
      let periodCount: number;
      let groupBy: 'day' | 'week' | 'month';

      if (timeRange === 'week') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodCount = 7;
        groupBy = 'day';
      } else if (timeRange === 'month') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        periodCount = 30;
        groupBy = 'day';
      } else if (timeRange === 'quarter') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        periodCount = 3;
        groupBy = 'month';
      } else { // year
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        periodCount = 12;
        groupBy = 'month';
      }

      const periodMap = new Map<string, { revenue: number; orders: number }>();

      avatars.forEach(avatar => {
        if (avatar.last_order_date) {
          const orderDate = new Date(avatar.last_order_date);
          if (orderDate >= startDate) {
            let periodKey: string;

            if (groupBy === 'day') {
              periodKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
            } else if (groupBy === 'week') {
              const weekStart = new Date(orderDate);
              weekStart.setDate(orderDate.getDate() - orderDate.getDay());
              periodKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate()) / 7)}`;
            } else { // month
              periodKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            }

            const existing = periodMap.get(periodKey);
            if (existing) {
              existing.revenue += Number(avatar.total_revenue || 0);
              existing.orders += Number(avatar.total_orders || 0);
            } else {
              periodMap.set(periodKey, {
                revenue: Number(avatar.total_revenue || 0),
                orders: Number(avatar.total_orders || 0)
              });
            }
          }
        }
      });

      // Generate chart data with proper labels
      const revenueByMonth: Array<{ month: string; revenue: number; orders: number }> = [];
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

      if (timeRange === 'week') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const data = periodMap.get(periodKey) || { revenue: 0, orders: 0 };
          revenueByMonth.push({
            month: `${dayNames[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`,
            revenue: Math.round(data.revenue),
            orders: data.orders
          });
        }
      } else if (timeRange === 'month') {
        // Last 30 days (grouped by day)
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const data = periodMap.get(periodKey) || { revenue: 0, orders: 0 };
          revenueByMonth.push({
            month: `${date.getDate()}/${date.getMonth() + 1}`,
            revenue: Math.round(data.revenue),
            orders: data.orders
          });
        }
      } else if (timeRange === 'quarter') {
        // Last 3 months
        for (let i = 2; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const data = periodMap.get(periodKey) || { revenue: 0, orders: 0 };
          revenueByMonth.push({
            month: monthNames[date.getMonth()] || 'N/D',
            revenue: Math.round(data.revenue),
            orders: data.orders
          });
        }
      } else { // year
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const data = periodMap.get(periodKey) || { revenue: 0, orders: 0 };
          revenueByMonth.push({
            month: monthNames[date.getMonth()] || 'N/D',
            revenue: Math.round(data.revenue),
            orders: data.orders
          });
        }
      }

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
          customerId: avatar.odoo_partner_id
        }));

      return {
        topPerformers,
        revenueByMonth,
        urgentVisits
      };
    },
    enabled: !!avatarsData?.avatars && avatarsData.avatars.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });
}
