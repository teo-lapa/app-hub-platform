'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { cn } from '@/lib/utils';

interface SearchProduct {
  id: number;
  name: string;
  code: string;
  barcode?: string;
  image_url?: string;
  uom?: string;
}

interface ProductSearchBarProps {
  onProductSelect: (product: SearchProduct) => void;
  placeholder?: string;
  minChars?: number;
  debounceMs?: number;
  className?: string;
}

export function ProductSearchBar({
  onProductSelect,
  placeholder = 'Cerca prodotto per nome, codice o EAN...',
  minChars = 3,
  debounceMs = 300,
  className
}: ProductSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search effect
  useEffect(() => {
    // Reset results if query is too short
    if (query.length < minChars) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        // Call product search API
        const response = await fetch(
          `/api/maestro/products/search?q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          throw new Error('Errore nella ricerca prodotti');
        }

        const data = await response.json();

        if (data.success) {
          setResults(data.products || []);
          setIsOpen(true);
        } else {
          setError(data.error || 'Errore nella ricerca');
          setResults([]);
        }
      } catch (err) {
        console.error('Product search error:', err);
        setError('Errore durante la ricerca prodotti');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, minChars, debounceMs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProduct = (product: SearchProduct) => {
    onProductSelect(product);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />

        {query && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-white" />
          </button>
        )}
      </div>

      {/* Search hint */}
      {query.length > 0 && query.length < minChars && (
        <p className="mt-2 text-xs text-slate-500">
          Inserisci almeno {minChars} caratteri per cercare
        </p>
      )}

      {/* Dropdown Results */}
      <AnimatePresence>
        {isOpen && (results.length > 0 || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-[9999] w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto"
          >
            {error ? (
              <div className="p-4 text-center text-red-400">
                <p className="text-sm">{error}</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                <p className="text-sm">Nessun prodotto trovato</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                <div className="px-2 py-1 text-xs text-slate-400">
                  {results.length} {results.length === 1 ? 'prodotto trovato' : 'prodotti trovati'}
                </div>

                {results.map((product) => (
                  <div key={product.id}>
                    <ProductCard
                      product={product}
                      selectable
                      onSelect={handleSelectProduct}
                      showQuantity={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
