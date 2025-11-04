'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Banknote,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  Package,
  Calendar,
  DollarSign,
  Award,
  Loader2
} from 'lucide-react';
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
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAnalytics } from '@/hooks/useMaestroAI';
import { useMaestroFilters } from '@/contexts/MaestroFiltersContext';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

// Color palette for charts
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function RevenueDetailPage() {
  const router = useRouter();
  const { period, selectedVendor, getPeriodLabel } = useMaestroFilters();

  // Fetch analytics data
  const { data: analytics, isLoading, error } = useAnalytics(period, selectedVendor?.id);

  // Calculate additional statistics
  const statistics = useMemo(() => {
    if (!analytics?.revenueByMonth || analytics.revenueByMonth.length === 0) {
      return {
        dailyAverage: 0,
        maxRevenue: 0,
        minRevenue: 0,
        maxDay: '-',
        minDay: '-',
        totalDays: 0
      };
    }

    const revenues = analytics.revenueByMonth.map(d => d.revenue);
    const maxRevenue = Math.max(...revenues);
    const minRevenue = Math.min(...revenues);
    const maxDay = analytics.revenueByMonth.find(d => d.revenue === maxRevenue)?.month || '-';
    const minDay = analytics.revenueByMonth.find(d => d.revenue === minRevenue)?.month || '-';
    const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
    const totalDays = revenues.length;
    const dailyAverage = totalRevenue / totalDays;

    return {
      dailyAverage,
      maxRevenue,
      minRevenue,
      maxDay,
      minDay,
      totalDays
    };
  }, [analytics]);

  // Prepare breakdown by salesperson
  const salesBreakdown = useMemo(() => {
    if (!analytics?.topPerformers || !analytics?.kpis?.revenue) return [];

    const totalRevenue = analytics.kpis.revenue;

    return analytics.topPerformers.map(performer => ({
      name: performer.name,
      revenue: performer.revenue,
      orders: performer.orders,
      customers: performer.customers,
      percentage: totalRevenue > 0 ? (performer.revenue / totalRevenue) * 100 : 0
    }));
  }, [analytics]);

  // Prepare pie chart data for salespeople
  const salesPieData = useMemo(() => {
    return salesBreakdown.slice(0, 5).map(s => ({
      name: s.name,
      value: s.revenue
    }));
  }, [salesBreakdown]);

  // Prepare top customers data (from top products - we'll simulate this)
  const topCustomers = useMemo(() => {
    // Since we don't have direct customer revenue breakdown, we'll use top products as proxy
    // In a real implementation, you'd fetch this from a dedicated API endpoint
    return [];
  }, []);

  // Top products breakdown
  const topProducts = useMemo(() => {
    if (!analytics?.topProducts) return [];
    return analytics.topProducts.slice(0, 10);
  }, [analytics]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento dati revenue...</p>
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
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Indietro
          </button>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-8 text-center">
            <p className="text-red-400">Errore nel caricamento dei dati</p>
          </div>
        </div>
      </div>
    );
  }

  const totalRevenue = analytics?.kpis?.revenue || 0;
  const totalOrders = analytics?.kpis?.orders || 0;
  const totalCustomers = analytics?.kpis?.customers || 0;
  const avgOrderValue = analytics?.kpis?.avgOrderValue || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Banknote className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                    Revenue Totale
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400 mt-1">
                    Analisi dettagliata delle vendite
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-green-400">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-400">Periodo:</span>
                <span className="text-xs sm:text-sm text-green-400 font-medium px-3 py-1 bg-green-500/10 rounded border border-green-500/20">
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

        {/* Quick Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-slate-400">Ordini Totali</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(totalOrders)}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-slate-400">Clienti Attivi</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(totalCustomers)}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-slate-400">Valore Medio</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(avgOrderValue)}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <p className="text-xs text-slate-400">Media Giornaliera</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(statistics.dailyAverage)}</p>
          </div>
        </motion.div>

        {/* Main Revenue Chart - Larger */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">
            Trend Revenue nel Tempo
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={analytics?.revenueByMonth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis
                yAxisId="left"
                stroke="#10b981"
                label={{ value: 'Revenue (CHF)', angle: -90, position: 'insideLeft', fill: '#10b981' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#3b82f6"
                label={{ value: 'Ordini', angle: 90, position: 'insideRight', fill: '#3b82f6' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Revenue') return [formatCurrency(value), name];
                  return [formatNumber(value), name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                name="Revenue"
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={3}
                name="Ordini"
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h4 className="text-sm font-medium text-slate-400">Picco Massimo</h4>
            </div>
            <p className="text-2xl font-bold text-green-400 mb-1">{formatCurrency(statistics.maxRevenue)}</p>
            <p className="text-xs text-slate-500">Giorno: {statistics.maxDay}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              <h4 className="text-sm font-medium text-slate-400">Valore Minimo</h4>
            </div>
            <p className="text-2xl font-bold text-orange-400 mb-1">{formatCurrency(statistics.minRevenue)}</p>
            <p className="text-xs text-slate-500">Giorno: {statistics.minDay}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <h4 className="text-sm font-medium text-slate-400">Giorni Analizzati</h4>
            </div>
            <p className="text-2xl font-bold text-blue-400 mb-1">{statistics.totalDays}</p>
            <p className="text-xs text-slate-500">nel periodo selezionato</p>
          </div>
        </motion.div>

        {/* Breakdown by Salesperson */}
        {!selectedVendor && salesBreakdown.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-white">Breakdown per Venditore</h3>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {salesBreakdown.map((sale, idx) => (
                  <div
                    key={sale.name}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">{sale.name}</p>
                          <p className="text-xs text-slate-400">{sale.orders} ordini • {sale.customers} clienti</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">{formatCurrency(sale.revenue)}</p>
                        <p className="text-xs text-slate-400">{formatPercent(sale.percentage)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                      <div
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(sale.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-white">Distribuzione Revenue</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={salesPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {salesPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Top 10 Prodotti per Revenue</h3>
            </div>
            <div className="space-y-3">
              {topProducts.map((product, idx) => {
                const percentage = totalRevenue > 0 ? (product.total_revenue / totalRevenue) * 100 : 0;
                return (
                  <div
                    key={product.product_id}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{product.name}</p>
                          <p className="text-xs text-slate-400">
                            {formatNumber(product.total_quantity)} pz • {product.customer_count} clienti
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-lg font-bold text-green-400">{formatCurrency(product.total_revenue)}</p>
                        <p className="text-xs text-slate-400">{formatPercent(percentage)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
