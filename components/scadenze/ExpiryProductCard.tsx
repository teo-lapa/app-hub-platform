'use client';

import { motion } from 'framer-motion';
import { ExpiryProduct } from '@/lib/types/expiry';

interface ExpiryProductCardProps {
  product: ExpiryProduct;
  onClick: () => void;
}

export function ExpiryProductCard({ product, onClick }: ExpiryProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="glass p-3 rounded-xl cursor-pointer transition-all"
      onClick={onClick}
    >
      {/* Immagine prodotto */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-2 rounded-lg overflow-hidden">
        {product.image ? (
          <img
            src={`data:image/png;base64,${product.image}`}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-3xl">
            📦
          </div>
        )}
      </div>

      {/* Nome prodotto */}
      <h3 className="text-xs sm:text-sm font-semibold mt-2 line-clamp-2 text-center min-h-[2.5rem]">
        {product.name}
      </h3>

      {/* Badge scadenza con colore urgenza */}
      <div className={`text-xs font-bold mt-2 text-center px-2 py-1 rounded-full ${getUrgencyBadgeClass(product.daysUntilExpiry)}`}>
        {formatExpiryBadge(product.daysUntilExpiry)}
      </div>

      {/* Ubicazione */}
      <div className="text-xs text-slate-400 mt-2 text-center truncate">
        📍 {product.locationName}
      </div>

      {/* Quantità */}
      <div className="text-sm font-bold text-green-400 mt-1 text-center">
        {product.quantity} {product.uom}
      </div>

      {/* Lotto */}
      {product.lotName && (
        <div className="text-xs text-orange-400 mt-1 text-center truncate">
          {product.lotName}
        </div>
      )}
    </motion.div>
  );
}

// Funzione per ottenere la classe CSS del badge in base ai giorni
function getUrgencyBadgeClass(days: number): string {
  if (days < 0) {
    return 'bg-red-500/20 text-red-400 border border-red-500';
  }
  if (days === 0) {
    return 'bg-red-500/20 text-red-400 border border-red-500 animate-pulse';
  }
  if (days <= 7) {
    return 'bg-orange-500/20 text-orange-400 border border-orange-500';
  }
  return 'bg-green-500/20 text-green-400 border border-green-500';
}

// Funzione per formattare il testo del badge
function formatExpiryBadge(days: number): string {
  if (days === 0) return '🔴 SCADE OGGI';
  if (days < 0) return `🔴 SCADUTO ${Math.abs(days)}gg fa`;
  if (days <= 3) return `🔴 Tra ${days}gg`;
  if (days <= 7) return `🟡 Tra ${days}gg`;
  return `🟢 Tra ${days}gg`;
}
