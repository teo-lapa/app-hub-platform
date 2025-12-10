'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  MapPin,
  FileText,
  RefreshCw,
  ExternalLink,
  BarChart3
} from 'lucide-react';

interface AnalyticsData {
  summary: {
    totalVisitors: number;
    totalPageViews: number;
    avgPagesPerVisitor: string;
    todayVisitors: number;
    growth: number;
    dailyGrowth: number;
  };
  visitorsPerDay: { date: string; count: number }[];
  topCountries: { name: string; count: number; percentage: string }[];
  topLanguages: { name: string; count: number; percentage: string }[];
  topPages: { name: string; count: number }[];
  lastUpdated: string;
}

export function WebsiteAnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/website-analytics');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Errore di connessione');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  };

  const maxVisitors = data ? Math.max(...data.visitorsPerDay.map(d => d.count)) : 0;

  const countryFlags: Record<string, string> = {
    'Switzerland': '🇨🇭',
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'Germany': '🇩🇪',
    'Austria': '🇦🇹',
    'Liechtenstein': '🇱🇮'
  };

  if (loading && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-cyan-500/20 rounded-xl">
            <Globe className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Website Analytics</h2>
            <p className="text-slate-400 text-sm">lapa.ch</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-red-500/20 p-6"
      >
        <div className="text-center text-red-400">
          <p>Errore: {error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30">
            Riprova
          </button>
        </div>
      </motion.div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-xl">
            <Globe className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Website Analytics</h2>
            <p className="text-slate-400 text-sm">lapa.ch • Ultimi 7 giorni</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="https://lapa.ch"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all"
          >
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>Visitatori Oggi</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.todayVisitors}</div>
          <div className={`text-sm flex items-center gap-1 ${data.summary.dailyGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.summary.dailyGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {data.summary.dailyGrowth >= 0 ? '+' : ''}{data.summary.dailyGrowth}% vs ieri
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Users className="w-4 h-4" />
            <span>Totale 7gg</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.totalVisitors}</div>
          <div className={`text-sm flex items-center gap-1 ${data.summary.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.summary.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {data.summary.growth >= 0 ? '+' : ''}{data.summary.growth}% trend
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Eye className="w-4 h-4" />
            <span>Page Views</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.totalPageViews.toLocaleString()}</div>
          <div className="text-sm text-slate-400">questa settimana</div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Pagine/Visita</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.avgPagesPerVisitor}</div>
          <div className="text-sm text-slate-400">media</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-700/20 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Visitatori per giorno</h3>
        <div className="flex items-end gap-2 h-32">
          {data.visitorsPerDay.map((day, i) => {
            const height = maxVisitors > 0 ? (day.count / maxVisitors) * 100 : 0;
            const isToday = i === data.visitorsPerDay.length - 1;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-slate-400">{day.count}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={`w-full rounded-t-lg ${isToday ? 'bg-gradient-to-t from-cyan-600 to-cyan-400' : 'bg-gradient-to-t from-slate-600 to-slate-500'}`}
                  style={{ minHeight: '4px' }}
                />
                <span className="text-xs text-slate-500">{formatDate(day.date)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Countries */}
        <div className="bg-slate-700/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-3">
            <MapPin className="w-4 h-4" />
            <span>Top Paesi</span>
          </div>
          <div className="space-y-2">
            {data.topCountries.map((country, i) => (
              <div key={country.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{countryFlags[country.name] || '🌍'}</span>
                  <span className="text-sm text-slate-300">{country.name}</span>
                </div>
                <span className="text-sm text-cyan-400">{country.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Languages */}
        <div className="bg-slate-700/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-3">
            <Globe className="w-4 h-4" />
            <span>Lingue</span>
          </div>
          <div className="space-y-2">
            {data.topLanguages.map((lang) => (
              <div key={lang.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 truncate max-w-[120px]">{lang.name}</span>
                <span className="text-sm text-cyan-400">{lang.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-slate-700/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-3">
            <FileText className="w-4 h-4" />
            <span>Pagine Top</span>
          </div>
          <div className="space-y-2">
            {data.topPages.map((page) => (
              <div key={page.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-300 truncate max-w-[120px]">{page.name}</span>
                <span className="text-sm text-cyan-400">{page.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
        <span>Solo traffico reale (CH/IT/FR/DE/AT)</span>
        <span>Aggiornato: {new Date(data.lastUpdated).toLocaleTimeString('it-IT')}</span>
      </div>
    </motion.div>
  );
}
