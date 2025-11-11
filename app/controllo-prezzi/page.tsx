'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, ArrowLeft, TrendingUp, TrendingDown, Lock, CheckCircle, SkipForward, X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import { PriceCheckProductCard } from '@/components/controllo-prezzi/PriceCheckProductCard';
import { PriceCategoryFilterBar } from '@/components/controllo-prezzi/PriceCategoryFilterBar';
import { PriceCheckProduct } from '@/lib/types/price-check';
import toast from 'react-hot-toast';

export default function ControlloPrezziPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Controllo accesso: SOLO Paul e Laura
  useEffect(() => {
    if (user && user.email) {
      const allowedEmails = ['paul.diserens@gmail.com', 'laura.diserens@gmail.com'];
      if (!allowedEmails.includes(user.email)) {
        toast.error('Accesso negato: questa app è disponibile solo per Paul e Laura');
        router.push('/');
      }
    }
  }, [user, router]);

  // Stati principali
  const [currentView, setCurrentView] = useState<'filter' | 'products'>('filter');
  const [selectedCategory, setSelectedCategory] = useState<'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all' | null>(null);
  const [products, setProducts] = useState<PriceCheckProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PriceCheckProduct | null>(null);

  // Conteggi
  const [categoryCounts, setCategoryCounts] = useState({
    below_critical: 0,
    critical_to_avg: 0,
    above_avg: 0,
    blocked: 0,
    all: 0,
  });

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Carica conteggi per categoria
  const loadCounts = async () => {
    try {
      const response = await fetch('/api/controllo-prezzi/counts', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setCategoryCounts(data.counts.byCategory);
      }
    } catch (error) {
      console.error('Errore caricamento conteggi:', error);
      toast.error('Errore caricamento conteggi');
    }
  };

  // Carica conteggi all'avvio
  useEffect(() => {
    loadCounts();
  }, []);

  // Seleziona categoria e mostra prodotti
  const handleSelectCategory = async (category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all') => {
    setSelectedCategory(category);
    setCurrentView('products');
    setLoading(true);

    try {
      const response = await fetch(`/api/controllo-prezzi/products?category=${category}&days=7`, {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
        const categoryLabels = {
          all: 'TUTTI I PREZZI',
          below_critical: 'SOTTO PUNTO CRITICO',
          critical_to_avg: 'TRA PC E MEDIO',
          above_avg: 'SOPRA MEDIO',
          blocked: 'RICHIESTE BLOCCO',
        };
        toast.success(`${categoryLabels[category]}: ${data.products?.length || 0} prodotti`);
      } else {
        toast.error(data.error || 'Errore caricamento prodotti');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Prodotti filtrati per ricerca
  const filteredProducts = products.filter(p => {
    if (!searchQuery || searchQuery.length < 3) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.code?.toLowerCase().includes(query) ||
      p.customerName?.toLowerCase().includes(query) ||
      p.orderName?.toLowerCase().includes(query)
    );
  });

  // Click su card prodotto
  const handleProductClick = (product: PriceCheckProduct) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  // Marca come controllato
  const handleMarkAsReviewed = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/mark-reviewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
          reviewedBy: user?.email || 'unknown',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✅ Prezzo marcato come controllato');
        setShowProductModal(false);
        // Rimuovi da lista
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id || p.orderId !== selectedProduct.orderId));
      } else {
        toast.error(data.error || 'Errore durante verifica');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Blocca prezzo
  const handleBlockPrice = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/block-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
          blockedBy: user?.email || 'unknown',
          note: 'Prezzo bloccato da supervisore',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('🔒 Prezzo bloccato - non apparirà più nella lista');
        setShowProductModal(false);
        // Rimuovi da lista
        setProducts(prev => prev.filter(p => p.id !== selectedProduct.id || p.orderId !== selectedProduct.orderId));
      } else {
        toast.error(data.error || 'Errore durante blocco');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Riporta a "Da Controllare"
  const handleMarkAsPending = async () => {
    if (!selectedProduct) return;

    try {
      const response = await fetch('/api/controllo-prezzi/mark-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: selectedProduct.id,
          orderId: selectedProduct.orderId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('⏳ Prezzo riportato a "Da Controllare"');
        setShowProductModal(false);
        // Aggiorna stato in lista
        setProducts(prev =>
          prev.map(p =>
            p.id === selectedProduct.id && p.orderId === selectedProduct.orderId
              ? { ...p, status: 'pending' as const }
              : p
          )
        );
      } else {
        toast.error(data.error || 'Errore durante operazione');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Torna indietro
  const handleBack = () => {
    if (currentView === 'products') {
      setCurrentView('filter');
      setSelectedCategory(null);
      setProducts([]);
      loadCounts(); // Ricarica conteggi aggiornati
    } else {
      router.back();
    }
  };

  const getCategoryLabel = () => {
    if (!selectedCategory) return '';
    const labels = {
      all: 'TUTTI I PREZZI',
      below_critical: 'SOTTO PUNTO CRITICO',
      critical_to_avg: 'TRA PC E MEDIO',
      above_avg: 'SOPRA MEDIO',
      blocked: 'RICHIESTE BLOCCO',
    };
    return labels[selectedCategory];
  };

  // Calcola posizione marker su slider
  const getPriceSliderPosition = (product: PriceCheckProduct): { value: number; critical: number; avg: number; min: number; max: number } => {
    const min = product.costPrice * 1.05; // +5% margine minimo
    const max = product.avgSellingPrice > 0 ? product.avgSellingPrice * 2.5 : product.costPrice * 4.2;

    return {
      value: product.soldPrice,
      critical: product.criticalPrice,
      avg: product.avgSellingPrice,
      min,
      max
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Controllo Prezzi"
        onBack={handleBack}
        showBackButton={currentView !== 'filter'}
      />

      <main className="container mx-auto p-4 max-w-7xl">
        {/* Vista: Selezione Categoria */}
        {currentView === 'filter' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                💰 Controllo Prezzi
              </h1>
              <p className="text-slate-400">
                Monitora i prezzi di vendita rispetto al Punto Critico e alla Media
              </p>
            </div>

            <PriceCategoryFilterBar
              counts={categoryCounts}
              onSelect={handleSelectCategory}
            />
          </motion.div>
        )}

        {/* Vista: Lista Prodotti */}
        {currentView === 'products' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Header con filtri */}
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{getCategoryLabel()}</h2>
                  <p className="text-sm text-slate-400">
                    {filteredProducts.length} prodotti
                    {searchQuery.length >= 3 && ` • Ricerca: "${searchQuery}"`}
                  </p>
                </div>

                {/* Badge totale */}
                <div className="px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500">
                  <span className="font-bold text-blue-400">{filteredProducts.length}</span>
                </div>
              </div>

              {/* Barra di ricerca veloce */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca prodotto o cliente (min 3 caratteri)..."
                    className="w-full pl-10 pr-10 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 min-w-[48px] min-h-[48px] p-3 rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchQuery.length > 0 && searchQuery.length < 3 && (
                  <p className="text-xs text-orange-400 mt-1 ml-1">
                    ⚠️ Inserisci almeno 3 caratteri per cercare
                  </p>
                )}
              </div>
            </div>

            {/* Griglia prodotti */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="glass p-12 rounded-xl text-center">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-bold mb-2">Nessun prodotto trovato</h3>
                <p className="text-slate-400">
                  Ottimo! Nessun prodotto in questa categoria
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {filteredProducts.map((product) => (
                  <PriceCheckProductCard
                    key={`${product.id}-${product.orderId}`}
                    product={product}
                    onClick={() => handleProductClick(product)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Modal Dettaglio Prodotto */}
      <AnimatePresence>
        {showProductModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProductModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowProductModal(false)}
                className="absolute top-4 right-4 min-w-[48px] min-h-[48px] rounded-full glass-strong flex items-center justify-center hover:bg-red-500/20"
              >
                ✕
              </button>

              {/* Immagine prodotto */}
              <div className="w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-4 rounded-xl overflow-hidden">
                {selectedProduct.image ? (
                  <img
                    src={`data:image/png;base64,${selectedProduct.image}`}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-6xl">
                    📦
                  </div>
                )}
              </div>

              {/* Nome e codice */}
              <h2 className="text-2xl font-bold text-center mb-1">{selectedProduct.name}</h2>
              <p className="text-slate-400 text-center mb-6">COD: {selectedProduct.code}</p>

              {/* Info card */}
              <div className="glass p-4 rounded-lg space-y-3 mb-6">
                {/* Prezzo venduto */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Prezzo Venduto:</span>
                  <span className="font-bold text-2xl text-blue-400">
                    CHF {selectedProduct.soldPrice.toFixed(2)}
                  </span>
                </div>

                {/* Sconto */}
                {selectedProduct.discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Sconto:</span>
                    <span className="font-bold text-orange-400">
                      -{selectedProduct.discount.toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Cliente e Ordine */}
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Cliente:</span>
                    <span className="font-semibold">{selectedProduct.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ordine:</span>
                    <span className="font-semibold">{selectedProduct.orderName}</span>
                  </div>
                </div>

                {/* Nota venditore */}
                {selectedProduct.note && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-slate-400 text-sm">Nota Venditore:</span>
                    <p className="text-yellow-400 mt-1">{selectedProduct.note}</p>
                  </div>
                )}
              </div>

              {/* Slider Prezzi */}
              <div className="glass p-4 rounded-lg mb-6">
                <h3 className="font-bold mb-3">Analisi Prezzi</h3>

                {/* Prezzi di riferimento */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                  <div className="text-center">
                    <div className="text-slate-400">Punto Critico</div>
                    <div className="font-bold text-yellow-400">
                      CHF {selectedProduct.criticalPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Medio</div>
                    <div className="font-bold text-blue-400">
                      CHF {selectedProduct.avgSellingPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400">Costo</div>
                    <div className="font-bold text-red-400">
                      CHF {selectedProduct.costPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Slider visuale */}
                <div className="relative h-12 bg-slate-700/50 rounded-lg overflow-hidden">
                  {(() => {
                    const { value, critical, avg, min, max } = getPriceSliderPosition(selectedProduct);
                    const criticalPos = ((critical - min) / (max - min)) * 100;
                    const avgPos = ((avg - min) / (max - min)) * 100;
                    const valuePos = ((value - min) / (max - min)) * 100;

                    return (
                      <>
                        {/* Gradiente di sfondo */}
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-blue-500 opacity-30" />

                        {/* Marker Punto Critico */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-yellow-500"
                          style={{ left: `${criticalPos}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-yellow-400 font-bold whitespace-nowrap">
                            PC
                          </div>
                        </div>

                        {/* Marker Medio */}
                        {avg > 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-blue-500"
                            style={{ left: `${avgPos}%` }}
                          >
                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 font-bold whitespace-nowrap">
                              Medio
                            </div>
                          </div>
                        )}

                        {/* Marker Prezzo Venduto */}
                        <div
                          className="absolute top-0 bottom-0 w-2 bg-white shadow-lg"
                          style={{ left: `${valuePos}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-blue-500" />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Azioni */}
              <div className="space-y-3">
                <h3 className="font-bold text-lg mb-3">Azioni Disponibili</h3>

                {/* Marca come controllato */}
                <button
                  onClick={handleMarkAsReviewed}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-green-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Marca come Controllato</div>
                      <div className="text-xs text-slate-400">Prezzo verificato e approvato</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Blocca prezzo */}
                <button
                  onClick={handleBlockPrice}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-red-500/20 transition-all
                           flex items-center justify-between group border-2 border-red-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-red-400">Blocca Prezzo</div>
                      <div className="text-xs text-slate-400">Blocca e rimuovi dalla lista</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-red-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Riporta a "Da Controllare" */}
                <button
                  onClick={handleMarkAsPending}
                  className="w-full glass-strong p-4 rounded-lg hover:bg-yellow-500/20 transition-all
                           flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                      <SkipForward className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-yellow-400">Da Controllare</div>
                      <div className="text-xs text-slate-400">Riporta in stato pending</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 rotate-180 text-yellow-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
