'use client';

import { X } from 'lucide-react';
import { ProductFilters } from './ProductFilters';

interface Category {
  id: number;
  name: string;
  productCount: number;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export function FilterModal({
  isOpen,
  onClose,
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
}: FilterModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Modal - Centered and compact */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] overflow-y-auto pointer-events-auto transform transition-all duration-300 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-gray-900">Filtri</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90"
            aria-label="Chiudi filtri"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 pb-2">
          <ProductFilters
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            availability={availability}
            onAvailabilityChange={onAvailabilityChange}
            sortBy={sortBy}
            onSortChange={onSortChange}
            showPurchasedOnly={showPurchasedOnly}
            onPurchasedOnlyChange={onPurchasedOnlyChange}
            showFavoritesOnly={showFavoritesOnly}
            onFavoritesOnlyChange={onFavoritesOnlyChange}
          />
        </div>

        {/* Apply Button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg text-sm"
          >
            Applica filtri
          </button>
        </div>
        </div>
      </div>
    </>
  );
}
