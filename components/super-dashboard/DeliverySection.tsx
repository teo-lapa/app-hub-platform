'use client';

import { motion } from 'framer-motion';
import { Truck, MapPin, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { mockAutisti, mockKPIGiornata, mockProblemiDelivery } from '@/lib/super-dashboard/mockData';

export function DeliverySection() {
  const autisti = mockAutisti;
  const kpiGiornata = mockKPIGiornata;
  const problemi = mockProblemiDelivery;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivery': return '🚚';
      case 'transit': return '🚛';
      case 'starting': return '⏰';
      default: return '📍';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivery': return 'In consegna';
      case 'transit': return 'In transito';
      case 'starting': return 'Partenza';
      default: return 'Sconosciuto';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivery': return 'border-green-600/30 bg-green-600/10';
      case 'transit': return 'border-blue-600/30 bg-blue-600/10';
      case 'starting': return 'border-orange-600/30 bg-orange-600/10';
      default: return 'border-slate-600/30 bg-slate-600/10';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">🚚</span>
          Consegne & Logistica
        </h2>
        <p className="text-slate-400 text-sm">
          Live tracking autisti e monitoring consegne
        </p>
      </div>

      {/* Map Placeholder + Autisti */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Mappa Live Autisti</h3>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4 mb-4 aspect-video flex items-center justify-center border border-slate-700/50">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500">
              Google Maps Live Tracking
              <br />
              <span className="text-xs">(Integrazione in fase di collegamento dati reali)</span>
            </p>
          </div>
        </div>

        {/* Autisti Cards */}
        <div className="space-y-2">
          {autisti.map((autista, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`${getStatusColor(autista.status)} border rounded-lg p-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{getStatusIcon(autista.status)}</div>
                  <div>
                    <div className="text-white font-bold">{autista.nome}</div>
                    <div className="text-slate-300 text-sm">
                      {getStatusText(autista.status)} • Stop {autista.stops}/{autista.totale}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-xs">ETA</div>
                  <div className="text-white font-bold">{autista.eta}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Timeline Consegne */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Timeline Consegne Oggi</h3>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="relative">
            {/* Timeline Bar */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-slate-400 text-sm">08:00</div>
              <div className="flex-1 mx-4 h-2 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '65%' }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-orange-500 rounded-full"
                />
              </div>
              <div className="text-slate-400 text-sm">18:00</div>
            </div>

            {/* Status Indicators */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-white">Stop 1-4 (Completate)</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span className="text-white">Stop 5 (In Progress) ← Marco è qui</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-slate-400">Stop 6-12 (Pending)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Giornata */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">KPI Giornata</h3>

        <div className="grid grid-cols-4 gap-3">
          {kpiGiornata.map((kpi, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="bg-slate-900/50 rounded-lg p-3 text-center"
            >
              <div className="text-slate-400 text-xs mb-1">{kpi.label}</div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Problemi Active */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Problemi Active</h3>
        </div>

        <div className="space-y-2">
          {problemi.map((problema, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              className={`${
                problema.severity === 'high' ? 'bg-red-600/10 border-red-600/30' : 'bg-orange-600/10 border-orange-600/30'
              } border rounded-lg p-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">{problema.autista}</div>
                  <div className="text-slate-300 text-sm">{problema.problema}</div>
                  <div className="text-slate-400 text-xs mt-1">Cliente: {problema.cliente}</div>
                </div>
                <button
                  className={`${
                    problema.severity === 'high' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                  } text-white px-3 py-1 rounded text-xs font-semibold`}
                >
                  {problema.severity === 'high' ? 'RESOLVE' : 'NOTIFY'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
