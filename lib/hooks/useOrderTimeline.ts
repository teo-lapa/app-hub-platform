'use client';

import { useQuery } from '@tanstack/react-query';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';

interface TodayResponse {
  suppliers: CadenceWithMetadata[];
  count: number;
  summary: {
    overdue: number;
    today: number;
  };
}

interface UpcomingResponse {
  suppliers: CadenceWithMetadata[];
  count: number;
  filters: {
    days: number;
    date_from: string;
    date_to: string;
  };
}

interface OrderTimelineData {
  overdue: CadenceWithMetadata[];
  today: CadenceWithMetadata[];
  tomorrow: CadenceWithMetadata[];
  thisWeek: CadenceWithMetadata[];
  counts: {
    overdue: number;
    today: number;
    tomorrow: number;
    thisWeek: number;
    total: number;
  };
}

/**
 * Fetch suppliers to order today (includes overdue)
 */
async function fetchTodayOrders(): Promise<TodayResponse> {
  const response = await fetch('/api/supplier-cadence/today');

  if (!response.ok) {
    throw new Error('Failed to fetch today orders');
  }

  return response.json();
}

/**
 * Fetch upcoming orders in the next N days
 */
async function fetchUpcomingOrders(days: number): Promise<UpcomingResponse> {
  const response = await fetch(`/api/supplier-cadence/upcoming?days=${days}`);

  if (!response.ok) {
    throw new Error('Failed to fetch upcoming orders');
  }

  return response.json();
}

/**
 * Hook to fetch and organize order timeline data
 */
export function useOrderTimeline() {
  // Fetch today's orders (including overdue)
  const {
    data: todayData,
    isLoading: todayLoading,
    error: todayError,
    refetch: refetchToday,
  } = useQuery({
    queryKey: ['order-timeline', 'today'],
    queryFn: fetchTodayOrders,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Fetch upcoming orders (next 7 days)
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    error: upcomingError,
    refetch: refetchUpcoming,
  } = useQuery({
    queryKey: ['order-timeline', 'upcoming', 7],
    queryFn: () => fetchUpcomingOrders(7),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Organize data by urgency
  const timelineData: OrderTimelineData | null = (() => {
    if (!todayData || !upcomingData) return null;

    // Separate overdue and today from todayData
    const overdue = todayData.suppliers.filter((s) => s.days_overdue > 0);
    const today = todayData.suppliers.filter((s) => s.days_overdue === 0);

    // Separate tomorrow and this week from upcomingData
    const tomorrow = upcomingData.suppliers.filter(
      (s) => s.days_until_next_order === 1
    );
    const thisWeek = upcomingData.suppliers.filter(
      (s) =>
        s.days_until_next_order !== null &&
        s.days_until_next_order >= 2 &&
        s.days_until_next_order <= 7
    );

    return {
      overdue,
      today,
      tomorrow,
      thisWeek,
      counts: {
        overdue: overdue.length,
        today: today.length,
        tomorrow: tomorrow.length,
        thisWeek: thisWeek.length,
        total: overdue.length + today.length + tomorrow.length + thisWeek.length,
      },
    };
  })();

  return {
    data: timelineData,
    isLoading: todayLoading || upcomingLoading,
    error: todayError || upcomingError,
    refetch: async () => {
      await Promise.all([refetchToday(), refetchUpcoming()]);
    },
  };
}
