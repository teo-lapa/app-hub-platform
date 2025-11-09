'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, CheckCircle, AlertCircle, Loader2, DollarSign, TrendingDown, Lock, Unlock, TrendingUp, Award, Info, BarChart, X, Trash2, ClipboardCheck } from 'lucide-react';
import type { OrderData, OrderLine, PriceUpdate } from '../types';
import ManualProductSearch from '../../components/ManualProductSearch';

interface CustomerStats {
  totalRevenue: number;
  tier: 'VIP' | 'GOLD' | 'SILVER' | 'BRONZE' | 'STANDARD';
  suggestedDiscount: number;
  averageOrderValue: number;
  orderCount: number;
}

interface GlobalStats {
  averageOrderValue: number;
  totalRevenue: number;
  customerCount: number;
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

  // Global stats state
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState(false);

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

  // Quantity editing state
  const [editingQuantity, setEditingQuantity] = useState<number | null>(null);
  const [quantityValues, setQuantityValues] = useState<Map<number, number>>(new Map());

  // Task creation modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskRequestLine, setTaskRequestLine] = useState<OrderLine | null>(null);
  const [taskNote, setTaskNote] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  // Delivery date editing state
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [newDeliveryDate, setNewDeliveryDate] = useState<string>('');
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  // Order cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  // Check if order can be edited (only draft state allows editing)
  const canEditOrder = orderData?.state === 'draft';

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

      // Log isLocked status for each line
      if (data.order.lines) {
        console.log('🔒 Lock status for each product:');
        data.order.lines.forEach((line: any) => {
          console.log(`  Product ${line.productId} (${line.productName}): isLocked = ${line.isLocked}`);
        });
      }

      // Initialize slider with first line ID
      if (data.order.lines && data.order.lines.length > 0) {
        setActiveSlider({
          lineId: data.order.lines[0].id,
          type: 'price'
        });
      }

      // Load customer stats and global stats
      if (data.order.customerId) {
        loadCustomerStats(data.order.customerId);
      }
      loadGlobalStats();
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

