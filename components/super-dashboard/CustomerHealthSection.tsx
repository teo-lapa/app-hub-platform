'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, Phone, Mail, Calendar, ExternalLink } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { mockHighRiskCustomers, mockUpsellOpportunities, mockHeatmapData } from '@/lib/super-dashboard/mockData';

export function CustomerHealthSection() {
  const highRiskCustomers = mockHighRiskCustomers;
  const upsellOpportunities = mockUpsellOpportunities;
  const heatmapData = mockHeatmapData;

  const getColorByStatus = (status: string) => {
    switch (status) {
      case 'critical': return '#ef4444'; // red
      case 'warning': return '#f59e0b'; // orange
      case 'ok': return '#10b981'; // green
      case 'excellent': return '#3b82f6'; // blue
      default: return '#64748b';
    }
  };

  const getRiskBadge = (risk: number) => {
    if (risk >= 80) return { text: '🔥 CRITICO', color: 'bg-red-600' };
    if (risk >= 70) return { text: '⚠️ ALTO', color: 'bg-orange-600' };
    if (risk >= 50) return { text: '🟡 MEDIO', color: 'bg-yellow-600' };
    return { text: '🟢 BASSO', color: 'bg-green-600' };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">👥</span>
          Customer Health Matrix
        </h2>
        <p className="text-slate-400 text-sm">
          Analisi predittiva clienti con AI scoring
        </p>
      </div>

      {/* High Risk Customers Table */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">
            Clienti ad Alto Rischio (Churn Risk &gt; 70%)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-400 pb-3">CLIENTE</th>
                <th className="text-left text-xs font-semibold text-slate-400 pb-3">HEALTH</th>
                <th className="text-left text-xs font-semibold text-slate-400 pb-3">RISK</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-3">REVENUE YTD</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-3">GIORNI NO ORDER</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-3">AZIONE</th>
              </tr>
            </thead>
            <tbody>
              {highRiskCustomers.map((customer, index) => {
                const riskBadge = getRiskBadge(customer.churnRisk);
                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3">
                      <div>
                        <div className="font-medium text-white">{customer.name}</div>
                        <div className="text-xs text-slate-400">{customer.city}</div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-red-400">{customer.healthScore}</div>
                        <div className="text-red-400">🔴</div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`${riskBadge.color} text-white text-xs px-2 py-1 rounded-full font-semibold`}>
                        {riskBadge.text}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="font-semibold text-white">CHF {customer.revenueYTD.toLocaleString()}</div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="text-orange-400 font-bold">{customer.daysSinceOrder}</div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold transition-colors">
                          CALL NOW
                        </button>
                        <button className="bg-slate-700 hover:bg-slate-600 text-white p-1 rounded transition-colors">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upsell Opportunities */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">
            Top Opportunità Upsell
          </h3>
        </div>

        <div className="space-y-2">
          {upsellOpportunities.map((opp, index) => (
            <motion.div
              key={opp.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-600/30 rounded-lg p-4 hover:border-green-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl font-bold text-green-400">{opp.upsellScore}</div>
                    <div>
                      <div className="font-semibold text-white">{opp.name}</div>
                      <div className="text-sm text-slate-300">{opp.suggestedProducts}</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Potenziale</div>
                  <div className="text-xl font-bold text-green-400">CHF {opp.potentialValue.toLocaleString()}</div>
                  <button className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-xs font-semibold transition-colors group-hover:scale-105">
                    SEND SAMPLE
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Health vs Value Heatmap */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">
          Heatmap Clienti (Health Score vs Revenue)
        </h3>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="health"
                name="Health Score"
                domain={[0, 100]}
                stroke="#94a3b8"
                label={{ value: 'Health Score', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
              />
              <YAxis
                type="number"
                dataKey="value"
                name="Revenue"
                stroke="#94a3b8"
                label={{ value: 'Revenue (CHF)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Revenue') return [`CHF ${value.toLocaleString()}`, name];
                  return [value, name];
                }}
              />
              <Scatter name="Clienti" data={heatmapData}>
                {heatmapData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColorByStatus(entry.status)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-300">Critico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-300">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-300">OK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-300">Champions</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
