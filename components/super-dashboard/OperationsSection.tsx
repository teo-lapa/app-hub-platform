'use client';

import { motion } from 'framer-motion';
import { Package, AlertCircle, Clock, TrendingDown, MapPin } from 'lucide-react';
import { mockArriviMerce, mockStockCritico, mockScadenzeImminenti, mockWarehouseCapacity } from '@/lib/super-dashboard/mockData';

export function OperationsSection() {
  // Mock data - imported from centralized mockData file
  const arriviMerceOggi = mockArriviMerce;
  const stockCritico = mockStockCritico;
  const scadenzeImminenti = mockScadenzeImminenti;
  const warehouseCapacity = mockWarehouseCapacity;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-600/20 border-green-600/30';
      case 'progress': return 'bg-blue-600/20 border-blue-600/30';
      case 'waiting': return 'bg-orange-600/20 border-orange-600/30';
      default: return 'bg-slate-600/20 border-slate-600/30';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const getSeverityButton = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 hover:bg-red-700';
      case 'high': return 'bg-orange-600 hover:bg-orange-700';
      case 'medium': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-slate-600 hover:bg-slate-700';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">📦</span>
          Operations & Magazzino
        </h2>
        <p className="text-slate-400 text-sm">
          Controllo real-time inventario e operazioni
        </p>
      </div>

      {/* Arrivi Merce Oggi */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Arrivi Merce Oggi</h3>
        </div>

        <div className="space-y-2">
          {arriviMerceOggi.map((arrivo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`${getStatusColor(arrivo.status)} border rounded-lg p-3 flex items-center justify-between`}
            >
              <div className="flex items-center gap-4">
                <div className="text-white font-bold text-lg">{arrivo.ora}</div>
                <div>
                  <div className="text-white font-medium">{arrivo.fornitore}</div>
                  <div className="text-slate-300 text-sm">{arrivo.prodotti} prodotti</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{arrivo.statusText}</span>
                {arrivo.status === 'progress' && (
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold">
                    CONTINUA
                  </button>
                )}
                {arrivo.status === 'waiting' && (
                  <button className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-semibold">
                    PREPARA
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Alert Stock Critico */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Alert Stock Critico</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-400 pb-2">PRODOTTO</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">STOCK</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">MIN</th>
                <th className="text-center text-xs font-semibold text-slate-400 pb-2">GIORNI</th>
                <th className="text-right text-xs font-semibold text-slate-400 pb-2">AZIONE</th>
              </tr>
            </thead>
            <tbody>
              {stockCritico.map((item, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="border-b border-slate-700/50"
                >
                  <td className="py-3 text-white font-medium">{item.prodotto}</td>
                  <td className={`py-3 text-center font-bold ${getSeverityColor(item.severity)}`}>
                    {item.stock}
                  </td>
                  <td className="py-3 text-center text-slate-400">{item.min}</td>
                  <td className={`py-3 text-center font-bold ${getSeverityColor(item.severity)}`}>
                    {item.giorni}
                  </td>
                  <td className="py-3 text-right">
                    <button className={`${getSeverityButton(item.severity)} text-white px-3 py-1 rounded text-xs font-semibold`}>
                      ORDER NOW
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scadenze Imminenti */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Scadenze Imminenti (&lt;30 giorni)</h3>
        </div>

        <div className="space-y-2">
          {scadenzeImminenti.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="bg-orange-600/10 border border-orange-600/30 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  <div>
                    <div className="text-white font-medium">{item.prodotto}</div>
                    <div className="text-sm text-slate-300">
                      Lotto: {item.lotto} • {item.zone}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <div className="text-orange-400 font-bold">{item.scadenza}</div>
                  <div className="text-slate-300 text-sm">{item.qty}</div>
                </div>
                <button className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-semibold whitespace-nowrap">
                  PROMO
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Warehouse Capacity Gauge */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Capacità Magazzino</h3>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          {/* Total Gauge */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 font-medium">Totale</span>
              <span className="text-2xl font-bold text-white">{warehouseCapacity.total}%</span>
            </div>
            <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${warehouseCapacity.total}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"
              />
            </div>
          </div>

          {/* Zone Breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Secco</div>
              <div className="text-2xl font-bold text-white mb-1">{warehouseCapacity.secco}%</div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${warehouseCapacity.secco}%` }}
                  transition={{ duration: 1, delay: 0.6 }}
                  className="h-full bg-blue-500 rounded-full"
                />
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Frigo</div>
              <div className="text-2xl font-bold text-white mb-1">{warehouseCapacity.frigo}%</div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${warehouseCapacity.frigo}%` }}
                  transition={{ duration: 1, delay: 0.7 }}
                  className="h-full bg-cyan-500 rounded-full"
                />
              </div>
            </div>

            <div className="text-center">
              <div className="text-slate-400 text-sm mb-1">Pingu</div>
              <div className="text-2xl font-bold text-white mb-1">{warehouseCapacity.pingu}%</div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${warehouseCapacity.pingu}%` }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
