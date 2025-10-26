'use client';

import { useState, useEffect } from 'react';
import { CartItemCard } from '@/components/portale-clienti/CartItemCard';
import { CartSummary } from '@/components/portale-clienti/CartSummary';
import { CheckoutModal } from '@/components/portale-clienti/CheckoutModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  ShoppingCart,
  PackageX,
  ArrowLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string | null;
  price: number;
  quantity: number;
  maxQuantity: number;
  image: string;
  unit: string;
  category: string | null;
}

interface CartData {
  items: CartItem[];
  subtotal: number;
  totalItems: number;
}

export default function CarrelloPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [imagesSynced, setImagesSynced] = useState(false);

  // Fetch cart on mount
  useEffect(() => {
    fetchCart();
  }, []);

  async function fetchCart(skipImageSync = false) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/portale-clienti/cart', {
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Errore nel caricamento del carrello');
      }

      // Map DB snake_case to frontend camelCase
      const mappedItems = (data.items || []).map((item: any) => ({
        id: item.id,
        productId: item.odoo_product_id,
        productName: item.product_name,
        productCode: item.product_code,
        price: parseFloat(item.unit_price) || 0,
        quantity: parseFloat(item.quantity) || 0,
        maxQuantity: parseFloat(item.available_stock) || 999,
        image: item.product_image_url || '/placeholder-product.png',
        unit: item.uom || 'Pz',
        category: null
      }));

      setCart({
        items: mappedItems,
        subtotal: parseFloat(data.cart?.total_amount) || 0,
        totalItems: parseInt(data.cart?.item_count) || 0,
      });

      // Sync images in background if any items have placeholder (only once)
      if (!skipImageSync && !imagesSynced) {
        const hasPlaceholders = mappedItems.some((item: any) =>
          item.image === '/placeholder-product.png'
        );

        if (hasPlaceholders) {
          console.log('🖼️ Detecting missing images, syncing in background...');
          syncCartImages();
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch cart:', err);
      setError(err.message || 'Errore nel caricamento del carrello');
      toast.error('Impossibile caricare il carrello');
    } finally {
      setLoading(false);
    }
  }

  async function syncCartImages() {
    try {
      const response = await fetch('/api/portale-clienti/cart/sync-images', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success && data.stats.updated > 0) {
        console.log(`✅ Synced ${data.stats.updated} product images`);
        setImagesSynced(true);
        // Refresh cart to show updated images (skip sync to avoid loop)
        await fetchCart(true);
      } else {
        setImagesSynced(true);
      }
    } catch (error) {
      console.error('Failed to sync images:', error);
      // Non mostrare errore all'utente, è un'operazione in background
    }
  }

  async function handleUpdateQuantity(itemId: number, newQuantity: number) {
    try {
      // Find item by unique itemId (cart_items.id - PRIMARY KEY)
      const item = cart?.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Prodotto non trovato nel carrello');
      }

      const oldQuantity = item.quantity;
      const priceDiff = (newQuantity - oldQuantity) * item.price;

      // Optimistic update - usa item.id che è UNIVOCO
      setCart((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId // FIX: usa item.id invece di productId!
              ? { ...i, quantity: newQuantity }
              : i
          ),
          subtotal: prev.subtotal + priceDiff,
        };
      });

      // Call API in background
      const response = await fetch(`/api/portale-clienti/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quantity: newQuantity }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        // Rollback on error - usa item.id
        setCart((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((i) =>
              i.id === itemId // FIX: usa item.id invece di productId!
                ? { ...i, quantity: oldQuantity }
                : i
            ),
            subtotal: prev.subtotal - priceDiff,
          };
        });
        throw new Error(data.error || 'Errore aggiornamento quantità');
      }

      // Success - optimistic update è già completo, no refresh needed
    } catch (err: any) {
      console.error('Failed to update quantity:', err);
      throw err;
    }
  }

  async function handleRemoveItem(itemId: number) {
    try {
      // Find item by unique itemId (cart_items.id - PRIMARY KEY)
      const item = cart?.items.find(i => i.id === itemId);
      if (!item) {
        throw new Error('Prodotto non trovato nel carrello');
      }

      const response = await fetch(`/api/portale-clienti/cart/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Errore rimozione prodotto');
      }

      toast.success('Prodotto rimosso dal carrello');

      // Refresh cart to get updated data
      await fetchCart();
    } catch (err: any) {
      console.error('Failed to remove item:', err);
      throw err;
    }
  }

  async function handleCheckout() {
    setShowCheckoutModal(true);
  }

  async function confirmCheckout(deliveryDate: string) {
    try {
      setIsCheckingOut(true);

      const response = await fetch('/api/portale-clienti/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deliveryNotes: deliveryNotes.trim() || null,
          deliveryDate: deliveryDate, // Pass delivery date to API
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Errore durante il checkout');
      }

      // Success!
      toast.success('Ordine creato con successo!', {
        icon: '🎉',
        duration: 5000,
      });

      // Redirect to order detail page (use camelCase from API response)
      router.push(`/portale-clienti/ordini/${data.orderId}`);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      toast.error(err.message || 'Errore durante il checkout');
      setIsCheckingOut(false);
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Caricamento carrello...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800/60 backdrop-blur-sm border border-red-500/50 rounded-2xl p-8 max-w-md w-full text-center"
        >
          <div className="bg-red-500/20 rounded-full p-4 inline-flex mb-4">
            <AlertCircle className="h-12 w-12 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Errore di Caricamento
          </h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => fetchCart()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
          >
            Riprova
          </button>
        </motion.div>
      </div>
    );
  }

  // Empty Cart State
  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => router.push('/portale-clienti/catalogo')}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna al catalogo</span>
            </button>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <ShoppingCart className="h-10 w-10 text-emerald-400" />
              Carrello
            </h1>
          </motion.div>

          {/* Empty State */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="bg-slate-800/30 rounded-full p-8 mb-6">
              <PackageX className="h-24 w-24 text-slate-600" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Il tuo carrello è vuoto
            </h2>
            <p className="text-slate-400 text-lg mb-8 text-center max-w-md">
              Non hai ancora aggiunto prodotti al carrello. Esplora il nostro
              catalogo e inizia a fare acquisti!
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push('/portale-clienti/catalogo')}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg transition-all"
            >
              <Sparkles className="h-6 w-6" />
              Esplora Catalogo
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Cart with items
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.push('/portale-clienti/catalogo')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Torna al catalogo</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
                <ShoppingCart className="h-10 w-10 text-emerald-400" />
                Carrello
              </h1>
              <p className="text-slate-400">
                {cart.totalItems} {cart.totalItems === 1 ? 'prodotto' : 'prodotti'} nel carrello
              </p>
            </div>

            {/* Subtotal Badge (mobile-friendly) */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-xl px-6 py-3"
            >
              <p className="text-sm text-slate-400 mb-1">Subtotale</p>
              <p className="text-2xl font-bold text-yellow-400">
                {new Intl.NumberFormat('it-CH', {
                  style: 'currency',
                  currency: 'CHF',
                }).format(cart.subtotal)}
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Main Content: Items + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items - Left Side (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.items.map((item, index) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemoveItem}
                />
              ))}
            </AnimatePresence>

            {/* Delivery Notes - Below items on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: cart.items.length * 0.05 + 0.2 }}
              className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm border border-slate-600/50 rounded-xl p-6"
            >
              <label className="block text-white font-semibold mb-3">
                Note Consegna (opzionale)
              </label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Inserisci eventuali note per la consegna..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
              <p className="text-xs text-slate-400 mt-2">
                {deliveryNotes.length}/500 caratteri
              </p>
            </motion.div>
          </div>

          {/* Cart Summary - Right Side (sticky) */}
          <div className="lg:col-span-1">
            <CartSummary
              subtotal={cart.subtotal}
              totalItems={cart.totalItems}
              onCheckout={handleCheckout}
              isCheckingOut={isCheckingOut}
            />
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onConfirm={confirmCheckout}
        subtotal={cart.subtotal}
        totalItems={cart.totalItems}
        deliveryNotes={deliveryNotes}
        isProcessing={isCheckingOut}
      />
    </div>
  );
}
