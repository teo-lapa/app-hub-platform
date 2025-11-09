'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, CheckCircle, AlertCircle, Loader2, DollarSign, TrendingDown, Lock, Unlock, TrendingUp, Award, Info, BarChart, X } from 'lucide-react';
import type { OrderData, OrderLine, PriceUpdate } from '../types';

interface CustomerStats {
  totalRevenue: number;
  tier: 'VIP' | 'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD';
  suggestedDiscount: number;
  averageOrderValue: number;
  orderCount: number;
}

interface ProductHistory {
  productId: number;
  productName: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgDiscount: number;
  recentOrders: Array<{
    orderId: number;
    orderName: string;
    customerAlias: string;
    date: string;
    priceUnit: number;
    discount: number;
    quantity: number;
  }>;
}

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
  const [inputValues, setInputValues] = useState<Map<number, { priceUnit: string; discount: string }>>(new Map());
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Customer stats state
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Product history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OrderLine | null>(null);
  const [productHistory, setProductHistory] = useState<ProductHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Slider state - default to 'price' for all lines
  const [activeSlider, setActiveSlider] = useState<{ lineId: number; type: 'price' | 'discount' }>({
    lineId: -1,
    type: 'price'
  });

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

      // Initialize slider with first line ID
      if (data.order.lines && data.order.lines.length > 0) {
        setActiveSlider({
          lineId: data.order.lines[0].id,
          type: 'price'
        });
      }

      // Load customer stats
      if (data.order.customerId) {
        loadCustomerStats(data.order.customerId);
      }
    } catch (err: any) {
      console.error('❌ Error loading order:', err);
      setError(err.message || 'Errore nel caricamento ordine');
    } finally {
      setLoading(false);
    }
  };

  // Load customer stats
  const loadCustomerStats = async (customerId: number) => {
    try {
      setLoadingStats(true);
      const response = await fetch(`/api/catalogo-venditori/customer-stats/${customerId}`);
      const data = await response.json();

      if (data.success) {
        setCustomerStats(data.stats);
        console.log('✅ Customer stats loaded:', data.stats);
      }
    } catch (err: any) {
      console.error('❌ Error loading customer stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load product history
  const loadProductHistory = async (productId: number, line: OrderLine) => {
    try {
      setLoadingHistory(true);
      setSelectedProduct(line);
      setShowHistoryModal(true);

      const response = await fetch(`/api/catalogo-venditori/product-history/${productId}`);
      const data = await response.json();

      if (data.success) {
        // Map API response to ProductHistory type
        const history: ProductHistory = {
          productId: data.product.id,
          productName: data.product.name,
          avgPrice: data.statistics.avgPrice,
          minPrice: data.statistics.minPrice,
          maxPrice: data.statistics.maxPrice,
          avgDiscount: data.statistics.avgDiscount,
          recentOrders: data.recentSales.map((sale: any) => ({
            orderId: sale.orderId,
            orderName: sale.orderName,
            customerAlias: sale.customerName,
            date: sale.date,
            priceUnit: sale.priceUnit,
            discount: sale.discount,
            quantity: sale.quantity
          }))
        };

        setProductHistory(history);
        console.log('✅ Product history loaded:', history);
      }
    } catch (err: any) {
      console.error('❌ Error loading product history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Get input value for a line field
  const getInputValue = (lineId: number, field: 'priceUnit' | 'discount'): string => {
    const inputValue = inputValues.get(lineId)?.[field];
    if (inputValue !== undefined) return inputValue;

    const line = orderData?.lines.find(l => l.id === lineId);
    if (!line) return '0';

    const edited = editedLines.get(lineId);
    const value = edited?.[field] ?? (field === 'priceUnit' ? line.currentPriceUnit : line.currentDiscount);
    return field === 'priceUnit' ? value.toFixed(2) : value.toFixed(1);
  };

  // Handle input change (for text input)
  const handleInputChange = (lineId: number, field: 'priceUnit' | 'discount', value: string) => {
    const line = orderData?.lines.find(l => l.id === lineId);
    if (!line) return;

    const edited = editedLines.get(lineId);
    const current = inputValues.get(lineId) || {
      priceUnit: edited?.priceUnit !== undefined ? edited.priceUnit.toFixed(2) : line.currentPriceUnit.toFixed(2),
      discount: edited?.discount !== undefined ? edited.discount.toFixed(1) : line.currentDiscount.toFixed(1)
    };

    const newInputValues = new Map(inputValues);
    newInputValues.set(lineId, {
      ...current,
      [field]: value
    });
    setInputValues(newInputValues);
  };

  // Handle input blur (convert to number and save)
  const handleInputBlur = (lineId: number, field: 'priceUnit' | 'discount') => {
    const line = orderData?.lines.find(l => l.id === lineId);
    if (!line) return;

    const inputValue = inputValues.get(lineId)?.[field];
    if (inputValue === undefined) return;

    const parsedValue = parseFloat(inputValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
      // Reset to current value if invalid
      const current = editedLines.get(lineId);
      const validValue = current?.[field] ?? (field === 'priceUnit' ? line.currentPriceUnit : line.currentDiscount);
      handleInputChange(lineId, field, field === 'priceUnit' ? validValue.toFixed(2) : validValue.toFixed(1));
      return;
    }

    // Save the valid value
    handlePriceChange(lineId, field, parsedValue);
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

  // Handle field click - switch slider type
  const handleFieldClick = (lineId: number, type: 'price' | 'discount') => {
    setActiveSlider({ lineId, type });
  };

  // Handle slider change
  const handleSliderChange = (lineId: number, value: number) => {
    const { type } = activeSlider;
    const field = type === 'price' ? 'priceUnit' : 'discount';
    handlePriceChange(lineId, field, value);
  };

  // Get slider range based on cost price
  const getSliderRange = (line: OrderLine, type: 'price' | 'discount'): { min: number; max: number } => {
    if (type === 'discount') {
      return { min: 0, max: 100 };
    }
    // Price slider: from costPrice + 6% margin to costPrice + 400%
    const costPrice = line.costPrice || 0;
    return {
      min: costPrice * 1.06, // +6% margin for coverage
      max: costPrice * 5 // costPrice + 400% = costPrice * 5
    };
  };

  // Get reference markers positions for price slider
  const getPriceMarkers = (line: OrderLine): { label: string; position: number; color: string }[] => {
    const costPrice = line.costPrice || 0;
    const avgSellingPrice = line.avgSellingPrice || 0;
    const range = getSliderRange(line, 'price');

    const markers = [];

    // Marker for +40% on cost price
    const fortyPercentPrice = costPrice * 1.4;
    if (fortyPercentPrice >= range.min && fortyPercentPrice <= range.max) {
      const position = ((fortyPercentPrice - range.min) / (range.max - range.min)) * 100;
      markers.push({
        label: '+40%',
        position,
        color: 'rgb(251, 191, 36)' // yellow
      });
    }

    // Marker for 3-month average selling price
    if (avgSellingPrice > 0 && avgSellingPrice >= range.min && avgSellingPrice <= range.max) {
      const position = ((avgSellingPrice - range.min) / (range.max - range.min)) * 100;
      markers.push({
        label: 'Medio',
        position,
        color: 'rgb(59, 130, 246)' // blue
      });
    }

    return markers;
  };

  // Get current slider value
  const getSliderValue = (line: OrderLine, type: 'price' | 'discount'): number => {
    const edited = editedLines.get(line.id);
    if (type === 'price') {
      return edited?.priceUnit ?? line.currentPriceUnit;
    }
    return edited?.discount ?? line.currentDiscount;
  };

  // Calculate slider color percentage (0 = red, 100 = green)
  const getSliderColorPercentage = (line: OrderLine, type: 'price' | 'discount'): number => {
    const value = getSliderValue(line, type);
    const range = getSliderRange(line, type);

    if (range.max === range.min) return 50;

    const percentage = ((value - range.min) / (range.max - range.min)) * 100;
    return Math.max(0, Math.min(100, percentage));
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

  // Helper functions for customer stats
  const getTierColor = (tier: CustomerStats['tier']) => {
    switch (tier) {
      case 'VIP': return 'from-purple-500 to-pink-500';
      case 'GOLD': return 'from-yellow-500 to-orange-500';
      case 'SILVER': return 'from-gray-400 to-gray-500';
      case 'BRONZE': return 'from-orange-700 to-orange-800';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getTierBadgeColor = (tier: CustomerStats['tier']) => {
    switch (tier) {
      case 'VIP': return 'bg-purple-500/20 text-purple-400 border-purple-500';
      case 'GOLD': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'SILVER': return 'bg-gray-400/20 text-gray-400 border-gray-400';
      case 'BRONZE': return 'bg-orange-700/20 text-orange-400 border-orange-700';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500';
    }
  };

  const getDiscountBadgeColor = (discount: number) => {
    if (discount >= 15) return 'bg-red-500/20 text-red-400 border-red-500';
    if (discount >= 10) return 'bg-orange-500/20 text-orange-400 border-orange-500';
    if (discount >= 5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    return 'bg-green-500/20 text-green-400 border-green-500';
  };

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
    <>
      {/* Slider Custom Styles */}
      <style jsx>{`
        input[type="range"].slider-gradient::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid rgb(59, 130, 246);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        input[type="range"].slider-gradient::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid rgb(59, 130, 246);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        input[type="range"].slider-gradient::-webkit-slider-runnable-track {
          height: 12px;
          border-radius: 6px;
        }

        input[type="range"].slider-gradient::-moz-range-track {
          height: 12px;
          border-radius: 6px;
        }
      `}</style>

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

        {/* Customer Stats Card */}
        {loadingStats && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl p-4 sm:p-6 border border-green-500/30 shadow-lg">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 text-green-400 animate-spin" />
              <p className="text-sm text-slate-300">Caricamento statistiche cliente...</p>
            </div>
          </div>
        )}

        {customerStats && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-xl p-4 sm:p-6 border border-green-500/30 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className={`bg-gradient-to-r ${getTierColor(customerStats.tier)} p-2.5 rounded-xl`}>
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Statistiche Cliente</h3>
                <p className="text-sm text-slate-300">Profilo vendita e sconti suggeriti</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* Fatturato Totale */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <p className="text-xs text-slate-400">Fatturato</p>
                </div>
                <p className="text-lg font-bold text-green-400">
                  CHF {customerStats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {/* Tier Cliente */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Tier</p>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${getTierBadgeColor(customerStats.tier)}`}>
                  <Award className="h-4 w-4" />
                  <span className="text-sm font-bold">{customerStats.tier}</span>
                </div>
              </div>

              {/* Sconto Suggerito */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Sconto Suggerito</p>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${getDiscountBadgeColor(customerStats.suggestedDiscount)}`}>
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-lg font-bold">{customerStats.suggestedDiscount.toFixed(1)}%</span>
                </div>
              </div>

              {/* Media Ordini */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Media Ordini</p>
                <p className="text-lg font-bold text-blue-400">
                  CHF {customerStats.averageOrderValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-500">
                  {customerStats.orderCount} ordini
                </p>
              </div>
            </div>
          </div>
        )}

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
                      <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1">
                        {line.productName.split(' - ')[0]}
                      </h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* History Button */}
                        <button
                          onClick={() => loadProductHistory(line.productId, line)}
                          className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 transition-colors"
                          title="Storico prezzi prodotto"
                        >
                          <BarChart className="h-4 w-4" />
                        </button>
                        {/* Lock/Unlock Icon */}
                        <div title={line.isLocked ? "Prezzo bloccato" : "Prezzo modificabile"}>
                          {line.isLocked ? (
                            <Lock className="h-5 w-5 text-red-400" />
                          ) : (
                            <Unlock className="h-5 w-5 text-green-400" />
                          )}
                        </div>
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
                      type="text"
                      inputMode="decimal"
                      value={getInputValue(line.id, 'priceUnit')}
                      onClick={() => handleFieldClick(line.id, 'price')}
                      readOnly
                      disabled={line.isLocked}
                      className={`w-full px-3 py-2 rounded-lg border text-white text-sm sm:text-base cursor-pointer transition-all ${
                        line.isLocked
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : activeSlider.lineId === line.id && activeSlider.type === 'price'
                          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500'
                          : 'bg-slate-700 border-slate-600 hover:border-blue-400'
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
                      type="text"
                      inputMode="decimal"
                      value={getInputValue(line.id, 'discount')}
                      onClick={() => handleFieldClick(line.id, 'discount')}
                      readOnly
                      disabled={line.isLocked}
                      className={`w-full px-3 py-2 rounded-lg border text-white text-sm sm:text-base cursor-pointer transition-all ${
                        line.isLocked
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : activeSlider.lineId === line.id && activeSlider.type === 'discount'
                          ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500'
                          : 'bg-slate-700 border-slate-600 hover:border-blue-400'
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

                {/* Price/Discount Slider - Always visible when this line is active */}
                {activeSlider.lineId === line.id && !line.isLocked && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="space-y-2">
                      {/* Slider Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs sm:text-sm font-medium text-slate-300">
                          {activeSlider.type === 'price' ? 'Prezzo Unitario' : 'Sconto'}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {activeSlider.type === 'price'
                            ? `CHF ${getSliderValue(line, 'price').toFixed(2)}`
                            : `${getSliderValue(line, 'discount').toFixed(1)}%`
                          }
                        </span>
                      </div>

                      {/* Slider Input with Markers */}
                      <div className="relative pb-6">
                        {/* Reference Markers (only for price slider) */}
                        {activeSlider.type === 'price' && getPriceMarkers(line).map((marker, idx) => (
                          <div
                            key={idx}
                            className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${marker.position}%` }}
                          >
                            <div
                              className="w-1 h-3 rounded-full mb-1"
                              style={{ backgroundColor: marker.color }}
                            />
                            <span
                              className="text-xs font-bold whitespace-nowrap"
                              style={{ color: marker.color }}
                            >
                              {marker.label}
                            </span>
                          </div>
                        ))}

                        <input
                          type="range"
                          min={getSliderRange(line, activeSlider.type).min}
                          max={getSliderRange(line, activeSlider.type).max}
                          step={activeSlider.type === 'price' ? '0.01' : '0.1'}
                          value={getSliderValue(line, activeSlider.type)}
                          onChange={(e) => handleSliderChange(line.id, parseFloat(e.target.value))}
                          className="w-full h-3 rounded-lg appearance-none cursor-pointer slider-gradient"
                          style={{
                            background: `linear-gradient(to right,
                              rgb(239, 68, 68) 0%,
                              rgb(251, 191, 36) ${getSliderColorPercentage(line, activeSlider.type) / 2}%,
                              rgb(34, 197, 94) ${getSliderColorPercentage(line, activeSlider.type)}%,
                              rgb(34, 197, 94) 100%)`
                          }}
                        />
                      </div>

                      {/* Range Labels */}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="text-red-400">
                          {activeSlider.type === 'price'
                            ? `Min: CHF ${getSliderRange(line, 'price').min.toFixed(2)}`
                            : '0%'
                          }
                        </span>
                        <span className="text-green-400">
                          {activeSlider.type === 'price'
                            ? `Max: CHF ${getSliderRange(line, 'price').max.toFixed(2)}`
                            : '100%'
                          }
                        </span>
                      </div>
                    </div>
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

      {/* Product History Modal */}
      {showHistoryModal && selectedProduct && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => {
            setShowHistoryModal(false);
            setProductHistory(null);
            setSelectedProduct(null);
          }}
        >
          <div
            className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-500/30">
                  <BarChart className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Storico Prezzi Prodotto
                  </h3>
                  <p className="text-sm text-slate-300">
                    {selectedProduct.productName.split(' - ')[0]}
                  </p>
                  {selectedProduct.productCode && (
                    <p className="text-xs text-slate-400">
                      Codice: {selectedProduct.productCode}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setProductHistory(null);
                  setSelectedProduct(null);
                }}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Loading State */}
            {loadingHistory && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 text-blue-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-300">Caricamento storico...</p>
                </div>
              </div>
            )}

            {/* History Content */}
            {!loadingHistory && productHistory && (
              <div className="space-y-6">
                {/* Statistics Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Prezzo Medio</p>
                    <p className="text-lg font-bold text-blue-400">
                      CHF {productHistory.avgPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Prezzo Min</p>
                    <p className="text-lg font-bold text-green-400">
                      CHF {productHistory.minPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Prezzo Max</p>
                    <p className="text-lg font-bold text-red-400">
                      CHF {productHistory.maxPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Sconto Medio</p>
                    <p className="text-lg font-bold text-yellow-400">
                      {productHistory.avgDiscount.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Recent Orders Table */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    Ultimi {productHistory.recentOrders.length} Ordini
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Cliente</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Data</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Qtà</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Prezzo</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Sconto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productHistory.recentOrders.map((order, index) => (
                          <tr
                            key={order.orderId}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <span className="text-slate-300 font-medium">
                                {order.customerAlias}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {new Date(order.date).toLocaleDateString('it-IT')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {order.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-blue-400">
                              CHF {order.priceUnit.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-yellow-400">
                              {order.discount.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {productHistory.recentOrders.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400">Nessuno storico disponibile per questo prodotto</p>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {!loadingHistory && !productHistory && (
              <div className="text-center py-8">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <p className="text-slate-400">Errore nel caricamento dello storico</p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
