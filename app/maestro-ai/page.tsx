'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Banknote,
  ShoppingCart,
  Users,
  TrendingUp,
  AlertTriangle,
  Trophy,
  Calendar,
  MapPin,
  Loader2,
  UserCheck,
  UsersRound,
  Package,
  Bell
} from 'lucide-react';
import { KPICard } from '@/components/maestro/KPICard';
import { HealthScoreBadge } from '@/components/maestro/HealthScoreBadge';
import { OfflineIndicator } from '@/components/maestro/OfflineIndicator';
import { PullToRefresh } from '@/components/maestro/PullToRefresh';
import { ChatWidget } from '@/components/maestro/ChatWidget';
import { VehicleStockButton } from '@/components/maestro/VehicleStockButton';
import { UrgentProductsModal } from '@/components/maestro/UrgentProductsModal';
import { formatCurrency, formatCurrencyValue, formatNumber } from '@/lib/utils';
import { useCustomerAvatars, useAnalytics } from '@/hooks/useMaestroAI';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useMaestroFilters } from '@/contexts/MaestroFiltersContext';
import { useAuthStore } from '@/lib/store/authStore';
import { canViewAllVendors } from '@/lib/maestro/permissions';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

// 🚀 Memoized Revenue Chart Component (optimized for mobile performance)
const MemoizedRevenueChart = memo(({ data }: { data: any[] }) => {
  console.log('📊 [CHART] Rendering MemoizedRevenueChart with', data?.length || 0, 'data points');

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] sm:h-[250px] md:h-[280px] lg:h-[300px] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm sm:text-base">Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" className="h-[200px] sm:h-[250px] md:h-[280px] lg:h-[300px]">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="month" stroke="#94a3b8" />
        <YAxis yAxisId="left" stroke="#10b981" label={{ value: 'CHF', angle: -90, position: 'insideLeft', fill: '#10b981' }} />
        <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" label={{ value: 'Ordini', angle: 90, position: 'insideRight', fill: '#3b82f6' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={3}
          name="Revenue (CHF)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#3b82f6"
          strokeWidth={3}
          name="Ordini"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
MemoizedRevenueChart.displayName = 'MemoizedRevenueChart';

export default function MaestroAIDashboard() {
  // 🔐 Check user permissions
  const { user } = useAuthStore();
  const canViewAll = canViewAllVendors(user);

  // Stati per modal Prodotti Urgenti
  const [showUrgentProductsModal, setShowUrgentProductsModal] = useState(false);
  const [urgentProductsCount, setUrgentProductsCount] = useState(0);

  // Use global filter context (default period is now 'week')
  const { period, setPeriod, selectedVendor, setSelectedVendor, clearVendorFilter, isVendorSelected, getPeriodLabel } = useMaestroFilters();

  // Fetch REAL customer avatars from database with period filter
  const { data: avatarsData, isLoading: avatarsLoading, error: avatarsError, refetch: refetchAvatars } = useCustomerAvatars({
    limit: 1000,
    sort_by: 'total_revenue',
    sort_order: 'desc',
    period: period,
    salesperson_id: selectedVendor?.id // Apply vendor filter to API
  });

  // Fetch REAL analytics (aggregated from customer_avatars) - WITH VENDOR FILTER
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics(period, selectedVendor?.id);

  // Offline cache for dashboard data
  const { cachedData: cachedAvatars } = useOfflineCache({
    key: `dashboard-avatars-${selectedVendor?.id || 'all'}`,
    data: avatarsData
  });

  const { cachedData: cachedAnalytics } = useOfflineCache({
    key: `dashboard-analytics-${period}-${selectedVendor?.id || 'all'}`,
    data: analytics
  });

  const isLoading = avatarsLoading || analyticsLoading;
  const error = avatarsError || analyticsError;

  // Carica contatore prodotti urgenti
  const loadUrgentProductsCount = async () => {
    try {
      const response = await fetch('/api/urgent-products', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setUrgentProductsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Errore caricamento contatore prodotti urgenti:', error);
    }
  };

  // Carica contatore all'avvio e ogni 3 minuti (ottimizzato per Android)
  useEffect(() => {
    loadUrgentProductsCount();
    const interval = setInterval(loadUrgentProductsCount, 3 * 60 * 1000); // 3 minuti invece di 30s
    return () => clearInterval(interval);
  }, []);

  // Pull to refresh handler
  const handleRefresh = async () => {
    await Promise.all([refetchAvatars(), refetchAnalytics(), loadUrgentProductsCount()]);
  };

  // Helper function to get start date based on period
  const getStartDate = (period: 'week' | 'month' | 'quarter' | 'year'): Date => {
    const now = new Date();
    switch (period) {
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  };

  // ✅ FIXED: Use period-specific KPIs from Odoo with REAL trend calculations
  // The analytics hook now queries Odoo directly for period-specific revenue and orders
  // AND compares with previous period to calculate trend percentages
  const kpis = useMemo(() => {
    // Use period-specific KPIs from analytics.kpis
    if (analytics?.kpis) {
      console.log('📊 [DASHBOARD] Using period-specific KPIs from Odoo:', {
        period,
        vendorId: selectedVendor?.id,
        revenue: analytics.kpis.revenue,
        orders: analytics.kpis.orders,
        customers: analytics.kpis.customers,
        avgOrderValue: analytics.kpis.avgOrderValue,
        revenueTrend: analytics.kpis.revenueTrend,
        ordersTrend: analytics.kpis.ordersTrend,
        customersTrend: analytics.kpis.customersTrend,
        avgOrderValueTrend: analytics.kpis.avgOrderValueTrend
      });

      return {
        totalRevenue: analytics.kpis.revenue,
        revenueTrend: analytics.kpis.revenueTrend || 0,
        totalOrders: analytics.kpis.orders,
        ordersTrend: analytics.kpis.ordersTrend || 0,
        activeCustomers: analytics.kpis.customers,
        customersTrend: analytics.kpis.customersTrend || 0,
        avgOrderValue: analytics.kpis.avgOrderValue,
        avgOrderTrend: analytics.kpis.avgOrderValueTrend || 0
      };
    }

    // Fallback to empty if no analytics data yet
    return {
      totalRevenue: 0,
      revenueTrend: 0,
      totalOrders: 0,
      ordersTrend: 0,
      activeCustomers: 0,
      customersTrend: 0,
      avgOrderValue: 0,
      avgOrderTrend: 0
    };
  }, [analytics, period, selectedVendor]);

  // Filter REAL churn alerts (churn_risk_score > 70) - ONLY in selected period and vendor
  // NOTE: API already filtered by date range and salesperson_id
  const churnAlerts = useMemo(() => {
    if (!avatarsData?.avatars) return [];

    // API already filtered, just find high-risk customers
    return avatarsData.avatars
      .filter(avatar => avatar.churn_risk_score > 70)
      .sort((a, b) => b.churn_risk_score - a.churn_risk_score)
      .slice(0, 5)
      .map(avatar => ({
        id: avatar.id, // FIX: Use customer_avatar.id instead of odoo_partner_id
        name: avatar.name,
        city: avatar.city || 'N/D',
        churnRisk: Math.round(avatar.churn_risk_score),
        healthScore: Math.round(avatar.health_score),
        lastOrderDays: avatar.days_since_last_order,
        avgOrderValue: Math.round(avatar.avg_order_value)
      }));
  }, [avatarsData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento dati dashboard...</p>
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
          <p className="text-slate-400 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineIndicator />
      <ChatWidget />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
              MAESTRO AI Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-400">
              Panoramica team vendite • {avatarsData?.avatars.length || 0} clienti attivi
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Pulsante Prodotti Urgenti */}
            <button
              onClick={() => setShowUrgentProductsModal(true)}
              className="relative px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-lg transition-colors flex items-center gap-2 min-h-[44px]"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Prodotti Urgenti</span>
              <span className="sm:hidden">Urgenti</span>
              {urgentProductsCount > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {urgentProductsCount}
                </span>
              )}
            </button>

            <VehicleStockButton
              vendorName={selectedVendor?.name || 'Tutti i Venditori'}
              vendorId={selectedVendor?.id}
            />
            <Link href="/maestro-ai/daily-plan">
              <button className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-lg transition-colors flex items-center gap-2 min-h-[44px]">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Piano Giornaliero</span>
                <span className="sm:hidden">Piano</span>
              </button>
            </Link>
            <button className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-colors flex items-center gap-2 min-h-[44px]">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Oggi</span>
            </button>
          </div>
        </motion.div>

        {/* Global Period Filter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 border border-slate-800 rounded-lg p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                Periodo Analisi
                <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-500/10 rounded border border-green-500/20">
                  {getPeriodLabel(period)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Filtra tutti i dati del dashboard per periodo selezionato</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPeriod('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  period === 'week'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Settimana
              </button>

              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  period === 'month'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Mese
              </button>

              <button
                onClick={() => setPeriod('quarter')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  period === 'quarter'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                3 Mesi
              </button>

              <button
                onClick={() => setPeriod('year')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  period === 'year'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Anno
              </button>
            </div>
          </div>
        </motion.div>

        {/* KPI Cards - REAL DATA - Mobile: 2 cols, Desktop: 4 cols */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <KPICard
            title="Revenue Totale"
            value={formatCurrency(kpis.totalRevenue)}
            icon={Banknote}
            trend={kpis.revenueTrend}
            color="green"
            type="revenue"
          />
          <KPICard
            title="Ordini"
            value={formatNumber(kpis.totalOrders)}
            icon={ShoppingCart}
            trend={kpis.ordersTrend}
            color="blue"
            type="orders"
          />
          <KPICard
            title="Clienti Attivi"
            value={formatNumber(kpis.activeCustomers)}
            icon={Users}
            trend={kpis.customersTrend}
            color="purple"
            type="customers"
          />
          <KPICard
            title="Valore Medio Ordine"
            value={formatCurrencyValue(kpis.avgOrderValue)}
            icon={TrendingUp}
            trend={kpis.avgOrderTrend}
            color="orange"
            type="avg-order-value"
            currencyLabel="CHF"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Revenue Chart - REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white">Trend Revenue & Ordini</h3>
              <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-500/10 rounded border border-green-500/20">
                Dati reali • {getPeriodLabel(period)}
              </span>
            </div>
            {(() => {
              console.log('📈 [DASHBOARD] Chart data check:', {
                hasAnalytics: !!analytics,
                hasRevenueByMonth: !!analytics?.revenueByMonth,
                revenueByMonthLength: analytics?.revenueByMonth?.length || 0,
                revenueByMonthData: analytics?.revenueByMonth
              });
              return null;
            })()}
            <MemoizedRevenueChart data={analytics?.revenueByMonth || []} />
          </motion.div>

          {/* 🔐 SECTION: Venditori (conditional based on permissions) */}
          {canViewAll ? (
            /* Top Performers - REAL DATA - SCROLLABLE & CLICKABLE (Only for super users) */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Venditori</h3>
                {selectedVendor && (
                  <span className="ml-auto text-xs text-blue-400 font-medium px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20">
                    Filtrato: {selectedVendor.name}
                  </span>
                )}
              </div>

              {/* "Tutti" Button */}
            <button
              onClick={clearVendorFilter}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all mb-3 ${
                !selectedVendor
                  ? 'bg-blue-600 border-2 border-blue-400 shadow-lg shadow-blue-500/20'
                  : 'bg-slate-900 border border-slate-700 hover:bg-slate-750'
              }`}
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <UsersRound className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-white">
                  Tutti i Venditori
                </p>
                <p className="text-xs text-slate-400">
                  Vista completa team
                </p>
              </div>
              {!selectedVendor && (
                <div className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
              )}
            </button>

            {/* Scrollable Performers List */}
            {analytics?.topPerformers && analytics.topPerformers.length > 0 ? (
              <div className="space-y-2 overflow-y-auto max-h-[250px] sm:max-h-[350px] md:max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                {analytics.topPerformers.map((performer, idx) => (
                  <button
                    key={performer.id}
                    onClick={() => setSelectedVendor({
                      id: performer.id,
                      name: performer.name,
                      revenue: performer.revenue,
                      orders: performer.orders,
                      customers: performer.customers
                    })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isVendorSelected(performer.id)
                        ? 'bg-blue-600 border-2 border-blue-400 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-900 border border-slate-700 hover:bg-slate-750 hover:border-slate-600'
                    }`}
                  >
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                      isVendorSelected(performer.id)
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                        : 'bg-gradient-to-br from-blue-500 to-purple-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm font-medium truncate ${
                        isVendorSelected(performer.id) ? 'text-white font-bold' : 'text-white'
                      }`}>
                        {performer.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(performer.revenue)} • {performer.orders} ordini • {performer.customers} clienti
                      </p>
                    </div>
                    {isVendorSelected(performer.id) ? (
                      <div className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-green-400 opacity-70" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessun venditore con dati disponibili</p>
              </div>
            )}
            </motion.div>
          ) : (
            /* Current User Info (for normal users - no vendor selection) */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Il Mio Account</h3>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-700">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-white">
                    {user?.name || 'Utente'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center">
                Stai visualizzando solo i tuoi clienti
              </p>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Top Products - REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Top Prodotti</h3>
              {analytics?.topProducts && analytics.topProducts.length > 0 && (
                <span className="ml-auto px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400 font-medium">
                  {analytics.topProducts.length}
                </span>
              )}
            </div>
            {analytics?.topProducts && analytics.topProducts.length > 0 ? (
              <div className="space-y-2 overflow-y-auto max-h-[250px] sm:max-h-[350px] md:max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
                {analytics.topProducts.map((product, idx) => (
                  <div
                    key={product.product_id}
                    className="flex items-start gap-3 p-3 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-green-400 font-medium">
                          {formatCurrency(product.total_revenue)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatNumber(product.total_quantity)} pz
                        </span>
                        <span className="text-xs text-slate-500">
                          {product.customer_count} clienti
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessun prodotto disponibile</p>
              </div>
            )}
          </motion.div>

          {/* Churn Alerts - REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Alert Churn Risk</h3>
              <span className="ml-auto px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-medium">
                {churnAlerts.length} urgenti
              </span>
            </div>
            {churnAlerts.length > 0 ? (
              <div className="space-y-3">
                {churnAlerts.map((alert) => (
                  <Link key={alert.id} href={`/maestro-ai/customers/${alert.id}`}>
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer min-h-[44px] flex flex-col justify-center">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white">{alert.name}</h4>
                          <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {alert.city}
                          </p>
                        </div>
                        <HealthScoreBadge score={alert.healthScore} size="sm" showLabel={false} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-400 font-medium">
                          Churn risk: {alert.churnRisk}%
                        </span>
                        <span className="text-slate-500">
                          Ultimo ordine: {alert.lastOrderDays}gg fa
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessun cliente a rischio churn (score &gt; 70)</p>
              </div>
            )}
          </motion.div>

          {/* Urgent Visits - REAL DATA (high churn customers) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Da Visitare Urgentemente</h3>
            </div>
            {analytics?.urgentVisits && analytics.urgentVisits.length > 0 ? (
              <div className="space-y-3">
                {analytics.urgentVisits.map((visit, idx) => (
                  <Link key={idx} href={`/maestro-ai/customers/${visit.customerId}`}>
                    <div className={`flex items-center gap-3 p-3 rounded-lg ${
                      visit.priority === 'urgent'
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-orange-500/10 border border-orange-500/20'
                    }`}>
                      <div className={`flex-shrink-0 px-3 py-2 rounded text-sm font-semibold ${
                        visit.priority === 'urgent'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {visit.churnRisk}%
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {visit.customer}
                        </p>
                        <p className="text-xs text-slate-400">
                          {visit.city} • {visit.salesperson}
                        </p>
                      </div>
                      <MapPin className={`h-4 w-4 ${
                        visit.priority === 'urgent' ? 'text-red-400' : 'text-orange-400'
                      }`} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessuna visita urgente programmata</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
      </PullToRefresh>

      {/* Modal Prodotti Urgenti */}
      <UrgentProductsModal
        isOpen={showUrgentProductsModal}
        onClose={() => {
          setShowUrgentProductsModal(false);
          loadUrgentProductsCount(); // Ricarica contatore quando chiudi modal
        }}
      />
    </>
  );
}
