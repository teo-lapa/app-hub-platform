/**
 * CartBadge Component
 * Animated badge showing cart item count for header navigation
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@/lib/store/cartStore';
import { cn } from '@/lib/utils';

export function CartBadge() {
  const [mounted, setMounted] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const items = useCartStore(state => state.items);
  const getTotalItems = useCartStore(state => state.getTotalItems);
  const _hasHydrated = useCartStore(state => state._hasHydrated);

  const itemCount = getTotalItems();

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Animate on count change
  useEffect(() => {
    if (!mounted || !_hasHydrated) return;

    if (itemCount !== prevCount) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 600);
      setPrevCount(itemCount);
      return () => clearTimeout(timer);
    }
  }, [itemCount, prevCount, mounted, _hasHydrated]);

  // Don't render until hydrated to avoid mismatch
  if (!mounted || !_hasHydrated) {
    return (
      <Link
        href="/portale-clienti/carrello"
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Carrello"
      >
        <ShoppingCartIcon className="h-6 w-6" />
      </Link>
    );
  }

  return (
    <Link
      href="/portale-clienti/carrello"
      className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors group"
      aria-label={`Carrello con ${itemCount} articoli`}
    >
      <ShoppingCartIcon className="h-6 w-6" />

      {itemCount > 0 && (
        <>
          {/* Count badge */}
          <span
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[20px] h-5 px-1.5",
              "bg-blue-600 text-white text-xs font-bold rounded-full",
              "ring-2 ring-white",
              "transition-transform duration-300",
              isAnimating && "animate-bounce scale-125"
            )}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>

          {/* Pulse animation on add */}
          {isAnimating && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            </span>
          )}
        </>
      )}

      {/* Tooltip on hover */}
      <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-50">
        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-lg">
          {itemCount === 0 ? 'Carrello vuoto' : `${itemCount} articol${itemCount === 1 ? 'o' : 'i'} nel carrello`}
          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
        </div>
      </div>
    </Link>
  );
}
