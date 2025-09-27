'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Plus } from 'lucide-react';
import { getInventoryClient } from '@/lib/odoo/inventoryClient';
import { BasicProduct } from '@/lib/types/inventory';

interface ProductSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: BasicProduct) => void;
  currentLocationName?: string;
}

export function ProductSearch({ isOpen, onClose, onSelectProduct, currentLocationName }: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BasicProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const inventoryClient = getInventoryClient();

  useEffect(() => {
    if (searchQuery.length >= 3) {
      searchProducts(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchProducts = async (query: string) => {
    setLoading(true);

    try {
      const products = await inventoryClient.searchProducts(query, 20);

      const formattedProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        code: product.default_code || product.barcode || '',
        barcode: product.barcode,
        image: product.image_128 ? `data:image/png;base64,${product.image_128}` : null,
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

  const handleSelectProduct = (product: BasicProduct) => {
    onSelectProduct(product);
    setSearchQuery('');
    setSearchResults([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          className="glass-strong w-full sm:w-full sm:max-w-2xl mx-4 rounded-t-xl sm:rounded-xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                Aggiungi Prodotto all'Ubicazione
              </h3>
              {currentLocationName && (
                <p className="text-sm text-yellow-400 mt-1">
                  📍 Ubicazione: {currentLocationName}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca prodotto per nome, codice o barcode..."
                className="w-full glass pl-10 pr-4 py-3 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoFocus
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
              onClick={onClose}
              className="w-full glass-strong py-3 rounded-xl hover:bg-white/20 transition-colors font-medium"
            >
              Chiudi
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}