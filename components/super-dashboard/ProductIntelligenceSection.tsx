'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { mockTopProducts, mockSlowMovers, mockABCData } from '@/lib/super-dashboard/mockData';

export function ProductIntelligenceSection() {
  const topProducts = mockTopProducts;
  const slowMovers = mockSlowMovers;
  const abcData = mockABCData;

  const getSeverityColor = (severity: string) => {
    return severity === 'critical' ? 'text-red-400' : 'text-orange-400';
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">📈</span>
          Product Intelligence
        </h2>
        <p className="text-slate-400 text-sm">
          Analisi prodotti e performance catalogo
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Top 5 Best Sellers</h3>
          </div>

          <div className="space-y-2">
            {topProducts.map((product, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 border border-green-600/20 rounded-lg p-3 hover:border-green-500/40 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-green-400">#{product.rank}</div>
                    <div>
                      <div className="text-white font-medium text-sm">{product.name}</div>
                      <div className="text-slate-400 text-xs">{product.units}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    +{product.trend}%
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Revenue:</span>
                  <span className="text-white font-bold">CHF {product.revenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-400">Margin:</span>
                  <span className="text-emerald-400 font-bold">{product.margin}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Slow Movers + ABC Analysis */}
        <div>
          {/* Slow Movers */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Slow Movers (&gt;90 giorni)</h3>
            </div>

            <div className="space-y-2">
              {slowMovers.map((product, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-red-600/10 border border-red-600/30 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{product.name}</div>
                      <div className="text-slate-400 text-xs mt-1">
                        Ultima vendita: {product.lastSale}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`${getSeverityColor(product.severity)} font-bold`}>{product.days} gg</div>
                      <div className="text-slate-400 text-xs">CHF {product.stock.toLocaleString()}</div>
                    </div>
                  </div>
                  <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold w-full">
                    PROMO/CLEARANCE
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ABC Analysis */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">ABC Analysis</h3>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={abcData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="category" type="category" stroke="#94a3b8" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="revenue" fill="#8884d8" radius={[0, 8, 8, 0]}>
                    {abcData.map((entry, index) => (
                      <Bar key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-green-400">● A Products</span>
                  <span className="text-slate-300">20% prodotti → 80% revenue</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-blue-400">● B Products</span>
                  <span className="text-slate-300">30% prodotti → 15% revenue</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">● C Products</span>
                  <span className="text-slate-300">50% prodotti → 5% revenue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
