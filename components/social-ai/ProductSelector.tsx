'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, X, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  code: string | null;
  price: number;
  image: string | null;
  description: string | null;
  barcode: string | null;
}

interface ProductSelectorProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function ProductSelector({ onSelect, onClose, isOpen }: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setProducts([]);
      setHasSearched(false);
      return;
    }

    if (searchQuery.trim().length < 2) {
      setProducts([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      searchProducts(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const searchProducts = async (query: string) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch('/api/portale-clienti/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento prodotti');
      }

      const data = await response.json();

      // Filtro client-side per query
      const filtered = data.products.filter((p: Product) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(query.toLowerCase())) ||
        (p.barcode && p.barcode.includes(query))
      ).slice(0, 50); // Max 50 risultati

      setProducts(filtered);
    } catch (error: any) {
      console.error('Errore ricerca prodotti:', error);
      toast.error('Errore durante la ricerca prodotti');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    onSelect(product);
    onClose();
    toast.success(`Prodotto selezionato: ${product.name}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl bg-slate-800 border border-purple-500/30 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-500/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Package className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                Scegli Prodotto
              </h2>
              <p className="text-xs sm:text-sm text-purple-300">
                Cerca e seleziona un prodotto dal catalogo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-purple-300" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 sm:p-6 border-b border-purple-500/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca prodotto per nome, codice o barcode..."
              className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-purple-500/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder:text-slate-500 text-sm sm:text-base"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-purple-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!hasSearched && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-purple-500/30 mx-auto mb-3" />
              <div className="text-purple-400 font-medium">
                Inizia a cercare un prodotto
              </div>
              <div className="text-purple-500/50 text-sm mt-1">
                Digita almeno 2 caratteri
              </div>
            </div>
          )}

          {hasSearched && !isLoading && products.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-purple-500/30 mx-auto mb-3" />
              <div className="text-purple-400 font-medium">
                Nessun prodotto trovato
              </div>
              <div className="text-purple-500/50 text-sm mt-1">
                Prova con un altro termine di ricerca
              </div>
            </div>
          )}

          {products.length > 0 && (
            <div className="space-y-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full flex items-center space-x-3 p-3 sm:p-4 bg-slate-900/30 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-lg transition-all group"
                >
                  {/* Image */}
                  <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-slate-800 rounded-lg overflow-hidden border border-purple-500/30">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-purple-500/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-white font-medium truncate text-sm sm:text-base group-hover:text-purple-300 transition-colors">
                      {product.name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1 text-xs text-purple-400">
                      {product.code && (
                        <span className="px-2 py-0.5 bg-purple-500/20 rounded">
                          {product.code}
                        </span>
                      )}
                      <span className="font-semibold text-emerald-400">
                        CHF {product.price.toFixed(2)}
                      </span>
                    </div>
                    {product.description && (
                      <div className="text-xs text-purple-500/70 mt-1 truncate">
                        {product.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {products.length > 0 && (
          <div className="p-4 border-t border-purple-500/20 bg-slate-900/50">
            <div className="text-xs text-purple-400 text-center">
              {products.length} {products.length === 1 ? 'prodotto trovato' : 'prodotti trovati'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
