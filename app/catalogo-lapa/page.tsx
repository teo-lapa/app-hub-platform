'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Barcode, Tag, Eye, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  list_price?: number;
  categ_id?: [number, string];
  image_256?: string;
  description?: string;
  description_sale?: string;
  qty_available?: number;
  uom_id?: [number, string];
  locations?: Array<{ name: string; qty: number }>; // Ubicazioni INTERNE con quantità
}

interface OdooResponse {
  success: boolean;
  data?: Product[];
  total?: number;
  error?: string;
  method?: string;
}

export default function CatalogoLapaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Cache completa
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAutoSearching, setIsAutoSearching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0); // Progresso caricamento cache
  const [isCacheComplete, setIsCacheComplete] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Prodotto selezionato per popup
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Categoria selezionata

  const productsPerPage = 50;

  // Carica prodotti con dati VERI da Odoo
  const loadProducts = async (page: number = 1, search: string = '', category: string | null = null) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/catalogo-lapa/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          limit: productsPerPage,
          search: search.trim() || undefined,
          category: category || undefined
        })
      });

      const data: OdooResponse = await response.json();

      if (data.success && data.data) {
        setProducts(data.data);
        setTotalProducts(data.total || data.data.length);
      } else {
        setError(data.error || 'Errore nel caricamento prodotti');
        setProducts([]);
      }
    } catch (err) {
      console.error('Errore API:', err);
      setError('Errore di connessione al server');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Carica tutti i prodotti in background per la cache
  const loadAllProductsInBackground = async () => {
    try {
      console.log('🚀 Inizio caricamento cache completa...');
      const response = await fetch('/api/catalogo-lapa/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          limit: 10000, // Carica tutti
          search: ''
        })
      });

      const data: OdooResponse = await response.json();

      if (data.success && data.data) {
        setAllProducts(data.data);
        setTotalProducts(data.total || data.data.length);
        setIsCacheComplete(true);
        setCacheProgress(100);
        console.log(`✅ Cache completa! ${data.data.length} prodotti caricati`);
      }
    } catch (err) {
      console.error('❌ Errore caricamento cache:', err);
    }
  };

  // Ricerca client-side nella cache
  const searchInCache = (query: string, page: number = 1) => {
    if (!isCacheComplete || allProducts.length === 0) {
      return;
    }

    const q = query.toLowerCase().trim();

    let filtered = allProducts;

    // Filtro per categoria se selezionata
    if (selectedCategory) {
      if (selectedCategory === 'SECCO') {
        // Per SECCO: include sia SECCO che SECCO 2
        filtered = filtered.filter(p => {
          const categ = p.categ_id?.[1]?.toLowerCase() || '';
          return categ.includes('secco');
        });
      } else {
        // Per altre categorie
        filtered = filtered.filter(p => {
          const categ = p.categ_id?.[1]?.toLowerCase() || '';
          return categ.includes(selectedCategory.toLowerCase());
        });
      }
    }

    // Filtro per ricerca testuale
    if (q) {
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        (typeof p.default_code === 'string' && p.default_code.toLowerCase().includes(q)) ||
        (typeof p.barcode === 'string' && p.barcode.toLowerCase().includes(q)) ||
        p.categ_id?.[1]?.toLowerCase().includes(q)
      );
    }

    const startIndex = (page - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    setProducts(paginated);
    setTotalProducts(filtered.length);
    setCurrentPage(page);
  };

  // Carica prima pagina all'avvio
  useEffect(() => {
    loadProducts(1, searchQuery);
    // Avvia caricamento cache in background
    setTimeout(() => loadAllProductsInBackground(), 1000);
  }, []);

  // Gestisci ricerca
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCacheComplete) {
      searchInCache(searchQuery, 1);
    } else {
      setCurrentPage(1);
      loadProducts(1, searchQuery, selectedCategory);
    }
  };

  // Gestisci click categoria
  const handleCategoryClick = (category: string | null) => {
    if (selectedCategory === category) {
      // Se clicco sulla stessa categoria, non faccio nulla
      return;
    }

    // Seleziono nuova categoria (null = TUTTO)
    setSelectedCategory(category);
    setSearchQuery('');
    setCurrentPage(1);
    loadProducts(1, '', category);
  };

  // Ricerca veloce automatica
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 3 || searchQuery.trim().length === 0) {
        if (isCacheComplete) {
          // Ricerca istantanea nella cache
          searchInCache(searchQuery, 1);
        } else {
          // Ricerca server-side se cache non pronta
          setIsAutoSearching(true);
          setCurrentPage(1);
          loadProducts(1, searchQuery).finally(() => {
            setIsAutoSearching(false);
          });
        }
      }
    }, isCacheComplete ? 0 : 300); // Istantanea se cache pronta, altrimenti 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isCacheComplete]);

  // Cambia pagina
  const handlePageChange = (newPage: number) => {
    if (isCacheComplete) {
      searchInCache(searchQuery, newPage);
    } else {
      setCurrentPage(newPage);
      loadProducts(newPage, searchQuery);
    }
    window.scrollTo(0, 0);
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center space-x-4">
                {/* Pulsante Indietro */}
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600 transition-colors group"
                >
                  <ArrowLeft className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <Home className="h-5 w-5 text-slate-300 group-hover:text-white" />
                  <span className="text-slate-300 group-hover:text-white font-medium">Home</span>
                </Link>

                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-3 rounded-xl">
                    <Package className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">Catalogo LAPA</h1>
                    <p className="text-slate-300">Finest Italian Food - Prodotti Premium</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pulsanti categorie - FILA ORIZZONTALE CON SCROLL */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 px-4 min-w-max">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-600 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              TUTTO
            </button>
            <button
              onClick={() => handleCategoryClick('SECCO')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === 'SECCO'
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-600 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              SECCO
            </button>
            <button
              onClick={() => handleCategoryClick('FRIGO')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === 'FRIGO'
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-600 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              FRIGO
            </button>
            <button
              onClick={() => handleCategoryClick('PINGU')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === 'PINGU'
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-600 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              PINGU
            </button>
            <button
              onClick={() => handleCategoryClick('NON FOOD')}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                selectedCategory === 'NON FOOD'
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 border border-slate-600 hover:border-emerald-500/50 hover:text-white'
              }`}
            >
              NON FOOD
            </button>
          </div>
        </div>

        {/* Barra di ricerca - SOTTO I PULSANTI CATEGORIE */}
        <div className="mb-8">
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca..."
                className="block w-full pl-10 pr-4 py-3 text-sm bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              {isAutoSearching && (
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stati di caricamento e errore */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center px-6 py-3 bg-slate-800/50 rounded-xl border border-slate-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-3"></div>
              <span className="text-slate-300">Caricamento prodotti reali da Odoo...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Griglia prodotti */}
        {!loading && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 mb-8">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer">
                  {/* Immagine prodotto */}
                  <div className="aspect-square bg-slate-700/30 relative overflow-hidden">
                    {product.image_256 ? (
                      <img
                        src={`data:image/jpeg;base64,${product.image_256}`}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-slate-500" />
                      </div>
                    )}

                    {/* Badge categoria madre (prima categoria) */}
                    {product.categ_id && (
                      <div className="absolute top-1.5 left-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/90 text-white">
                          {product.categ_id[1].split('/')[0].trim()}
                        </span>
                      </div>
                    )}

                    {/* Badge disponibilità piccolo */}
                    {typeof product.qty_available === 'number' && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                          product.qty_available > 0
                            ? 'bg-green-500/90 text-white'
                            : 'bg-red-500/90 text-white'
                        }`}>
                          {product.qty_available > 0 ? '✓' : '✗'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contenuto card */}
                  <div className="p-2">
                    <h3 className="text-xs font-semibold text-white mb-1 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
                      {product.name}
                    </h3>

                    {/* Codice prodotto */}
                    {product.default_code && (
                      <div className="text-slate-400 text-[10px] mb-1 truncate">
                        {product.default_code}
                      </div>
                    )}

                    {/* Footer card */}
                    <div className="pt-1.5 mt-1 border-t border-slate-600/50 space-y-1">
                      {/* Prezzo e Quantità */}
                      <div className="flex items-center justify-between">
                        {/* Prezzo */}
                        {product.list_price && product.list_price > 0 ? (
                          <div>
                            <span className="text-sm font-bold text-emerald-400">
                              {new Intl.NumberFormat('it-CH', {
                                style: 'currency',
                                currency: 'CHF'
                              }).format(product.list_price)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">N/D</span>
                        )}

                        {/* Quantità */}
                        {typeof product.qty_available === 'number' && (
                          <div className="text-right">
                            <div className={`text-[11px] font-semibold ${
                              product.qty_available > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {product.qty_available}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ubicazioni INTERNE con quantità */}
                      {product.locations && product.locations.length > 0 && (
                        <div className="text-[9px] mt-1">
                          <div className="text-slate-400 mb-0.5">Ubicazioni:</div>
                          <div className="flex flex-wrap gap-1">
                            {product.locations.map((loc, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30"
                              >
                                <span>{loc.name}</span>
                                <span className="text-green-400 font-bold">({loc.qty})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Precedente
                </button>

                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          page === currentPage
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  Successiva
                </button>

                <div className="ml-4 text-slate-400 text-sm">
                  Pagina {currentPage} di {totalPages}
                </div>
              </div>
            )}
          </>
        )}

        {/* Nessun risultato */}
        {!loading && products.length === 0 && !error && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">Nessun prodotto trovato</h3>
            <p className="text-slate-400">
              {searchQuery ? 'Prova con termini di ricerca diversi' : 'Il catalogo è vuoto al momento'}
            </p>
          </div>
        )}
      </div>

      {/* Popup dettaglio prodotto */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con immagine */}
            <div className="relative">
              <div className="aspect-video bg-slate-700/30 relative overflow-hidden">
                {selectedProduct.image_256 ? (
                  <img
                    src={`data:image/jpeg;base64,${selectedProduct.image_256}`}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-24 w-24 text-slate-500" />
                  </div>
                )}
              </div>

              {/* Pulsante chiudi */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenuto */}
            <div className="p-6">
              {/* Nome prodotto */}
              <h2 className="text-2xl font-bold text-white mb-4">{selectedProduct.name}</h2>

              {/* Informazioni principali */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Codice prodotto */}
                {selectedProduct.default_code && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-sm mb-1">Codice Prodotto</div>
                    <div className="text-white font-semibold">{selectedProduct.default_code}</div>
                  </div>
                )}

                {/* Barcode */}
                {selectedProduct.barcode && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <div className="text-slate-400 text-sm mb-1">Barcode</div>
                    <div className="text-white font-mono font-semibold">{selectedProduct.barcode}</div>
                  </div>
                )}

                {/* Prezzo */}
                {selectedProduct.list_price && selectedProduct.list_price > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="text-emerald-400 text-sm mb-1">Prezzo di Listino</div>
                    <div className="text-white font-bold text-xl">
                      €{selectedProduct.list_price.toFixed(2)}
                      {selectedProduct.uom_id && (
                        <span className="text-slate-400 text-base font-normal ml-1">
                          / {selectedProduct.uom_id[1]}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Disponibilità */}
                {typeof selectedProduct.qty_available === 'number' && (
                  <div className={`rounded-lg p-3 ${
                    selectedProduct.qty_available > 0
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className={`text-sm mb-1 ${
                      selectedProduct.qty_available > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      Disponibilità
                    </div>
                    <div className="text-white font-bold text-xl">
                      {selectedProduct.qty_available > 0 ? (
                        <span className="text-green-400">{selectedProduct.qty_available} disponibili</span>
                      ) : (
                        <span className="text-red-400">Esaurito</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Categoria */}
              {selectedProduct.categ_id && (
                <div className="mb-6">
                  <div className="text-slate-400 text-sm mb-2">Categoria</div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {selectedProduct.categ_id[1]}
                    </span>
                  </div>
                </div>
              )}

              {/* Descrizione */}
              {selectedProduct.description_sale && (
                <div className="mb-6">
                  <div className="text-slate-400 text-sm mb-2">Descrizione</div>
                  <p className="text-white leading-relaxed whitespace-pre-line">
                    {selectedProduct.description_sale}
                  </p>
                </div>
              )}

              {/* Pulsanti azione */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Chiudi
                </button>
                <button
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all"
                >
                  Richiedi Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pulsante Home Mobile - sempre visibile */}
      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110"
        >
          <Home className="h-6 w-6" />
        </Link>
      </div>
    </div>
  );
}