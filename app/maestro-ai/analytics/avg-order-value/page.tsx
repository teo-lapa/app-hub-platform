'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  BarChart3,
  Award,
  Calculator,
  Loader2,
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useMaestroFilters } from '@/contexts/MaestroFiltersContext';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

// Chart color palette
const COLORS = {
  primary: '#f59e0b',
  secondary: '#10b981',
  tertiary: '#3b82f6',
  quaternary: '#ef4444',
  quinary: '#8b5cf6'
};

interface AvgOrderValueAnalytics {
  avgOrderValue: number;
  medianOrderValue: number;
  stdDeviation: number;
  totalOrders: number;
  totalRevenue: number;
  peakOrder: {
    orderId: number;
    orderName: string;
    amount: number;
    date: string;
  };
  avgValueTrend: Array<{
    date: string;
    avgValue: number;
    orderCount: number;
  }>;
  distributionByRange: Array<{
    range: string;
    rangeLabel: string;
    orderCount: number;
    percentage: number;
    totalRevenue: number;
  }>;
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    avgOrderValue: number;
    totalOrders: number;
    totalRevenue: number;
  }>;
  productImpact: Array<{
    productId: number;
    productName: string;
    avgOrderValue: number;
    orderCount: number;
    totalRevenue: number;
    impact: 'increase' | 'decrease';
  }>;
  topOrders: Array<{
    orderId: number;
    orderName: string;
    customerName: string;
    salespersonName: string;
    date: string;
    amount: number;
    percentageOfAvg: number;
  }>;
}

// Fetch avg order value analytics
async function fetchAvgOrderValueAnalytics(
  period: string,
  salespersonId?: number
): Promise<AvgOrderValueAnalytics> {
  const params = new URLSearchParams({ period });
  if (salespersonId) {
    params.append('salesperson_id', salespersonId.toString());
  }

  const response = await fetch(`/api/maestro/analytics/avg-order-value?${params}`);
  if (!response.ok) throw new Error('Failed to fetch avg order value analytics');

  const data = await response.json();
  if (!data.success) throw new Error(data.error?.message || 'Avg order value analytics failed');

  return data.analytics;
}

