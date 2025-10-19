'use client';

import { useState, useMemo } from 'react';
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
  UserCheck
} from 'lucide-react';
import { KPICard } from '@/components/maestro/KPICard';
import { HealthScoreBadge } from '@/components/maestro/HealthScoreBadge';
import { OfflineIndicator } from '@/components/maestro/OfflineIndicator';
import { PullToRefresh } from '@/components/maestro/PullToRefresh';
import { ChatWidget } from '@/components/maestro/ChatWidget';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useCustomerAvatars, useAnalytics } from '@/hooks/useMaestroAI';
import { useOfflineCache } from '@/hooks/useOfflineCache';
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

export default function MaestroAIDashboard() {
  // Global period filter - DEFAULT: trimestre (3 mesi)
  const [globalPeriod, setGlobalPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('quarter');

  // Fetch REAL customer avatars from database with period filter
  const { data: avatarsData, isLoading: avatarsLoading, error: avatarsError, refetch: refetchAvatars } = useCustomerAvatars({
    limit: 1000,
    sort_by: 'total_revenue',
    sort_order: 'desc',
    period: globalPeriod
  });

  // Fetch REAL analytics (aggregated from customer_avatars)
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useAnalytics(globalPeriod);

  // Offline cache for dashboard data
  const { cachedData: cachedAvatars } = useOfflineCache({
    key: 'dashboard-avatars',
    data: avatarsData
  });

  const { cachedData: cachedAnalytics } = useOfflineCache({
    key: `dashboard-analytics-${globalPeriod}`,
    data: analytics
  });

  const isLoading = avatarsLoading || analyticsLoading;
  const error = avatarsError || analyticsError;

  // Pull to refresh handler
  const handleRefresh = async () => {
    await Promise.all([refetchAvatars(), refetchAnalytics()]);
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

  // Helper function to get period label
  const getPeriodLabel = (period: 'week' | 'month' | 'quarter' | 'year'): string => {
    switch (period) {
      case 'week': return 'Ultimi 7 giorni';
      case 'month': return 'Ultimi 30 giorni';
      case 'quarter': return 'Ultimi 90 giorni';
      case 'year': return 'Ultimi 365 giorni';
    }
  };

  // Calculate REAL KPIs from database filtered by period
  const kpis = useMemo(() => {
    if (!avatarsData?.avatars) {
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
    }

    const startDate = getStartDate(globalPeriod);

    // Filter avatars by period (last_order_date within period)
    const avatarsInPeriod = avatarsData.avatars.filter(avatar => {
      if (!avatar.last_order_date) return false;
      const lastOrderDate = new Date(avatar.last_order_date);
      return lastOrderDate >= startDate;
    });

    const totalRevenue = avatarsInPeriod.reduce((sum, a) => sum + Number(a.total_revenue || 0), 0);
    const totalOrders = avatarsInPeriod.reduce((sum, a) => sum + Number(a.total_orders || 0), 0);
    const activeCustomers = avatarsInPeriod.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // TODO: Calculate trends by comparing with previous period data
    // For now, set trends to 0 (no historical data available yet)
    return {
      totalRevenue,
      revenueTrend: 0,
      totalOrders,
      ordersTrend: 0,
      activeCustomers,
      customersTrend: 0,
      avgOrderValue,
      avgOrderTrend: 0
    };
  }, [avatarsData, globalPeriod]);

  // Filter REAL churn alerts (churn_risk_score > 70) - ONLY in selected period
  const churnAlerts = useMemo(() => {
    if (!avatarsData?.avatars) return [];

    const startDate = getStartDate(globalPeriod);

    return avatarsData.avatars
      .filter(avatar => {
        // Only customers with orders in the selected period
        if (!avatar.last_order_date) return false;
        const lastOrderDate = new Date(avatar.last_order_date);
        return lastOrderDate >= startDate && avatar.churn_risk_score > 70;
      })
      .sort((a, b) => b.churn_risk_score - a.churn_risk_score)
      .slice(0, 5)
      .map(avatar => ({
        id: avatar.odoo_partner_id,
        name: avatar.name,
        city: avatar.city || 'N/D',
        churnRisk: Math.round(avatar.churn_risk_score),
        healthScore: Math.round(avatar.health_score),
        lastOrderDays: avatar.days_since_last_order,
        avgOrderValue: Math.round(avatar.avg_order_value)
      }));
  }, [avatarsData, globalPeriod]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
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

        {/* Global Period Filter - NEW */}
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
                  {getPeriodLabel(globalPeriod)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Filtra tutti i dati del dashboard per periodo selezionato</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setGlobalPeriod('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  globalPeriod === 'week'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Settimana
              </button>

              <button
                onClick={() => setGlobalPeriod('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  globalPeriod === 'month'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                Mese
              </button>

              <button
                onClick={() => setGlobalPeriod('quarter')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  globalPeriod === 'quarter'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                3 Mesi
              </button>

              <button
                onClick={() => setGlobalPeriod('year')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  globalPeriod === 'year'
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <KPICard
            title="Revenue Totale"
            value={formatCurrency(kpis.totalRevenue)}
            icon={Banknote}
            trend={kpis.revenueTrend}
            color="green"
          />
          <KPICard
            title="Ordini"
            value={formatNumber(kpis.totalOrders)}
            icon={ShoppingCart}
            trend={kpis.ordersTrend}
            color="blue"
          />
          <KPICard
            title="Clienti Attivi"
            value={formatNumber(kpis.activeCustomers)}
            icon={Users}
            trend={kpis.customersTrend}
            color="purple"
          />
          <KPICard
            title="Valore Medio Ordine"
            value={formatCurrency(kpis.avgOrderValue)}
            icon={TrendingUp}
            trend={kpis.avgOrderTrend}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
                Dati reali • {getPeriodLabel(globalPeriod)}
              </span>
            </div>
            {analytics?.revenueByMonth && analytics.revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                <LineChart data={analytics.revenueByMonth}>
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
            ) : (
              <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm sm:text-base">Nessun dato disponibile</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Top Performers - REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Top Performers</h3>
            </div>
            {analytics?.topPerformers && analytics.topPerformers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topPerformers.map((performer, idx) => (
                  <div
                    key={performer.id}
                    className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {performer.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(performer.revenue)} • {performer.orders} ordini • {performer.customers} clienti
                      </p>
                    </div>
                    <UserCheck className="h-4 w-4 text-green-400" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nessun venditore con dati disponibili</p>
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Churn Alerts - REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer">
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
            transition={{ delay: 0.4 }}
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
    </>
  );
}
