'use client';

import { motion } from 'framer-motion';
import { ZoneBandCounts } from '@/lib/types/expiry';

export type ScadenzaBand = 'red' | 'yellow' | 'green';

interface BandSelectorProps {
  zoneName: string;
  zoneIcon: string;
  bands: ZoneBandCounts;
  onSelectBand: (band: ScadenzaBand) => void;
}

const BAND_META: Record<ScadenzaBand, { emoji: string; title: string; subtitle: string; classes: string; num: string }> = {
  red: {
    emoji: '🔴',
    title: 'URGENTI',
    subtitle: 'Scaduti o entro 3 giorni',
    classes: 'bg-red-500/15 border-red-500 hover:bg-red-500/25',
    num: 'text-red-400',
  },
  yellow: {
    emoji: '🟡',
    title: 'DA TENERE D\'OCCHIO',
    subtitle: 'Scadono in 4-7 giorni',
    classes: 'bg-yellow-500/15 border-yellow-500 hover:bg-yellow-500/25',
    num: 'text-yellow-400',
  },
  green: {
    emoji: '🟢',
    title: 'IN ARRIVO',
    subtitle: 'Scadono in 8-14 giorni',
    classes: 'bg-green-500/15 border-green-500 hover:bg-green-500/25',
    num: 'text-green-400',
  },
};

/**
 * Livello 2 — Le tre fasce di urgenza per la zona scelta.
 */
export function BandSelector({ zoneName, zoneIcon, bands, onSelectBand }: BandSelectorProps) {
  const order: ScadenzaBand[] = ['red', 'yellow', 'green'];
  const value: Record<ScadenzaBand, number> = { red: bands.red, yellow: bands.yellow, green: bands.green };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">{zoneIcon}</div>
        <h2 className="text-2xl font-bold">{zoneName}</h2>
        <p className="text-slate-400 text-sm">Scegli la fascia di urgenza</p>
      </div>

      <div className="space-y-3">
        {order.map((band, index) => {
          const meta = BAND_META[band];
          const count = value[band];
          return (
            <motion.button
              key={band}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectBand(band)}
              disabled={count === 0}
              className={`w-full rounded-2xl p-5 border-2 flex items-center justify-between transition-all
                ${count === 0 ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed' : meta.classes}`}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl">{meta.emoji}</div>
                <div className="text-left">
                  <div className="font-bold text-lg">{meta.title}</div>
                  <div className="text-xs text-slate-400">{meta.subtitle}</div>
                </div>
              </div>
              <div className={`text-4xl font-extrabold ${count === 0 ? 'text-slate-600' : meta.num}`}>
                {count}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
