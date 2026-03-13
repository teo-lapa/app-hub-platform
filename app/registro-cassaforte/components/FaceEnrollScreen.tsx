'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera } from 'lucide-react';
import type { Employee } from '@/lib/registro-cassaforte/types';

interface FaceEnrollScreenProps {
  employee: Employee | null;
  onStartEnrollment: () => void;
  onBack: () => void;
}

export default function FaceEnrollScreen({ employee, onStartEnrollment, onBack }: FaceEnrollScreenProps) {
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
          <p className="text-white/60">Vuoi registrare il tuo volto?</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto mt-8">
        <div className="text-center mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-16 h-16 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Registrazione Volto</h2>
          <p className="text-white/60 max-w-md mx-auto">
            Registra il tuo volto per accedere automaticamente la prossima volta senza selezionare il nome dalla lista.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStartEnrollment}
          className="w-full p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-white text-xl font-bold shadow-xl shadow-cyan-500/20"
        >
          <div className="flex items-center justify-center gap-3">
            <Camera className="w-7 h-7" />
            Registra il mio volto
          </div>
        </motion.button>

        <p className="text-center text-white/40 text-sm mt-6">
          Serviranno 3 foto del tuo volto da diverse angolazioni
        </p>
      </div>
    </motion.div>
  );
}
