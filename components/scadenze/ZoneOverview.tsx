'use client';

import { motion } from 'framer-motion';
import { ZoneBandCounts } from '@/lib/types/expiry';

export interface ZoneOverviewItem {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  bands: ZoneBandCounts;
}

interface ZoneOverviewProps {
  zones: ZoneOverviewItem[];
  onSelectZone: (zoneId: string) => void;
}

/**
 * Livello 1 — Panoramica zone.
 * Una card per zona con i 3 numeri a colpo d'occhio:
 *   🔴 scaduti + entro 3 giorni  ·  🟡 4-7 giorni  ·  🟢 8-14 giorni
 */
export function ZoneOverview({ zones, onSelectZone }: ZoneOverviewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {zones.map((zone, index) => {
        const { red, yellow, green } = zone.bands;
        const totale = red + yellow + green;
        const haUrgenze = red > 0;

        return (
          <motion.button
            key={zone.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectZone(zone.id)}
            className={`relative glass-strong rounded-2xl p-5 text-left overflow-hidden
              ${haUrgenze ? 'ring-2 ring-red-500/60' : ''}`}
          >
            {/* Striscia gradiente in alto */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${zone.gradient}`} />

            <div className="flex items-center gap-3 mb-4">
              <div className="text-4xl">{zone.icon}</div>
              <div>
                <h3 className="text-xl font-bold">{zone.name}</h3>
                <p className="text-xs text-slate-400">
                  {totale === 0 ? 'Tutto sotto controllo' : `${totale} prodotti a ridosso`}
                </p>
              </div>
            </div>

            {/* I tre numeri */}
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-xl p-3 text-center border-2
                ${red > 0 ? 'bg-red-500/20 border-red-500' : 'bg-white/5 border-white/10'}`}>
                <div className={`text-2xl font-extrabold ${red > 0 ? 'text-red-400' : 'text-slate-500'}`}>{red}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">🔴 ≤3gg</div>
              </div>
              <div className={`rounded-xl p-3 text-center border-2
                ${yellow > 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-white/5 border-white/10'}`}>
                <div className={`text-2xl font-extrabold ${yellow > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>{yellow}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">🟡 4-7gg</div>
              </div>
              <div className={`rounded-xl p-3 text-center border-2
                ${green > 0 ? 'bg-green-500/20 border-green-500' : 'bg-white/5 border-white/10'}`}>
                <div className={`text-2xl font-extrabold ${green > 0 ? 'text-green-400' : 'text-slate-500'}`}>{green}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">🟢 8-14gg</div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