  // Load global stats
  const loadGlobalStats = async () => {
    try {
      setLoadingGlobalStats(true);
      const response = await fetch('/api/catalogo-venditori/global-stats');
      const data = await response.json();

      if (data.success) {
        setGlobalStats(data.stats);
        console.log('✅ Global stats loaded:', data.stats);
      }
    } catch (err: any) {
      console.error('❌ Error loading global stats:', err);
    } finally {
      setLoadingGlobalStats(false);
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

  // Handle quantity change
  const handleQuantityChange = (lineId: number, value: string) => {
    const quantity = parseInt(value) || 0;
    if (quantity > 0) {
      const newQuantityValues = new Map(quantityValues);
      newQuantityValues.set(lineId, quantity);
      setQuantityValues(newQuantityValues);
    }
  };

  // Handle remove line from order
  const handleRemoveLine = async (lineId: number) => {
    if (!orderData) return;

    try {
      setLoading(true);
      setError('');

      console.log('🗑️ Deleting line from Odoo:', {
        orderId: orderData.id,
        lineId
      });

      // Call API to delete line from Odoo order
      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderData.id}/delete-line`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineId: lineId
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella cancellazione del prodotto');
      }

      console.log('✅ Line deleted from Odoo successfully');

      // Reload order data to get updated totals
      await loadOrderData();

      console.log('✅ Order data reloaded after deletion');
    } catch (error) {
      console.error('❌ Error deleting line:', error);
      setError(error instanceof Error ? error.message : 'Errore nella cancellazione del prodotto');
    } finally {
      setLoading(false);
    }
  };

  // Handle add product to order
  const handleAddProduct = async (product: any, quantity: number) => {
    if (!orderData) return;

    try {
      setLoading(true);
      setError('');

      console.log('➕ Adding product to order in Odoo:', {
        orderId: orderData.id,
        productId: product.id,
        productName: product.name,
        quantity
      });

      // Call API to add product line to Odoo order
      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderData.id}/add-line`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nell\'aggiunta del prodotto');
      }

      console.log('✅ Product added to Odoo order successfully:', data.lineId);

      // Reload order data to get updated prices, costs, and all product details
      await loadOrderData();

      console.log('✅ Order data reloaded with new product');
    } catch (error) {
      console.error('❌ Error adding product:', error);
      setError(error instanceof Error ? error.message : 'Errore nell\'aggiunta del prodotto');
    } finally {
      setLoading(false);
    }
  };

  // Handle task creation request
  const handleRequestPriceLock = async () => {
    if (!taskRequestLine || !orderData) return;

    // Validazione: la nota è obbligatoria
    if (!taskNote.trim()) {
      alert('⚠️ La nota per Laura è obbligatoria. Inserisci una spiegazione per la richiesta.');
      return;
    }

    try {
      setCreatingTask(true);
      setError('');

      const edited = editedLines.get(taskRequestLine.id);
      const proposedPrice = edited?.priceUnit ?? taskRequestLine.currentPriceUnit;
      const discount = edited?.discount ?? taskRequestLine.currentDiscount;

      console.log('📋 Creating task for price lock approval:', {
        lineId: taskRequestLine.id,
        productName: taskRequestLine.productName,
        proposedPrice
      });

      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderData.id}/create-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineId: taskRequestLine.id,
          productName: taskRequestLine.productName,
          productCode: taskRequestLine.productCode,
          costPrice: taskRequestLine.costPrice,
          avgSellingPrice: taskRequestLine.avgSellingPrice,
          proposedPrice,
          discount,
          note: taskNote
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella creazione del task');
      }

      console.log('✅ Task created successfully:', data.taskId);

      // Close modal and reset state
      setShowTaskModal(false);
      setTaskRequestLine(null);
      setTaskNote('');

      // Show success message
      alert(`✅ Richiesta inviata a Laura per il prodotto: ${taskRequestLine.productName.split(' - ')[0]}`);

    } catch (error) {
      console.error('❌ Error creating task:', error);
      setError(error instanceof Error ? error.message : 'Errore nella creazione del task');
    } finally {
      setCreatingTask(false);
    }
  };

  // Get slider range based on cost price and average selling price
  const getSliderRange = (line: OrderLine, type: 'price' | 'discount'): { min: number; max: number } => {
    if (type === 'discount') {
      return { min: 0, max: 100 };
    }
    // Price slider: from costPrice + 5% margin to avgSellingPrice + 150% (or 400% of cost if no avg)
    const costPrice = line.costPrice || 0;
    const avgSellingPrice = line.avgSellingPrice || 0;

    const min = costPrice * 1.05; // +5% margin for coverage
    const max = avgSellingPrice > 0
      ? avgSellingPrice * 2.5 // avg + 150%
      : costPrice * 4.2; // 400% of cost price if no average

    return { min, max };
  };

  // Get reference markers positions for price slider
  const getPriceMarkers = (line: OrderLine): { label: string; position: number; color: string }[] => {
    const costPrice = line.costPrice || 0;
    const avgSellingPrice = line.avgSellingPrice || 0;
    const range = getSliderRange(line, 'price');

    const markers = [];

    // Marker for +40% on cost price (Punto Critico)
    const fortyPercentPrice = costPrice * 1.4;
    if (fortyPercentPrice >= range.min && fortyPercentPrice <= range.max) {
      const position = ((fortyPercentPrice - range.min) / (range.max - range.min)) * 100;
      markers.push({
        label: 'PC',
        position,
        color: 'rgb(251, 191, 36)' // yellow
      });
    }

    // Marker for 3-month average selling price (only shown when available)
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

  // Save all changes (quantities and prices)
  const handleSavePrices = async () => {
    if (editedLines.size === 0 && quantityValues.size === 0) {
      setError('Nessuna modifica da salvare');
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // 1. Save quantity changes first
      if (quantityValues.size > 0) {
        console.log('💾 Saving quantity changes...');

        const quantityUpdates = Array.from(quantityValues.entries()).map(([lineId, quantity]) => ({
          lineId,
          quantity
        }));

        const quantityResponse = await fetch('/api/catalogo-venditori/update-quantities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            updates: quantityUpdates
          })
        });

        const quantityData = await quantityResponse.json();

        if (!quantityData.success) {
          throw new Error(quantityData.error || 'Errore nel salvataggio quantità');
        }

        console.log('✅ Quantities updated:', quantityData);
      }

      // 2. Save price/discount changes
      if (editedLines.size > 0) {
        console.log('💾 Saving price changes...');

        const priceUpdates: PriceUpdate[] = Array.from(editedLines.entries()).map(([lineId, values]) => ({
          lineId,
          priceUnit: values.priceUnit,
          discount: values.discount
        }));

        const priceResponse = await fetch('/api/catalogo-venditori/update-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            updates: priceUpdates
          })
        });

        const priceData = await priceResponse.json();

        if (!priceData.success) {
          throw new Error(priceData.error || 'Errore nel salvataggio prezzi');
        }

        console.log('✅ Prices updated:', priceData);
      }

      // 3. Reload order data to get fresh data from Odoo
      await loadOrderData();

      // 4. Clear all edits
      setEditedLines(new Map());
      setQuantityValues(new Map());

      console.log('✅ All changes saved successfully');

    } catch (err: any) {
      console.error('❌ Error saving changes:', err);
      setError(err.message || 'Errore nel salvataggio modifiche');
    } finally {
      setLoading(false);
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

  // Update delivery date
  const handleUpdateDeliveryDate = async () => {
    if (!newDeliveryDate) {
      setError('Inserisci una data di consegna');
      return;
    }

    try {
      setUpdatingDelivery(true);
      setError(null);

      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderId}/update-delivery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryDate: newDeliveryDate })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore aggiornamento data consegna');
      }

      console.log('✅ Delivery date updated');
      setEditingDeliveryDate(false);

      // Reload order data to show new date
      await loadOrderData();

    } catch (err: any) {
      console.error('❌ Error updating delivery date:', err);
      setError(err.message || 'Errore aggiornamento data consegna');
    } finally {
      setUpdatingDelivery(false);
    }
  };

  // Cancel order
  const handleCancelOrder = async () => {
    try {
      setCancellingOrder(true);
      setError(null);

      const response = await fetch(`/api/catalogo-venditori/order-prices/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore annullamento ordine');
      }

      console.log('✅ Order cancelled');
      setShowCancelModal(false);

      // Redirect back after 1 second
      setTimeout(() => {
        router.back();
      }, 1000);

    } catch (err: any) {
      console.error('❌ Error cancelling order:', err);
      setError(err.message || 'Errore annullamento ordine');
    } finally {
      setCancellingOrder(false);
    }
  };

  const totals = calculateTotals();
  const hasChanges = editedLines.size > 0 || quantityValues.size > 0;

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

  // Calculate customer position relative to global average
  const getCustomerPosition = () => {
    if (!customerStats || !globalStats || globalStats.averageOrderValue === 0) {
      return null;
    }

    const ratio = customerStats.averageOrderValue / globalStats.averageOrderValue;

    // Calculate percentage (0-100) for position on bar
    // Map ratio to 0-100 scale:
    // ratio < 0.5 (molto sotto) -> 0-20%
    // ratio 0.5-0.9 (sotto) -> 20-45%
    // ratio 0.9-1.1 (media) -> 45-55%
    // ratio 1.1-1.5 (sopra) -> 55-80%
    // ratio > 1.5 (molto sopra) -> 80-100%

    let position;
    let label;
    let color;

    if (ratio < 0.5) {
      position = ratio * 40; // 0-20%
      label = 'Molto Sotto Media';
      color = 'rgb(239, 68, 68)'; // red
    } else if (ratio < 0.9) {
      position = 20 + ((ratio - 0.5) / 0.4) * 25; // 20-45%
      label = 'Sotto Media';
      color = 'rgb(251, 191, 36)'; // yellow
    } else if (ratio < 1.1) {
      position = 45 + ((ratio - 0.9) / 0.2) * 10; // 45-55%
      label = 'Media';
      color = 'rgb(59, 130, 246)'; // blue
    } else if (ratio < 1.5) {
      position = 55 + ((ratio - 1.1) / 0.4) * 25; // 55-80%
      label = 'Sopra Media';
      color = 'rgb(34, 197, 94)'; // green
    } else {
      position = 80 + Math.min((ratio - 1.5) / 1.5 * 20, 20); // 80-100%
      label = 'Molto Sopra Media';
      color = 'rgb(168, 85, 247)'; // purple
    }

    return {
      position: Math.min(Math.max(position, 0), 100),
      label,
      color,
      ratio,
      customerAvg: customerStats.averageOrderValue,
      globalAvg: globalStats.averageOrderValue
    };
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
            onClick={() => router.back()}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Indietro
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="py-2 sm:py-3">
            <div className="flex items-center justify-between gap-1.5 sm:gap-3">
              {/* Back Button */}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-slate-800/70 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors min-h-[44px] shrink-0"
                aria-label="Indietro"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden sm:inline">Indietro</span>
              </button>

              {/* Title */}
              <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                <div className="bg-gradient-to-r from-green-500 to-blue-500 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0">
                  <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-xl lg:text-2xl font-bold text-white truncate">
                    Revisione Prezzi
                  </h1>
                  <p className="text-[10px] sm:text-sm text-slate-300 truncate">
                    Ordine {orderData.name}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-6 pb-24 sm:pb-32">
        {/* Success Message */}
        {confirmSuccess && (
          <div className="mb-2 sm:mb-4 bg-green-500/20 border border-green-500 rounded-lg p-2 sm:p-4 animate-pulse">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 sm:h-8 sm:w-8 text-green-400 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-green-400">
                  Ordine Confermato! 🎉
                </h3>
                <p className="text-xs sm:text-base text-green-300">
                  Ordine {orderData.name} confermato
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-2 sm:mb-4 bg-red-500/20 border border-red-500 rounded-lg p-2 sm:p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 sm:h-6 sm:w-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm sm:text-lg font-bold text-red-400">Errore</h3>
                <p className="text-xs sm:text-base text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Info Card */}
        <div className="mb-2 sm:mb-4 bg-slate-800 rounded-lg p-2 sm:p-4 border border-slate-700 shadow-lg">
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div>
              <p className="text-[10px] sm:text-sm text-slate-400 mb-0.5">Cliente</p>
              <p className="text-xs sm:text-lg font-semibold text-white truncate">{orderData.customerName}</p>
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-slate-400 mb-0.5">Consegna</p>
              {orderData.state === 'draft' || orderData.state === 'sale' ? (
                editingDeliveryDate ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDeliveryDate}
                      onChange={(e) => setNewDeliveryDate(e.target.value)}
                      className="flex-1 px-2 py-2 bg-slate-700 text-white text-xs sm:text-sm rounded border border-slate-600 focus:border-blue-500 outline-none min-h-[40px]"
                    />
                    <button
                      onClick={handleUpdateDeliveryDate}
                      disabled={updatingDelivery}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-xs sm:text-sm rounded transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      {updatingDelivery ? 'Salvo...' : '✓'}
                    </button>
                    <button
                      onClick={() => setEditingDeliveryDate(false)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs sm:text-sm rounded transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-lg font-semibold text-white truncate">
                      {orderData.deliveryDate ? new Date(orderData.deliveryDate).toLocaleDateString('it-IT') : 'N/D'}
                    </p>
                    <button
                      onClick={() => {
                        setNewDeliveryDate(orderData.deliveryDate || '');
                        setEditingDeliveryDate(true);
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title="Modifica data consegna"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                )
              ) : (
                <p className="text-xs sm:text-lg font-semibold text-white truncate">
                  {orderData.deliveryDate ? new Date(orderData.deliveryDate).toLocaleDateString('it-IT') : 'N/D'}
                </p>
              )}
            </div>
            {orderData.pricelist && (
              <div className="col-span-2">
                <p className="text-[10px] sm:text-sm text-slate-400 mb-0.5">Listino</p>
                <p className="text-xs sm:text-base font-semibold text-blue-400 truncate">{orderData.pricelist.name}</p>
              </div>
            )}

            {/* Customer Position Bar */}
            {(() => {
              const position = getCustomerPosition();
              if (!position) return null;

              return (
                <div className="col-span-2 mt-2 sm:mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] sm:text-xs text-slate-400">Posizione Cliente vs Media</p>
                    <p className="text-[9px] sm:text-xs text-slate-400">
                      CHF {position.customerAvg.toFixed(0)} vs {position.globalAvg.toFixed(0)}
                    </p>
                  </div>

                  {/* Position Bar */}
                  <div className="relative h-3 sm:h-4 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600">
                    {/* Gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-blue-500 via-green-500 to-purple-500 opacity-40"></div>

                    {/* Customer position marker */}
                    <div
                      className="absolute top-0 bottom-0 w-1 sm:w-1.5 -ml-0.5 sm:-ml-0.75 transition-all duration-300"
                      style={{
                        left: `${position.position}%`,
                        backgroundColor: position.color,
                        boxShadow: `0 0 8px ${position.color}`
                      }}
                    />
                  </div>

                  {/* Label */}
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[9px] sm:text-xs text-slate-500">Molto Sotto</p>
                    <p
                      className="text-[9px] sm:text-xs font-bold"
                      style={{ color: position.color }}
                    >
                      {position.label}
                    </p>
                    <p className="text-[9px] sm:text-xs text-slate-500">Molto Sopra</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Customer Stats Card */}
        {loadingStats && (
          <div className="mb-2 sm:mb-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-2 sm:p-4 border border-green-500/30">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 animate-spin" />
              <p className="text-xs sm:text-sm text-slate-300">Caricamento stats...</p>
            </div>
          </div>
        )}

        {customerStats && (
          <div className="mb-2 sm:mb-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg p-2 sm:p-4 border border-green-500/30">
            <div className="flex items-center gap-1.5 sm:gap-3 mb-2">
              <div className={`bg-gradient-to-r ${getTierColor(customerStats.tier)} p-1.5 sm:p-2.5 rounded-lg`}>
                <Award className="h-3 w-3 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xs sm:text-lg font-bold text-white">Statistiche Cliente</h3>
                <p className="text-[10px] sm:text-sm text-slate-300 hidden sm:block">Profilo e sconti suggeriti</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
              {/* Fatturato Totale */}
              <div className="bg-slate-800/50 rounded-lg p-1.5 sm:p-3 border border-slate-700">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                  <p className="text-[9px] sm:text-xs text-slate-400">Fatturato</p>
                </div>
                <p className="text-[10px] sm:text-base font-bold text-green-400 truncate">
                  {customerStats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              {/* Tier Cliente */}
              <div className="bg-slate-800/50 rounded-lg p-1.5 sm:p-3 border border-slate-700">
                <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Tier</p>
                <div className={`inline-flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded border ${getTierBadgeColor(customerStats.tier)}`}>
                  <Award className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                  <span className="text-[9px] sm:text-sm font-bold">{customerStats.tier}</span>
                </div>
              </div>

              {/* Sconto Suggerito */}
              <div className="bg-slate-800/50 rounded-lg p-1.5 sm:p-3 border border-slate-700">
                <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Sconto</p>
                <div className={`inline-flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded border ${getDiscountBadgeColor(customerStats.suggestedDiscount)}`}>
                  <TrendingDown className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-base font-bold">{customerStats.suggestedDiscount.toFixed(1)}%</span>
                </div>
              </div>

              {/* Media Ordini */}
              <div className="bg-slate-800/50 rounded-lg p-1.5 sm:p-3 border border-slate-700">
                <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Media</p>
                <p className="text-[10px] sm:text-base font-bold text-blue-400 truncate">
                  {customerStats.averageOrderValue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-[8px] sm:text-xs text-slate-500">
                  {customerStats.orderCount} ord
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Product Lines */}
        <div className="space-y-1.5 sm:space-y-3 mb-4">
          {orderData.lines.map((line) => {
            const edited = editedLines.get(line.id);
            const priceUnit = edited?.priceUnit ?? line.currentPriceUnit;
            const discount = edited?.discount ?? line.currentDiscount;
            const lineTotal = getLineTotal(line);
            const isEdited = edited !== undefined;

            return (
              <div
                key={line.id}
                className={`bg-slate-800 rounded-lg p-2 sm:p-4 border transition-all ${
                  isEdited ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-slate-700'
                }`}
              >
                {/* Product Header */}
                <div className="flex gap-2 sm:gap-3 mb-2">
                  {line.imageUrl && (
                    <img
                      src={line.imageUrl}
                      alt={line.productName}
                      className="w-12 h-12 sm:w-20 sm:h-20 object-cover rounded border border-slate-600 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h3 className="text-xs sm:text-base font-bold text-white line-clamp-2 leading-tight">
                        {line.productName.split(' - ')[0]}
                      </h3>
                      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
                        {/* History Button */}
                        <button
                          onClick={() => loadProductHistory(line.productId, line)}
                          className="p-1 sm:p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                          title="Storico"
                        >
                          <BarChart className="h-3 w-3 sm:h-4 sm:w-4" />
                        </button>
                        {/* Task Request Button - only show in draft state and when price is edited */}
                        {canEditOrder && (
                          <button
                            onClick={() => {
                              setTaskRequestLine(line);
                              setShowTaskModal(true);
                            }}
                            disabled={!isEdited}
                            className={`p-1 sm:p-1.5 rounded border transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center ${
                              isEdited
                                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30 cursor-pointer'
                                : 'bg-slate-700/50 text-slate-500 border-slate-600 cursor-not-allowed opacity-50'
                            }`}
                            title={isEdited ? "Richiedi blocco prezzo" : "Modifica prima il prezzo"}
                          >
                            <ClipboardCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        {/* Delete Button - only show in draft state */}
                        {canEditOrder && (
                          <button
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 sm:p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded border border-red-500/30 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="Elimina"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        {/* Lock/Unlock Icon */}
                        <div title={line.isLocked ? "Bloccato" : "Modificabile"} className="flex items-center justify-center min-h-[32px]">
                          {line.isLocked ? (
                            <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-red-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-green-400" />
                          )}
                        </div>
                      </div>
                    </div>
                    {line.productCode && (
                      <p className="text-[10px] sm:text-sm text-slate-400 truncate">Cod: {line.productCode}</p>
                    )}
                    <div className="text-[10px] sm:text-sm text-slate-400 flex items-center gap-1">
                      <span>Qtà:</span>
                      {editingQuantity === line.id && canEditOrder ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={quantityValues.get(line.id) || line.quantity}
                          onChange={(e) => handleQuantityChange(line.id, e.target.value)}
                          onBlur={() => setEditingQuantity(null)}
                          autoFocus
                          className="w-16 px-1.5 py-0.5 bg-slate-700 border border-blue-500 rounded text-white font-semibold text-xs"
                        />
                      ) : (
                        <span
                          onClick={() => {
                            if (canEditOrder) {
                              setEditingQuantity(line.id);
                              if (!quantityValues.has(line.id)) {
                                const newQuantityValues = new Map(quantityValues);
                                newQuantityValues.set(line.id, line.quantity);
                                setQuantityValues(newQuantityValues);
                              }
                            }
                          }}
                          className={`font-semibold text-white min-h-[32px] flex items-center ${
                            canEditOrder ? 'cursor-pointer hover:text-blue-400 transition-colors' : 'cursor-not-allowed'
                          }`}
                        >
                          {quantityValues.get(line.id) || line.quantity} {line.uom}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price Fields */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  {/* Price Unit */}
                  <div>
                    <label className="block text-[10px] sm:text-sm text-slate-400 mb-0.5 sm:mb-1 truncate">
                      Prezzo
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getInputValue(line.id, 'priceUnit')}
                      onClick={() => canEditOrder && handleFieldClick(line.id, 'price')}
                      readOnly
                      disabled={line.isLocked || !canEditOrder}
                      className={`w-full px-1.5 sm:px-3 py-1.5 sm:py-2 rounded border text-white text-xs sm:text-base transition-all min-h-[36px] ${
                        line.isLocked || !canEditOrder
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : activeSlider.lineId === line.id && activeSlider.type === 'price'
                          ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500 cursor-pointer'
                          : 'bg-slate-700 border-slate-600 hover:border-blue-400 cursor-pointer'
                      }`}
                    />
                    {line.standardPrice > 0 && line.standardPrice !== priceUnit && (
                      <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5 truncate hidden sm:block">
                        Std: {line.standardPrice.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="block text-[10px] sm:text-sm text-slate-400 mb-0.5 sm:mb-1 truncate">
                      Sconto
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={getInputValue(line.id, 'discount')}
                      onClick={() => canEditOrder && handleFieldClick(line.id, 'discount')}
                      readOnly
                      disabled={line.isLocked || !canEditOrder}
                      className={`w-full px-1.5 sm:px-3 py-1.5 sm:py-2 rounded border text-white text-xs sm:text-base transition-all min-h-[36px] ${
                        line.isLocked || !canEditOrder
                          ? 'bg-slate-700/50 border-slate-600 cursor-not-allowed'
                          : activeSlider.lineId === line.id && activeSlider.type === 'discount'
                          ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500 cursor-pointer'
                          : 'bg-slate-700 border-slate-600 hover:border-blue-400 cursor-pointer'
                      }`}
                    />
                  </div>

                  {/* Total */}
                  <div>
                    <label className="block text-[10px] sm:text-sm text-slate-400 mb-0.5 sm:mb-1 truncate">
                      Totale
                    </label>
                    <div className="px-1.5 sm:px-3 py-1.5 sm:py-2 rounded bg-slate-700/50 border border-slate-600 min-h-[36px] flex items-center">
                      <p className="text-xs sm:text-xl font-bold text-green-400 truncate">
                        {lineTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Savings Indicator */}
                {discount > 0 && (
                  <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-sm text-green-400">
                    <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>
                      Risparmio: CHF {(line.quantity * priceUnit * discount / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Price/Discount Slider - Always visible when this line is active */}
                {activeSlider.lineId === line.id && !line.isLocked && canEditOrder && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-700">
                    <div className="space-y-1 sm:space-y-2">
                      {/* Slider Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] sm:text-sm font-medium text-slate-300">
                          {activeSlider.type === 'price' ? 'Prezzo' : 'Sconto'}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white">
                          {activeSlider.type === 'price'
                            ? `CHF ${getSliderValue(line, 'price').toFixed(2)}`
                            : `${getSliderValue(line, 'discount').toFixed(1)}%`
                          }
                        </span>
                      </div>

                      {/* Slider Input with Markers */}
                      <div className="relative pb-4 sm:pb-6">
                        {/* Reference Markers (only for price slider) */}
                        {activeSlider.type === 'price' && getPriceMarkers(line).map((marker, idx) => (
                          <div
                            key={idx}
                            className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${marker.position}%` }}
                          >
                            <div
                              className="w-0.5 sm:w-1 h-2 sm:h-3 rounded-full mb-0.5"
                              style={{ backgroundColor: marker.color }}
                            />
                            <span
                              className="text-[9px] sm:text-xs font-bold whitespace-nowrap"
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
                          className="w-full h-3 sm:h-4 rounded-lg appearance-none cursor-pointer slider-gradient touch-pan-x"
                          style={{
                            background: `linear-gradient(to right,
                              rgb(239, 68, 68) 0%,
                              rgb(251, 191, 36) ${getSliderColorPercentage(line, activeSlider.type) / 2}%,
                              rgb(34, 197, 94) ${getSliderColorPercentage(line, activeSlider.type)}%,
                              rgb(34, 197, 94) 100%)`,
                            WebkitTapHighlightColor: 'transparent'
                          }}
                        />
                      </div>

                      {/* Range Labels */}
                      <div className="flex items-center justify-end text-[9px] sm:text-xs text-slate-500">
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
        <div className="bg-slate-800 rounded-lg p-2 sm:p-4 border border-slate-700 shadow-lg mb-2 sm:mb-4">
          <h3 className="text-sm sm:text-xl font-bold text-white mb-1.5 sm:mb-3">Riepilogo</h3>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs sm:text-base">
              <span className="text-slate-400">Subtotale:</span>
              <span className="font-semibold text-white text-xs sm:text-base">{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-base">
              <span className="text-slate-400">IVA:</span>
              <span className="font-semibold text-white text-xs sm:text-base">{totals.tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-1 sm:pt-2 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-xl font-bold text-white">Totale:</span>
                <span className="text-base sm:text-2xl font-bold text-green-400">
                  {totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Search */}
        <div className="bg-slate-800 rounded-lg p-2 sm:p-4 border border-slate-700 shadow-lg mb-2">
          <h3 className="text-sm sm:text-xl font-bold text-white mb-1.5 sm:mb-3">Aggiungi Prodotto</h3>
          <ManualProductSearch
            customerId={orderData.customerId}
            onProductAdd={handleAddProduct}
          />
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      {orderData.state !== 'done' && orderData.state !== 'cancel' && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700 shadow-2xl z-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3">
              {/* DRAFT state: Show save and confirm buttons */}
              {orderData.state === 'draft' && (
                <>
                  {/* Save Changes Button */}
                  {hasChanges && (
                    <button
                      onClick={handleSavePrices}
                      className="flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors min-h-[44px] text-xs sm:text-base"
                    >
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                      Salva Modifiche
                    </button>
                  )}

                  {/* Confirm Order Button */}
                  <button
                    onClick={handleConfirmOrder}
                    disabled={isConfirming || confirmSuccess}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-600 text-white rounded-lg font-bold transition-all min-h-[44px] text-xs sm:text-base shadow-lg"
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
                </>
              )}

              {/* SALE state: Show cancel button only */}
              {orderData.state === 'sale' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-all min-h-[44px] text-xs sm:text-base shadow-lg"
                >
                  <X className="h-5 w-5" />
                  Annulla Ordine
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Modal */}
      {showTaskModal && taskRequestLine && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => {
            setShowTaskModal(false);
            setTaskRequestLine(null);
            setTaskNote('');
          }}
        >
          <div
            className="bg-slate-800 rounded-lg p-3 sm:p-6 max-w-xl w-full border border-purple-500/30 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex items-start gap-1.5 sm:gap-3">
                <div className="bg-purple-500/20 p-1.5 sm:p-2.5 rounded-lg border border-purple-500/30">
                  <ClipboardCheck className="h-4 w-4 sm:h-6 sm:w-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-xl font-bold text-white">
                    Richiedi Blocco Prezzo
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 mt-1">
                    {taskRequestLine.productName.split(' - ')[0]}
                  </p>
                  {taskRequestLine.productCode && (
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      Cod: {taskRequestLine.productCode}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setTaskRequestLine(null);
                  setTaskNote('');
                }}
                className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
                title="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Note Input */}
            <div className="mb-4">
              <label className="block text-xs sm:text-sm text-slate-300 font-medium mb-2">
                Note per Laura: <span className="text-red-400">*</span>
              </label>
              <textarea
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder="Spiega il motivo della richiesta di blocco prezzo (obbligatorio)..."
                className="w-full min-h-[140px] sm:min-h-[120px] px-3 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none text-sm touch-manipulation"
                required
                style={{
                  fontSize: '16px',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setTaskRequestLine(null);
                  setTaskNote('');
                }}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors min-h-[48px] text-sm sm:text-base"
                disabled={creatingTask}
              >
                Annulla
              </button>
              <button
                onClick={handleRequestPriceLock}
                disabled={creatingTask || !taskNote.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors min-h-[48px] text-sm sm:text-base"
              >
                {creatingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Invio...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />
                    Invia Richiesta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => setShowCancelModal(false)}
        >
          <div
            className="bg-slate-800 rounded-lg p-3 sm:p-6 max-w-md w-full border border-red-500/30 shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-1.5 sm:gap-3 mb-3 sm:mb-4">
              <div className="bg-red-500/20 p-1.5 sm:p-2.5 rounded-lg border border-red-500/30">
                <X className="h-4 w-4 sm:h-6 sm:w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm sm:text-xl font-bold text-white">
                  Annulla Ordine
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  {orderData?.name}
                </p>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4 mb-4">
              <p className="text-xs sm:text-sm text-slate-200">
                Sei sicuro di voler annullare questo ordine?
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Questa azione non può essere annullata. L'ordine passerà allo stato "Annullato".
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3 mb-3">
                <p className="text-xs sm:text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors min-h-[48px] text-sm sm:text-base"
                disabled={cancellingOrder}
              >
                Annulla
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancellingOrder}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors min-h-[48px] text-sm sm:text-base"
              >
                {cancellingOrder ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Annullamento...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    Conferma Annullamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product History Modal */}
      {showHistoryModal && selectedProduct && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          onClick={() => {
            setShowHistoryModal(false);
            setProductHistory(null);
            setSelectedProduct(null);
          }}
        >
          <div
            className="bg-slate-800 rounded-lg p-3 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex items-start gap-1.5 sm:gap-3">
                <div className="bg-blue-500/20 p-1.5 sm:p-2.5 rounded-lg border border-blue-500/30">
                  <BarChart className="h-4 w-4 sm:h-6 sm:w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-xl font-bold text-white">
                    Storico Prezzi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 line-clamp-1">
                    {selectedProduct.productName.split(' - ')[0]}
                  </p>
                  {selectedProduct.productCode && (
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      Cod: {selectedProduct.productCode}
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
                className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
                title="Chiudi"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Loading State */}
            {loadingHistory && (
              <div className="flex items-center justify-center py-6 sm:py-12">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 sm:h-10 sm:w-10 text-blue-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-slate-300">Caricamento...</p>
                </div>
              </div>
            )}

            {/* History Content */}
            {!loadingHistory && productHistory && (
              <div className="space-y-2 sm:space-y-4">
                {/* Statistics Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                  <div className="bg-slate-700/50 rounded p-1.5 sm:p-3 border border-slate-600">
                    <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Medio</p>
                    <p className="text-xs sm:text-lg font-bold text-blue-400 truncate">
                      {productHistory.avgPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-1.5 sm:p-3 border border-slate-600">
                    <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Min</p>
                    <p className="text-xs sm:text-lg font-bold text-green-400 truncate">
                      {productHistory.minPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-1.5 sm:p-3 border border-slate-600">
                    <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Max</p>
                    <p className="text-xs sm:text-lg font-bold text-red-400 truncate">
                      {productHistory.maxPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-1.5 sm:p-3 border border-slate-600">
                    <p className="text-[9px] sm:text-xs text-slate-400 mb-0.5">Sconto</p>
                    <p className="text-xs sm:text-lg font-bold text-yellow-400 truncate">
                      {productHistory.avgDiscount.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Info text */}
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-slate-400">
                    Ultimi 50 ordini confermati
                  </p>
                </div>
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
