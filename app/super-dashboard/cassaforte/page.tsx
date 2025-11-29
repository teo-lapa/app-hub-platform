'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  ArrowLeft,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  User,
  Calendar,
  Banknote,
  X,
} from 'lucide-react';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';

interface PendingPayment {
  picking_id: number;
  picking_name: string;
  partner_id: number;
  partner_name: string;
  amount: number;
  date: string;
  driver_name: string;
}

interface CassaforteItem {
  id: number;
  date: string;
  payment_ref: string;
  partner_id: number | null;
  partner_name: string;
  amount: number;
  employee_name: string;
  is_reconciled: boolean;
  create_date: string;
  type: 'deposit' | 'withdrawal';
}

interface CassaforteData {
  pending: {
    items: PendingPayment[];
    count: number;
    total: number;
  };
  in_safe: {
    items: CassaforteItem[];
    count: number;
    total: number;
    deposits_total: number;
  };
  withdrawn: {
    items: CassaforteItem[];
    count: number;
    total: number;
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/D';
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function CassafortePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CassaforteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/super-dashboard/cassaforte');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Errore nel caricamento');
      }
    } catch (err: any) {
      console.error('Error fetching cassaforte data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Inserisci un importo valido');
      return;
    }

    if (data && amount > data.in_safe.total) {
      toast.error('Importo superiore al saldo in cassaforte');
      return;
    }

    setIsWithdrawing(true);
    try {
      const response = await fetch('/api/registro-cassaforte/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: 1, // TODO: Get from session
          employee_name: 'Admin', // TODO: Get from session
          amount: amount,
          note: withdrawNote || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Prelievo registrato con successo!');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setWithdrawNote('');
        fetchData(); // Refresh data
      } else {
        throw new Error(result.error || 'Errore nel prelievo');
      }
    } catch (err: any) {
      console.error('Error withdrawing:', err);
      toast.error(err.message || 'Errore nel prelievo');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/60">Caricamento dati cassaforte...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Errore nel caricamento'}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/super-dashboard">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </motion.button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Lock className="w-7 h-7 text-slate-400" />
                  Controllo Cassaforte
                </h1>
                <p className="text-slate-400 text-sm">Gestione depositi e prelievi</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWithdrawModal(true)}
                disabled={data.in_safe.total <= 0}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-lg text-white font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpFromLine className="w-5 h-5" />
                Preleva
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Pending */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-2xl p-6 border border-amber-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">{data.pending.count} incassi</span>
            </div>
            <div className="text-amber-100 text-sm mb-1">Da Depositare</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(data.pending.total)}</div>
          </motion.div>

          {/* In Safe */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-2xl p-6 border border-emerald-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <Lock className="w-8 h-8 text-emerald-400" />
              <span className="text-emerald-300 text-sm font-medium">{data.in_safe.count} movimenti</span>
            </div>
            <div className="text-emerald-100 text-sm mb-1">In Cassaforte</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(data.in_safe.total)}</div>
          </motion.div>

          {/* Withdrawn */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-2xl p-6 border border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-4">
              <ArrowUpFromLine className="w-8 h-8 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">{data.withdrawn.count} prelievi</span>
            </div>
            <div className="text-purple-100 text-sm mb-1">Prelevati</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(data.withdrawn.total)}</div>
          </motion.div>
        </div>

        {/* Three Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1: Da Depositare */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
          >
            <div className="bg-amber-500/10 px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Da Depositare
              </h2>
              <p className="text-white/60 text-sm">Incassi cash in attesa di versamento</p>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {data.pending.items.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-emerald-400/40 mx-auto mb-3" />
                  <p className="text-white/40">Tutti gli incassi sono stati versati</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.pending.items.map((item) => (
                    <div
                      key={item.picking_id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{item.partner_name}</span>
                        <span className="text-amber-400 font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-white/60">
                        <span>{item.picking_name}</span>
                        <span>{item.date}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-1">
                        <User className="w-3 h-3 inline mr-1" />
                        {item.driver_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Section 2: In Cassaforte */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
          >
            <div className="bg-emerald-500/10 px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                In Cassaforte
              </h2>
              <p className="text-white/60 text-sm">Versamenti non ancora prelevati</p>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {data.in_safe.items.length === 0 ? (
                <div className="text-center py-8">
                  <Banknote className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">Nessun versamento in cassaforte</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.in_safe.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{item.partner_name}</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-white/60">
                        <span className="truncate max-w-[200px]" title={item.payment_ref}>
                          {item.employee_name}
                        </span>
                        <span>{formatDate(item.date)}</span>
                      </div>
                      {item.is_reconciled && (
                        <div className="text-xs text-emerald-400 mt-1">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Riconciliato
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Section 3: Prelevati */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
          >
            <div className="bg-purple-500/10 px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ArrowUpFromLine className="w-5 h-5 text-purple-400" />
                Prelevati
              </h2>
              <p className="text-white/60 text-sm">Soldi ritirati dalla cassaforte</p>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {data.withdrawn.items.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowUpFromLine className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40">Nessun prelievo registrato</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.withdrawn.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white/5 rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{item.employee_name}</span>
                        <span className="text-purple-400 font-bold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-white/60">
                        <span className="truncate max-w-[200px]" title={item.payment_ref}>
                          {item.payment_ref.replace('Prelievo Cassaforte - ', '').split(' - ')[1] || 'Prelievo'}
                        </span>
                        <span>{formatDate(item.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWithdrawModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ArrowUpFromLine className="w-6 h-6 text-amber-400" />
                  Preleva dalla Cassaforte
                </h2>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="mb-6">
                <div className="text-white/60 text-sm mb-1">Saldo attuale</div>
                <div className="text-2xl font-bold text-emerald-400">{formatCurrency(data.in_safe.total)}</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 mb-2">Importo da prelevare</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-lg placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-white/80 mb-2">Note (opzionale)</label>
                  <input
                    type="text"
                    value={withdrawNote}
                    onChange={(e) => setWithdrawNote(e.target.value)}
                    placeholder="Es. Deposito in banca"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isWithdrawing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Conferma Prelievo
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
