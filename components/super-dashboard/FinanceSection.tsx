'use client';

import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Scale } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { mockPLData, mockBreakEven, mockBreakEvenChartData, mockARAging } from '@/lib/super-dashboard/mockData';

interface FinanceSectionProps {
  period: string;
}

export function FinanceSection({ period }: FinanceSectionProps) {
  // Use mock data from centralized mockData.ts
  const plData = mockPLData;
  const breakEven = mockBreakEven;
  const breakEvenChartData = mockBreakEvenChartData;
  const arAging = mockARAging;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ok': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'critical': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'ok': return 'bg-green-600/20';
      case 'warning': return 'bg-yellow-600/20';
      case 'high': return 'bg-orange-600/20';
      case 'critical': return 'bg-red-600/20';
      default: return 'bg-slate-600/20';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">💰</span>
          Finanza & P&L
        </h2>
        <p className="text-slate-400 text-sm">
          Situazione finanziaria e break-even analysis
        </p>
      </div>

      {/* P&L Summary */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">P&L Summary (MTD)</h3>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="text-slate-300">Revenue</span>
            <div className="text-right">
              <div className="text-white font-bold">CHF {plData.revenue.toLocaleString()}</div>
              <div className="text-green-400 text-xs flex items-center gap-1 justify-end">
                <TrendingUp className="w-3 h-3" />
                +12% vs last month
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="text-slate-300">COGS</span>
            <div className="text-right">
              <div className="text-slate-400 font-bold">CHF {plData.cogs.toLocaleString()}</div>
              <div className="text-slate-500 text-xs">60% of revenue</div>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-700 bg-emerald-600/10 -mx-4 px-4 py-2">
            <span className="text-white font-semibold">Gross Profit</span>
            <div className="text-right">
              <div className="text-emerald-400 font-bold">CHF {plData.grossProfit.toLocaleString()}</div>
              <div className="text-emerald-500 text-xs">40% margin ✅</div>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <span className="text-slate-300">Operating Expenses</span>
            <div className="text-right">
              <div className="text-slate-400 font-bold">CHF {plData.opex.toLocaleString()}</div>
              <div className="text-slate-500 text-xs">24% of revenue</div>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-700 bg-blue-600/10 -mx-4 px-4 py-2">
            <span className="text-white font-semibold">EBITDA</span>
            <div className="text-right">
              <div className="text-blue-400 font-bold">CHF {plData.ebitda.toLocaleString()}</div>
              <div className="text-blue-500 text-xs">16% ✅</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-pink-600/20 -mx-4 px-4 py-3 rounded">
            <span className="text-white font-bold">Net Income</span>
            <div className="text-right">
              <div className="text-purple-400 font-bold text-xl">CHF {plData.netIncome.toLocaleString()}</div>
              <div className="text-purple-500 text-xs font-semibold">11.2% 🎯</div>
            </div>
          </div>
        </div>
      </div>

      {/* Break-Even Analysis */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Break-Even Analysis</h3>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs mb-1">Break-Even</div>
            <div className="text-white font-bold">{breakEven.units.toLocaleString()}</div>
            <div className="text-slate-500 text-xs">units</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs mb-1">BEP Revenue</div>
            <div className="text-white font-bold">{(breakEven.revenue / 1000).toFixed(0)}K</div>
            <div className="text-slate-500 text-xs">CHF</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs mb-1">Current</div>
            <div className="text-green-400 font-bold">{breakEven.currentUnits.toLocaleString()}</div>
            <div className="text-green-500 text-xs">+{((breakEven.currentUnits / breakEven.units - 1) * 100).toFixed(0)}%</div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs mb-1">Safety Margin</div>
            <div className="text-emerald-400 font-bold">{breakEven.marginSafetyPercent}%</div>
            <div className="text-emerald-500 text-xs">🟢</div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={breakEvenChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="units"
                stroke="#94a3b8"
                label={{ value: 'Units', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
              />
              <YAxis
                stroke="#94a3b8"
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: any) => `CHF ${value.toLocaleString()}`}
              />
              <ReferenceLine
                x={breakEven.units}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{ value: 'BEP', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue" dot={false} />
              <Line type="monotone" dataKey="costs" stroke="#ef4444" strokeWidth={3} name="Total Costs" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AR Aging */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Cash Flow & Crediti (AR Aging)</h3>

        <div className="space-y-2">
          {arAging.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className={`${getSeverityBg(item.severity)} rounded-lg p-3 flex items-center justify-between`}
            >
              <div className="flex-1">
                <div className="text-white font-medium text-sm mb-1">{item.period}</div>
                <div className="text-slate-400 text-xs">{item.count} fatture</div>
              </div>
              <div className="text-right">
                <div className={`${getSeverityColor(item.severity)} font-bold text-lg`}>
                  CHF {item.amount.toLocaleString()}
                </div>
                <div className="text-slate-400 text-xs">{item.percent}%</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
