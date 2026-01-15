'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Product {
  id: number;
  name: string;
  default_code?: string;
  list_price?: number;
  image_128?: string;
  last_purchase_date?: string;
  qty_available?: number;
  incoming_qty?: number;
  incoming_date?: string | null;
  uom_id?: [number, string] | false;
  uom_name?: string;
}

interface ManualProductSearchProps {
  customerId: number | null;
  onProductAdd: (product: Product, quantity: number) => void;
}

export default function ManualProductSearch({ customerId, onProductAdd }: ManualProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // State per alternative
  const [alternativeProducts, setAlternativeProducts] = useState<Product[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search function
  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/catalogo-venditori/search-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          customerId: customerId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nella ricerca prodotti');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Errore nella ricerca');
      }

      setSearchResults(data.products || []);
      setIsDropdownOpen(true);
      console.log(`✅ Found ${data.products?.length || 0} products`);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      setSearchResults([]);
      setIsDropdownOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search input change with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts(value);
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
      setIsDropdownOpen(false);
    }
  };

  // Handle product selection from dropdown
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setIsDropdownOpen(false);
    setQuantity(1);
    setQuantityInput('1');
  };

  // Handle quantity input change
  const handleQuantityChange = (value: string) => {
    setQuantityInput(value);

    // Allow empty string
    if (value === '') {
      setQuantity(0);
      return;
    }

    // Replace comma with dot for parseFloat
    const normalizedValue = value.replace(',', '.');

    // Validate and parse
    if (/^[0-9]*\.?[0-9]*$/.test(normalizedValue)) {
      const qty = parseFloat(normalizedValue);
      if (!isNaN(qty) && qty >= 0) {
        setQuantity(qty);
      } else if (normalizedValue === '0' || normalizedValue === '.') {
        setQuantity(0);
      }
    }
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (!selectedProduct) {
      setError('Seleziona un prodotto prima di aggiungerlo');
      return;
    }

    if (quantity <= 0) {
      setError('La quantità deve essere maggiore di 0');
      return;
    }

    onProductAdd(selectedProduct, quantity);

    // Reset form
    setSelectedProduct(null);
    setSearchQuery('');
    setQuantity(1);
    setQuantityInput('1');
    setSearchResults([]);
    setError(null);
    setIsDropdownOpen(false);
    setAlternativeProducts([]);
    setShowAlternatives(false);
  };

  // Carica prodotti alternativi
  const handleLoadAlternatives = async () => {
    if (!selectedProduct) return;

    setLoadingAlternatives(true);
    setError(null);

    try {
      // Chiama API per ottenere le alternative
      const response = await fetch('/api/odoo/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model: 'product.product',
          method: 'search_read',
          args: [[['id', '=', selectedProduct.id]]],
          kwargs: { fields: ['product_tmpl_id'], limit: 1 }
        }),
      });

      const productData = await response.json();
      if (!productData.result || productData.result.length === 0) {
        setError('Prodotto non trovato');
        return;
      }

      const templateId = productData.result[0].product_tmpl_id[0];

      // Ottieni alternative dal template
      const templateResponse = await fetch('/api/odoo/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model: 'product.template',
          method: 'search_read',
          args: [[['id', '=', templateId]]],
          kwargs: { fields: ['alternative_product_ids'], limit: 1 }
        }),
      });

      const templateData = await templateResponse.json();
      if (!templateData.result || templateData.result.length === 0 ||
          !templateData.result[0].alternative_product_ids ||
          templateData.result[0].alternative_product_ids.length === 0) {
        setError('Nessun prodotto alternativo configurato');
        setAlternativeProducts([]);
        setShowAlternatives(true);
        return;
      }

      // Carica i prodotti alternativi con immagini e giacenza
      const altResponse = await fetch('/api/odoo/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model: 'product.product',
          method: 'search_read',
          args: [[['product_tmpl_id', 'in', templateData.result[0].alternative_product_ids]]],
          kwargs: {
            fields: ['id', 'name', 'default_code', 'image_128', 'qty_available', 'uom_id', 'list_price'],
            limit: 50
          }
        }),
      });

      const altData = await altResponse.json();
      if (altData.result && altData.result.length > 0) {
        setAlternativeProducts(altData.result);
        setShowAlternatives(true);
      } else {
        setError('Nessun prodotto alternativo trovato');
        setAlternativeProducts([]);
        setShowAlternatives(true);
      }
    } catch (err) {
      console.error('Errore caricamento alternative:', err);
      setError('Errore nel caricamento delle alternative');
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Seleziona un prodotto alternativo
  const handleSelectAlternative = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowAlternatives(false);
    setAlternativeProducts([]);
    setQuantity(1);
    setQuantityInput('1');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-white" style={{ fontSize: '18px', lineHeight: '1.5' }}>
          Ricerca Manuale Prodotto
        </h3>
      </div>

      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cerca prodotto per nome o codice..."
            className="w-full min-h-[56px] px-4 py-3 pr-12 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown - Mobile Optimized */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div className="absolute sm:bottom-full bottom-auto sm:top-auto top-full z-50 w-full sm:mb-2 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-[60vh] sm:max-h-[400px] overflow-y-auto overscroll-contain">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product)}
                className="w-full flex items-center gap-3 p-3 min-h-[56px] hover:bg-slate-700 active:bg-slate-600 transition-colors text-left border-b border-slate-700 last:border-b-0"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Product Image */}
                {product.image_128 ? (
                  <img
                    src={`data:image/png;base64,${product.image_128}`}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-600 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white break-words" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                    {product.name}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {product.default_code && (
                      <div className="text-xs text-slate-400" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                        Cod: {product.default_code}
                      </div>
                    )}
                    {/* Prezzo rimosso - gestito separatamente */}
                  </div>
                  {/* Giacenza e Unità di Misura */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <div className="text-xs font-semibold flex items-center gap-1" style={{ fontSize: '12px', lineHeight: '1.5', color: product.qty_available && product.qty_available > 0 ? '#10b981' : '#f59e0b' }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Giacenza: {product.qty_available !== undefined ? product.qty_available.toFixed(2) : '0.00'}
                      {product.uom_id && Array.isArray(product.uom_id) && ` ${product.uom_id[1]}`}
                    </div>
                    {product.incoming_qty && product.incoming_qty > 0 && (
                      <div className="text-xs text-blue-400 flex items-center gap-1" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        In arrivo: {product.incoming_qty.toFixed(2)}
                        {product.incoming_date && ` il ${new Date(product.incoming_date).toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                      </div>
                    )}
                    {product.last_purchase_date && (
                      <div className="text-xs text-purple-400 flex items-center gap-1" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Ultimo: {new Date(product.last_purchase_date).toLocaleDateString('it-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results Message */}
        {isDropdownOpen && searchResults.length === 0 && !loading && searchQuery.length >= 2 && (
          <div className="absolute bottom-full z-50 w-full mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">Nessun prodotto trovato</span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Product + Quantity */}
      {selectedProduct && (
        <div className="bg-slate-800 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-3">
            {selectedProduct.image_128 ? (
              <img
                src={`data:image/png;base64,${selectedProduct.image_128}`}
                alt={selectedProduct.name}
                className="w-16 h-16 rounded-lg object-cover border border-slate-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <div className="font-semibold text-white" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                {selectedProduct.name}
              </div>
              {/* Giacenza */}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: selectedProduct.qty_available && selectedProduct.qty_available > 0 ? '#10b981' : '#f59e0b'
                  }}
                >
                  📦 Giacenza: {selectedProduct.qty_available?.toFixed(2) || '0.00'}
                  {selectedProduct.uom_id && Array.isArray(selectedProduct.uom_id) && ` ${selectedProduct.uom_id[1]}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity Input + Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm text-slate-300 font-medium" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Quantità:
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={quantityInput}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="1"
              className="w-20 min-h-[48px] px-3 py-2 bg-slate-700 text-white text-center rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              style={{
                fontSize: '16px',
                lineHeight: '1.5',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            />
            <button
              onClick={handleAddToCart}
              className="flex-1 min-h-[48px] px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Aggiungi al Carrello
            </button>
            <button
              onClick={handleLoadAlternatives}
              disabled={loadingAlternatives}
              className="min-h-[48px] px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              {loadingAlternatives ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>🔀 Alternativa</>
              )}
            </button>
          </div>

          {/* Alternative Products */}
          {showAlternatives && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-sm font-semibold text-teal-400 mb-3">
                🔀 Prodotti Alternativi {alternativeProducts.length > 0 && `(${alternativeProducts.length})`}
              </div>
              {alternativeProducts.length === 0 ? (
                <div className="text-sm text-slate-400">Nessun prodotto alternativo configurato</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {alternativeProducts.map((alt) => {
                    const uom = alt.uom_id && Array.isArray(alt.uom_id) ? alt.uom_id[1] : '';
                    const hasStock = alt.qty_available && alt.qty_available > 0;
                    return (
                      <button
                        key={alt.id}
                        onClick={() => handleSelectAlternative(alt)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-all text-left"
                      >
                        {alt.image_128 ? (
                          <img
                            src={`data:image/png;base64,${alt.image_128}`}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-slate-600"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center text-lg">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{alt.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="text-xs font-semibold"
                              style={{ color: hasStock ? '#10b981' : '#f59e0b' }}
                            >
                              📦 {alt.qty_available?.toFixed(2) || '0.00'} {uom}
                            </span>
                            {alt.default_code && (
                              <span className="text-xs text-slate-400">Cod: {alt.default_code}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-teal-400 text-sm">Seleziona →</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => { setShowAlternatives(false); setAlternativeProducts([]); }}
                className="mt-3 text-sm text-slate-400 hover:text-white transition-colors"
              >
                ✕ Chiudi alternative
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-500">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
