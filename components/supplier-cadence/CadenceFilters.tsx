'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadenceType } from '@/lib/types/supplier-cadence';

interface CadenceFiltersProps {
  onSearchChange: (query: string) => void;
  onStatusChange: (status: 'all' | 'active' | 'inactive') => void;
  onSortChange: (sort: 'next_order_date' | 'supplier_name') => void;
  totalCount: number;
  filteredCount: number;
  className?: string;
}

export function CadenceFilters({
  onSearchChange,
  onStatusChange,
  onSortChange,
  totalCount,
  filteredCount,
  className,
}: CadenceFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSort, setSelectedSort] = useState<'next_order_date' | 'supplier_name'>(
    'next_order_date'
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onSearchChange('');
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onSearchChange(searchQuery);
    }
  };

  // Status filter change
  const handleStatusChange = (status: 'all' | 'active' | 'inactive') => {
    setSelectedStatus(status);
    onStatusChange(status);
  };

  // Sort change
  const handleSortChange = (sort: 'next_order_date' | 'supplier_name') => {
    setSelectedSort(sort);
    onSortChange(sort);
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
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      <div className="relative w-full">
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search className="h-5 w-5" />
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Cerca fornitore per nome..."
            className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            aria-label="Cerca fornitori"
          />

          {/* Clear Button */}
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
              aria-label="Cancella ricerca"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-400 flex items-center gap-1.5">
            <Filter className="h-4 w-4" />
            Stato:
          </span>

          <button
            onClick={() => handleStatusChange('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              selectedStatus === 'all'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
            )}
          >
            Tutti
          </button>

          <button
            onClick={() => handleStatusChange('active')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5',
              selectedStatus === 'active'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Attivi
          </button>

          <button
            onClick={() => handleStatusChange('inactive')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5',
              selectedStatus === 'inactive'
                ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
            )}
          >
            <Circle className="h-3.5 w-3.5" />
            Inattivi
          </button>
        </div>

        {/* Sort Dropdown + Results Count */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Results Count Badge */}
          {filteredCount !== totalCount && (
            <span className="text-sm text-slate-400">
              <span className="font-medium text-white">{filteredCount}</span> di {totalCount}
            </span>
          )}

          {/* Sort Dropdown */}
          <select
            value={selectedSort}
            onChange={(e) =>
              handleSortChange(e.target.value as 'next_order_date' | 'supplier_name')
            }
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            aria-label="Ordina per"
          >
            <option value="next_order_date">Prossimo ordine</option>
            <option value="supplier_name">Nome fornitore</option>
          </select>
        </div>
      </div>

      {/* Active Search Hint */}
      {searchQuery && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <span>
            Ricerca: <span className="font-medium text-white">{searchQuery}</span>
          </span>
        </div>
      )}
    </div>
  );
}
