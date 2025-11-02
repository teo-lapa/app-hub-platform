'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface CatalogSearchBarProps {
  onSearch: (query: string) => void;
  onOpenFilters: () => void;
  placeholder?: string;
  debounceMs?: number;
  value?: string; // Controlled value from parent
}

export function CatalogSearchBar({
  onSearch,
  onOpenFilters,
  placeholder = 'Cerca prodotti per nome o codice...',
  debounceMs = 500, // Increased from 300ms to 500ms for better stability
  value = '' // Default to empty string
}: CatalogSearchBarProps) {
  const [query, setQuery] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Sync local state with parent value ONLY when not actively typing
  useEffect(() => {
    // Don't sync if user is actively typing (prevents conflicts)
    if (!isTypingRef.current) {
      setQuery(value);
    }
  }, [value]);

  // Handle input change with debounce
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    isTypingRef.current = true; // Mark as actively typing

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      isTypingRef.current = false; // Typing finished
      onSearch(value);
    }, debounceMs);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    isTypingRef.current = false; // Reset typing flag
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onSearch('');
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      isTypingRef.current = false; // Reset typing flag
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onSearch(query);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200/50 bg-white/90 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-7xl mx-auto px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Filters Button */}
          <button
            onClick={onOpenFilters}
            className="flex-shrink-0 p-3 min-h-[48px] min-w-[48px] bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl hover:bg-white hover:border-gray-300 transition-all shadow-sm hover:shadow active:scale-95"
            aria-label="Apri filtri"
            title="Filtri"
          >
            <SlidersHorizontal className="h-5 w-5 text-gray-700" />
          </button>

          {/* Search Input Container */}
          <div className="relative flex-1">
            <div className="relative">
              {/* Search Icon */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Search className="h-5 w-5" />
              </div>

              {/* Input Field */}
              <input
                type="text"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full pl-10 pr-10 py-3 min-h-[48px] bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 focus:bg-white transition-all shadow-sm placeholder:text-gray-400 text-gray-900"
                aria-label="Cerca prodotti"
              />

              {/* Clear Button */}
              {query && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all active:scale-90"
                  aria-label="Cancella ricerca"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
