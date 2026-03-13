'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2, Package, CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';
import type { PendingPayment } from '@/lib/registro-cassaforte/types';

interface SelectPickingsScreenProps {
  pendingPayments: PendingPayment[];
  selectedPayments: number[];
  isLoading: boolean;
  expectedTotal: number;
  onTogglePayment: (pickingId: number) => void;
  onProceed: () => void;
  onBack: () => void;
}

export default function SelectPickingsScreen({
  pendingPayments,
  selectedPayments,
  isLoading,
  expectedTotal,
  onTogglePayment,
  onProceed,
  onBack,
}: SelectPickingsScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Seleziona Incassi</h1>
            <p className="text-white/60">Scegli quali incassi stai versando</p>
          </div>
        </div>

        {selectedPayments.length > 0 && (
          <button
            onClick={onProceed}
            disabled={isLoading}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-wait rounded-xl text-white font-semibold flex items-center gap-2 transition-colors"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Caricamento...</>
            ) : (
              <>Continua <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        )}
      </div>

      <div className="space-y-3 max-w-3xl mx-auto">
        {pendingPayments.map((payment) => (
          <motion.button
            key={payment.picking_id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onTogglePayment(payment.picking_id)}
            className={`w-full p-5 rounded-2xl border transition-all text-left ${
              selectedPayments.includes(payment.picking_id)
                ? 'bg-emerald-500/20 border-emerald-400/50'
                : 'bg-white/10 border-white/20 hover:bg-white/15'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPayments.includes(payment.picking_id)
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-white/40'
                }`}>
                  {selectedPayments.includes(payment.picking_id) && (
                    <CheckCircle className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{payment.partner_name}</div>
                  <div className="text-sm text-white/60">{payment.picking_name} • {payment.date}</div>
                </div>
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(payment.amount)}
              </div>
            </div>
          </motion.button>
        ))}

        {pendingPayments.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Nessun incasso da versare</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-white/40 animate-spin mx-auto" />
          </div>
        )}
      </div>

      {selectedPayments.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6">
          <div className="max-w-3xl mx-auto p-4 bg-slate-800/90 backdrop-blur-lg rounded-2xl border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/60 text-sm">Totale selezionato</div>
                <div className="text-2xl font-bold text-white">{formatCurrency(expectedTotal)}</div>
              </div>
              <div className="text-white/60">
                {selectedPayments.length} incass{selectedPayments.length === 1 ? 'o' : 'i'}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
