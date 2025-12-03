'use client';

import { Filter, Package, Grid3x3, History, Star } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  productCount: number;
}

interface ProductFiltersProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  availability: string;
  onAvailabilityChange: (availability: string) => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  showPurchasedOnly: boolean;
  onPurchasedOnlyChange: (value: boolean) => void;
  showFavoritesOnly?: boolean;
  onFavoritesOnlyChange?: (value: boolean) => void;
}

export function ProductFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  availability,
  onAvailabilityChange,
  sortBy,
  onSortChange,
  showPurchasedOnly,
  onPurchasedOnlyChange,
  showFavoritesOnly = false,
  onFavoritesOnlyChange,
}: ProductFiltersProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
        <Filter className="h-5 w-5 text-gray-600" />
        <h2 className="font-semibold text-gray-900">Filtri</h2>
      </div>

      {/* Favorites Toggle */}
      {onFavoritesOnlyChange && (
        <div className="pb-4 border-b border-gray-200">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">
                Solo Preferiti
              </span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={(e) => onFavoritesOnlyChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-yellow-500 peer-focus:ring-2 peer-focus:ring-yellow-300 transition-colors"></div>
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
            </div>
          </label>
          {showFavoritesOnly && (
            <p className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
              <Star className="h-3 w-3" />
              Mostra solo prodotti con stellina
            </p>
          )}
        </div>
      )}

      {/* Purchased Products Toggle */}
      <div className="pb-4 border-b border-gray-200">
        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              Prodotti gia acquistati
            </span>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={showPurchasedOnly}
              onChange={(e) => onPurchasedOnlyChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors"></div>
            <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
          </div>
        </label>
        {showPurchasedOnly && (
          <p className="mt-2 text-xs text-blue-600 flex items-center gap-1">
            <History className="h-3 w-3" />
            Mostra solo prodotti ordinati in precedenza
          </p>
        )}
      </div>

      {/* Category Filter */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Grid3x3 className="h-4 w-4" />
          Categoria
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">Tutte le categorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id.toString()}>
              {category.name} ({category.productCount})
            </option>
          ))}
        </select>
      </div>

      {/* Availability Filter */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Package className="h-4 w-4" />
          Disponibilita
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="availability"
              value="all"
              checked={availability === 'all'}
              onChange={(e) => onAvailabilityChange(e.target.value)}
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Tutti i prodotti</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="availability"
              value="in_stock"
              checked={availability === 'in_stock'}
              onChange={(e) => onAvailabilityChange(e.target.value)}
              className="w-4 h-4 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Solo disponibili</span>
          </label>
        </div>
      </div>

      {/* Sort Filter */}
      <div className="space-y-2 pt-3 border-t border-gray-200">
        <label className="text-sm font-medium text-gray-700">
          Ordina per
        </label>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="name">Nome (A-Z)</option>
          <option value="price_asc">Prezzo (crescente)</option>
          <option value="price_desc">Prezzo (decrescente)</option>
        </select>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => {
          onCategoryChange('all');
          onAvailabilityChange('all');
          onSortChange('name');
          onPurchasedOnlyChange(false);
          onFavoritesOnlyChange?.(false);
        }}
        className="w-full px-4 py-3 min-h-[48px] text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Reimposta filtri
      </button>
    </div>
  );
}
