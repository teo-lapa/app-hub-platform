'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from '@/components/portale-clienti/ProductCard';
import { CatalogSearchBar } from '@/components/portale-clienti/CatalogSearchBar';
import { FilterModal } from '@/components/portale-clienti/FilterModal';
import { Loader2, ShoppingCart, ChevronLeft, ChevronRight, PackageX } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  code: string | null;
  price: number;
  originalPrice: number;
  hasCustomPrice: boolean;
  quantity: number;
  available: boolean;
  image: string;
  category: { id: number; name: string } | null;
  unit: string;
  description: string | null;
}

interface Category {
  id: number;
  name: string;
  productCount: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function CatalogoPage() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showPurchasedOnly, setShowPurchasedOnly] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Cart state (simple local state - you can move to context/zustand later)
  const [cartItems, setCartItems] = useState<{ productId: number; quantity: number }[]>([]);

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
    fetchCartItems(); // Riabilitato - cache browser risolta
  }, []);

  // Fetch cart items
  async function fetchCartItems() {
    try {
      const response = await fetch('/api/portale-clienti/cart');
      const data = await response.json();

      if (!data.error && data.items && Array.isArray(data.items)) {
        const validItems = data.items
          .filter((item: any) => {
            try {
              return item && item.product && typeof item.product.id === 'number';
            } catch {
              return false;
            }
          })
          .map((item: any) => ({
            productId: item.product.id,
            quantity: item.quantity || 0
          }));
        setCartItems(validItems);
      } else {
        setCartItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
      setCartItems([]); // Set empty array on error
    }
  }

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts();
  }, [searchQuery, selectedCategory, availability, sortBy, showPurchasedOnly, pagination.page]);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/portale-clienti/categories');
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setCategories(data.categories || []);
    } catch (err: any) {
      console.error('Failed to fetch categories:', err);
      toast.error('Impossibile caricare le categorie');
    }
  }

  async function fetchProducts() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        q: searchQuery,
        category: selectedCategory,
        availability,
        sort: sortBy,
        purchased: showPurchasedOnly ? 'true' : 'false',
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/portale-clienti/products?${params}`, {
        credentials: 'include', // Include cookies for JWT token
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setProducts(data.products || []);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Errore nel caricamento prodotti');
      toast.error('Impossibile caricare i prodotti');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart(productId: number, quantity: number) {
    try {
      // Add to cart via API
      const response = await fetch('/api/portale-clienti/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Update local cart state
      setCartItems((prev) => {
        const existing = prev.find((item) => item.productId === productId);
        if (existing) {
          return prev.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prev, { productId, quantity }];
      });

      const product = products.find((p) => p.id === productId);
      toast.success(`${product?.name || 'Prodotto'} aggiunto al carrello`);

      // Ricarica il carrello per aggiornare le quantità
      fetchCartItems();
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      toast.error(err.message || 'Impossibile aggiungere al carrello');
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on search
  }

  function handleCategoryChange(categoryId: string) {
    setSelectedCategory(categoryId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleAvailabilityChange(avail: string) {
    setAvailability(avail);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handleSortChange(sort: string) {
    setSortBy(sort);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function handlePurchasedOnlyChange(value: boolean) {
    setShowPurchasedOnly(value);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1
  }

  function handlePageChange(newPage: number) {
    setPagination((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Catalogo Prodotti</h1>
              <p className="text-sm text-gray-600 mt-1">
                {pagination.total} prodotti disponibili
              </p>
            </div>

            {/* Cart Badge */}
            <a
              href="/portale-clienti/carrello"
              className="relative flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium">Carrello</span>
              {totalCartItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                  {totalCartItems}
                </span>
              )}
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Area - Products */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            <span className="ml-2 text-gray-600">Caricamento prodotti...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-2 text-red-600 hover:text-red-700 font-medium"
            >
              Riprova
            </button>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageX className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessun prodotto trovato
            </h3>
            <p className="text-gray-600">
              Prova a modificare i filtri o la ricerca
            </p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {products.map((product) => {
                const cartItem = cartItems.find(item => item.productId === product.id);
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    cartQuantity={cartItem?.quantity || 0}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 pb-4">
                <div className="text-sm text-gray-600">
                  Pagina {pagination.page} di {pagination.totalPages}
                  {' · '}
                  {pagination.total} prodotti totali
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 px-4 py-2 min-h-[48px] border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </button>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="flex items-center gap-1 px-4 py-2 min-h-[48px] border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        availability={availability}
        onAvailabilityChange={handleAvailabilityChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        showPurchasedOnly={showPurchasedOnly}
        onPurchasedOnlyChange={handlePurchasedOnlyChange}
      />

      {/* Bottom Search Bar */}
      <CatalogSearchBar
        onSearch={handleSearch}
        onOpenFilters={() => setIsFilterModalOpen(true)}
      />
    </div>
  );
}
