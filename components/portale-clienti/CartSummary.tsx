/**
 * CartSummary Component
 * Display cart totals, tax breakdown, and checkout button
 */

'use client';

import Link from 'next/link';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface CartSummaryProps {
  subtotal: number;
  itemCount: number;
  taxRate?: number;
  onCheckout?: () => void;
}

export function CartSummary({
  subtotal,
  itemCount,
  taxRate = 0.081, // 8.1% Swiss VAT
  onCheckout,
}: CartSummaryProps) {
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      {/* Summary Title */}
      <h2 className="text-lg font-semibold text-gray-900">
        Riepilogo Ordine
      </h2>

      {/* Summary Lines */}
      <div className="space-y-3 py-4 border-t border-b border-gray-200">
        <div className="flex justify-between text-gray-600">
          <span>Subtotale ({itemCount} articol{itemCount === 1 ? 'o' : 'i'})</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between text-gray-600">
          <span>IVA ({(taxRate * 100).toFixed(1)}%)</span>
          <span className="font-medium">{formatCurrency(tax)}</span>
        </div>

        <div className="flex justify-between text-sm text-gray-500">
          <span>Spedizione</span>
          <span>Calcolata al checkout</span>
        </div>
      </div>

      {/* Total */}
      <div className="flex justify-between items-baseline pt-2">
        <span className="text-lg font-semibold text-gray-900">Totale</span>
        <span className="text-2xl font-bold text-blue-600">
          {formatCurrency(total)}
        </span>
      </div>

      {/* Checkout Button */}
      {onCheckout ? (
        <button
          onClick={onCheckout}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <ShoppingBagIcon className="h-5 w-5" />
          Procedi al Checkout
        </button>
      ) : (
        <Link
          href="/portale-clienti/ordini/nuovo"
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          <ShoppingBagIcon className="h-5 w-5" />
          Procedi al Checkout
        </Link>
      )}

      {/* Additional Info */}
      <div className="pt-4 space-y-2 text-sm text-gray-500">
        <div className="flex items-start gap-2">
          <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Pagamento sicuro e protetto</span>
        </div>

        <div className="flex items-start gap-2">
          <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Spedizione gratuita per ordini oltre CHF 200</span>
        </div>

        <div className="flex items-start gap-2">
          <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Resi gratuiti entro 30 giorni</span>
        </div>
      </div>
    </div>
  );
}

/**
 * CartSummarySkeleton - Loading placeholder
 */
export function CartSummarySkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2" />

      <div className="space-y-3 py-4 border-t border-b border-gray-200">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </div>

      <div className="flex justify-between items-baseline pt-2">
        <div className="h-6 bg-gray-200 rounded w-1/4" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>

      <div className="h-12 bg-gray-200 rounded-lg w-full" />
    </div>
  );
}
