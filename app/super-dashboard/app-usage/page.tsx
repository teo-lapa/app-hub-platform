'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Users, Clock, ArrowLeft, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useAppTracking } from '@/hooks/useAppTracking';

interface UsageStats {
  totalEvents: number;
  totalApps: number;
  totalUsers: number;
  appStats: Array<{
    appId: string;
    appName: string;
    openCount: number;
    uniqueUsers: number;
    totalDuration: number;
    avgDuration: number;
  }>;
  userStats: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    totalSessions: number;
    appsUsed: string[];
  }>;
  timeline: Array<{
    date: string;
    openCount: number;
    uniqueUsers: number;
  }>;
  recentSessions: Array<{
    userId: string;
    userName: string;
    appId: string;
    appName: string;
    timestamp: number;
    action: string;
    duration?: number;
  }>;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Adesso';
  if (diffMins < 60) return `${diffMins}m fa`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}g fa`;
}

export default function AppUsagePage() {
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [days, setDays] = useState(7);

  // Traccia questa pagina stessa
  useAppTracking({ appId: 'app-usage-dashboard', appName: 'App Usage Dashboard' });

  useEffect(() => {
    async function fetchUsageStats() {
      try {
        setLoading(true);
        const response = await fetch(`/api/usage-stats?days=${days}`);
        const result = await response.json();
        if (result.success) {
          setUsageStats(result.data);
        }
      } catch (error) {
        console.error('Error fetching usage stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsageStats();
  }, [days]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-teal-500/20"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/super-dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Dashboard</span>
                </motion.button>
              </Link>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Activity className="w-8 h-8 text-teal-400" />
                App Usage Analytics
              </h1>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    days === d
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {d === 7 ? '7 giorni' : d === 14 ? '14 giorni' : d === 30 ? '30 giorni' : '90 giorni'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-white text-lg">Caricamento statistiche...</div>
          </div>
        ) : usageStats ? (
          <>
            {/* KPI Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Eventi Totali</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {usageStats.totalEvents.toLocaleString()}
                </div>
                <div className="text-white/60 text-xs mt-1">
                  Ultimi {days} giorni
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <Smartphone className="w-4 h-4" />
                  <span>App Utilizzate</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {usageStats.totalApps}
                </div>
                <div className="text-white/60 text-xs mt-1">
                  App diverse aperte
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <Users className="w-4 h-4" />
                  <span>Utenti Attivi</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {usageStats.totalUsers}
                </div>
                <div className="text-white/60 text-xs mt-1">
                  Utenti unici
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Durata Media</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {usageStats.appStats.length > 0
                    ? formatDuration(
                        Math.round(
                          usageStats.appStats.reduce((sum, app) => sum + app.avgDuration, 0) /
                            usageStats.appStats.length
                        )
                      )
                    : '0s'}
                </div>
                <div className="text-white/60 text-xs mt-1">
                  Per sessione
                </div>
              </div>
            </motion.div>

            {/* App Statistics Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-400" />
                  Statistiche per App
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        App
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Aperture
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Utenti Unici
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Durata Totale
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Durata Media
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {usageStats.appStats.length > 0 ? (
                      usageStats.appStats.map((app, index) => (
                        <motion.tr
                          key={app.appId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                                <Smartphone className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="text-white font-medium">{app.appName}</div>
                                <div className="text-slate-400 text-sm">{app.appId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-white font-semibold">{app.openCount}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-white font-semibold">{app.uniqueUsers}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-white font-semibold">
                              {formatDuration(app.totalDuration)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-teal-400 font-semibold">
                              {formatDuration(app.avgDuration)}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          Nessun dato disponibile
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* User Statistics Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Statistiche per Utente
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Utente
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Sessioni
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        App Usate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {usageStats.userStats.length > 0 ? (
                      usageStats.userStats.map((user, index) => (
                        <motion.tr
                          key={user.userId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {user.userName.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="text-white font-medium">{user.userName}</div>
                                <div className="text-slate-400 text-sm">{user.userEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-white font-semibold">{user.totalSessions}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-purple-400 font-semibold">{user.appsUsed.length}</div>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                          Nessun dato disponibile
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Recent Sessions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Attività Recenti
                </h2>
              </div>
              <div className="divide-y divide-slate-700/50">
                {usageStats.recentSessions.length > 0 ? (
                  usageStats.recentSessions.map((session, index) => (
                    <motion.div
                      key={`${session.userId}-${session.timestamp}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="px-6 py-4 hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {session.userName.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-white font-medium">
                              {session.userName}{' '}
                              <span className="text-slate-400">
                                {session.action === 'open' ? 'ha aperto' : 'ha chiuso'}
                              </span>{' '}
                              <span className="text-teal-400">{session.appName}</span>
                            </div>
                            <div className="text-slate-500 text-sm">
                              {formatTimestamp(session.timestamp)}
                              {session.duration && (
                                <span className="ml-2">
                                  • Durata: {formatDuration(session.duration)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center text-slate-400">
                    Nessuna attività recente
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-white text-lg">Nessun dato disponibile</div>
          </div>
        )}
      </div>
    </div>
  );
}
