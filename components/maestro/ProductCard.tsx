'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Package, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image_url?: string;
  quantity?: number;
  uom?: string;
}

interface ProductCardProps {
  product: Product;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (product: Product) => void;
  disabled?: boolean;
  showQuantity?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  selectable = false,
  selected = false,
  onSelect,
  disabled = false,
  showQuantity = true,
  className
}: ProductCardProps) {
  const handleClick = () => {
    if (selectable && !disabled && onSelect) {
      onSelect(product);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={cn(
        'relative group overflow-hidden rounded-lg border transition-all',
        selectable && !disabled
          ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]'
          : '',
        selected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
          : 'border-slate-700 bg-slate-900',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Selected Indicator */}
      {selected && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-blue-600 rounded-full p-1">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      <div className="p-3 flex gap-3">
        {/* Product Image */}
        <div className="flex-shrink-0 w-16 h-16 bg-slate-800 rounded-lg overflow-hidden relative">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-slate-600" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white truncate mb-1">
            {product.name}
          </h3>

          <div className="space-y-0.5">
            <p className="text-xs text-slate-400">
              Codice: <span className="text-slate-300 font-mono">{product.code}</span>
            </p>

            {product.barcode && (
              <p className="text-xs text-slate-400">
                EAN: <span className="text-slate-300 font-mono">{product.barcode}</span>
              </p>
            )}

            {showQuantity && product.quantity !== undefined && (
              <p className="text-xs font-semibold text-blue-400">
                Qty: {product.quantity} {product.uom || 'pz'}
              </p>
            )}
          </div>
        </div>

        {/* Quantity Badge (when showing quantity) */}
        {showQuantity && product.quantity !== undefined && product.quantity > 0 && (
          <div className="flex-shrink-0 flex items-start">
            <div className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
              {product.quantity}
            </div>
          </div>
        )}
      </div>

      {/* Hover effect for selectable cards */}
      {selectable && !disabled && !selected && (
        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </motion.div>
  );
}
