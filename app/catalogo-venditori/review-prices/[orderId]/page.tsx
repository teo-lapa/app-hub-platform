'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, CheckCircle, AlertCircle, Loader2, DollarSign, TrendingDown, Lock, Unlock } from 'lucide-react';
import type { OrderData, OrderLine, PriceUpdate } from '../types';

interface RouteParams {
  params: {
    orderId: string;
  };
}

export default function ReviewPricesPage({ params }: RouteParams) {
  const router = useRouter();
  const orderId = parseInt(params.orderId);

  // State
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedLines, setEditedLines] = useState<Map<number, { priceUnit: number; discount: number }>>(new Map());
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Load order data
  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const loadOrderData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel caricamento ordine');
      }

      setOrderData(data.order);
      console.log('✅ Order data loaded:', data.order);
    } catch (err: any) {
      console.error('❌ Error loading order:', err);
      setError(err.message || 'Errore nel caricamento ordine');
    } finally {
      setLoading(false);
    }
  };

  // Handle price change for a line
  const handlePriceChange = (lineId: number, field: 'priceUnit' | 'discount', value: number) => {
    const line = orderData?.lines.find(l => l.id === lineId);
    if (!line) return;

    const current = editedLines.get(lineId) || {
      priceUnit: line.currentPriceUnit,
      discount: line.currentDiscount
    };

    setEditedLines(new Map(editedLines.set(lineId, {
      ...current,
      [field]: value
    })));
  };

  // Calculate line total with edited values
  const getLineTotal = (line: OrderLine): number => {
    const edited = editedLines.get(line.id);
    const priceUnit = edited?.priceUnit ?? line.currentPriceUnit;
    const discount = edited?.discount ?? line.currentDiscount;

    return line.quantity * priceUnit * (1 - discount / 100);
  };

  // Calculate order totals with edited values
  const calculateTotals = () => {
    if (!orderData) return { subtotal: 0, total: 0, tax: 0 };

    const subtotal = orderData.lines.reduce((sum, line) => sum + getLineTotal(line), 0);

    // Simplified tax calculation (assumes same tax rate as original)
    const originalTaxRate = orderData.totals.subtotal > 0
      ? orderData.totals.tax / orderData.totals.subtotal
      : 0;

    const tax = subtotal * originalTaxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  };

  // Save price changes
  const handleSavePrices = async () => {
    if (editedLines.size === 0) {
      setError('Nessuna modifica da salvare');
      return;
    }

    try {
      setError(null);

      const updates: PriceUpdate[] = Array.from(editedLines.entries()).map(([lineId, values]) => ({
        lineId,
        priceUnit: values.priceUnit,
        discount: values.discount
      }));

      const response = await fetch('/api/catalogo-venditori/update-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          updates
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nel salvataggio prezzi');
      }

      console.log('✅ Prices updated:', data);

      // Reload order data
      await loadOrderData();

      // Clear edits
      setEditedLines(new Map());

    } catch (err: any) {
      console.error('❌ Error saving prices:', err);
      setError(err.message || 'Errore nel salvataggio prezzi');
    }
  };

  // Confirm order (draft → sale)
  const handleConfirmOrder = async () => {
    // Save prices first if there are edits
    if (editedLines.size > 0) {
      await handleSavePrices();
    }

    try {
      setIsConfirming(true);
      setError(null);

      const response = await fetch('/api/catalogo-venditori/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella conferma ordine');
      }

      console.log('✅ Order confirmed:', data);
      setConfirmSuccess(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        router.push('/catalogo-venditori');
      }, 2000);

    } catch (err: any) {
      console.error('❌ Error confirming order:', err);
      setError(err.message || 'Errore nella conferma ordine');
    } finally {
      setIsConfirming(false);
    }
  };

  const totals = calculateTotals();
  const hasChanges = editedLines.size > 0;

  if (loading) {
    return (
      <div className="min-h-screen-dynamic bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Caricamento ordine...</p>
        </div>
      </div>
    );
  }

  if (error && !orderData) {
    return (
      <div className="min-h-screen-dynamic bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-500/20 border-2 border-red-500 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-1">Errore</h3>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/catalogo-venditori')}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Torna al catalogo
          </button>
        </div>
      </div>
    );
  }

  if (!orderData) return null;

  return (
    <div className="min-h-screen-dynamic bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* Back Button */}
              <button
                onClick={() => router.push('/catalogo-venditori')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/70 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors min-h-[48px] shrink-0"
                aria-label="Indietro"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm sm:text-base font-medium hidden xs:inline">Indietro</span>
              </button>

              {/* Title */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="bg-gradient-to-r from-green-500 to-blue-500 p-2 sm:p-2.5 rounded-xl shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                    Revisione Prezzi
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Ordine {orderData.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-32">
        {/* Success Message */}
        {confirmSuccess && (
          <div className="mb-4 sm:mb-6 bg-green-500/20 border-2 border-green-500 rounded-xl p-4 sm:p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-400 shrink-0" />
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-1">
                  Ordine Confermato! 🎉
                </h3>
                <p className="text-sm sm:text-base text-green-300">
                  Ordine {orderData.name} confermato con successo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 sm:mb-6 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-red-400 mb-1">Errore</h3>
                <p className="text-sm sm:text-base text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Info Card */}
        <div className="mb-4 sm:mb-6 bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Cliente</p>
              <p className="text-base sm:text-lg font-semibold text-white">{orderData.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Data Consegna</p>
              <p className="text-base sm:text-lg font-semibold text-white">
                {orderData.deliveryDate ? new Date(orderData.deliveryDate).toLocaleDateString('it-IT') : 'Non specificata'}
              </p>
            </div>
            {orderData.pricelist && (
              <div className="sm:col-span-2">
                <p className="text-sm text-slate-400 mb-1">Listino Prezzi</p>
                <p className="text-base sm:text-lg font-semibold text-blue-400">{orderData.pricelist.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Product Lines */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          {orderData.lines.map((line) => {
            const edited = editedLines.get(line.id);
            const priceUnit = edited?.priceUnit ?? line.currentPriceUnit;
            const discount = edited?.discount ?? line.currentDiscount;
            const lineTotal = getLineTotal(line);
            const isEdited = edited !== undefined;

            return (
              <div
                key={line.id}
                className={`bg-slate-800 rounded-xl p-4 sm:p-5 border transition-all ${
                  isEdited ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-slate-700'
                }`}
              >
                {/* Product Header */}
                <div className="flex gap-3 sm:gap-4 mb-4">
                  {line.imageUrl && (
                    <img
                      src={line.imageUrl}
                      alt={line.productName}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-slate-600 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                        {line.productName}
                      </h3>
                      <div title={line.isLocked ? "Prezzo bloccato" : "Prezzo modificabile"}>
                        {line.isLocked ? (
                          <Lock className="h-5 w-5 text-red-400 shrink-0" />
                        ) : (
                          <Unlock className="h-5 w-5 text-green-400 shrink-0" />
                        )}
                      </div>
                    </div>
                    {line.productCode && (
                      <p className="text-sm text-slate-400">Codice: {line.productCode}</p>
                    )}
                    <p className="text-sm text-slate-400">
                      Quantità: <span className="font-semibold text-white">{line.quantity} {line.uom}</span>
                    </p>
                  </div>
                </div>

                {/* Price Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Price Unit */}
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-1.5">
                      Prezzo Unitario (CHF)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceUnit.toFixed(2)}
                      onChange={(e) => handlePriceChange(line.id, 'priceUnit', parseFloat(e.target.value) || 0)}
                      disabled={line.isLocked}
                      className={`w-full px-3 py-2 rounded-lg border text-white text-sm sm:text-base ${
                        line.isLocked
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : 'bg-slate-700 border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                    />
                    {line.standardPrice > 0 && line.standardPrice !== priceUnit && (
                      <p className="text-xs text-slate-500 mt-1">
                        Prezzo standard: CHF {line.standardPrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-1.5">
                      Sconto (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discount.toFixed(1)}
                      onChange={(e) => handlePriceChange(line.id, 'discount', parseFloat(e.target.value) || 0)}
                      disabled={line.isLocked}
                      className={`w-full px-3 py-2 rounded-lg border text-white text-sm sm:text-base ${
                        line.isLocked
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : 'bg-slate-700 border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                      }`}
                    />
                  </div>

                  {/* Total */}
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-1.5">
                      Totale Riga (CHF)
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600">
                      <p className="text-lg sm:text-xl font-bold text-green-400">
                        {lineTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Savings Indicator */}
                {discount > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs sm:text-sm text-green-400">
                    <TrendingDown className="h-4 w-4" />
                    <span>
                      Risparmio: CHF {(line.quantity * priceUnit * discount / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Order Totals */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 shadow-lg mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Riepilogo Ordine</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm sm:text-base">
              <span className="text-slate-400">Subtotale:</span>
              <span className="font-semibold text-white">CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm sm:text-base">
              <span className="text-slate-400">IVA:</span>
              <span className="font-semibold text-white">CHF {totals.tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg sm:text-xl font-bold text-white">Totale:</span>
                <span className="text-xl sm:text-2xl font-bold text-green-400">
                  CHF {totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 shadow-2xl z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {/* Save Prices Button */}
            {hasChanges && (
              <button
                onClick={handleSavePrices}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors min-h-[48px] text-sm sm:text-base"
              >
                <DollarSign className="h-5 w-5" />
                Salva Modifiche Prezzi
              </button>
            )}

            {/* Confirm Order Button */}
            <button
              onClick={handleConfirmOrder}
              disabled={isConfirming || confirmSuccess}
              className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg font-bold transition-all min-h-[48px] text-sm sm:text-base shadow-lg"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Conferma in corso...
                </>
              ) : confirmSuccess ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Ordine Confermato!
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Conferma Ordine Finale
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
