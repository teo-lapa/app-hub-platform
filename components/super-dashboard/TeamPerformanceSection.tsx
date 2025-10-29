'use client';

import { motion } from 'framer-motion';
import { Trophy, Activity, Target } from 'lucide-react';

import { mockLeaderboard, mockActivityHeatmap, mockTeamKPIs } from '@/lib/super-dashboard/mockData';

export function TeamPerformanceSection() {
  const leaderboard = mockLeaderboard;
  const activityHeatmap = mockActivityHeatmap;
  const kpis = mockTeamKPIs;

  const getQuotaColor = (quota: number) => {
    if (quota >= 100) return 'text-green-400';
    if (quota >= 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getQuotaBg = (quota: number) => {
    if (quota >= 100) return 'bg-green-600';
    if (quota >= 90) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">👔</span>
          Team Performance
        </h2>
        <p className="text-slate-400 text-sm">
          Leaderboard venditori e performance tracking
        </p>
      </div>

      {/* Leaderboard */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Leaderboard (Mese Corrente)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">#</th>
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">VENDITORE</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">REVENUE</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">ORDERS</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">QUOTA</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">PERF</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((seller, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="py-3 text-2xl">{seller.emoji}</td>
                  <td className="py-3 text-white font-medium">{seller.name}</td>
                  <td className="py-3 text-right text-white font-bold">
                    CHF {(seller.revenue / 1000).toFixed(0)}K
                  </td>
                  <td className="py-3 text-right text-slate-300">{seller.orders}</td>
                  <td className="py-3 text-right">
                    <span className={`${getQuotaColor(seller.quota)} font-bold`}>
                      {seller.quota}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(seller.quota, 100)}%` }}
                          transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                          className={`h-full ${getQuotaBg(seller.quota)} rounded-full`}
                        />
                      </div>
                      {seller.quota >= 100 && <span>🔥</span>}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Activity Heatmap (Ultime 2 settimane)</h3>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex gap-2 mb-2 text-xs text-slate-500">
            <div className="w-20" />
            {['L', 'M', 'M', 'G', 'V', 'S', 'D', 'L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, i) => (
              <div key={i} className="w-6 text-center">{day}</div>
            ))}
          </div>
          {activityHeatmap.map((person, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="flex gap-2 mb-1"
            >
              <div className="w-20 text-slate-300 text-sm">{person.name}</div>
              {person.days.map((day, i) => (
                <div key={i} className="w-6 text-center">{day}</div>
              ))}
            </motion.div>
          ))}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span>🟩 High activity</span>
            <span>🟨 Medium</span>
            <span>🟧 Low</span>
            <span>⬜ No data</span>
          </div>
        </div>
      </div>

      {/* KPI Details */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">KPI per Venditore</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">NOME</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">CONV.</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">AVG DEAL</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">VISITE</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">SAMPLES</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">HEALTH</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 + index * 0.05 }}
                  className="border-b border-slate-700/50"
                >
                  <td className="py-2 text-white font-medium text-sm">{kpi.name}</td>
                  <td className="py-2 text-center">
                    <span className={kpi.convRate >= 40 ? 'text-green-400' : kpi.convRate >= 35 ? 'text-yellow-400' : 'text-red-400'}>
                      {kpi.convRate}%
                    </span>
                  </td>
                  <td className="py-2 text-center text-slate-300">{kpi.avgDeal.toLocaleString()}</td>
                  <td className="py-2 text-center text-slate-300">{kpi.visits}</td>
                  <td className="py-2 text-center text-slate-300">{kpi.samples}</td>
                  <td className="py-2 text-center">
                    <span className={kpi.health >= 70 ? 'text-green-400' : kpi.health >= 60 ? 'text-yellow-400' : 'text-orange-400'}>
                      {kpi.health}/100
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}
