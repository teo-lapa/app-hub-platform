/**
 * Custom hook for fetching dashboard data
 * Supports toggling between mock and real data via environment variable
 */

import { useState, useEffect } from 'react';
import { DashboardData } from '../types';
import {
  mockKPIData,
  mockHighRiskCustomers,
  mockUpsellOpportunities,
  mockHeatmapData,
  mockArriviMerce,
  mockStockCritico,
  mockScadenzeImminenti,
  mockWarehouseCapacity,
  mockAutisti,
  mockKPIGiornata,
  mockProblemiDelivery,
  mockPLData,
  mockBreakEven,
  mockBreakEvenChartData,
  mockARAging,
  mockLeaderboard,
  mockActivityHeatmap,
  mockTeamKPIs,
  mockTopProducts,
  mockSlowMovers,
  mockABCData,
  mockCriticalAlerts,
  mockRecommendations,
  mockPriorities,
  mockAIActivity,
  mockAIModels,
  mockSystemStatus,
} from '../mockData';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

/**
 * Main hook for fetching all dashboard data
 * @param period - Time period for data filtering (day, week, month, year)
 * @returns Dashboard data and loading state
 */
export function useDashboardData(period: string = 'month') {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        if (USE_MOCK_DATA) {
          // Simulate API delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Return mock data
          setData({
            kpi: mockKPIData,
            highRiskCustomers: mockHighRiskCustomers,
            upsellOpportunities: mockUpsellOpportunities,
            heatmapData: mockHeatmapData,
            arriviMerce: mockArriviMerce,
            stockCritico: mockStockCritico,
            scadenzeImminenti: mockScadenzeImminenti,
            warehouseCapacity: mockWarehouseCapacity,
            autisti: mockAutisti,
            kpiGiornata: mockKPIGiornata,
            problemiDelivery: mockProblemiDelivery,
            plData: mockPLData,
            breakEven: mockBreakEven,
            breakEvenChartData: mockBreakEvenChartData,
            arAging: mockARAging,
            leaderboard: mockLeaderboard,
            activityHeatmap: mockActivityHeatmap,
            teamKPIs: mockTeamKPIs,
            topProducts: mockTopProducts,
            slowMovers: mockSlowMovers,
            abcData: mockABCData,
            criticalAlerts: mockCriticalAlerts,
            recommendations: mockRecommendations,
            priorities: mockPriorities,
            aiActivity: mockAIActivity,
            aiModels: mockAIModels,
            systemStatus: mockSystemStatus,
          });
        } else {
          // TODO: Fetch real data from Odoo API
          // const response = await fetch(`/api/dashboard?period=${period}`);
          // const realData = await response.json();
          // setData(realData);

          // For now, fall back to mock data
          console.warn('Real data fetching not yet implemented. Using mock data.');
          setData({
            kpi: mockKPIData,
            highRiskCustomers: mockHighRiskCustomers,
            upsellOpportunities: mockUpsellOpportunities,
            heatmapData: mockHeatmapData,
            arriviMerce: mockArriviMerce,
            stockCritico: mockStockCritico,
            scadenzeImminenti: mockScadenzeImminenti,
            warehouseCapacity: mockWarehouseCapacity,
            autisti: mockAutisti,
            kpiGiornata: mockKPIGiornata,
            problemiDelivery: mockProblemiDelivery,
            plData: mockPLData,
            breakEven: mockBreakEven,
            breakEvenChartData: mockBreakEvenChartData,
            arAging: mockARAging,
            leaderboard: mockLeaderboard,
            activityHeatmap: mockActivityHeatmap,
            teamKPIs: mockTeamKPIs,
            topProducts: mockTopProducts,
            slowMovers: mockSlowMovers,
            abcData: mockABCData,
            criticalAlerts: mockCriticalAlerts,
            recommendations: mockRecommendations,
            priorities: mockPriorities,
            aiActivity: mockAIActivity,
            aiModels: mockAIModels,
            systemStatus: mockSystemStatus,
          });
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [period]);

  return { data, loading, error };
}

/**
 * Hook for refreshing dashboard data
 * @returns Refresh function and loading state
 */
export function useRefreshDashboard() {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);

    try {
      if (!USE_MOCK_DATA) {
        // TODO: Trigger real data refresh
        // await fetch('/api/dashboard/refresh', { method: 'POST' });
      }

      // Simulate refresh delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return { refresh, refreshing };
}

/**
 * Hook for exporting dashboard data
 * @returns Export function and loading state
 */
export function useExportDashboard() {
  const [exporting, setExporting] = useState(false);

  const exportData = async (format: 'pdf' | 'excel' | 'csv' = 'pdf') => {
    setExporting(true);

    try {
      if (USE_MOCK_DATA) {
        // Simulate export delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log(`Mock export to ${format} completed`);
      } else {
        // TODO: Real export implementation
        // const response = await fetch(`/api/dashboard/export?format=${format}`);
        // const blob = await response.blob();
        // Download file...
      }
    } catch (err) {
      console.error('Error exporting dashboard:', err);
    } finally {
      setExporting(false);
    }
  };

  return { exportData, exporting };
}
