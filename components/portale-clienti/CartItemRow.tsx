/**
 * CartItemRow Component
 * Single cart item with quantity controls, price, and remove button
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CartItem } from '@/lib/store/cartStore';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  isAnimatingOut?: boolean;
}

export function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
  isAnimatingOut = false,
}: CartItemRowProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;

    setIsUpdating(true);
    onUpdateQuantity(item.id, newQuantity);

    // Small delay for visual feedback
    setTimeout(() => setIsUpdating(false), 300);
  };

  const handleRemove = () => {
    onRemove(item.id);
  };

  return (
    <div
      className={cn(
        "flex gap-4 py-4 px-4 bg-white rounded-lg border border-gray-200",
        "transition-all duration-300",
        isAnimatingOut && "opacity-0 scale-95 -translate-x-4",
        !isAnimatingOut && "hover:shadow-md"
      )}
    >
      {/* Product Image */}
      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden relative">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs">
            Nessuna immagine
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 truncate">
          {item.name}
        </h3>

        {item.variant && (
          <p className="text-sm text-gray-500 mt-0.5">
            {item.variant}
          </p>
        )}

        <div className="flex items-center gap-4 mt-2">
          {/* Quantity Controls */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={() => handleQuantityChange(item.quantity - 1)}
              disabled={item.quantity <= 1 || isUpdating}
              className={cn(
                "p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                "rounded-l-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              )}
              aria-label="Diminuisci quantità"
            >
              <MinusIcon className="h-4 w-4" />
            </button>

            <input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => {
                const newQty = parseInt(e.target.value, 10);
                if (!isNaN(newQty) && newQty >= 1) {
                  handleQuantityChange(newQty);
                }
              }}
              className={cn(
                "w-12 text-center font-medium text-gray-900 bg-transparent",
                "border-0 focus:ring-0 focus:outline-none",
                isUpdating && "opacity-50"
              )}
              disabled={isUpdating}
            />

            <button
              onClick={() => handleQuantityChange(item.quantity + 1)}
              disabled={isUpdating}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-r-lg transition-colors disabled:opacity-30"
              aria-label="Aumenta quantità"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Price per unit */}
          <div className="text-sm text-gray-500">
            {formatCurrency(item.price)} cad.
          </div>
        </div>
      </div>

      {/* Total & Remove */}
      <div className="flex flex-col items-end justify-between">
        <button
          onClick={handleRemove}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Rimuovi articolo"
        >
          <TrashIcon className="h-5 w-5" />
        </button>

        <div className="font-semibold text-lg text-gray-900">
          {formatCurrency(item.price * item.quantity)}
        </div>
      </div>
    </div>
  );
}

/**
 * CartItemsSkeleton - Loading placeholder
 */
export function CartItemsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex gap-4 py-4 px-4 bg-white rounded-lg border border-gray-200 animate-pulse"
        >
          <div className="w-20 h-20 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-32" />
          </div>
          <div className="w-24 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-full ml-auto" />
            <div className="h-6 bg-gray-200 rounded w-full ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
