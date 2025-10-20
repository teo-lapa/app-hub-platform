'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';

interface Product {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image?: string;
  uom: string;
}

interface SelectedProduct extends Product {
  quantity: number;
}

interface SampleProductsSelectorProps {
  selectedProducts: SelectedProduct[];
  onProductsChange: (products: SelectedProduct[]) => void;
}

export function SampleProductsSelector({ selectedProducts, onProductsChange }: SampleProductsSelectorProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inventoryClient = getInventoryClient();

  useEffect(() => {
    if (searchQuery.length >= 3) {
      searchProducts(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setSearchQuery('');
      setSearchResults([]);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  const searchProducts = async (query: string) => {
    setLoading(true);
    try {
      const products = await inventoryClient.searchProducts(query, 20);

      if (!products || !Array.isArray(products)) {
        setSearchResults([]);
        return;
      }

      const formattedProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        code: product.default_code || product.barcode || '',
        barcode: product.barcode,
        image: product.image_128 ? `data:image/png;base64,${product.image_128}` : undefined,
        uom: product.uom_id ? product.uom_id[1] : 'PZ'
      }));

      setSearchResults(formattedProducts);
    } catch (error) {
      console.error('Errore ricerca prodotti:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    // Verifica se il prodotto è già selezionato
    const existing = selectedProducts.find(p => p.id === product.id);

    if (existing) {
      // Incrementa quantità
      onProductsChange(
        selectedProducts.map(p =>
          p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      // Aggiungi nuovo prodotto con quantità 1
      onProductsChange([...selectedProducts, { ...product, quantity: 1 }]);
    }

    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  const updateQuantity = (productId: number, delta: number) => {
    onProductsChange(
      selectedProducts.map(p => {
        if (p.id === productId) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      })
    );
  };

  const removeProduct = (productId: number) => {
    onProductsChange(selectedProducts.filter(p => p.id !== productId));
  };

  return (
    <div className="space-y-3">
      {/* Lista prodotti selezionati */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-green-400" />
              Campioni Consegnati ({selectedProducts.length})
            </label>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass rounded-lg p-3 flex items-center gap-3"
              >
                {/* Immagine prodotto */}
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                {/* Info prodotto */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{product.name}</h4>
                  <p className="text-xs text-muted-foreground">{product.code}</p>
                </div>

                {/* Controlli quantità */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(product.id, -1)}
                    className="w-7 h-7 glass rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <div className="w-12 text-center">
                    <span className="font-semibold">{product.quantity}</span>
                    <span className="text-xs text-muted-foreground ml-1">{product.uom}</span>
                  </div>

                  <button
                    onClick={() => updateQuantity(product.id, 1)}
                    className="w-7 h-7 glass rounded-lg hover:bg-white/10 flex items-center justify-center"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Rimuovi */}
                <button
                  onClick={() => removeProduct(product.id)}
                  className="w-8 h-8 glass rounded-lg hover:bg-red-500/20 flex items-center justify-center text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Pulsante Aggiungi Prodotto */}
      <button
        onClick={() => setIsSearchOpen(true)}
        className="w-full glass-strong py-3 rounded-xl hover:bg-blue-500/20 transition-colors font-medium flex items-center justify-center gap-2 text-blue-400"
      >
        <Plus className="w-4 h-4" />
        {selectedProducts.length > 0 ? 'Aggiungi Altro Campione' : 'Aggiungi Campioni'}
      </button>

      {/* Modal di ricerca */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full sm:w-full sm:max-w-2xl mx-4 rounded-t-xl sm:rounded-xl max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/20">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Search className="w-5 h-5 text-blue-400" />
                    Cerca Prodotto Campione
                  </h3>
                </div>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-4 border-b border-white/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca prodotto per nome, codice o barcode..."
                    className="w-full glass pl-10 pr-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Inserisci almeno 3 caratteri per iniziare la ricerca
                </p>
              </div>

              {/* Search Results */}
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : searchQuery.length < 3 ? (
                  <div className="text-center py-12">
                    <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Inserisci almeno 3 caratteri per iniziare la ricerca
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h4 className="font-semibold mb-2">Nessun prodotto trovato</h4>
                    <p className="text-muted-foreground">
                      Prova con termini di ricerca diversi
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((product) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => handleSelectProduct(product)}
                        className="glass rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{product.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-muted-foreground">
                                {product.code}
                              </span>
                              {product.barcode && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-sm text-muted-foreground">
                                    {product.barcode}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-1">
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                                {product.uom}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                              <Plus className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/20">
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-full glass-strong py-3 rounded-xl hover:bg-white/20 transition-colors font-medium"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
