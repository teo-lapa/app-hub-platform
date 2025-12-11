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
  BarChart3,
  Search,
  Share2,
  MousePointer,
  Bot,
  UserCheck,
  Target,
  Hash
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
  trafficSources?: { name: string; count: number; percentage: string; color: string }[];
  lastUpdated: string;
}

interface SearchConsoleData {
  summary: {
    totalClicks: number;
    totalImpressions: number;
    avgCTR: string;
    avgPosition: string;
    growth: number;
  };
  dailyData: { date: string; clicks: number; impressions: number; ctr: string; position: string }[];
  topQueries: { query: string; clicks: number; impressions: number; ctr: string; position: string }[];
  topPages: { page: string; clicks: number; impressions: number }[];
  topCountries: { country: string; clicks: number; impressions: number }[];
  lastUpdated: string;
}

export function WebsiteAnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [seoData, setSeoData] = useState<SearchConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both APIs in parallel
      const [analyticsRes, seoRes] = await Promise.all([
        fetch('/api/website-analytics'),
        fetch('/api/search-console')
      ]);

      const analyticsResult = await analyticsRes.json();
      const seoResult = await seoRes.json();

      if (analyticsResult.success) {
        setData(analyticsResult.data);
      }
      if (seoResult.success) {
        setSeoData(seoResult.data);
      }
      if (analyticsResult.success || seoResult.success) {
        setError(null);
      } else {
        setError(analyticsResult.error || seoResult.error);
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

      {/* Traffic Reality Banner - Bot vs Real */}
      {seoData && (
        <div className="bg-gradient-to-r from-green-900/30 to-red-900/30 rounded-xl p-4 mb-6 border border-green-500/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              {/* Real Traffic */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <UserCheck className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-green-400 font-semibold uppercase">Umani Reali (Google)</div>
                  <div className="text-2xl font-bold text-green-400">{seoData.summary.totalClicks}</div>
                </div>
              </div>

              <div className="text-slate-500 text-2xl">vs</div>

              {/* Bot Traffic */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Bot className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-xs text-red-400 font-semibold uppercase">Bot/Crawler</div>
                  <div className="text-2xl font-bold text-red-400">~{Math.max(0, data.summary.totalVisitors - seoData.summary.totalClicks)}</div>
                </div>
              </div>
            </div>

            {/* Percentage */}
            <div className="text-right">
              <div className="text-xs text-slate-400">Traffico reale</div>
              <div className="text-xl font-bold text-green-400">
                {data.summary.totalVisitors > 0
                  ? ((seoData.summary.totalClicks / data.summary.totalVisitors) * 100).toFixed(1)
                  : '0'}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEO Performance Cards */}
      {seoData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
              <MousePointer className="w-4 h-4" />
              <span>Click da Google</span>
            </div>
            <div className="text-2xl font-bold text-white">{seoData.summary.totalClicks}</div>
            <div className={`text-sm flex items-center gap-1 ${seoData.summary.growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {seoData.summary.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {seoData.summary.growth >= 0 ? '+' : ''}{seoData.summary.growth}% trend
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
              <Eye className="w-4 h-4" />
              <span>Impressioni</span>
            </div>
            <div className="text-2xl font-bold text-white">{seoData.summary.totalImpressions.toLocaleString()}</div>
            <div className="text-sm text-slate-400">volte su Google</div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl p-4 border border-purple-500/20">
            <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
              <Target className="w-4 h-4" />
              <span>CTR</span>
            </div>
            <div className="text-2xl font-bold text-white">{seoData.summary.avgCTR}%</div>
            <div className="text-sm text-slate-400">click rate</div>
          </div>

          <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl p-4 border border-orange-500/20">
            <div className="flex items-center gap-2 text-orange-400 text-sm mb-1">
              <Hash className="w-4 h-4" />
              <span>Posizione Media</span>
            </div>
            <div className="text-2xl font-bold text-white">{seoData.summary.avgPosition}</div>
            <div className="text-sm text-slate-400">su Google</div>
          </div>
        </div>
      )}

      {/* Odoo Traffic Cards (includes bots) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Bot className="w-4 h-4" />
            <span>Visite Totali (con bot)</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.summary.todayVisitors}</div>
          <div className={`text-sm flex items-center gap-1 ${data.summary.dailyGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.summary.dailyGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {data.summary.dailyGrowth >= 0 ? '+' : ''}{data.summary.dailyGrowth}% vs ieri
          </div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Bot className="w-4 h-4" />
            <span>Totale 7gg (con bot)</span>
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
        <div className="flex items-end gap-3" style={{ height: '160px' }}>
          {data.visitorsPerDay.map((day, i) => {
            const heightPx = maxVisitors > 0 ? Math.max((day.count / maxVisitors) * 120, 8) : 8;
            const isToday = i === data.visitorsPerDay.length - 1;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-semibold text-slate-300 mb-1">{day.count}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: heightPx }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                  className={`w-full rounded-t-lg ${isToday ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-lg shadow-cyan-500/30' : 'bg-gradient-to-t from-slate-600 to-slate-400'}`}
                />
                <span className="text-xs text-slate-500 mt-2">{formatDate(day.date)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Google Queries */}
      {seoData && seoData.topQueries && seoData.topQueries.length > 0 && (
        <div className="bg-gradient-to-br from-green-900/20 to-slate-800/50 rounded-xl p-4 mb-6 border border-green-500/20">
          <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-3">
            <Search className="w-4 h-4" />
            <span>Ricerche Google (cosa cercano per trovarti)</span>
          </div>
          <div className="space-y-2">
            {seoData.topQueries.slice(0, 5).map((q) => (
              <div key={q.query} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-300 truncate max-w-[200px]">"{q.query}"</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-400">{q.clicks} click</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-blue-400">{q.impressions} imp</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-purple-400">{q.ctr}% CTR</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SEO Countries (Real) */}
        {seoData && seoData.topCountries && (
          <div className="bg-gradient-to-br from-green-900/20 to-slate-700/20 rounded-xl p-4 border border-green-500/10">
            <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-3">
              <MapPin className="w-4 h-4" />
              <span>Paesi (Reali Google)</span>
            </div>
            <div className="space-y-2">
              {seoData.topCountries.slice(0, 5).map((country) => {
                const countryNames: Record<string, string> = {
                  'che': '🇨🇭 Svizzera',
                  'ita': '🇮🇹 Italia',
                  'deu': '🇩🇪 Germania',
                  'fra': '🇫🇷 Francia',
                  'aut': '🇦🇹 Austria',
                  'rou': '🇷🇴 Romania'
                };
                return (
                  <div key={country.country} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{countryNames[country.country] || country.country}</span>
                    <span className="text-sm text-green-400">{country.clicks} click</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Countries */}
        <div className="bg-slate-700/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-3">
            <MapPin className="w-4 h-4" />
            <span>Top Paesi</span>
          </div>
          <div className="space-y-2">
            {data.topCountries.map((country) => (
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
                <span className="text-sm text-slate-300 truncate max-w-[100px]">{lang.name}</span>
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
                <span className="text-sm text-slate-300 truncate max-w-[100px]">{page.name}</span>
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
