'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Percent, TrendingUp, TrendingDown, ArrowLeft, Gift, AlertTriangle, Trophy, Calendar } from 'lucide-react';
import Link from 'next/link';

interface MarginsData {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercentage: number;
    orderCount: number;
    productCount: number;
    period: { startDate: string; endDate: string };
  };
  topProducts: Array<{
    id: number;
    name: string;
    quantitySold: number;
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercentage: string;
  }>;
  lossProducts: Array<{
    id: number;
    name: string;
    quantitySold: number;
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercentage: string;
  }>;
  giftsGiven: {
    totalCost: number;
    productCount: number;
    products: Array<{
      productId: number;
      productName: string;
      quantityGiven: number;
      totalCost: number;
    }>;
    byCustomer: Array<{
      customerId: number;
      customerName: string;
      products: Array<{
        productName: string;
        quantity: number;
        cost: number;
      }>;
      totalCost: number;
    }>;
  };
}

export default function MarginiPage() {
  const [loading, setLoading] = useState(true);
  const [marginsData, setMarginsData] = useState<MarginsData | null>(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    async function fetchMarginsDetail() {
      try {
        setLoading(true);
        const response = await fetch(`/api/super-dashboard/margini?period=${period}`);
        const result = await response.json();
        if (result.success) {
          setMarginsData(result.data);
        }
      } catch (error) {
        console.error('Error fetching margins:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMarginsDetail();
  }, [period]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-rose-500/20"
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
                <Percent className="w-8 h-8 text-rose-400" />
                Analisi Margini
              </h1>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {['week', 'month', 'quarter'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    period === p
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Trimestre'}
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
            <div className="text-white text-lg">Caricamento dati margini...</div>
          </div>
        ) : marginsData ? (
          <>
            {/* KPI Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <Percent className="w-4 h-4" />
                  <span>Margine Totale</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  CHF {(marginsData.summary.totalMargin / 1000).toFixed(0)}K
                </div>
                <p className="text-white/60 text-xs mt-2">
                  {marginsData.summary.marginPercentage.toFixed(1)}% di margine
                </p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Fatturato</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  CHF {(marginsData.summary.totalRevenue / 1000).toFixed(0)}K
                </div>
                <p className="text-white/60 text-xs mt-2">
                  {marginsData.summary.orderCount} ordini
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <span>Costo</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  CHF {(marginsData.summary.totalCost / 1000).toFixed(0)}K
                </div>
                <p className="text-white/60 text-xs mt-2">Costo del venduto</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-1">
                  <Trophy className="w-4 h-4" />
                  <span>Prodotti</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {marginsData.summary.productCount}
                </div>
                <p className="text-white/60 text-xs mt-2">Articoli venduti</p>
              </div>
            </motion.div>

            {/* Top 10 Products by Margin */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
            >
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                Top 10 Prodotti per Margine
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 pb-3 px-2">PRODOTTO</th>
                      <th className="text-right text-slate-400 pb-3 px-2">QTÀ</th>
                      <th className="text-right text-slate-400 pb-3 px-2">FATTURATO</th>
                      <th className="text-right text-slate-400 pb-3 px-2">COSTO</th>
                      <th className="text-right text-slate-400 pb-3 px-2">MARGINE €</th>
                      <th className="text-right text-slate-400 pb-3 px-2">MARGINE %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginsData.topProducts.slice(0, 10).map((product, index) => (
                      <tr key={product.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-2 text-white">{product.name.substring(0, 50)}</td>
                        <td className="py-3 px-2 text-right text-slate-300">{product.quantitySold}</td>
                        <td className="py-3 px-2 text-right text-slate-300">CHF {product.totalRevenue.toFixed(0)}</td>
                        <td className="py-3 px-2 text-right text-slate-300">CHF {product.totalCost.toFixed(0)}</td>
                        <td className="py-3 px-2 text-right text-green-400 font-semibold">
                          CHF {product.totalMargin.toFixed(0)}
                        </td>
                        <td className="py-3 px-2 text-right text-green-400 font-semibold">{product.marginPercentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Prodotti Regalati */}
            {marginsData.giftsGiven.productCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
              >
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Gift className="w-6 h-6 text-pink-400" />
                  Prodotti Regalati
                  <span className="text-sm text-pink-400 font-normal">
                    ({marginsData.giftsGiven.productCount} prodotti - CHF {marginsData.giftsGiven.totalCost.toFixed(0)} costo)
                  </span>
                </h2>

                {/* Regali per Cliente */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-300">Regali per Cliente</h3>
                  {marginsData.giftsGiven.byCustomer.map((customer) => (
                    <div key={customer.customerId} className="bg-slate-700/30 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium">{customer.customerName}</span>
                        <span className="text-pink-400 font-semibold">CHF {customer.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        {customer.products.map((product, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{product.productName} (x{product.quantity})</span>
                            <span>CHF {product.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Prodotti in Perdita */}
            {marginsData.lossProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-red-700/50 shadow-xl"
              >
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  Prodotti in Perdita
                  <span className="text-sm text-red-400 font-normal">({marginsData.lossProducts.length} prodotti)</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-slate-400 pb-3 px-2">PRODOTTO</th>
                        <th className="text-right text-slate-400 pb-3 px-2">QTÀ</th>
                        <th className="text-right text-slate-400 pb-3 px-2">FATTURATO</th>
                        <th className="text-right text-slate-400 pb-3 px-2">COSTO</th>
                        <th className="text-right text-slate-400 pb-3 px-2">PERDITA €</th>
                        <th className="text-right text-slate-400 pb-3 px-2">PERDITA %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marginsData.lossProducts.map((product) => (
                        <tr key={product.id} className="border-b border-slate-700/50 hover:bg-red-900/10 transition-colors">
                          <td className="py-3 px-2 text-white">{product.name.substring(0, 50)}</td>
                          <td className="py-3 px-2 text-right text-slate-300">{product.quantitySold}</td>
                          <td className="py-3 px-2 text-right text-slate-300">CHF {product.totalRevenue.toFixed(0)}</td>
                          <td className="py-3 px-2 text-right text-slate-300">CHF {product.totalCost.toFixed(0)}</td>
                          <td className="py-3 px-2 text-right text-red-400 font-semibold">
                            CHF {product.totalMargin.toFixed(0)}
                          </td>
                          <td className="py-3 px-2 text-right text-red-400 font-semibold">{product.marginPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="text-center text-red-400">Errore nel caricamento dei dati</div>
        )}
      </div>
    </div>
  );
}
