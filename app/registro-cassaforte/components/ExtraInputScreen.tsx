'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface ExtraInputScreenProps {
  customerName: string;
  isLoading: boolean;
  onCustomerNameChange: (name: string) => void;
  onProceed: () => void;
  onBack: () => void;
}

export default function ExtraInputScreen({
  customerName,
  isLoading,
  onCustomerNameChange,
  onProceed,
  onBack,
}: ExtraInputScreenProps) {
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
          <h1 className="text-2xl font-bold text-white">Versamento Extra</h1>
          <p className="text-white/60">Inserisci i dettagli</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-12">
        <div className="mb-8">
          <label className="block text-white/80 mb-3 text-lg">Nome Cliente</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Es. Mario Rossi"
            className="w-full px-6 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-xl placeholder-white/40 focus:outline-none focus:border-white/40"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onProceed}
          disabled={!customerName.trim() || isLoading}
          className="w-full py-5 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl text-white text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <><Loader2 className="w-6 h-6 animate-spin" /> Caricamento...</>
          ) : (
            'Continua al Conteggio'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
