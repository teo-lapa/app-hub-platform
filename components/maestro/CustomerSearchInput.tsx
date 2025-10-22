'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CustomerAvatar } from '@/lib/maestro/types';

interface CustomerSearchInputProps {
  onSelectCustomer: (customer: CustomerAvatar) => void;
  vendorId?: number | null; // Filter by vendor if provided
  placeholder?: string;
  className?: string;
}

export function CustomerSearchInput({
  onSelectCustomer,
  vendorId,
  placeholder = "Cerca cliente per aggiungere alla lista...",
  className = ""
}: CustomerSearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerAvatar[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search customers when user types
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const searchCustomers = async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          search: searchTerm,
          limit: '20',
          sort_by: 'name',
          sort_order: 'asc'
        });

        // NO FILTER: Search ALL customers (not just assigned to this salesperson)
        // This allows salespeople to add any customer to their daily plan
        // (e.g., visiting a colleague's customer or leaving a sample gift)

        const res = await fetch(`/api/maestro/avatars?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to search customers');

        const data = await res.json();

        setSearchResults(data.avatars || []);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error searching customers:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, vendorId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleSelectCustomer(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectCustomer = (customer: CustomerAvatar) => {
    onSelectCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    searchInputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {showDropdown && searchResults.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto"
          >
            <div className="p-2">
              <div className="px-3 py-2 text-xs text-slate-400 font-medium">
                {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'} trovat{searchResults.length === 1 ? 'o' : 'i'}
              </div>
              <div className="space-y-1">
                {searchResults.map((customer, index) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{customer.name}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" />
                          <span>{customer.city || 'N/D'}</span>
                          {customer.assigned_salesperson_name && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{customer.assigned_salesperson_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-slate-400">Health Score</div>
                        <div className={`text-sm font-bold ${
                          customer.health_score >= 70 ? 'text-green-400' :
                          customer.health_score >= 40 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {Math.round(customer.health_score)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Results Message */}
      <AnimatePresence>
        {showDropdown && searchTerm.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4"
          >
            <p className="text-center text-slate-400 text-sm">
              Nessun cliente trovato per "{searchTerm}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
