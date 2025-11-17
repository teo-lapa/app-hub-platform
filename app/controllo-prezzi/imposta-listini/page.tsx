'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, X, Plus, Minus, Save, Trash2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { AppHeader } from '@/components/layout/AppHeader';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  code: string;
  listPrice: number;
  costPrice: number;
  category: string;
}

interface Pricelist {
  id: number;
  name: string;
  currency: string;
  itemCount: number;
}

interface PricelistRule {
  id: number;
  pricelistId: number;
  pricelistName: string;
  computePrice: string;
  fixedPrice: number;
  percentPrice: number;
  priceDiscount: number;
  minQuantity: number;
}

export default function ImpostaListiniPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Controllo accesso: SOLO Admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast.error('Accesso negato: questa app è disponibile solo per amministratori');
      router.push('/');
    }
  }, [user, router]);

  // Stati
  const [filter, setFilter] = useState<'without' | 'with'>('without'); // Filtro prodotti
  const [pricelists, setPricelists] = useState<Pricelist[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productRules, setProductRules] = useState<PricelistRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Slider values per ogni listino (product_id -> pricelist_id -> percent)
  const [sliderValues, setSliderValues] = useState<Record<number, Record<number, number>>>({});

  // Carica i 5 listini principali
  useEffect(() => {
    loadPricelists();
  }, []);

  // Carica prodotti quando cambia il filtro o i listini
  useEffect(() => {
    if (pricelists.length > 0) {
      loadProducts();
    }
  }, [filter, pricelists]);

  const loadPricelists = async () => {
    try {
      const response = await fetch('/api/controllo-prezzi/main-pricelists', {
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setPricelists(data.pricelists || []);
        console.log(`✅ Caricati ${data.pricelists?.length || 0} listini`);
      } else {
        toast.error(data.error || 'Errore caricamento listini');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const pricelistIds = pricelists.map(p => p.id).join(',');
      const response = await fetch(
        `/api/controllo-prezzi/products-without-rules?pricelistIds=${pricelistIds}&filter=${filter}`,
        { credentials: 'include' }
      );

      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
        toast.success(`Trovati ${data.products?.length || 0} prodotti`);
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
      p.category?.toLowerCase().includes(query)
    );
  });

  // Click su prodotto per vedere TUTTE le regole
  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/controllo-prezzi/product-pricelist-rules?productId=${product.id}`,
        { credentials: 'include' }
      );

      const data = await response.json();
      if (data.success) {
        setProductRules(data.rules || []);
        setShowRulesModal(true);
      } else {
        toast.error(data.error || 'Errore caricamento regole');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Cambia slider
  const handleSliderChange = (productId: number, pricelistId: number, value: number) => {
    setSliderValues(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [pricelistId]: value
      }
    }));
  };

  // Salva regola per un listino
  const handleSaveRule = async (productId: number, pricelistId: number) => {
    const discountPercent = sliderValues[productId]?.[pricelistId] || 0;

    try {
      const response = await fetch('/api/controllo-prezzi/set-product-pricelist-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          pricelistId,
          discountPercent
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Regola ${data.action === 'created' ? 'creata' : 'aggiornata'}: ${discountPercent}%`);
        // Ricarica prodotti
        loadProducts();
      } else {
        toast.error(data.error || 'Errore salvataggio regola');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  // Elimina regola
  const handleDeleteRule = async (productId: number, pricelistId: number) => {
    try {
      const response = await fetch('/api/controllo-prezzi/set-product-pricelist-rule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          pricelistId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Regola eliminata');
        // Reset slider
        setSliderValues(prev => {
          const newValues = { ...prev };
          if (newValues[productId]) {
            delete newValues[productId][pricelistId];
          }
          return newValues;
        });
        loadProducts();
      } else {
        toast.error(data.error || 'Errore eliminazione regola');
      }
    } catch (error: any) {
      toast.error('Errore: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AppHeader
        title="Imposta Listini Prodotti"
        onBack={() => router.back()}
        showBackButton={true}
      />

      <main className="container mx-auto p-4 max-w-7xl">
        {/* Header con filtri */}
        <div className="glass p-4 rounded-xl mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold">Gestione Regole Prezzi</h2>
              <p className="text-sm text-slate-400">
                Imposta regole di sconto per i {pricelists.length} listini principali
              </p>
            </div>

            {/* Toggle filtro */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('without')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'without'
                    ? 'bg-purple-500 text-white font-bold'
                    : 'glass text-slate-400'
                }`}
              >
                Senza Listino
              </button>
              <button
                onClick={() => setFilter('with')}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === 'with'
                    ? 'bg-green-500 text-white font-bold'
                    : 'glass text-slate-400'
                }`}
              >
                Con Listino
              </button>
            </div>
          </div>

          {/* Barra ricerca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca prodotto (min 3 caratteri)..."
              className="w-full pl-10 pr-10 py-3 glass rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista Prodotti */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold mb-2">Nessun prodotto trovato</h3>
            <p className="text-slate-400">
              {filter === 'without'
                ? 'Tutti i prodotti hanno già regole di prezzo impostate!'
                : 'Nessun prodotto con regole di prezzo.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass p-4 rounded-xl"
              >
                {/* Header prodotto */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{product.name}</h3>
                    <p className="text-sm text-slate-400">
                      Codice: {product.code} • Categoria: {product.category}
                    </p>
                    <p className="text-sm text-slate-400">
                      Prezzo Base: CHF {product.listPrice.toFixed(2)} • Costo: CHF {product.costPrice.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleProductClick(product)}
                    className="glass-strong p-3 rounded-lg hover:bg-blue-500/20 transition-all"
                    title="Vedi tutte le regole"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>

                {/* Slider per ogni listino */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pricelists.map((pricelist) => {
                    const currentValue = sliderValues[product.id]?.[pricelist.id] || 0;
                    const finalPrice = product.listPrice * (1 - currentValue / 100);

                    return (
                      <div key={pricelist.id} className="glass-strong p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{pricelist.name}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSaveRule(product.id, pricelist.id)}
                              className="p-1.5 rounded bg-green-500/20 hover:bg-green-500/30 transition-all"
                              title="Salva regola"
                            >
                              <Save className="w-4 h-4 text-green-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(product.id, pricelist.id)}
                              className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 transition-all"
                              title="Elimina regola"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {/* Slider */}
                        <div className="mb-2">
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            step="0.5"
                            value={currentValue}
                            onChange={(e) => handleSliderChange(product.id, pricelist.id, parseFloat(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        {/* Info */}
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold ${currentValue > 0 ? 'text-red-400' : currentValue < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                            {currentValue > 0 ? '-' : currentValue < 0 ? '+' : ''}{Math.abs(currentValue).toFixed(1)}%
                          </span>
                          <span className="font-bold text-blue-400">
                            CHF {finalPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Tutte le regole del prodotto */}
      <AnimatePresence>
        {showRulesModal && selectedProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRulesModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowRulesModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full glass-strong hover:bg-red-500/20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <h2 className="text-2xl font-bold mb-2">{selectedProduct.name}</h2>
              <p className="text-sm text-slate-400 mb-6">
                Tutte le regole di prezzo impostate per questo prodotto
              </p>

              {/* Lista regole */}
              {productRules.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400">Nessuna regola impostata</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productRules.map((rule) => (
                    <div key={rule.id} className="glass p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">{rule.pricelistName}</span>
                        <span className="text-xs text-slate-400">ID: {rule.id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400">Tipo calcolo:</span>
                          <span className="ml-2 font-semibold">{rule.computePrice}</span>
                        </div>
                        {rule.computePrice === 'percentage' && (
                          <div>
                            <span className="text-slate-400">Sconto:</span>
                            <span className={`ml-2 font-bold ${rule.percentPrice > 0 ? 'text-red-400' : 'text-green-400'}`}>
                              {rule.percentPrice > 0 ? '-' : '+'}{Math.abs(rule.percentPrice).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {rule.computePrice === 'fixed' && (
                          <div>
                            <span className="text-slate-400">Prezzo fisso:</span>
                            <span className="ml-2 font-bold text-blue-400">
                              CHF {rule.fixedPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">Qta min:</span>
                          <span className="ml-2 font-semibold">{rule.minQuantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
