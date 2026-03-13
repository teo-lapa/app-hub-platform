'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Banknote, Coins, Plus, Minus, ScanLine } from 'lucide-react';
import { formatCurrency, calculateBanknotesTotal, calculateCoinsTotal, calculateTotal } from '@/lib/registro-cassaforte/helpers';
import { BANKNOTE_COLORS } from '@/lib/registro-cassaforte/constants';
import type { BanknoteCount, CoinCount } from '@/lib/registro-cassaforte/types';

interface CountingScreenProps {
  depositType: 'from_delivery' | 'extra';
  extraCustomerName: string;
  selectedPaymentsCount: number;
  expectedTotal: number;
  banknotes: BanknoteCount[];
  coins: CoinCount[];
  onOpenScanner: () => void;
  onUpdateCoinCount: (denomination: number, delta: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export default function CountingScreen({
  depositType,
  extraCustomerName,
  selectedPaymentsCount,
  expectedTotal,
  banknotes,
  coins,
  onOpenScanner,
  onUpdateCoinCount,
  onConfirm,
  onBack,
}: CountingScreenProps) {
  const banknotesTotal = calculateBanknotesTotal(banknotes);
  const coinsTotal = calculateCoinsTotal(coins);
  const total = calculateTotal(banknotes, coins);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6 pb-40"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Conteggio Denaro</h1>
            <p className="text-white/60">
              {depositType === 'extra' ? extraCustomerName : `${selectedPaymentsCount} incassi selezionati`}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banknotes */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Banknote className="w-7 h-7 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Banconote</h2>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenScanner}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl text-emerald-400 font-medium flex items-center gap-2 transition-colors"
            >
              <ScanLine className="w-5 h-5" />
              Scanner
            </motion.button>
          </div>

          <div className="space-y-3">
            {banknotes.map((b) => (
              <div key={b.denomination} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-5 rounded bg-gradient-to-r ${BANKNOTE_COLORS[b.denomination]}`} />
                  <span className="text-lg text-white font-medium">{b.denomination} CHF</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-center text-2xl font-bold text-white">{b.count}</span>
                  <span className="w-24 text-right text-white/60">{formatCurrency(b.denomination * b.count)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
            <span className="text-white/60">Subtotale Banconote</span>
            <span className="text-xl font-bold text-emerald-400">{formatCurrency(banknotesTotal)}</span>
          </div>
        </div>

        {/* Coins */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <Coins className="w-7 h-7 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Monete</h2>
          </div>

          <div className="space-y-3">
            {coins.map((c) => (
              <div key={c.denomination} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg text-white font-medium">
                  {c.denomination >= 1 ? `${c.denomination} CHF` : `${c.denomination * 100} ct`}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onUpdateCoinCount(c.denomination, -1)}
                    className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-5 h-5 text-red-400" />
                  </button>
                  <span className="w-12 text-center text-2xl font-bold text-white">{c.count}</span>
                  <button
                    onClick={() => onUpdateCoinCount(c.denomination, 1)}
                    className="w-10 h-10 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-5 h-5 text-emerald-400" />
                  </button>
                  <span className="w-24 text-right text-white/60">{formatCurrency(c.denomination * c.count)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
            <span className="text-white/60">Subtotale Monete</span>
            <span className="text-xl font-bold text-yellow-400">{formatCurrency(coinsTotal)}</span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-900/95 backdrop-blur-lg border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/60 text-sm">Totale da versare</div>
              <div className="text-4xl font-bold text-white">{formatCurrency(total)}</div>
            </div>
            {depositType === 'from_delivery' && expectedTotal > 0 && (
              <div className="text-right">
                <div className="text-white/60 text-sm">Importo atteso</div>
                <div className="text-2xl font-semibold text-white/80">{formatCurrency(expectedTotal)}</div>
                {total !== expectedTotal && (
                  <div className={`text-sm font-medium ${total > expectedTotal ? 'text-emerald-400' : 'text-amber-400'}`}>
                    Differenza: {total > expectedTotal ? '+' : ''}{formatCurrency(total - expectedTotal)}
                  </div>
                )}
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            disabled={total === 0}
            className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Conferma Versamento
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
