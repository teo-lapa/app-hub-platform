'use client';

import { motion } from 'framer-motion';
import { PriceCheckProduct } from '@/lib/types/price-check';

interface PriceCheckProductCardProps {
  product: PriceCheckProduct;
  onClick: () => void;
}

// Estrae solo il nome breve del prodotto (prima della descrizione)
function extractShortName(fullName: string): string {
  // Rimuovi tutto dopo "**" o dopo "\n"
  const lines = fullName.split('\n');
  const firstLine = lines[0];

  // Se c'è "**", prendi solo la parte prima
  const beforeMarkdown = firstLine.split('**')[0].trim();

  // Se risulta vuoto, usa la prima riga
  return beforeMarkdown || firstLine.trim();
}

export function PriceCheckProductCard({ product, onClick }: PriceCheckProductCardProps) {
  const shortName = extractShortName(product.name);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="glass p-3 rounded-xl cursor-pointer transition-all"
      onClick={onClick}
    >
      {/* Nome prodotto (senza immagine, solo nome breve) */}
      <h3 className="text-xs sm:text-sm font-semibold mt-2 line-clamp-3 text-center min-h-[3rem]">
        {shortName}
      </h3>

      {/* Badge stato */}
      <div className={`text-xs font-bold mt-2 text-center px-2 py-1 rounded-full ${getStatusBadgeClass(product.status)}`}>
        {formatStatusBadge(product.status)}
      </div>

      {/* Prezzo venduto e sconto */}
      <div className="mt-2 text-center">
        <div className="text-sm font-bold text-blue-400">
          CHF {product.soldPrice.toFixed(2)}
        </div>
        {product.discount > 0 && (
          <div className="text-xs text-orange-400">
            -{product.discount.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Cliente */}
      <div className="text-xs text-slate-400 mt-2 text-center truncate">
        👤 {product.customerName}
      </div>

      {/* Nota venditore se presente */}
      {product.note && (
        <div className="text-xs text-yellow-400 mt-1 text-center truncate">
          📝 {product.note}
        </div>
      )}
    </motion.div>
  );
}

// Funzione per ottenere la classe CSS del badge status
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500';
    case 'reviewed':
      return 'bg-green-500/20 text-green-400 border border-green-500';
    case 'blocked':
      return 'bg-red-500/20 text-red-400 border border-red-500';
    default:
      return 'bg-slate-500/20 text-slate-400 border border-slate-500';
  }
}

// Funzione per formattare il testo del badge status
function formatStatusBadge(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳ Da Controllare';
    case 'reviewed':
      return '✅ Controllato';
    case 'blocked':
      return '🔒 Bloccato';
    default:
      return '❓ Sconosciuto';
  }
}
