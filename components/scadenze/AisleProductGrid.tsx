'use client';

import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { ExpiryProduct } from '@/lib/types/expiry';
import { ExpiryProductCard } from '@/components/scadenze/ExpiryProductCard';

interface AisleProductGridProps {
  products: ExpiryProduct[];
  onSelectProduct: (product: ExpiryProduct) => void;
}

/**
 * Ricava la "corsia" dall'ubicazione, cosi' i ragazzi raccolgono tutto
 * insieme corsia per corsia invece di girare a vuoto.
 * Es: "FRIGO.CA.D04.6" -> "D" · "FRIGO.CA.B02.4" -> "B" · "Frigo-01" -> "Senza corsia"
 */
export function parseAisle(p: ExpiryProduct): string {
  const ref = `${p.locationName || ''} ${p.locationCompleteName || ''}`;
  // Pattern principale: "...CA.X.." dove X e' la lettera corsia
  const m1 = ref.match(/CA\.([A-Z])/i);
  if (m1) return m1[1].toUpperCase();
  // Fallback: una lettera seguita da due cifre (es. "D04", "B02")
  const m2 = ref.match(/\b([A-K])\s?\d{2}/i);
  if (m2) return m2[1].toUpperCase();
  return 'Senza corsia';
}

export function AisleProductGrid({ products, onSelectProduct }: AisleProductGridProps) {
  // Raggruppa per corsia
  const groups = new Map<string, ExpiryProduct[]>();
  for (const p of products) {
    const aisle = parseAisle(p);
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle)!.push(p);
  }

  // Ordina le corsie alfabeticamente, "Senza corsia" per ultima
  const aisles = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Senza corsia') return 1;
    if (b === 'Senza corsia') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {aisles.map((aisle) => {
        const items = groups.get(aisle)!;
        return (
          <motion.div
            key={aisle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {/* Intestazione corsia */}
            <div className="flex items-center gap-2 sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm py-2 rounded-lg">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20 border-2 border-blue-500">
                <span className="font-extrabold text-blue-400 text-lg">{aisle === 'Senza corsia' ? '—' : aisle}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-300">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">
                  {aisle === 'Senza corsia' ? 'Senza corsia' : `Corsia ${aisle}`}
                </span>
                <span className="text-slate-500 text-sm">· {items.length}</span>
              </div>
            </div>

            {/* Prodotti della corsia */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {items.map((product) => (
                <ExpiryProductCard
                  key={`${product.id}-${product.lotId}-${product.locationId}`}
                  product={product}
                  onClick={() => onSelectProduct(product)}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
