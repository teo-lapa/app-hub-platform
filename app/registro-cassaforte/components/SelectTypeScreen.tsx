'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, CreditCard, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Employee, PendingPayment } from '@/lib/registro-cassaforte/types';

interface SelectTypeScreenProps {
  employee: Employee | null;
  pendingPayments: PendingPayment[];
  isAdmin: boolean;
  onSelectType: (type: 'from_delivery' | 'extra') => void;
  onBack: () => void;
}

export default function SelectTypeScreen({
  employee,
  pendingPayments,
  isAdmin,
  onSelectType,
  onBack,
}: SelectTypeScreenProps) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen p-6"
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Ciao, {employee?.name}!</h1>
          <p className="text-white/60">Cosa vuoi fare?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mt-12">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectType('from_delivery')}
          className="p-8 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-3xl border border-blue-400/30 hover:border-blue-400/50 transition-all"
        >
          <Package className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Versa Incassi</h2>
          <p className="text-white/60">Soldi dalle consegne</p>
          {pendingPayments.length > 0 && (
            <div className="mt-4 px-4 py-2 bg-blue-500/30 rounded-full inline-block">
              <span className="text-blue-200 font-semibold">{pendingPayments.length} da versare</span>
            </div>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectType('extra')}
          className="p-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-3xl border border-purple-400/30 hover:border-purple-400/50 transition-all"
        >
          <CreditCard className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Versa Extra</h2>
          <p className="text-white/60">Altri soldi (non da consegne)</p>
        </motion.button>
      </div>

      {isAdmin && (
        <div className="max-w-3xl mx-auto mt-8">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/registro-cassaforte/admin')}
            className="w-full p-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 rounded-2xl text-amber-400 font-medium transition-colors"
          >
            <div className="flex items-center justify-center gap-3">
              <Shield className="w-6 h-6" />
              <span className="text-lg">Gestione Admin - Volti Dipendenti</span>
            </div>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
