'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Calculator, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface ContoData {
  fatturato: number;
  costoMerci: number;
  margine: number;
  marginePct: number;
  costiFissi: number;
  risultato: number;
}

interface ContoEconomicoData {
  contabile: ContoData;
  reale: ContoData;
}

interface MagazzinoData {
  zone: {
    [key: string]: { count: number; qty: number; value: number };
  };
  totale: number;
}

const REFRESH_INTERVAL = 30000; // 30 secondi

export function ContoEconomicoSection() {
  const [data, setData] = useState<{ contoEconomico: ContoEconomicoData; magazzino: MagazzinoData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const response = await fetch('/api/super-dashboard/conto-economico?t=' + Date.now());
      const result = await response.json();
      if (result.success) {
        setData(result);
        setLastUpdate(new Date());
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Errore nel caricamento dati');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchData]);

  const formatCHF = (value: number) => {
    const formatted = Math.abs(value).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? `-CHF ${formatted}` : `CHF ${formatted}`;
  };

  const zoneLabels: { [key: string]: { label: string; icon: string; color: string } } = {
    'SECCO_SOPRA': { label: 'Secco Sopra', icon: '📦', color: 'from-amber-500 to-orange-500' },
    'SECCO_SOTTO': { label: 'Secco Sotto', icon: '🍷', color: 'from-purple-500 to-indigo-500' },
    'FRIGO': { label: 'Frigo', icon: '❄️', color: 'from-cyan-500 to-blue-500' },
    'PING': { label: 'Ping (Surgelati)', icon: '🧊', color: 'from-blue-500 to-indigo-600' }
  };

  if (loading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </motion.section>
    );
  }

  if (error || !data) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-red-500/50 shadow-xl"
      >
        <div className="text-red-400 text-center py-8">
          <XCircle className="w-12 h-12 mx-auto mb-4" />
          <p>{error || 'Errore nel caricamento'}</p>
        </div>
      </motion.section>
    );
  }

  const { contoEconomico, magazzino } = data;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 shadow-xl"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
            <span className="text-2xl">📊</span>
            Conto Economico Reale vs Contabile
          </h2>
          <p className="text-slate-400 text-sm">
            Novembre 2025 - Dati in tempo reale da Odoo
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 bg-green-600/20 px-3 py-1.5 rounded-full border border-green-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-green-400 text-xs font-medium">LIVE</span>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-300 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Last update */}
          {lastUpdate && (
            <span className="text-slate-500 text-xs">
              {lastUpdate.toLocaleTimeString('it-IT')}
            </span>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Header Row */}
        <div className="text-slate-400 font-medium"></div>
        <div className="text-center">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <FileText className="w-5 h-5 mx-auto mb-1 text-slate-400" />
            <span className="text-slate-300 font-semibold">Conto Economico</span>
          </div>
        </div>
        <div className="text-center">
          <div className="bg-emerald-600/20 rounded-lg p-3 border border-emerald-500/30">
            <Calculator className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
            <span className="text-emerald-300 font-semibold">Conto PULITO (reale)</span>
          </div>
        </div>

        {/* Fatturato */}
        <div className="flex items-center text-slate-300 font-medium">Fatturato</div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <motion.div
            key={contoEconomico.contabile.fatturato}
            initial={{ scale: 1.1, color: '#fbbf24' }}
            animate={{ scale: 1, color: '#ffffff' }}
            className="text-white font-bold"
          >
            {formatCHF(contoEconomico.contabile.fatturato)}
          </motion.div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-emerald-500/20">
          <motion.div
            key={contoEconomico.reale.fatturato}
            initial={{ scale: 1.1, color: '#fbbf24' }}
            animate={{ scale: 1, color: '#34d399' }}
            className="text-emerald-400 font-bold"
          >
            {formatCHF(contoEconomico.reale.fatturato)}
          </motion.div>
        </div>

        {/* Costo Merci */}
        <div className="flex items-center text-slate-300 font-medium">Costo merci</div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <motion.div
            key={contoEconomico.contabile.costoMerci}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-red-400 font-bold"
          >
            {formatCHF(contoEconomico.contabile.costoMerci)}
          </motion.div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-emerald-500/20">
          <motion.div
            key={contoEconomico.reale.costoMerci}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-red-400 font-bold"
          >
            {formatCHF(contoEconomico.reale.costoMerci)}
          </motion.div>
        </div>

        {/* Margine */}
        <div className="flex items-center text-white font-semibold">Margine</div>
        <div className="bg-blue-600/20 rounded-lg p-3 text-center">
          <div className="text-blue-400 font-bold">{formatCHF(contoEconomico.contabile.margine)}</div>
          <div className="text-blue-300 text-xs">({contoEconomico.contabile.marginePct.toFixed(1)}%)</div>
        </div>
        <div className="bg-emerald-600/20 rounded-lg p-3 text-center border border-emerald-500/30">
          <div className="text-emerald-400 font-bold">{formatCHF(contoEconomico.reale.margine)}</div>
          <div className="text-emerald-300 text-xs">({contoEconomico.reale.marginePct.toFixed(1)}%)</div>
        </div>

        {/* Costi Fissi */}
        <div className="flex items-center text-slate-300 font-medium">Costi fissi</div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="text-orange-400 font-bold">~{formatCHF(contoEconomico.contabile.costiFissi)}</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-emerald-500/20">
          <div className="text-orange-400 font-bold">{formatCHF(contoEconomico.reale.costiFissi)}</div>
        </div>

        {/* Risultato */}
        <div className="flex items-center text-white font-bold text-lg">RISULTATO</div>
        <div className={`rounded-lg p-4 text-center ${contoEconomico.contabile.risultato >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
          <div className={`font-bold text-xl flex items-center justify-center gap-2 ${contoEconomico.contabile.risultato >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {contoEconomico.contabile.risultato >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {contoEconomico.contabile.risultato >= 0 ? '+' : ''}{formatCHF(contoEconomico.contabile.risultato)}
          </div>
        </div>
        <div className={`rounded-lg p-4 text-center border-2 ${contoEconomico.reale.risultato >= 0 ? 'bg-green-600/30 border-green-500/50' : 'bg-red-600/30 border-red-500/50'}`}>
          <div className={`font-bold text-xl flex items-center justify-center gap-2 ${contoEconomico.reale.risultato >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {contoEconomico.reale.risultato >= 0 ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {contoEconomico.reale.risultato >= 0 ? '+' : ''}{formatCHF(contoEconomico.reale.risultato)}
          </div>
          <div className="text-xs mt-1 text-white/70">
            {contoEconomico.reale.risultato >= 0 ? 'SEI IN UTILE!' : 'IN PERDITA'}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
        <p className="text-slate-400 text-sm">
          <span className="text-yellow-400 font-semibold">Nota:</span> La differenza tra contabile e reale deriva dalla merce acquistata ma non ancora venduta (rimasta in magazzino).
          Il conto economico contabile include tutti gli acquisti del mese, mentre il conto pulito considera solo il costo della merce effettivamente consegnata.
        </p>
      </div>

      {/* Warehouse Section */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🏭</span>
          Valore Magazzino per Zona
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {Object.entries(magazzino.zone).map(([key, zone]) => {
            const info = zoneLabels[key] || { label: key, icon: '📦', color: 'from-slate-500 to-slate-600' };
            const pct = magazzino.totale > 0 ? (zone.value / magazzino.totale) * 100 : 0;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{info.icon}</span>
                  <span className="text-slate-300 font-medium text-sm">{info.label}</span>
                </div>
                <div className="text-white font-bold text-lg mb-1">
                  {formatCHF(zone.value)}
                </div>
                <div className="text-slate-400 text-xs mb-2">
                  {zone.count} prodotti • {zone.qty.toFixed(0)} unita
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${info.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-right text-xs text-slate-500 mt-1">{pct.toFixed(1)}%</div>
              </motion.div>
            );
          })}
        </div>

        {/* Total */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏭</span>
              <div>
                <div className="text-white font-semibold">TOTALE MAGAZZINO</div>
                <div className="text-slate-400 text-xs">Valore merce in stock</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-400">{formatCHF(magazzino.totale)}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
