'use client';

import { motion } from 'framer-motion';
import { UrgencyCategory } from '@/lib/types/expiry';

interface UrgencyFilterBarProps {
  counts: {
    expired: number;
    expiring: number;
    ok: number;
    all: number;
    'no-movement-30': number;
    'no-movement-90': number;
  };
  onSelect: (urgency: 'expired' | 'expiring' | 'ok' | 'all' | 'no-movement-30' | 'no-movement-90') => void;
}

const URGENCY_CATEGORIES: UrgencyCategory[] = [
  {
    id: 'expired',
    name: 'SCADUTI',
    icon: '🔴',
    description: 'Azione immediata',
    gradient: 'from-red-500 to-red-700',
    count: 0,
  },
  {
    id: 'expiring',
    name: 'IN SCADENZA',
    icon: '🟡',
    description: 'Entro 7 giorni',
    gradient: 'from-orange-500 to-orange-700',
    count: 0,
    daysThreshold: 7,
  },
  {
    id: 'ok',
    name: 'OK >7gg',
    icon: '🟢',
    description: 'Monitoraggio',
    gradient: 'from-green-500 to-green-700',
    count: 0,
  },
  {
    id: 'no-movement-30',
    name: 'FERMI 30GG',
    icon: '⏸️',
    description: 'Non venduti da 30gg',
    gradient: 'from-purple-500 to-purple-700',
    count: 0,
  },
  {
    id: 'no-movement-90',
    name: 'FERMI 3 MESI',
    icon: '🛑',
    description: 'Non venduti da 90gg',
    gradient: 'from-pink-500 to-pink-700',
    count: 0,
  },
  {
    id: 'all',
    name: 'TUTTI',
    icon: '📊',
    description: 'Vista completa',
    gradient: 'from-blue-500 to-blue-700',
    count: 0,
  },
];

export function UrgencyFilterBar({ counts, onSelect }: UrgencyFilterBarProps) {
  // Trova il massimo per evidenziare
  const maxCount = Math.max(counts.expired, counts.expiring, counts.ok);
  const hasExpired = counts.expired > 0;

  return (
    <div className="space-y-4">
      {/* Alert se ci sono scaduti */}
      {hasExpired && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border-l-4 border-red-500 p-4 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-bold text-red-400">Attenzione!</h3>
              <p className="text-sm text-slate-300 mt-1">
                Hai <span className="font-bold text-red-400">{counts.expired}</span> prodotti{' '}
                <span className="font-bold">SCADUTI</span> che richiedono azione immediata.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Griglia filtri */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {URGENCY_CATEGORIES.map((category, index) => {
          const count = counts[category.id];
          const isHighlighted = count === maxCount && maxCount > 0;

          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`glass-strong p-6 sm:p-8 rounded-2xl bg-gradient-to-br ${category.gradient}
                         cursor-pointer relative text-white transition-all
                         ${isHighlighted ? 'ring-2 ring-white shadow-xl' : ''}`}
              onClick={() => onSelect(category.id)}
            >
              {/* Badge conteggio */}
              {count > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/20 backdrop-blur-sm
                           px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
                >
                  {count}
                </motion.div>
              )}

              {/* Icona */}
              <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 text-center">
                {category.icon}
              </div>

              {/* Nome */}
              <h3 className="text-lg sm:text-2xl font-bold text-center mb-1">
                {category.name}
              </h3>

              {/* Descrizione */}
              <p className="text-xs sm:text-sm text-center text-white/80">
                {category.description}
              </p>

              {/* Pulsa se ci sono scaduti */}
              {category.id === 'expired' && count > 0 && (
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-white/30"
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
