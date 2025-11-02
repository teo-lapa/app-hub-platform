'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Track if user has ever searched (to prevent intelligent sort from re-activating)
  const [hasSearched, setHasSearched] = useState(false);

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

  // Fetch cart items with ultra-robust error handling
  async function fetchCartItems() {
    try {
      const response = await fetch('/api/portale-clienti/cart');
      if (!response.ok) {
        console.warn('Cart API returned error status:', response.status);
        setCartItems([]);
        return;
      }

      const data = await response.json();

      if (!data.error && data.items && Array.isArray(data.items)) {
        const validItems: { productId: number; quantity: number }[] = [];

        for (const item of data.items) {
          try {
            // Try different possible structures
            let productId: number | null = null;
            let quantity: number = 0;

            // Option 1: item.product_id (campo diretto)
            if (item?.product_id) {
              productId = item.product_id;
              quantity = item.quantity || 0;
            }
            // Option 2: item.odoo_product_id
            else if (item?.odoo_product_id) {
              productId = item.odoo_product_id;
              quantity = item.quantity || 0;
            }
            // Option 3: item.product.id (nested)
            else if (item?.product?.id) {
              productId = item.product.id;
              quantity = item.quantity || 0;
            }

            if (productId && typeof productId === 'number') {
              validItems.push({ productId, quantity });
            }
          } catch (e) {
            console.warn('Skipping invalid cart item:', e);
            continue;
          }
        }

        setCartItems(validItems);
      } else {
        setCartItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch cart:', err);
      setCartItems([]);
    }
  }

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

  // useCallback to prevent stale closures and unnecessary re-renders
  const fetchProducts = useCallback(async () => {
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
        // CRITICAL: Block intelligent sorting if user has searched in this session
        blockIntelligentSort: hasSearched ? 'true' : 'false',
      });

      console.log('🔍 [CATALOG] Fetching products with params:', {
        q: searchQuery,
        category: selectedCategory,
        sort: sortBy,
        page: pagination.page,
        hasSearched,
        blockIntelligentSort: hasSearched
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
  }, [searchQuery, selectedCategory, availability, sortBy, showPurchasedOnly, pagination.page, pagination.limit, hasSearched]);

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleAddToCart(productId: number, quantity: number) {
    try {
      // Ottimistic update - aggiorna subito lo stato locale
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

      // Add to cart via API
      const response = await fetch('/api/portale-clienti/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });

      const data = await response.json();

      if (data.error) {
        // Se c'è un errore, ripristina lo stato precedente
        await fetchCartItems();
        throw new Error(data.error);
      }

      const product = products.find((p) => p.id === productId);
      toast.success(`${product?.name || 'Prodotto'} aggiunto al carrello`);
    } catch (err: any) {
      console.error('Failed to add to cart:', err);
      toast.error(err.message || 'Impossibile aggiungere al carrello');
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on search

    // Mark that user has searched (prevents intelligent sort from re-activating)
    if (query && query.length > 0) {
      setHasSearched(true);
      console.log('🔍 [CATALOG] User searched, intelligent sorting now BLOCKED');
    } else if (query === '' && hasSearched) {
      // User explicitly cleared search - reset hasSearched
      setHasSearched(false);
      console.log('🔍 [CATALOG] Search cleared, intelligent sorting can re-activate');
    }
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
                const cartQty = cartItem?.quantity || 0;

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    cartQuantity={cartQty}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-6 pb-4 px-2">
                <div className="text-sm sm:text-base text-gray-700 font-medium">
                  Pagina {pagination.page} di {pagination.totalPages}
                  {' · '}
                  {pagination.total} prodotti totali
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 min-h-[52px] bg-white border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-red-50 hover:border-red-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 disabled:hover:text-gray-700 transition-all shadow-sm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                    <span className="hidden sm:inline">Precedente</span>
                    <span className="sm:hidden">Prec</span>
                  </button>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasMore}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 min-h-[52px] bg-red-600 border-2 border-red-600 rounded-lg font-semibold text-white hover:bg-red-700 hover:border-red-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600 disabled:hover:border-red-600 transition-all shadow-sm"
                  >
                    <span className="hidden sm:inline">Successiva</span>
                    <span className="sm:hidden">Succ</span>
                    <ChevronRight className="h-5 w-5" />
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
        value={searchQuery}
      />
    </div>
  );
}
