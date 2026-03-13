'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';
import type { Employee } from '@/lib/registro-cassaforte/types';

interface ConfirmScreenProps {
  employee: Employee | null;
  depositType: 'from_delivery' | 'extra';
  extraCustomerName: string;
  selectedPaymentsCount: number;
  total: number;
  isLoading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ConfirmScreen({
  employee,
  depositType,
  extraCustomerName,
  selectedPaymentsCount,
  total,
  isLoading,
  onConfirm,
  onBack,
}: ConfirmScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen p-6 flex items-center justify-center"
    >
      <div className="max-w-lg w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Conferma Versamento</h2>
          <p className="text-white/60">Stai per registrare questo versamento</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-3 border-b border-white/10">
            <span className="text-white/60">Dipendente</span>
            <span className="text-white font-medium">{employee?.name}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-white/10">
            <span className="text-white/60">Tipo</span>
            <span className="text-white font-medium">
              {depositType === 'from_delivery' ? 'Da consegne' : 'Extra'}
            </span>
          </div>
          {depositType === 'extra' && (
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-white/60">Cliente</span>
              <span className="text-white font-medium">{extraCustomerName}</span>
            </div>
          )}
          {depositType === 'from_delivery' && (
            <div className="flex justify-between py-3 border-b border-white/10">
              <span className="text-white/60">Incassi</span>
              <span className="text-white font-medium">{selectedPaymentsCount} selezionati</span>
            </div>
          )}
          <div className="flex justify-between py-3">
            <span className="text-white/60">Importo</span>
            <span className="text-3xl font-bold text-emerald-400">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <><CheckCircle className="w-5 h-5" /> Conferma</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
