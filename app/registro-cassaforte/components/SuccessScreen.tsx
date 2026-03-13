'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/registro-cassaforte/helpers';
import type { Employee } from '@/lib/registro-cassaforte/types';

interface SuccessScreenProps {
  employee: Employee | null;
  total: number;
  onNewDeposit: () => void;
}

export default function SuccessScreen({ employee, total, onNewDeposit }: SuccessScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen p-6 flex items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8"
        >
          <CheckCircle className="w-16 h-16 text-emerald-400" />
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-4">Versamento Completato!</h1>
        <p className="text-xl text-white/60 mb-2">{employee?.name}</p>
        <p className="text-5xl font-bold text-emerald-400 mb-8">{formatCurrency(total)}</p>

        <p className="text-white/40 mb-8">Ritorno automatico tra 10 secondi...</p>

        <button
          onClick={onNewDeposit}
          className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition-colors"
        >
          Nuovo Versamento
        </button>
      </div>
    </motion.div>
  );
}
