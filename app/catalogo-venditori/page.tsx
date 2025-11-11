'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, ShoppingCart, Sparkles, CheckCircle, AlertCircle, FileText, X, Loader2, Bell, Tag } from 'lucide-react';
import CustomerSelector from './components/CustomerSelector';
import AIOrderInput from './components/AIOrderInput';
import SmartCart from './components/SmartCart';
import NotesInput from './components/NotesInput';
import ManualProductSearch from './components/ManualProductSearch';
import DeliveryDatePicker from './components/DeliveryDatePicker';
import OdooOrderLink from './components/OdooOrderLink';
import { UrgentProductsModal } from '@/components/maestro/UrgentProductsModal';
import { OfferProductsModal } from '@/components/maestro/OfferProductsModal';
import type { MatchedProduct, CartProduct } from './components/types';

export default function CatalogoVenditoriPage() {
  const router = useRouter();

  // Get tomorrow's date as default
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [warehouseNotes, setWarehouseNotes] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(getTomorrowDate());
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ name: string; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Orders modal state
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Prodotti urgenti e offerte
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);

  // Auto-scroll to top on mount (mobile optimization)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadProductCounts(); // Carica conteggi prodotti urgenti e offerte
  }, []);

  // Carica conteggi prodotti urgenti e offerte
  const loadProductCounts = async () => {
    try {
      // Carica prodotti urgenti
      const urgentResponse = await fetch('/api/urgent-products', { credentials: 'include' });
      const urgentData = await urgentResponse.json();
      if (urgentData.success) {
        setUrgentCount(urgentData.count || 0);
      }

      // Carica prodotti in offerta
      const offerResponse = await fetch('/api/offer-products', { credentials: 'include' });
      const offerData = await offerResponse.json();
      if (offerData.success) {
        setOfferCount(offerData.count || 0);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi:', error);
    }
  };

  // Handle customer selection
  const handleCustomerSelect = (customerId: number, customerName: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName);
    setError(null);
  };

  // Handle delivery address selection
  const handleAddressSelect = (addressId: number | null) => {
    setSelectedAddressId(addressId);
  };

  // Handle AI matched products
  const handleProductsMatched = (products: MatchedProduct[]) => {
    // Clear previous order success when starting a new order
    setOrderSuccess(null);

    // Convert matched products to cart products
    const newCartProducts: CartProduct[] = products
      .filter(p => p.product_id !== null) // Only add found products
      .map(p => ({
        product_id: p.product_id!,
        product_name: p.product_name!,
        quantity: p.quantita,
        confidence: p.confidence,
        reasoning: p.reasoning,
        image_url: p.image_url || null,
        qty_available: p.qty_available || 0,
        uom_name: p.uom_name || '',
        incoming_qty: p.incoming_qty || 0,
        incoming_date: p.incoming_date || null,
      }));

    // Add to cart (merge with existing)
    setCartProducts(prev => {
      const merged = [...prev];
      newCartProducts.forEach(newProduct => {
        const existingIndex = merged.findIndex(p => p.product_id === newProduct.product_id);
        if (existingIndex >= 0) {
          // Product already in cart, add quantities
          merged[existingIndex].quantity += newProduct.quantity;
        } else {
          // New product, add to cart
          merged.push(newProduct);
        }
      });
      return merged;
    });

    // Scroll to cart on mobile
    setTimeout(() => {
      const cartElement = document.getElementById('smart-cart');
      if (cartElement) {
        cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  // Handle quantity change in cart
  const handleQuantityChange = (index: number, quantity: number) => {
    setCartProducts(prev => {
      const updated = [...prev];
      updated[index].quantity = quantity;
      return updated;
    });
  };

  // Handle product removal from cart
  const handleRemoveProduct = (index: number) => {
    setCartProducts(prev => prev.filter((_, i) => i !== index));
  };

  // Handle manual product add
  const handleManualProductAdd = (product: any, quantity: number) => {
    // Clear previous order success when starting a new order
    setOrderSuccess(null);

    const newCartProduct: CartProduct = {
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      price: product.list_price || undefined,
      confidence: 'MANUALE',
      image_url: product.image_128 ? `data:image/png;base64,${product.image_128}` : null,
      qty_available: product.qty_available || 0,
      uom_name: product.uom_id && Array.isArray(product.uom_id) ? product.uom_id[1] : '',
      incoming_qty: product.incoming_qty || 0,
      incoming_date: product.incoming_date || null,
    };

    // Add to cart (merge with existing)
    setCartProducts(prev => {
      const existingIndex = prev.findIndex(p => p.product_id === newCartProduct.product_id);
      if (existingIndex >= 0) {
        // Product already in cart, add quantities
        const updated = [...prev];
        updated[existingIndex].quantity += newCartProduct.quantity;
        return updated;
      } else {
        // New product, add to cart
        return [...prev, newCartProduct];
      }
    });

    // Scroll to cart on mobile
    setTimeout(() => {
      const cartElement = document.getElementById('smart-cart');
      if (cartElement) {
        cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  // Handle order confirmation
  const handleConfirmOrder = async () => {
    if (!selectedCustomerId) {
      setError('Seleziona un cliente prima di confermare l\'ordine');
      return;
    }

    if (cartProducts.length === 0) {
      setError('Aggiungi almeno un prodotto al carrello');
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      const response = await fetch('/api/catalogo-venditori/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          deliveryAddressId: selectedAddressId,
          orderLines: cartProducts.map(p => ({
            product_id: p.product_id,
            quantity: p.quantity
          })),
          orderNotes: orderNotes || undefined,
          warehouseNotes: warehouseNotes || undefined,
          deliveryDate: deliveryDate || undefined
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella creazione dell\'ordine');
      }

      // Success! Redirect to price review page
      console.log('✅ Order created, redirecting to price review:', data.orderId);
      router.push(`/catalogo-venditori/review-prices/${data.orderId}`);

    } catch (err: any) {
      console.error('Errore creazione ordine:', err);
      setError(err.message || 'Errore nella creazione dell\'ordine');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Handle new order - reset EVERYTHING
  const handleNewOrder = () => {
    setSelectedCustomerId(null);
    setSelectedCustomerName('');
    setSelectedAddressId(null);
    setCartProducts([]);
    setOrderNotes('');
    setWarehouseNotes('');
    setOrderSuccess(null);
    setError(null);
    setDeliveryDate(getTomorrowDate());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load customer orders and quotations
  const loadCustomerOrders = async () => {
    if (!selectedCustomerId) {
      setError('Seleziona un cliente prima di vedere gli ordini');
      return;
    }

    try {
      setLoadingOrders(true);
      setShowOrdersModal(true);
      setCustomerOrders([]);

      const response = await fetch(`/api/catalogo-venditori/customer-orders/${selectedCustomerId}`);
      const data = await response.json();

      if (data.success) {
        setCustomerOrders(data.orders);
        console.log('✅ Customer orders loaded:', data.orders.length);
      } else {
        throw new Error(data.error || 'Errore nel caricamento ordini');
      }
    } catch (err: any) {
      console.error('❌ Error loading customer orders:', err);
      setError(err.message || 'Errore nel caricamento ordini');
      setShowOrdersModal(false);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle order selection from modal
  const handleSelectOrder = (orderId: number) => {
    setShowOrdersModal(false);
    router.push(`/catalogo-venditori/review-prices/${orderId}`);
  };

  return (
    <div className="min-h-screen-dynamic bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header - Sticky on mobile */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
          <div className="py-2 sm:py-3">
            <div className="flex items-center justify-between gap-1.5 sm:gap-3">
              {/* Home Button */}
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-slate-800/70 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors min-h-[44px] shrink-0"
                aria-label="Home"
              >
                <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden sm:inline">Home</span>
              </button>

              {/* Nuovo Ordine Button */}
              <button
                onClick={handleNewOrder}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg border border-emerald-500 transition-colors min-h-[44px] shrink-0"
                aria-label="Nuovo"
              >
                <svg className="h-5 w-5 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm sm:text-base font-medium hidden sm:inline">Nuovo Ordine</span>
              </button>

              {/* Ordini Button - Navigate to orders list */}
              <button
                onClick={() => router.push('/catalogo-venditori/ordini')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg border border-purple-500 transition-colors min-h-[44px] shrink-0"
                aria-label="Ordini"
                title="Visualizza tutti gli ordini"
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden lg:inline">Ordini</span>
              </button>

              {/* Prodotti Urgenti Button */}
              <button
                onClick={() => setShowUrgentModal(true)}
                className="relative flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-orange-600/80 hover:bg-orange-600 text-white rounded-lg border border-orange-500 transition-colors min-h-[44px] shrink-0"
                aria-label="Urgenti"
                title="Prodotti urgenti da vendere"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden lg:inline">Urgenti</span>
                {urgentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {urgentCount}
                  </span>
                )}
              </button>

              {/* Prodotti in Offerta Button */}
              <button
                onClick={() => setShowOfferModal(true)}
                className="relative flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg border border-blue-500 transition-colors min-h-[44px] shrink-0"
                aria-label="Offerte"
                title="Prodotti in offerta"
              >
                <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden lg:inline">Offerte</span>
                {offerCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {offerCount}
                  </span>
                )}
              </button>

              {/* Revisione Prezzi Button */}
              <button
                onClick={loadCustomerOrders}
                disabled={!selectedCustomerId}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg border transition-colors min-h-[44px] shrink-0 ${
                  selectedCustomerId
                    ? 'bg-blue-600/80 hover:bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-700/50 text-slate-500 border-slate-600 cursor-not-allowed'
                }`}
                aria-label="Revisione"
                title={!selectedCustomerId ? 'Seleziona un cliente' : 'Vedi ordini del cliente'}
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-base font-medium hidden lg:inline">Revisione</span>
              </button>

              {/* Title */}
              <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl shrink-0">
                  <Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-xl lg:text-2xl font-bold text-white truncate">
                    Catalogo AI
                  </h1>
                  <p className="text-[10px] sm:text-sm text-slate-300 hidden sm:block">
                    Ordini intelligenti
                  </p>
                </div>
              </div>

              {/* Cart Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-slate-300" />
                  {cartProducts.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-emerald-500 text-white text-[10px] sm:text-xs font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                      {cartProducts.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 pb-20 sm:pb-8">
        {/* Success Message */}
        {orderSuccess && (
          <div className="mb-2 sm:mb-4 bg-green-500/20 border border-green-500 rounded-lg p-2 sm:p-4 animate-pulse">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 sm:h-8 sm:w-8 text-green-400 shrink-0" />
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-green-400">
                  Ordine Creato! 🎉
                </h3>
                <p className="text-xs sm:text-base text-green-300">
                  <strong>{orderSuccess.name}</strong> (ID: {orderSuccess.id})
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

        {/* Customer Selector */}
        <div className="mb-2 sm:mb-4">
          <CustomerSelector
            onCustomerSelect={handleCustomerSelect}
            onAddressSelect={handleAddressSelect}
          />
        </div>

        {/* Delivery Date Picker */}
        {selectedCustomerId && (
          <div className="mb-2 sm:mb-4">
            <div className="bg-slate-800 rounded-lg p-2 sm:p-4 border border-slate-700 shadow-lg">
              <DeliveryDatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
              />

              {/* Odoo Order Link - Only shown after order confirmation */}
              {orderSuccess && (
                <OdooOrderLink
                  orderId={orderSuccess.id}
                  orderName={orderSuccess.name}
                />
              )}
            </div>
          </div>
        )}

        {/* AI Order Input */}
        {selectedCustomerId && (
          <div className="mb-2 sm:mb-4">
            <AIOrderInput
              customerId={selectedCustomerId}
              onProductsMatched={handleProductsMatched}
            />
          </div>
        )}

        {/* Manual Product Search */}
        {selectedCustomerId && (
          <div className="mb-2 sm:mb-4">
            <div className="bg-slate-800 rounded-lg p-2 sm:p-4 border border-slate-700 shadow-lg">
              <ManualProductSearch
                customerId={selectedCustomerId}
                onProductAdd={handleManualProductAdd}
              />
            </div>
          </div>
        )}

        {/* Order Notes */}
        {selectedCustomerId && cartProducts.length > 0 && (
          <div className="mb-2 sm:mb-4">
            <NotesInput
              orderNotes={orderNotes}
              warehouseNotes={warehouseNotes}
              onOrderNotesChange={setOrderNotes}
              onWarehouseNotesChange={setWarehouseNotes}
            />
          </div>
        )}

        {/* Smart Cart */}
        <div id="smart-cart" className="scroll-mt-16 sm:scroll-mt-20">
          <SmartCart
            products={cartProducts}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemoveProduct}
            onConfirm={handleConfirmOrder}
            loading={isCreatingOrder}
          />
        </div>

        {/* Help Card - Mobile Optimized */}
        {!selectedCustomerId && (
          <div className="mt-3 sm:mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-4">
            <h3 className="text-sm sm:text-xl font-bold text-blue-400 mb-2 sm:mb-3 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
              Come funziona
            </h3>
            <ol className="space-y-1.5 sm:space-y-3 text-xs sm:text-base text-slate-300">
              <li className="flex items-start gap-1.5 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold">
                  1
                </span>
                <span>Seleziona il <strong className="text-white">cliente</strong> e indirizzo</span>
              </li>
              <li className="flex items-start gap-1.5 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold">
                  2
                </span>
                <span>Inserisci l'ordine del cliente: <strong className="text-white">testo</strong>, <strong className="text-white">foto</strong>, <strong className="text-white">audio</strong> o <strong className="text-white">registrazione vocale</strong></span>
              </li>
              <li className="flex items-start gap-1.5 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold">
                  3
                </span>
                <span>L'<strong className="text-white">AI processa</strong> il messaggio e trova i prodotti automaticamente</span>
              </li>
              <li className="flex items-start gap-1.5 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold">
                  4
                </span>
                <span>Oppure usa la <strong className="text-white">ricerca manuale</strong> per aggiungere prodotti specifici</span>
              </li>
              <li className="flex items-start gap-1.5 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] sm:text-sm font-bold">
                  5
                </span>
                <span>Controlla il <strong className="text-white">carrello</strong>, modifica se necessario e conferma!</span>
              </li>
            </ol>
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) - Mobile Only */}
      {cartProducts.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 sm:hidden">
          <button
            onClick={() => {
              const cartElement = document.getElementById('smart-cart');
              if (cartElement) {
                cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-emerald-500/50 transition-all min-h-[56px] font-bold"
            aria-label="Vai al carrello"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>{cartProducts.length}</span>
            <span className="text-sm">Prodotti</span>
          </button>
        </div>
      )}

      {/* Orders Modal - Mobile Optimized */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-800 rounded-lg sm:rounded-xl max-w-4xl w-full max-h-[85vh] overflow-auto border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-2 sm:p-4 lg:p-6 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-xl lg:text-2xl font-bold text-white mb-0.5 sm:mb-1 truncate">
                  Ordini e Preventivi
                </h3>
                <p className="text-[10px] sm:text-sm text-slate-400 truncate">
                  {selectedCustomerName}
                </p>
              </div>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="p-1.5 sm:p-2 hover:bg-slate-700 rounded-lg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Chiudi"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-2 sm:p-4 lg:p-6">
              {/* Loading State */}
              {loadingOrders && (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 text-blue-400 animate-spin mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-base text-slate-400">Caricamento ordini...</p>
                </div>
              )}

              {/* Empty State */}
              {!loadingOrders && customerOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 text-slate-600 mb-2 sm:mb-3" />
                  <p className="text-sm sm:text-lg text-slate-400">Nessun ordine o preventivo trovato</p>
                </div>
              )}

              {/* Orders List */}
              {!loadingOrders && customerOrders.length > 0 && (
                <div className="space-y-2 sm:space-y-3">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-3 mb-2 sm:mb-4">
                    <div className="bg-slate-700/50 rounded-lg p-1.5 sm:p-3 border border-slate-600">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Preventivi</p>
                      <p className="text-lg sm:text-2xl font-bold text-yellow-400">
                        {customerOrders.filter(o => o.orderType === 'quotation').length}
                      </p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-1.5 sm:p-3 border border-slate-600">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-0.5 sm:mb-1">Ordini Confermati</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-400">
                        {customerOrders.filter(o => o.orderType === 'order').length}
                      </p>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-1.5 sm:py-3 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold text-slate-400">Numero</th>
                          <th className="text-left py-1.5 sm:py-3 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold text-slate-400">Stato</th>
                          <th className="text-left py-1.5 sm:py-3 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold text-slate-400 hidden sm:table-cell">Data</th>
                          <th className="text-right py-1.5 sm:py-3 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold text-slate-400 hidden md:table-cell">Totale</th>
                          <th className="text-right py-1.5 sm:py-3 px-1.5 sm:px-3 text-[10px] sm:text-xs font-semibold text-slate-400">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((order) => (
                          <tr
                            key={order.id}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                          >
                            {/* Order Number */}
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3">
                              <div className="flex items-center gap-1 sm:gap-2">
                                {order.orderType === 'quotation' ? (
                                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400 shrink-0" />
                                ) : (
                                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 shrink-0" />
                                )}
                                <span className="font-semibold text-white text-[10px] sm:text-sm truncate">{order.name}</span>
                              </div>
                            </td>

                            {/* State */}
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3">
                              <span
                                className={`inline-flex items-center px-1 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-medium ${
                                  order.orderType === 'quotation'
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                }`}
                              >
                                <span className="hidden sm:inline">{order.stateLabel}</span>
                                <span className="sm:hidden">{order.stateLabel.substring(0, 10)}{order.stateLabel.length > 10 ? '...' : ''}</span>
                              </span>
                            </td>

                            {/* Date */}
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 text-slate-300 hidden sm:table-cell text-xs">
                              {new Date(order.date).toLocaleDateString('it-IT')}
                            </td>

                            {/* Total Amount */}
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 text-right font-semibold text-blue-400 hidden md:table-cell text-xs sm:text-sm">
                              {order.currency} {order.amountTotal.toFixed(2)}
                            </td>

                            {/* Action */}
                            <td className="py-2 sm:py-3 px-1.5 sm:px-3 text-right">
                              <button
                                onClick={() => handleSelectOrder(order.id)}
                                className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] sm:text-xs font-medium rounded-lg transition-colors min-h-[32px]"
                              >
                                <span className="hidden sm:inline">Revisiona</span>
                                <span className="sm:hidden">Vedi</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Prodotti Urgenti */}
      <UrgentProductsModal
        isOpen={showUrgentModal}
        onClose={() => {
          setShowUrgentModal(false);
          loadProductCounts(); // Ricarica conteggi quando chiude
        }}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        showRemoveButton={false}
        onProductAdd={(urgentProduct, quantity) => {
          // Aggiungi prodotto urgente al carrello
          const cartProduct: CartProduct = {
            product_id: urgentProduct.productId,
            product_name: urgentProduct.productName,
            quantity: quantity,
            confidence: 'high',
            reasoning: `Prodotto urgente (scade: ${new Date(urgentProduct.expirationDate).toLocaleDateString('it-IT')}) - ${urgentProduct.note}`,
            image_url: urgentProduct.image ? `data:image/png;base64,${urgentProduct.image}` : null,
            qty_available: urgentProduct.quantity,
            uom_name: urgentProduct.uom,
            incoming_qty: 0,
            incoming_date: null
          };

          setCartProducts(prev => {
            const existingIndex = prev.findIndex(p => p.product_id === urgentProduct.productId);
            if (existingIndex >= 0) {
              // Prodotto già nel carrello, somma quantità
              const updated = [...prev];
              updated[existingIndex].quantity += quantity;
              return updated;
            } else {
              // Nuovo prodotto
              return [...prev, cartProduct];
            }
          });
        }}
      />

      {/* Modal Prodotti in Offerta */}
      <OfferProductsModal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false);
          loadProductCounts(); // Ricarica conteggi quando chiude
        }}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        showRemoveButton={false}
        onProductAdd={(offerProduct, quantity) => {
          // Aggiungi prodotto in offerta al carrello
          const cartProduct: CartProduct = {
            product_id: offerProduct.productId,
            product_name: offerProduct.productName,
            quantity: quantity,
            confidence: 'high',
            reasoning: `Prodotto in offerta - ${offerProduct.note}${offerProduct.offerPrice ? ` - Prezzo offerta: CHF ${offerProduct.offerPrice.toFixed(2)}` : ''}`,
            image_url: offerProduct.image ? `data:image/png;base64,${offerProduct.image}` : null,
            qty_available: offerProduct.quantity,
            uom_name: offerProduct.uom,
            incoming_qty: 0,
            incoming_date: null
          };

          setCartProducts(prev => {
            const existingIndex = prev.findIndex(p => p.product_id === offerProduct.productId);
            if (existingIndex >= 0) {
              // Prodotto già nel carrello, somma quantità
              const updated = [...prev];
              updated[existingIndex].quantity += quantity;
              return updated;
            } else {
              // Nuovo prodotto
              return [...prev, cartProduct];
            }
          });
        }}
      />
    </div>
  );
}
