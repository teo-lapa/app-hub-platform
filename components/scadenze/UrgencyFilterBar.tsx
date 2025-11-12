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
  onManagementClick?: () => void; // Callback per aprire modal gestione
  urgentCount?: number; // Conteggio prodotti urgenti
  offerCount?: number; // Conteggio prodotti in offerta
  onVerificationClick?: () => void; // Callback per aprire modal richieste verifica
  verificationCount?: number; // Conteggio richieste di verifica
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

export function UrgencyFilterBar({
  counts,
  onSelect,
  onManagementClick,
  urgentCount = 0,
  offerCount = 0,
  onVerificationClick,
  verificationCount = 0
}: UrgencyFilterBarProps) {
  // Trova il massimo per evidenziare
  const maxCount = Math.max(counts.expired, counts.expiring, counts.ok);
  const hasExpired = counts.expired > 0;
  const totalManagementCount = urgentCount + offerCount;

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

      {/* Card Gestione Urgenti/Offerte */}
      {onManagementClick && totalManagementCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass-strong p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 cursor-pointer relative text-white transition-all shadow-lg hover:shadow-xl"
          onClick={onManagementClick}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <div className="text-3xl">📋</div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1">GESTIONE URGENTI/OFFERTE</h3>
                <p className="text-sm text-white/80">
                  Dashboard completa per gestire tutti i prodotti urgenti e in offerta
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/70">🔔 Urgenti:</span>
                    <span className="font-bold text-orange-300">{urgentCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/70">🏷️ Offerte:</span>
                    <span className="font-bold text-blue-200">{offerCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge conteggio totale */}
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="bg-white/30 backdrop-blur-sm px-4 py-3 rounded-full"
            >
              <span className="text-2xl font-bold">{totalManagementCount}</span>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Card Richieste di Verifica */}
      {onVerificationClick && verificationCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass-strong p-6 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 cursor-pointer relative text-white transition-all shadow-lg hover:shadow-xl"
          onClick={onVerificationClick}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <div className="text-3xl">✅</div>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1">RICHIESTE DI VERIFICA</h3>
                <p className="text-sm text-white/80">
                  Prodotti che richiedono un controllo fisico inventario
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/70">📦 Da verificare:</span>
                    <span className="font-bold text-purple-200">{verificationCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Badge conteggio con animazione pulsante */}
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="bg-white/30 backdrop-blur-sm px-4 py-3 rounded-full"
            >
              <span className="text-2xl font-bold">{verificationCount}</span>
            </motion.div>
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
