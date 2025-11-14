'use client';

import { useState, useRef, useEffect } from 'react';

export interface CartProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number;
  image_url?: string | null;
  qty_available?: number;
  uom_name?: string;
  incoming_qty?: number;
  incoming_date?: string | null;
}

interface SmartCartProps {
  products: CartProduct[];
  onQuantityChange: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function SmartCart({
  products,
  onQuantityChange,
  onRemove,
  onConfirm,
  loading = false,
}: SmartCartProps) {
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalPrice = products.reduce((sum, p) => sum + (p.price || 0) * p.quantity, 0);
  const hasPrice = products.some(p => p.price !== undefined && p.price > 0);

  const handleQuantityChange = (index: number, newQty: string) => {
    // Allow empty string (when user deletes all)
    if (newQty === '') {
      onQuantityChange(index, 0);
      return;
    }

    // Allow any valid number format: 0, 01, 0.5, 0,5, 2.5, 2,5, etc.
    // Replace comma with dot for parseFloat
    const normalizedQty = newQty.replace(',', '.');

    // Check if it's a valid number (including leading zeros, decimals)
    // Allow patterns like: 0, 01, 0.5, 1.5, etc.
    if (/^[0-9]*\.?[0-9]*$/.test(normalizedQty) || normalizedQty === '.') {
      const qty = parseFloat(normalizedQty);

      // Only update if it's a valid number (not NaN)
      if (!isNaN(qty) && qty >= 0) {
        onQuantityChange(index, qty);
      } else if (normalizedQty === '0' || normalizedQty === '.') {
        // Allow typing "0" or "." as intermediate states
        onQuantityChange(index, 0);
      }
    }
  };

  const incrementQuantity = (index: number) => {
    onQuantityChange(index, products[index].quantity + 1);
  };

  const decrementQuantity = (index: number) => {
    const newQty = products[index].quantity - 1;
    if (newQty > 0) {
      onQuantityChange(index, newQty);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 50) {
      setSwipedIndex(index);
    } else if (diff < -20) {
      setSwipedIndex(null);
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  if (products.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2" style={{ fontSize: '18px', lineHeight: '1.5' }}>
            Carrello Vuoto
          </h3>
          <p className="text-sm text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Usa l'AI per aggiungere prodotti al carrello
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontSize: '20px', lineHeight: '1.5' }}>
          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Carrello
        </h2>
        <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-full" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          {products.length} {products.length === 1 ? 'prodotto' : 'prodotti'}
        </span>
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {products.map((product, index) => (
          <div
            key={index}
            className="relative overflow-hidden"
            style={{ contain: 'layout style' }}
          >
            {/* Swipe Delete Background */}
            <div
              className={`absolute inset-0 bg-red-500 flex items-center justify-end px-6 rounded-lg transition-opacity ${
                swipedIndex === index ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            {/* Product Card */}
            <div
              className={`bg-slate-800 rounded-lg p-4 border border-slate-700 active:border-slate-600 transition-transform ${
                swipedIndex === index ? '-translate-x-20' : 'translate-x-0'
              }`}
              style={{ touchAction: 'pan-y' }}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={(e) => handleTouchMove(e, index)}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-start gap-4">
                {/* Product Image */}
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.product_name}
                    className="w-16 h-16 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-700">
                    <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-3" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                    {product.product_name}
                  </h3>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-900 rounded-lg border border-slate-700">
                      <button
                        onClick={() => decrementQuantity(index)}
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all"
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                        aria-label="Riduci quantità"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.,]?[0-9]*"
                        value={product.quantity === 0 ? '' : product.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className="w-16 min-h-[48px] text-center bg-transparent text-white font-semibold outline-none"
                        style={{
                          fontSize: '16px',
                          lineHeight: '1.5',
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      />
                      <button
                        onClick={() => incrementQuantity(index)}
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-emerald-500 active:scale-95 transition-all"
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                        aria-label="Aumenta quantità"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    {/* Stock Quantity */}
                    {product.qty_available !== undefined && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 rounded-lg border border-slate-700">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="text-xs text-slate-400" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                          Disponibili: <span className={`font-semibold ${product.qty_available > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {product.qty_available} {product.uom_name || ''}
                          </span>
                        </span>
                      </div>
                    )}

                    {/* Incoming Quantity */}
                    {product.incoming_qty !== undefined && product.incoming_qty > 0 && (
                      <div className="flex flex-col gap-1 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="text-xs text-blue-400 font-semibold" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                            In arrivo: {product.incoming_qty} {product.uom_name || ''}
                          </span>
                        </div>
                        {product.incoming_date && (
                          <div className="flex items-center gap-2 ml-6">
                            <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs text-blue-300" style={{ fontSize: '11px', lineHeight: '1.5' }}>
                              {new Date(product.incoming_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => {
                    onRemove(index);
                    setSwipedIndex(null);
                  }}
                  className="min-h-[56px] min-w-[56px] sm:min-h-[48px] sm:min-w-[48px] flex items-center justify-center text-slate-400 hover:text-red-400 active:scale-95 transition-all flex-shrink-0"
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  aria-label="Rimuovi prodotto"
                >
                  <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400" style={{ fontSize: '14px', lineHeight: '1.5' }}>Totale Prodotti:</span>
          <span className="font-semibold text-white text-lg" style={{ fontSize: '18px', lineHeight: '1.5' }}>{totalItems}</span>
        </div>
      </div>

      {/* Confirm Button - Sticky on mobile */}
      <div className="sticky bottom-0 left-0 right-0 pb-safe bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-4 -mx-4 px-4 sm:static sm:bg-transparent sm:pt-0 sm:mx-0 sm:px-0">
        <button
          onClick={onConfirm}
          disabled={loading || products.length === 0}
          className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold text-lg rounded-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            fontSize: '18px',
            lineHeight: '1.5',
          }}
        >
          {loading ? (
            <>
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" style={{ transform: 'translateZ(0)' }} />
              <span>Elaborazione...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Conferma Ordine</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
