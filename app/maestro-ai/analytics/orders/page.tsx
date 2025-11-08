'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  ArrowLeft,
  TrendingUp,
  Users,
  Calendar,
  Package,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useMaestroFilters } from '@/contexts/MaestroFiltersContext';
import { formatNumber, formatCurrency } from '@/lib/utils';

// Chart color palette
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  tertiary: '#f59e0b',
  quaternary: '#ef4444',
  quinary: '#8b5cf6',
  pie: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
};

interface OrderAnalytics {
  totalOrders: number;
  avgOrdersPerDay: number;
  peakDay: {
    date: string;
    count: number;
  };
  ordersTrend: Array<{
    date: string;
    orders: number;
  }>;
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    orders: number;
    percentage: number;
  }>;
  byState: Array<{
    state: string;
    stateLabel: string;
    orders: number;
    percentage: number;
  }>;
  byCustomer: Array<{
    customerId: number;
    customerName: string;
    orders: number;
    percentage: number;
  }>;
  byDayOfWeek: Array<{
    day: string;
    dayLabel: string;
    orders: number;
  }>;
  recentOrders: Array<{
    orderId: number;
    orderName: string;
    customerName: string;
    salespersonName: string;
    date: string;
    state: string;
    stateLabel: string;
    amount: number;
  }>;
}

// Fetch orders analytics
async function fetchOrdersAnalytics(period: string, salespersonId?: number): Promise<OrderAnalytics> {
  const params = new URLSearchParams({ period });
  if (salespersonId) {
    params.append('salesperson_id', salespersonId.toString());
  }

  const response = await fetch(`/api/maestro/analytics/orders?${params}`);
  if (!response.ok) throw new Error('Failed to fetch orders analytics');

  const data = await response.json();
  if (!data.success) throw new Error(data.error?.message || 'Orders analytics failed');

  return data.analytics;
}

export default function OrdersAnalyticsPage() {
  // Use global filter context
  const { period, getPeriodLabel, selectedVendor } = useMaestroFilters();

  // Fetch orders analytics
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['orders-analytics', period, selectedVendor?.id],
    queryFn: () => fetchOrdersAnalytics(period, selectedVendor?.id),
    staleTime: 60000 // 1 minute
  });

  // Format chart data for trend
  const trendChartData = useMemo(() => {
    if (!analytics?.ordersTrend) return [];

    return analytics.ordersTrend.map(item => {
      const date = new Date(item.date);
      let label: string;

      if (period === 'week' || period === 'month') {
        // Day format: DD/MM
        label = `${date.getDate()}/${date.getMonth() + 1}`;
      } else {
        // Month format: Gen, Feb, etc.
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        label = monthNames[date.getMonth()] || 'N/D';
      }

      return {
        label,
        orders: item.orders
      };
    });
  }, [analytics?.ordersTrend, period]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento analytics ordini...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center bg-red-500/10 border border-red-500/20 rounded-lg p-8 max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Errore nel caricamento</h2>
          <p className="text-slate-400 mb-4">{(error as Error).message}</p>
          <Link href="/maestro-ai">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Torna alla Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Format peak day date
  const peakDayDate = analytics.peakDay.date
    ? new Date(analytics.peakDay.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : 'N/D';

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/maestro-ai">
              <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors">
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-blue-500" />
                Ordini
                <span className="text-blue-400">{formatNumber(analytics.totalOrders)}</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 mt-1">
                Analytics dettagliate • {getPeriodLabel(period)}
                {selectedVendor && <span> • {selectedVendor.name}</span>}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-medium text-slate-400">Media Ordini/Giorno</h3>
            </div>
            <p className="text-3xl font-bold text-white">{analytics.avgOrdersPerDay}</p>
            <p className="text-xs text-slate-500 mt-1">ordini al giorno in media</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h3 className="text-sm font-medium text-slate-400">Picco Massimo</h3>
            </div>
            <p className="text-3xl font-bold text-white">{analytics.peakDay.count}</p>
            <p className="text-xs text-slate-500 mt-1">ordini il {peakDayDate}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-purple-500" />
              <h3 className="text-sm font-medium text-slate-400">Clienti Unici</h3>
            </div>
            <p className="text-3xl font-bold text-white">{analytics.byCustomer.length}</p>
            <p className="text-xs text-slate-500 mt-1">clienti con ordini</p>
          </motion.div>
        </div>

        {/* Trend Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Trend Numero Ordini
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke={COLORS.primary}
                strokeWidth={3}
                name="Ordini"
                dot={{ fill: COLORS.primary, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Breakdown by Salesperson */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              Ordini per Venditore
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.bySalesperson.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="salespersonName" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="orders" fill={COLORS.secondary} name="Ordini" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Breakdown by State */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Ordini per Stato
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.byState}
                    dataKey="orders"
                    nameKey="stateLabel"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.stateLabel}: ${entry.orders}`}
                  >
                    {analytics.byState.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.pie[index % COLORS.pie.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {analytics.byState.map((item, idx) => (
                  <div key={item.state} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS.pie[idx % COLORS.pie.length] }}
                      />
                      <span className="text-sm text-slate-300">{item.stateLabel}</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {item.orders} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Two Column Layout - Customers & Day of Week */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top Customers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Top Clienti per Numero Ordini
            </h3>
            <div className="space-y-2 max-h-[350px] sm:max-h-[450px] md:max-h-[500px] overflow-y-auto pr-2">
              {analytics.byCustomer.map((customer, idx) => (
                <div
                  key={customer.customerId}
                  className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-750 transition-colors"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{customer.customerName}</p>
                    <p className="text-xs text-slate-400">
                      {customer.orders} ordini ({customer.percentage}%)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Distribution by Day of Week */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Distribuzione per Giorno Settimana
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dayLabel" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="orders" fill={COLORS.primary} name="Ordini" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Recent Orders Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-500" />
            Ordini Recenti
          </h3>
          <div className="overflow-x-auto">
            <div className="max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Importo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {analytics.recentOrders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-slate-750 transition-colors">
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            order.state === 'done'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : order.state === 'sale'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : order.state === 'cancel'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {order.stateLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-medium text-white">{formatCurrency(order.amount)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
