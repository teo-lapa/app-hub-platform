'use client';

import { useState, useEffect, useRef } from 'react';

interface ClientFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLiveSearchResults?: (results: any[]) => void;
  userId?: number;
}

export function ClientFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onLiveSearchResults,
  userId = 7
}: ClientFiltersProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const filters = [
    { id: 'all', label: '🔄 Tutti', icon: '🔄' },
    { id: 'active', label: '✅ Attivi', icon: '✅' },
    { id: 'warning', label: '⚠️ Attenzione', icon: '⚠️' },
    { id: 'inactive', label: '❌ Inattivi', icon: '❌' },
    { id: 'inactive_5weeks', label: '📉 Non Attivi 5 Sett.', icon: '📉' },
    { id: 'decreasing_5weeks', label: '📉 In Calo 5 Sett.', icon: '📉' }
  ];

  // Ricerca LIVE su Odoo con debounce
  useEffect(() => {
    // Pulisci timeout precedente
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Se query vuota o troppo corta, nascondi risultati
    if (!searchQuery || searchQuery.trim().length < 2) {
      setShowResults(false);
      setSearchResults([]);
      if (onLiveSearchResults) {
        onLiveSearchResults([]);
      }
      return;
    }

    // Aspetta 500ms prima di cercare (debounce)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        console.log(`🔍 Ricerca live: "${searchQuery}"`);

        const response = await fetch(
          `/api/clienti/search?q=${encodeURIComponent(searchQuery)}&userId=${userId}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          console.log(`✅ Trovati ${data.count} clienti`);
          setSearchResults(data.results || []);
          setShowResults(true);

          // Notifica parent component
          if (onLiveSearchResults) {
            onLiveSearchResults(data.results || []);
          }
        } else {
          console.error('❌ Errore ricerca:', data.error);
          setSearchResults([]);
          setShowResults(false);
        }
      } catch (error: any) {
        console.error('❌ Errore ricerca live:', error);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Debounce 500ms

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, userId, onLiveSearchResults]);

  // Chiudi dropdown quando clicchi fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="mb-4 sm:mb-5 md:mb-6 space-y-3">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`px-2 sm:px-3 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-full border transition-all font-medium text-xs sm:text-sm min-h-touch active:scale-95 ${
              activeFilter === filter.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:shadow-sm'
            }`}
          >
            <span className="sm:hidden">{filter.icon}</span>
            <span className="hidden sm:inline">{filter.label}</span>
          </button>
        ))}
      </div>

      {/* Search Box con Live Search */}
      <div className="w-full relative" ref={searchContainerRef}>
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Cerca in TUTTI i clienti Odoo..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (e.target.value.trim().length >= 2) {
                setShowResults(true);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
                setShowResults(true);
              }
            }}
            className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 pr-10 border border-slate-300 rounded-lg bg-white text-sm md:text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition min-h-touch"
          />

          {/* Loading spinner */}
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Dropdown risultati LIVE */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-blue-500 rounded-lg shadow-2xl max-h-96 overflow-y-auto">
            <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs font-semibold text-blue-700">
              🔍 Trovati {searchResults.length} clienti in TUTTA Odoo
            </div>
            <div className="divide-y">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    // Chiudi dropdown
                    setShowResults(false);
                    // Mantieni la query per visualizzare il risultato
                    onSearchChange(result.name);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-start gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 truncate">
                      {result.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
                      {result.city && (
                        <div className="flex items-center gap-1">
                          <span>📍</span>
                          <span>{result.city}</span>
                          {result.zip && <span className="text-slate-400">({result.zip})</span>}
                        </div>
                      )}
                      {result.phone && (
                        <div className="flex items-center gap-1">
                          <span>📞</span>
                          <span>{result.phone}</span>
                        </div>
                      )}
                      {result.email && (
                        <div className="flex items-center gap-1 truncate">
                          <span>✉️</span>
                          <span className="truncate">{result.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs">
                    <div className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                      {result.teamName}
                    </div>
                    {result.salesperson && (
                      <div className="mt-1 text-slate-500 text-center">
                        👤 {result.salesperson.split(' ')[0]}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nessun risultato */}
        {showResults && searchQuery.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-4 text-center">
            <div className="text-slate-500 text-sm">
              ❌ Nessun cliente trovato per "{searchQuery}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
