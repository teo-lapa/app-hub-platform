'use client';

/**
 * LAPA Smart Ordering AI - Dashboard SEMPLIFICATA
 *
 * Versione VELOCE:
 * 1. Mostra card fornitori (caricamento veloce)
 * 2. Click per analizzare singolo fornitore
 * 3. Evita timeout Odoo
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Package,
  Clock,
  CheckCircle,
  Brain,
  Zap,
  RefreshCw,
  TrendingUp,
  Truck
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  leadTime?: number;
  reliability?: number;
  onTimeRate?: number;
  productsCount: number;
  analyzed: boolean;
}

export default function SmartOrderingAIPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingSupplier, setAnalyzingSupplier] = useState<number | null>(null);

  // Carica lista fornitori (VELOCE)
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      console.log('Caricamento lista fornitori...');

      // Chiama Odoo per lista fornitori con ordini recenti
      const response = await fetch('/api/odoo-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'res.partner',
          method: 'search_read',
          domain: [['supplier_rank', '>', 0]],
          fields: ['name', 'supplier_rank'],
          limit: 20
        })
      });

      const data = await response.json();

      if (data.success) {
        const supplierList = data.result.map((s: any) => ({
          id: s.id,
          name: s.name,
          productsCount: 0,
          analyzed: false
        }));

        setSuppliers(supplierList);
        console.log(`Caricati ${supplierList.length} fornitori`);
      }
    } catch (error) {
      console.error('Errore caricamento fornitori:', error);
    } finally {
      setLoading(false);
    }
  };

  // Analizza UN fornitore specifico
  const analyzeSupplier = async (supplierId: number) => {
    setAnalyzingSupplier(supplierId);

    try {
      console.log(`Analisi fornitore ${supplierId}...`);

      const response = await fetch(`/api/smart-ordering-ai/analyze-supplier?supplierId=${supplierId}&months=6`);
      const data = await response.json();

      if (data.success) {
        // Aggiorna fornitore con dati analizzati
        setSuppliers(prev => prev.map(s =>
          s.id === supplierId
            ? {
                ...s,
                leadTime: data.analysis.medianLeadTime,
                reliability: data.analysis.reliabilityScore,
                onTimeRate: data.analysis.onTimeRate,
                analyzed: true
              }
            : s
        ));

        console.log(`✅ Fornitore ${supplierId} analizzato`);
      }
    } catch (error) {
      console.error(`Errore analisi fornitore ${supplierId}:`, error);
    } finally {
      setAnalyzingSupplier(null);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Brain className="w-10 h-10 text-blue-400" />
              LAPA Smart Ordering AI
            </h1>
            <p className="text-slate-300 mt-2">
              Analisi Lead Time Reali per Fornitore
            </p>
          </div>

          <button
            onClick={loadSuppliers}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Ricarica
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Truck className="w-6 h-6" />}
            label="Fornitori"
            value={suppliers.length}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            label="Analizzati"
            value={suppliers.filter(s => s.analyzed).length}
            color="green"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label="Lead Time Medio"
            value={suppliers.filter(s => s.analyzed).length > 0
              ? `${(suppliers.filter(s => s.analyzed).reduce((sum, s) => sum + (s.leadTime || 0), 0) / suppliers.filter(s => s.analyzed).length).toFixed(1)}gg`
              : '-'}
            color="yellow"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Affidabilita Media"
            value={suppliers.filter(s => s.analyzed).length > 0
              ? `${Math.round(suppliers.filter(s => s.analyzed).reduce((sum, s) => sum + (s.reliability || 0), 0) / suppliers.filter(s => s.analyzed).length)}/100`
              : '-'}
            color="purple"
          />
        </div>

        {/* Fornitori Grid */}
        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-xl text-slate-300">Caricamento fornitori...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(supplier => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                analyzing={analyzingSupplier === supplier.id}
                onAnalyze={() => analyzeSupplier(supplier.id)}
              />
            ))}
          </div>
        )}

        {suppliers.length === 0 && !loading && (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h3 className="text-2xl font-bold text-slate-300">Nessun fornitore trovato</h3>
            <p className="text-slate-400 mt-2">Controlla la connessione Odoo</p>
          </div>
        )}
      </div>
    </div>
  );
}

// StatCard Component
function StatCard({ icon, label, value, color }: any) {
  const colors = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
    yellow: 'from-yellow-600 to-yellow-700',
    purple: 'from-purple-600 to-purple-700'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-gradient-to-br ${colors[color as keyof typeof colors]} p-4 rounded-xl shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="opacity-60">{icon}</div>
      </div>
    </motion.div>
  );
}

// SupplierCard Component
function SupplierCard({ supplier, analyzing, onAnalyze }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1">{supplier.name}</h3>
          <p className="text-sm text-slate-400">ID: {supplier.id}</p>
        </div>
        <Truck className="w-8 h-8 text-blue-400" />
      </div>

      {supplier.analyzed ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
            <span className="text-slate-300">Lead Time</span>
            <span className="font-bold text-white">{supplier.leadTime?.toFixed(1)} giorni</span>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
            <span className="text-slate-300">Affidabilita</span>
            <span className={`font-bold ${
              supplier.reliability >= 80 ? 'text-green-400' :
              supplier.reliability >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {supplier.reliability?.toFixed(0)}/100
            </span>
          </div>

          <div className="flex justify-between items-center p-3 bg-slate-700 rounded-lg">
            <span className="text-slate-300">Puntualita</span>
            <span className="font-bold text-white">{supplier.onTimeRate?.toFixed(1)}%</span>
          </div>

          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            {analyzing ? 'Aggiornamento...' : 'Aggiorna Analisi'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm mb-4">
            Clicca per analizzare lead time e affidabilita da ordini storici
          </p>

          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Analisi in corso...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Analizza Fornitore
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
