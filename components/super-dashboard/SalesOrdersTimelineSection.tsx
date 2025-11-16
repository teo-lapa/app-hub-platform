'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Users, TrendingUp, DollarSign, BarChart3, AlertCircle, ArrowUpDown } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Types
interface TimelineDataPoint {
  period: string;
  orderCount: number;
  totalValue: number;
  avgOrderValue: number;
}

interface TeamDataPoint {
  team: string;
  salesperson: string;
  orderCount: number;
  totalValue: number;
  avgOrderValue: number;
  conversionRate: number;
}

interface SalesTimelineData {
  summary: {
    totalOrders: number;
    totalValue: number;
    avgOrderValue: number;
    growth: number;
  };
  timeline: TimelineDataPoint[];
  byTeam: TeamDataPoint[];
}

interface SalesOrdersTimelineSectionProps {
  groupBy?: 'day' | 'week' | 'month' | 'team';
}

type SortField = 'salesperson' | 'orderCount' | 'totalValue' | 'avgOrderValue' | 'conversionRate';
type SortDirection = 'asc' | 'desc';

const groupByLabels = {
  day: 'Giorno',
  week: 'Settimana',
  month: 'Mese',
  team: 'Team',
};

export function SalesOrdersTimelineSection({ groupBy = 'week' }: SalesOrdersTimelineSectionProps) {
  const [data, setData] = useState<SalesTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'team'>('timeline');
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedGroupBy, setSelectedGroupBy] = useState(groupBy);
  const [sortField, setSortField] = useState<SortField>('totalValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/super-dashboard/sales-timeline?period=${selectedPeriod}&groupBy=${selectedGroupBy}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch sales timeline: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Failed to load sales timeline data');
        }
      } catch (err: any) {
        console.error('Error fetching sales timeline:', err);
        setError(err.message || 'Failed to load sales timeline data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedPeriod, selectedGroupBy]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedTeamData = () => {
    if (!data?.byTeam) return [];

    return [...data.byTeam].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  };

  // Loading State
  if (loading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Timeline Ordini Vendita
              <span className="text-sm font-normal text-slate-400 ml-2">• Caricamento...</span>
            </h2>

            <div className="flex items-center gap-4">
              {/* Period Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm">Periodo:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="today">Oggi</option>
                  <option value="week">Questa Settimana</option>
                  <option value="month">Questo Mese</option>
                  <option value="quarter">Questo Trimestre</option>
                  <option value="year">Quest'Anno</option>
                </select>
              </div>

              {/* Group By Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm">Raggruppa per:</label>
                <select
                  value={selectedGroupBy}
                  onChange={(e) => setSelectedGroupBy(e.target.value as any)}
                  className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(groupByLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded mb-3 w-1/2" />
              <div className="h-8 bg-slate-700 rounded mb-2" />
              <div className="h-3 bg-slate-700 rounded w-3/4" />
            </div>
          ))}
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 animate-pulse">
          <div className="h-64 bg-slate-700 rounded" />
        </div>
      </motion.section>
    );
  }

  // Error State
  if (error || !data) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Timeline Ordini Vendita
            </h2>

            <div className="flex items-center gap-4">
              {/* Period Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm">Periodo:</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="today">Oggi</option>
                  <option value="week">Questa Settimana</option>
                  <option value="month">Questo Mese</option>
                  <option value="quarter">Questo Trimestre</option>
                  <option value="year">Quest'Anno</option>
                </select>
              </div>

              {/* Group By Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm">Raggruppa per:</label>
                <select
                  value={selectedGroupBy}
                  onChange={(e) => setSelectedGroupBy(e.target.value as any)}
                  className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(groupByLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Errore nel caricamento della timeline</h3>
              <p className="text-sm text-red-300 mt-1">{error || 'Dati non disponibili'}</p>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Timeline Ordini Vendita
          </h2>

          <div className="flex items-center gap-4">
            {/* Period Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Periodo:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Oggi</option>
                <option value="week">Questa Settimana</option>
                <option value="month">Questo Mese</option>
                <option value="quarter">Questo Trimestre</option>
                <option value="year">Quest'Anno</option>
              </select>
            </div>

            {/* Group By Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm">Raggruppa per:</label>
              <select
                value={selectedGroupBy}
                onChange={(e) => setSelectedGroupBy(e.target.value as any)}
                className="bg-slate-900/50 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(groupByLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <p className="text-slate-400 text-sm">
          Analisi vendite per periodo e team
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg p-4 border border-blue-500/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            {data.summary.growth !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                data.summary.growth > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                <TrendingUp className={`w-4 h-4 ${data.summary.growth < 0 ? 'rotate-180' : ''}`} />
                {data.summary.growth > 0 ? '+' : ''}{data.summary.growth}%
              </div>
            )}
          </div>
          <h3 className="text-slate-400 text-sm mb-1">Totale Ordini</h3>
          <p className="text-white text-3xl font-bold">{data.summary.totalOrders.toLocaleString()}</p>
          <p className="text-slate-500 text-xs mt-1">ordini nel periodo</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-lg p-4 border border-emerald-500/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <h3 className="text-slate-400 text-sm mb-1">Valore Totale</h3>
          <p className="text-white text-3xl font-bold">
            CHF {(data.summary.totalValue / 1000).toFixed(1)}K
          </p>
          <p className="text-slate-500 text-xs mt-1">fatturato totale</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg p-4 border border-purple-500/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <h3 className="text-slate-400 text-sm mb-1">Valore Medio Ordine</h3>
          <p className="text-white text-3xl font-bold">
            CHF {data.summary.avgOrderValue.toLocaleString()}
          </p>
          <p className="text-slate-500 text-xs mt-1">per ordine</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'timeline'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Per Periodo
          {activeTab === 'timeline' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'team'
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Per Team
          {activeTab === 'team' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Chart */}
          <div className="bg-slate-900/50 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="period"
                  stroke="#94a3b8"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#3b82f6"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  label={{ value: 'Ordini', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  label={{ value: 'Valore (CHF)', angle: 90, position: 'insideRight', fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Numero Ordini') return [value, name];
                    if (name === 'Valore Totale') return [`CHF ${value.toLocaleString()}`, name];
                    if (name === 'Valore Medio') return [`CHF ${value.toLocaleString()}`, name];
                    return [value, name];
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Bar
                  yAxisId="left"
                  dataKey="orderCount"
                  fill="#3b82f6"
                  name="Numero Ordini"
                  radius={[8, 8, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalValue"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Valore Totale"
                  dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgOrderValue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Valore Medio"
                  dot={{ fill: '#8b5cf6', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Team Performance Table */}
          <div className="bg-slate-900/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">
                      <button
                        onClick={() => handleSort('salesperson')}
                        className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                      >
                        <Users className="w-4 h-4" />
                        VENDITORE
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-center text-xs font-semibold text-slate-400 px-4 py-3">
                      TEAM
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">
                      <button
                        onClick={() => handleSort('orderCount')}
                        className="flex items-center gap-1 ml-auto hover:text-slate-300 transition-colors"
                      >
                        ORDINI
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">
                      <button
                        onClick={() => handleSort('totalValue')}
                        className="flex items-center gap-1 ml-auto hover:text-slate-300 transition-colors"
                      >
                        VALORE TOTALE
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">
                      <button
                        onClick={() => handleSort('avgOrderValue')}
                        className="flex items-center gap-1 ml-auto hover:text-slate-300 transition-colors"
                      >
                        VALORE MEDIO
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">
                      <button
                        onClick={() => handleSort('conversionRate')}
                        className="flex items-center gap-1 ml-auto hover:text-slate-300 transition-colors"
                      >
                        CONVERSIONE
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedTeamData().map((item, index) => (
                    <motion.tr
                      key={`${item.team}-${item.salesperson}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-medium">
                        {item.salesperson}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {item.team}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {item.orderCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                        CHF {item.totalValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        CHF {item.avgOrderValue.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            item.conversionRate >= 40
                              ? 'text-green-400'
                              : item.conversionRate >= 30
                              ? 'text-yellow-400'
                              : 'text-red-400'
                          }`}
                        >
                          {item.conversionRate}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
