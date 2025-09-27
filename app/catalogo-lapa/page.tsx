'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Barcode, Tag, Eye } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
  list_price?: number;
  categ_id?: [number, string];
  image_1920?: string;
  description_sale?: string;
  qty_available?: number;
  uom_id?: [number, string];
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const productsPerPage = 50;

  // Carica prodotti con dati VERI da Odoo
  const loadProducts = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/catalogo-lapa/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          limit: productsPerPage,
          search: search.trim() || undefined
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

  // Carica prodotti all'avvio
  useEffect(() => {
    loadProducts(1, searchQuery);
  }, []);

  // Gestisci ricerca
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadProducts(1, searchQuery);
  };

  // Cambia pagina
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadProducts(newPage, searchQuery);
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
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-3 rounded-xl">
                  <Package className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Catalogo LAPA</h1>
                  <p className="text-slate-300">Finest Italian Food - Prodotti Premium</p>
                </div>
              </div>

              <div className="mt-4 lg:mt-0">
                <div className="bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-600">
                  <div className="text-sm text-slate-300">
                    <span className="font-semibold text-emerald-400">{totalProducts}</span> prodotti totali
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Barra di ricerca */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca prodotti per nome, codice o barcode..."
                className="block w-full pl-10 pr-24 py-4 text-lg bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute inset-y-0 right-0 px-6 py-2 m-2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-all"
              >
                Cerca
              </button>
            </div>
          </form>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {products.map((product) => (
                <div key={product.id} className="bg-slate-800/40 backdrop-blur-sm rounded-xl border border-slate-600/50 overflow-hidden hover:border-emerald-500/50 transition-all duration-300 group">
                  {/* Immagine prodotto */}
                  <div className="aspect-square bg-slate-700/30 relative overflow-hidden">
                    {product.image_1920 ? (
                      <img
                        src={`data:image/jpeg;base64,${product.image_1920}`}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-slate-500" />
                      </div>
                    )}

                    {/* Badge categoria */}
                    {product.categ_id && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/90 text-white">
                          <Tag className="w-3 h-3 mr-1" />
                          {product.categ_id[1]}
                        </span>
                      </div>
                    )}

                    {/* Quantità disponibile */}
                    {typeof product.qty_available === 'number' && (
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.qty_available > 0
                            ? 'bg-green-500/90 text-white'
                            : 'bg-red-500/90 text-white'
                        }`}>
                          {product.qty_available > 0 ? 'Disponibile' : 'Esaurito'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contenuto card */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {product.name}
                    </h3>

                    {/* Codice prodotto */}
                    {product.default_code && (
                      <div className="flex items-center text-slate-400 text-sm mb-2">
                        <Eye className="w-4 h-4 mr-1" />
                        <span>Codice: {product.default_code}</span>
                      </div>
                    )}

                    {/* Barcode */}
                    {product.barcode && (
                      <div className="flex items-center text-slate-400 text-sm mb-2">
                        <Barcode className="w-4 h-4 mr-1" />
                        <span className="font-mono">{product.barcode}</span>
                      </div>
                    )}

                    {/* Descrizione */}
                    {product.description_sale && (
                      <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                        {product.description_sale}
                      </p>
                    )}

                    {/* Footer card */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-600/50">
                      {/* Prezzo */}
                      {product.list_price && product.list_price > 0 ? (
                        <div className="text-right">
                          <span className="text-2xl font-bold text-emerald-400">
                            €{product.list_price.toFixed(2)}
                          </span>
                          {product.uom_id && (
                            <span className="text-slate-400 text-sm ml-1">
                              /{product.uom_id[1]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">Prezzo da definire</span>
                      )}

                      {/* Quantità */}
                      {typeof product.qty_available === 'number' && (
                        <div className="text-right">
                          <div className="text-sm text-slate-400">Qtà disponibile</div>
                          <div className={`font-semibold ${
                            product.qty_available > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {product.qty_available}
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
    </div>
  );
}