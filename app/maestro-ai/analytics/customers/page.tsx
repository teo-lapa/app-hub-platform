'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  MapPin,
  Award,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Loader2,
  Search,
  X
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
import { HealthScoreBadge } from '@/components/maestro/HealthScoreBadge';
import { formatNumber, formatCurrency } from '@/lib/utils';

// Chart colors
const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  tertiary: '#f59e0b',
  quaternary: '#ef4444',
  quinary: '#8b5cf6',
  pie: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
};

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  recurringCustomers: number;
  churnRate: number;
  customersTrend: Array<{
    date: string;
    customers: number;
  }>;
  customersList: Array<{
    id: string;
    name: string;
    city: string;
    orderCount: number;
    totalRevenue: number;
    healthScore: number;
    churnRisk: number;
  }>;
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    customerCount: number;
    percentage: number;
  }>;
  byCity: Array<{
    city: string;
    customerCount: number;
    percentage: number;
  }>;
}

// Fetch customers analytics
async function fetchCustomersAnalytics(period: string, salespersonId?: number): Promise<CustomerAnalytics> {
  const params = new URLSearchParams({ period });
  if (salespersonId) {
    params.append('salesperson_id', salespersonId.toString());
  }

  const response = await fetch(`/api/maestro/analytics/customers?${params}`);
  if (!response.ok) throw new Error('Failed to fetch customers analytics');

  const data = await response.json();
  if (!data.success) throw new Error(data.error?.message || 'Customers analytics failed');

  return data.analytics;
}

export default function CustomersAnalyticsPage() {
  const router = useRouter();
  const { period, getPeriodLabel, selectedVendor } = useMaestroFilters();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch customers analytics
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['customers-analytics', period, selectedVendor?.id],
    queryFn: () => fetchCustomersAnalytics(period, selectedVendor?.id),
    staleTime: 60000 // 1 minute
  });

  // Filter customers list based on search
  const filteredCustomers = useMemo(() => {
    if (!analytics?.customersList) return [];
    if (!searchQuery.trim()) return analytics.customersList;

    const query = searchQuery.toLowerCase();
    return analytics.customersList.filter(customer =>
      customer.name.toLowerCase().includes(query) ||
      customer.city.toLowerCase().includes(query)
    );
  }, [analytics?.customersList, searchQuery]);

  // Format trend data for chart
  const trendChartData = useMemo(() => {
    if (!analytics?.customersTrend) return [];

    return analytics.customersTrend.map(item => {
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
        customers: item.customers
      };
    });
  }, [analytics?.customersTrend, period]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Caricamento analytics clienti...</p>
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
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Torna Indietro
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
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
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                    Clienti Attivi
                  </h1>
                  <p className="text-sm sm:text-base text-slate-400 mt-1">
                    Analisi dettagliata dei clienti
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-purple-400">
                {formatNumber(analytics.totalCustomers)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-400">Periodo:</span>
                <span className="text-xs sm:text-sm text-purple-400 font-medium px-3 py-1 bg-purple-500/10 rounded border border-purple-500/20">
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <UserPlus className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-medium text-slate-400">Nuovi Clienti</h3>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(analytics.newCustomers)}</p>
            <p className="text-xs text-slate-500 mt-1">nel periodo selezionato</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-medium text-slate-400">Clienti Ricorrenti</h3>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(analytics.recurringCustomers)}</p>
            <p className="text-xs text-slate-500 mt-1">già attivi in precedenza</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="text-sm font-medium text-slate-400">Churn Rate</h3>
            </div>
            <p className="text-3xl font-bold text-white">{analytics.churnRate.toFixed(1)}%</p>
            <p className="text-xs text-slate-500 mt-1">clienti persi vs periodo precedente</p>
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
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Trend Clienti Attivi nel Tempo
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
                dataKey="customers"
                stroke={COLORS.quinary}
                strokeWidth={3}
                name="Clienti Attivi"
                dot={{ fill: COLORS.quinary, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Breakdown by Salesperson */}
          {!selectedVendor && analytics.bySalesperson && analytics.bySalesperson.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-500" />
                Breakdown per Venditore
              </h3>
              <div className="space-y-2 max-h-[350px] sm:max-h-[450px] md:max-h-[500px] overflow-y-auto pr-2">
                {analytics.bySalesperson.map((salesperson, idx) => (
                  <div
                    key={salesperson.salespersonId}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white">{salesperson.salespersonName}</p>
                          <p className="text-xs text-slate-400">{salesperson.customerCount} clienti</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-400">{salesperson.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(salesperson.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Geographic Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 md:p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              Distribuzione Geografica
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.byCity}
                    dataKey="customerCount"
                    nameKey="city"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.city}: ${entry.customerCount}`}
                  >
                    {analytics.byCity.map((entry, index) => (
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
                {analytics.byCity.map((item, idx) => (
                  <div key={item.city} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS.pie[idx % COLORS.pie.length] }}
                      />
                      <span className="text-sm text-slate-300">{item.city}</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {item.customerCount} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Customers List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Lista Clienti ({filteredCustomers.length})
            </h3>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca per nome o città..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Città
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Ordini
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Health Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-750 transition-colors cursor-pointer"
                      onClick={() => router.push(`/maestro-ai/customers/${customer.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                            {customer.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-white">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-slate-300">
                          <MapPin className="h-3 w-3" />
                          {customer.city}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-white">{formatNumber(customer.orderCount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-green-400">{formatCurrency(customer.totalRevenue)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <HealthScoreBadge score={customer.healthScore} size="sm" showLabel={false} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/maestro-ai/customers/${customer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Visualizza →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">
                {searchQuery
                  ? 'Nessun cliente trovato con questi criteri di ricerca'
                  : 'Nessun cliente attivo nel periodo selezionato'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                >
                  Reset ricerca
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