export default function AvgOrderValueDetailPage() {
  const router = useRouter();
  const { period, getPeriodLabel, selectedVendor } = useMaestroFilters();

  // Fetch analytics
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['avg-order-value-analytics', period, selectedVendor?.id],
    queryFn: () => fetchAvgOrderValueAnalytics(period, selectedVendor?.id),
    staleTime: 60000 // 1 minute
  });

  // Format trend chart data
  const trendChartData = useMemo(() => {
    if (!analytics?.avgValueTrend) return [];

    return analytics.avgValueTrend.map(item => {
      const date = new Date(item.date);
      let label: string;

      if (period === 'week' || period === 'month') {
        label = `${date.getDate()}/${date.getMonth() + 1}`;
      } else {
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        label = monthNames[date.getMonth()] || 'N/D';
      }

      return {
        label,
        avgValue: Math.round(item.avgValue),
        orderCount: item.orderCount
      };
    });
  }, [analytics?.avgValueTrend, period]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento analytics valore medio ordine...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors min-h-[44px] -ml-2 px-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm sm:text-base">Indietro alla Dashboard</span>
          </button>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Errore nel caricamento</h2>
            <p className="text-slate-400">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors min-h-[44px] -ml-2 px-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm sm:text-base">Indietro alla Dashboard</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                    Valore Medio Ordine
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400 mt-1">
                    Analisi dettagliata del valore medio per ordine
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-orange-400">
                {formatCurrency(analytics.avgOrderValue)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-400">Periodo:</span>
                <span className="text-xs sm:text-sm text-orange-400 font-medium px-3 py-1 bg-orange-500/10 rounded border border-orange-500/20">
                  {getPeriodLabel(period)}
                </span>
              </div>
              {selectedVendor && (
                <span className="text-xs text-blue-400 font-medium px-3 py-1 bg-blue-500/10 rounded border border-blue-500/20">
                  {selectedVendor.name}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Statistics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-slate-400">Mediana</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(analytics.medianOrderValue)}</p>
            <p className="text-xs text-slate-500 mt-1">valore centrale</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-slate-400">Deviazione Std</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(analytics.stdDeviation)}</p>
            <p className="text-xs text-slate-500 mt-1">variabilita</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-slate-400">Picco Massimo</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(analytics.peakOrder.amount)}</p>
            <p className="text-xs text-slate-500 mt-1">{analytics.peakOrder.orderName}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-slate-400">Totale Ordini</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatNumber(analytics.totalOrders)}</p>
            <p className="text-xs text-slate-500 mt-1">ordini analizzati</p>
          </div>
        </motion.div>

        {/* Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            Evoluzione Valore Medio nel Tempo
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" stroke="#94a3b8" />
              <YAxis
                yAxisId="left"
                stroke="#f59e0b"
                label={{ value: 'Valore Medio (CHF)', angle: -90, position: 'insideLeft', fill: '#f59e0b' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#3b82f6"
                label={{ value: 'N. Ordini', angle: 90, position: 'insideRight', fill: '#3b82f6' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Valore Medio') return [formatCurrency(value), name];
                  return [formatNumber(value), name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgValue"
                stroke={COLORS.primary}
                strokeWidth={3}
                name="Valore Medio"
                dot={{ fill: COLORS.primary, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orderCount"
                stroke={COLORS.tertiary}
                strokeWidth={2}
                name="N. Ordini"
                dot={{ fill: COLORS.tertiary, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Distribution by Range */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Distribuzione Ordini per Fascia di Valore
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.distributionByRange}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="rangeLabel" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Revenue Totale') return [formatCurrency(value), name];
                  return [formatNumber(value), name];
                }}
              />
              <Legend />
              <Bar dataKey="orderCount" fill={COLORS.tertiary} name="Numero Ordini" />
              <Bar dataKey="totalRevenue" fill={COLORS.secondary} name="Revenue Totale" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {analytics.distributionByRange.map((range, idx) => (
              <div key={range.range} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">{range.rangeLabel}</p>
                <p className="text-lg font-bold text-white">{range.orderCount}</p>
                <p className="text-xs text-slate-500">{formatPercent(range.percentage)} degli ordini</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Two Column Layout - Salesperson & Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Breakdown by Salesperson */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">Valore Medio per Venditore</h3>
            </div>
            <div className="space-y-3 max-h-[350px] sm:max-h-[450px] md:max-h-[500px] overflow-y-auto pr-2">
              {analytics.bySalesperson.map((seller, idx) => (
                <div
                  key={seller.salespersonId}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-white">{seller.salespersonName}</p>
                        <p className="text-xs text-slate-400">
                          {seller.totalOrders} ordini • {formatCurrency(seller.totalRevenue)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-400">{formatCurrency(seller.avgOrderValue)}</p>
                      <p className="text-xs text-slate-400">media</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((seller.avgOrderValue / (analytics.avgOrderValue * 1.5)) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Product Impact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-white">Prodotti che Alzano la Media</h3>
            </div>
            <div className="space-y-3 max-h-[350px] sm:max-h-[450px] md:max-h-[500px] overflow-y-auto pr-2">
              {analytics.productImpact.map((product, idx) => (
                <div
                  key={product.productId}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        product.impact === 'increase'
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                          : 'bg-gradient-to-br from-red-500 to-rose-600'
                      }`}>
                        {product.impact === 'increase' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{product.productName}</p>
                        <p className="text-xs text-slate-400">
                          {product.orderCount} ordini • {formatCurrency(product.totalRevenue)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className={`text-lg font-bold ${
                        product.impact === 'increase' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(product.avgOrderValue)}
                      </p>
                      <p className="text-xs text-slate-400">media ordini</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Top 10 Largest Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-500" />
            Top 10 Ordini Piu Grandi del Periodo
          </h3>
          <div className="overflow-x-auto">
            <div className="max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Ordine
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Venditore
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Importo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      vs Media
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {analytics.topOrders.map((order, idx) => (
                    <tr key={order.orderId} className="hover:bg-slate-750 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-blue-400">{order.orderName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white">{order.customerName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300">{order.salespersonName}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-400">
                          {new Date(order.date).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-green-400">{formatCurrency(order.amount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {order.percentageOfAvg}% della media
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Insights Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-500" />
            Perche la Media e {formatCurrency(analytics.avgOrderValue)}?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-300 mb-2">
                <span className="font-semibold text-white">{formatPercent(analytics.distributionByRange[0]?.percentage || 0)}</span> degli ordini
                sono nella fascia {analytics.distributionByRange[0]?.rangeLabel}
              </p>
              <p className="text-xs text-slate-400">
                Ordini di piccolo valore abbassano la media complessiva
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-300 mb-2">
                La <span className="font-semibold text-white">mediana</span> e {formatCurrency(analytics.medianOrderValue)},
                {analytics.medianOrderValue < analytics.avgOrderValue ? ' inferiore' : ' superiore'} alla media
              </p>
              <p className="text-xs text-slate-400">
                {analytics.medianOrderValue < analytics.avgOrderValue
                  ? 'Alcuni ordini molto grandi alzano la media'
                  : 'La distribuzione e abbastanza uniforme'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-slate-300 mb-2">
                Deviazione standard di <span className="font-semibold text-white">{formatCurrency(analytics.stdDeviation)}</span>
              </p>
              <p className="text-xs text-slate-400">
                {analytics.stdDeviation > analytics.avgOrderValue * 0.5
                  ? 'Alta variabilita tra gli ordini'
                  : 'Ordini abbastanza consistenti'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
