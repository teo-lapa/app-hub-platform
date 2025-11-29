'use client';

import { motion } from 'framer-motion';
import { PriceCategory } from '@/lib/types/price-check';

interface PriceCategoryFilterBarProps {
  counts: {
    below_critical: number;
    critical_to_avg: number;
    above_avg: number;
    blocked: number;
    all: number;
    setup_pricelists: number;
    analisi_mensile?: number;
  };
  onSelect: (category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all' | 'setup_pricelists' | 'analisi_mensile') => void;
}

const PRICE_CATEGORIES: PriceCategory[] = [
  {
    id: 'all',
    name: 'TUTTI I PREZZI',
    icon: '📊',
    description: 'Visualizza tutti i prodotti',
    gradient: 'from-slate-500 to-slate-700',
    count: 0,
  },
  {
    id: 'below_critical',
    name: 'SOTTO PUNTO CRITICO',
    icon: '🔴',
    description: 'Prezzo < PC (Costo +40%)',
    gradient: 'from-red-500 to-red-700',
    count: 0,
  },
  {
    id: 'critical_to_avg',
    name: 'TRA PC E MEDIO',
    icon: '🟡',
    description: 'PC < Prezzo < Media',
    gradient: 'from-orange-500 to-orange-700',
    count: 0,
  },
  {
    id: 'above_avg',
    name: 'SOPRA MEDIO',
    icon: '🟢',
    description: 'Prezzo > Media vendita',
    gradient: 'from-green-500 to-green-700',
    count: 0,
  },
  {
    id: 'blocked',
    name: 'RICHIESTE BLOCCO',
    icon: '🔔',
    description: 'Prezzi bloccati da controllare',
    gradient: 'from-blue-500 to-blue-700',
    count: 0,
  },
  {
    id: 'setup_pricelists',
    name: 'IMPOSTA LISTINI',
    icon: '📋',
    description: 'Imposta regole prezzi prodotti',
    gradient: 'from-purple-500 to-purple-700',
    count: 0,
  },
  {
    id: 'analisi_mensile',
    name: 'ANALISI MENSILE',
    icon: '📅',
    description: 'Verifica prezzi vs listini',
    gradient: 'from-cyan-500 to-cyan-700',
    count: 0,
  },
];

export function PriceCategoryFilterBar({
  counts,
  onSelect,
}: PriceCategoryFilterBarProps) {
  // Trova il massimo per evidenziare
  const maxCount = Math.max(counts.below_critical, counts.critical_to_avg, counts.above_avg, counts.blocked);
  const hasBelowCritical = counts.below_critical > 0;

  return (
    <div className="space-y-4">
      {/* Alert se ci sono prezzi sotto PC */}
      {hasBelowCritical && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border-l-4 border-red-500 p-4 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <h3 className="font-bold text-red-400">Attenzione Prezzi!</h3>
              <p className="text-sm text-slate-300 mt-1">
                Hai <span className="font-bold text-red-400">{counts.below_critical}</span> prodotti{' '}
                <span className="font-bold">VENDUTI SOTTO IL PUNTO CRITICO</span> che richiedono verifica.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Griglia filtri */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 max-w-7xl mx-auto">
        {PRICE_CATEGORIES.map((category, index) => {
          const count = counts[category.id as keyof typeof counts] || 0;
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

              {/* Pulsa se ci sono sotto PC */}
              {category.id === 'below_critical' && count > 0 && (
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
