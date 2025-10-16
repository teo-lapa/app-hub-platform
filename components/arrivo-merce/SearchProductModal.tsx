'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Loader, CheckCircle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  code: string;
  barcode: string;
  description: string;
  price: number;
  cost: number;
  uom: string;
  category: string;
  image: string | null;
}

interface SearchProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  suggestedSearch?: string;
}

export default function SearchProductModal({
  isOpen,
  onClose,
  onSelectProduct,
  suggestedSearch = ''
}: SearchProductModalProps) {
  const [searchQuery, setSearchQuery] = useState(suggestedSearch);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedSearch && isOpen) {
      setSearchQuery(suggestedSearch);
      handleSearch(suggestedSearch);
    }
  }, [suggestedSearch, isOpen]);

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setProducts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/arrivo-merce/search-products', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 20 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la ricerca');
      }

      setProducts(data.products || []);
    } catch (err: any) {
      console.error('❌ Errore ricerca prodotti:', err);
      setError(err.message || 'Errore durante la ricerca');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ricerca Prodotto</h2>
                <p className="text-sm text-gray-500">Cerca nel database Odoo</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Cerca per nome, codice, EAN..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {!loading && !error && products.length === 0 && searchQuery && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nessun prodotto trovato</p>
              </div>
            )}

            {!loading && !error && products.length === 0 && !searchQuery && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Inizia a digitare per cercare...</p>
              </div>
            )}

            <div className="space-y-3">
              {products.map((product) => (
                <motion.button
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {product.image ? (
                        <img
                          src={`data:image/png;base64,${product.image}`}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {product.code && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md">
                            {product.code}
                          </span>
                        )}
                        {product.barcode && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md">
                            EAN: {product.barcode}
                          </span>
                        )}
                        {product.category && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                            {product.category}
                          </span>
                        )}
                      </div>
                      {product.price > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          Prezzo: €{product.price.toFixed(2)} / {product.uom}
                        </p>
                      )}
                    </div>

                    {/* Select Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
