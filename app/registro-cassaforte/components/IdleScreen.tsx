'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, UserCheck } from 'lucide-react';
import { formatTime, formatDate } from '@/lib/registro-cassaforte/helpers';

interface IdleScreenProps {
  currentTime: Date | null;
  onDeposit: () => void;
  onRegister: () => void;
}

export default function IdleScreen({ currentTime, onDeposit, onRegister }: IdleScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-screen p-8"
    >
      <div className="text-center mb-12">
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-8xl mb-6"
        >
          🔐
        </motion.div>
        <h1 className="text-4xl font-bold text-white mb-4">Registro Cassaforte</h1>
        <div className="text-6xl font-mono text-white/90 mb-2">
          {currentTime ? formatTime(currentTime) : '--:--:--'}
        </div>
        <div className="text-xl text-white/60">
          {currentTime ? formatDate(currentTime) : '---'}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDeposit}
          className="px-12 py-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white text-2xl font-bold shadow-2xl shadow-emerald-500/30"
        >
          <div className="flex items-center gap-4">
            <Lock className="w-10 h-10" />
            VERSA SOLDI
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRegister}
          className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-white text-2xl font-bold shadow-2xl shadow-cyan-500/30"
        >
          <div className="flex items-center gap-4">
            <UserCheck className="w-10 h-10" />
            REGISTRATI
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
