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

      {/* Modal */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 max-h-[85vh] overflow-y-auto ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Filtri</h2>
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
          />
        </div>

        {/* Apply Button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <button
            onClick={onClose}
            className="w-full py-3 min-h-[48px] bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg"
          >
            Applica filtri
          </button>
        </div>
      </div>
    </>
  );
}
