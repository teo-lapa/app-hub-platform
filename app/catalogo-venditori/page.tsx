'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, ShoppingCart, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import CustomerSelector from './components/CustomerSelector';
import AIOrderInput from './components/AIOrderInput';
import SmartCart from './components/SmartCart';
import NotesInput from './components/NotesInput';
import ManualProductSearch from './components/ManualProductSearch';
import DeliveryDatePicker from './components/DeliveryDatePicker';
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
  const [deliveryDate, setDeliveryDate] = useState<string>(getTomorrowDate());
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ name: string; id: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-scroll to top on mount (mobile optimization)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    // Convert matched products to cart products
    const newCartProducts: CartProduct[] = products
      .filter(p => p.product_id !== null) // Only add found products
      .map(p => ({
        product_id: p.product_id!,
        product_name: p.product_name!,
        quantity: p.quantita,
        confidence: p.confidence,
        reasoning: p.reasoning
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
    const newCartProduct: CartProduct = {
      product_id: product.id,
      product_name: product.name,
      quantity: quantity,
      price: product.list_price || undefined,
      confidence: 'MANUALE'
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
          notes: orderNotes || undefined,
          deliveryDate: deliveryDate || undefined
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella creazione dell\'ordine');
      }

      // Success!
      setOrderSuccess({
        name: data.orderName,
        id: data.orderId
      });

      // Reset form after 3 seconds
      setTimeout(() => {
        setCartProducts([]);
        setOrderNotes('');
        setOrderSuccess(null);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 3000);

    } catch (err: any) {
      console.error('Errore creazione ordine:', err);
      setError(err.message || 'Errore nella creazione dell\'ordine');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="min-h-screen-dynamic bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header - Sticky on mobile */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* Home Button */}
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/70 hover:bg-slate-700 text-white rounded-lg border border-slate-600 transition-colors min-h-[48px] shrink-0"
                aria-label="Torna alla home"
              >
                <Home className="h-5 w-5 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base font-medium hidden xs:inline">Home</span>
              </button>

              {/* Title */}
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-2 sm:p-2.5 rounded-xl shrink-0">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                    Catalogo Venditori AI
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 hidden sm:block">
                    Inserimento ordini intelligente
                  </p>
                </div>
              </div>

              {/* Cart Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <ShoppingCart className="h-6 w-6 text-slate-300" />
                  {cartProducts.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
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
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 pb-24 sm:pb-8">
        {/* Success Message */}
        {orderSuccess && (
          <div className="mb-4 sm:mb-6 bg-green-500/20 border-2 border-green-500 rounded-xl p-4 sm:p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-400 shrink-0" />
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-1">
                  Ordine Creato con Successo! 🎉
                </h3>
                <p className="text-sm sm:text-base text-green-300">
                  Ordine <strong>{orderSuccess.name}</strong> (ID: {orderSuccess.id})
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

        {/* Customer Selector */}
        <div className="mb-4 sm:mb-6">
          <CustomerSelector
            onCustomerSelect={handleCustomerSelect}
            onAddressSelect={handleAddressSelect}
          />
        </div>

        {/* Delivery Date Picker */}
        {selectedCustomerId && (
          <div className="mb-4 sm:mb-6">
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 shadow-lg">
              <DeliveryDatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
              />
            </div>
          </div>
        )}

        {/* AI Order Input */}
        {selectedCustomerId && (
          <div className="mb-4 sm:mb-6">
            <AIOrderInput
              customerId={selectedCustomerId}
              onProductsMatched={handleProductsMatched}
            />
          </div>
        )}

        {/* Manual Product Search */}
        {selectedCustomerId && (
          <div className="mb-4 sm:mb-6">
            <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 shadow-lg">
              <ManualProductSearch onProductAdd={handleManualProductAdd} />
            </div>
          </div>
        )}

        {/* Order Notes */}
        {selectedCustomerId && cartProducts.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <NotesInput
              value={orderNotes}
              onChange={setOrderNotes}
            />
          </div>
        )}

        {/* Smart Cart */}
        <div id="smart-cart" className="scroll-mt-20">
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
          <div className="mt-6 sm:mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-blue-400 mb-3 sm:mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
              Come funziona
            </h3>
            <ol className="space-y-2 sm:space-y-3 text-sm sm:text-base text-slate-300">
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                  1
                </span>
                <span>Seleziona il <strong className="text-white">cliente</strong> e l'indirizzo di consegna</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                  2
                </span>
                <span>Incolla il <strong className="text-white">messaggio del cliente</strong> (WhatsApp, email, vocale trascritto)</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                  3
                </span>
                <span>L'<strong className="text-white">AI processa</strong> il messaggio e trova i prodotti automaticamente</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
                  4
                </span>
                <span>Oppure usa la <strong className="text-white">ricerca manuale</strong> per aggiungere prodotti specifici</span>
              </li>
              <li className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
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
    </div>
  );
}
