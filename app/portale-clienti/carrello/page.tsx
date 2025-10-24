/**
 * Cart Page - Customer Portal
 * Full cart view with items, summary, and checkout flow
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBagIcon,
  ArrowLeftIcon,
  TrashIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { useCartStore } from '@/lib/store/cartStore';
import { CartItemRow, CartItemsSkeleton } from '@/components/portale-clienti/CartItemRow';
import { CartSummary, CartSummarySkeleton } from '@/components/portale-clienti/CartSummary';

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  const items = useCartStore(state => state.items);
  const updateQuantity = useCartStore(state => state.updateQuantity);
  const removeItem = useCartStore(state => state.removeItem);
  const clearCart = useCartStore(state => state.clearCart);
  const getTotalItems = useCartStore(state => state.getTotalItems);
  const getTotalPrice = useCartStore(state => state.getTotalPrice);

  const itemCount = getTotalItems();
  const totalPrice = getTotalPrice();

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle item removal with animation
  const handleRemove = (itemId: string) => {
    setRemovingItemId(itemId);
    setTimeout(() => {
      removeItem(itemId);
      setRemovingItemId(null);
    }, 300);
  };

  // Handle checkout
  const handleCheckout = () => {
    router.push('/portale-clienti/ordini/nuovo');
  };

  // Loading state
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-1/3 animate-pulse" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <CartItemsSkeleton />
            </div>
            <div className="lg:col-span-1">
              <CartSummarySkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/portale-clienti/catalogo"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Torna al Catalogo
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">Carrello</h1>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-gray-100 rounded-full">
                <ShoppingCartIcon className="h-16 w-16 text-gray-400" />
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Il tuo carrello è vuoto
            </h2>

            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Non hai ancora aggiunto nessun prodotto al carrello.
              Esplora il nostro catalogo e scopri le nostre offerte!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/portale-clienti/catalogo"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <ShoppingBagIcon className="h-5 w-5" />
                Esplora il Catalogo
              </Link>

              <Link
                href="/portale-clienti/ordini"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border border-gray-300 transition-colors"
              >
                Vedi Ordini Passati
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cart with items
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/portale-clienti/catalogo"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Continua lo Shopping
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Carrello</h1>
              <p className="text-gray-600 mt-1">
                {itemCount} articol{itemCount === 1 ? 'o' : 'i'} nel carrello
              </p>
            </div>

            <button
              onClick={() => {
                if (confirm('Sei sicuro di voler svuotare il carrello?')) {
                  clearCart();
                }
              }}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <TrashIcon className="h-5 w-5" />
              Svuota Carrello
            </button>
          </div>
        </div>

        {/* Cart Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={handleRemove}
                isAnimatingOut={removingItemId === item.id}
              />
            ))}
          </div>

          {/* Cart Summary - Sticky */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <CartSummary
                subtotal={totalPrice}
                itemCount={itemCount}
                onCheckout={handleCheckout}
              />

              {/* Continue Shopping Link */}
              <div className="mt-4 text-center">
                <Link
                  href="/portale-clienti/catalogo"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Continua lo shopping
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="flex justify-center mb-3">
              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Pagamenti Sicuri</h3>
            <p className="text-sm text-gray-600">SSL e crittografia avanzata</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="flex justify-center mb-3">
              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Spedizione Veloce</h3>
            <p className="text-sm text-gray-600">Consegna in 2-3 giorni lavorativi</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="flex justify-center mb-3">
              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Resi Gratuiti</h3>
            <p className="text-sm text-gray-600">30 giorni per cambiare idea</p>
          </div>
        </div>
      </div>
    </div>
  );
}
