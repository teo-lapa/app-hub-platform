'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';
import type { BanknoteCount, CoinCount } from '@/lib/registro-cassaforte/types';

interface ResponsibilityDialogProps {
  total: number;
  onCancel: () => void;
  onAccept: () => void;
}

export function ResponsibilityDialog({ total, onCancel, onAccept }: ResponsibilityDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-800 rounded-3xl p-8 max-w-lg w-full border border-white/20"
      >
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Conferma Responsabilità</h2>
          <p className="text-white/70">Stai per confermare il versamento di:</p>
          <p className="text-4xl font-bold text-emerald-400 my-4">{formatCurrency(total)}</p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
          <p className="text-amber-300 text-sm leading-relaxed">
            <strong>DICHIARAZIONE DI RESPONSABILITÀ:</strong><br />
            Confermo di aver inserito personalmente i soldi nella cassaforte e mi assumo
            la piena responsabilità della correttezza dell'importo dichiarato.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            Accetto e Confermo
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface FinalConfirmDialogProps {
  total: number;
  banknotes: BanknoteCount[];
  coins: CoinCount[];
  onBack: () => void;
  onConfirm: () => void;
}

export function FinalConfirmDialog({ total, banknotes, coins, onBack, onConfirm }: FinalConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-800 rounded-3xl p-8 max-w-lg w-full border border-white/20"
      >
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Sei Sicuro?</h2>
          <p className="text-white/70 text-lg">
            Hai davvero messo <span className="text-emerald-400 font-bold">{formatCurrency(total)}</span> nella cassaforte?
          </p>
        </div>

        <div className="bg-slate-700/50 rounded-2xl p-4 mb-6">
          <div className="text-white/60 text-sm mb-2">Riepilogo:</div>
          <div className="space-y-1">
            {banknotes.filter(b => b.count > 0).map(b => (
              <div key={b.denomination} className="flex justify-between text-white">
                <span>{b.count}x {b.denomination} CHF</span>
                <span className="text-white/60">{formatCurrency(b.count * b.denomination)}</span>
              </div>
            ))}
            {coins.filter(c => c.count > 0).map(c => (
              <div key={c.denomination} className="flex justify-between text-white">
                <span>{c.count}x {c.denomination} CHF</span>
                <span className="text-white/60">{formatCurrency(c.count * c.denomination)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
          >
            Indietro
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
          >
            SÌ, CONFERMO
          </button>
        </div>
      </motion.div>
    </div>
  );
}
