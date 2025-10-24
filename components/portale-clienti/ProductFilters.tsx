'use client';

import { Filter, Package, Grid3x3 } from 'lucide-react';

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
}

export function ProductFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  availability,
  onAvailabilityChange,
  sortBy,
  onSortChange,
}: ProductFiltersProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
        <Filter className="h-5 w-5 text-gray-600" />
        <h2 className="font-semibold text-gray-900">Filtri</h2>
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
        }}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Reimposta filtri
      </button>
    </div>
  );
}
