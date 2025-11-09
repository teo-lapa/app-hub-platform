'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Package, TrendingUp, TrendingDown, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

interface Product {
  id: number;
  name: string;
  image_url: string;
  current_stock: number;
  uom: string;
  sales_5_days: number;
  sales_10_days: number;
  sales_14_days: number;
  supplier_id: number;
  supplier_name: string;
  avg_price: number;
}

export default function CatalogoProdotti() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'supplier'>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadAllSuppliers();
  }, []);

  // Load products when selectedSupplierId changes
  useEffect(() => {
    loadProducts();
  }, [selectedSupplierId]);

  // Auto-select supplier from URL params
  useEffect(() => {
    const supplierIdParam = searchParams.get('supplier_id');
    if (supplierIdParam) {
      const supplierId = parseInt(supplierIdParam);
      setFilterMode('supplier');
      setSelectedSupplierId(supplierId);
    }
  }, [searchParams]);

  async function loadAllSuppliers() {
    try {
      setLoadingSuppliers(true);
      // Load all products without filter to get all suppliers
      const response = await fetch('/api/products-catalog');
      const data = await response.json();

      if (data.success) {
        // Extract unique suppliers
        const suppliersMap = new Map<number, { id: number; name: string }>();
        data.products.forEach((p: Product) => {
          if (p.supplier_id > 0 && !suppliersMap.has(p.supplier_id)) {
            suppliersMap.set(p.supplier_id, { id: p.supplier_id, name: p.supplier_name });
          }
        });
        const sortedSuppliers = Array.from(suppliersMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setAllSuppliers(sortedSuppliers);
      }
    } catch (error) {
      console.error('Errore caricamento fornitori:', error);
    } finally {
      setLoadingSuppliers(false);
    }
  }

  async function loadProducts() {
    try {
      setLoading(true);

      // Build API URL with supplier filter if present
      const apiUrl = selectedSupplierId
        ? `/api/products-catalog?supplier_id=${selectedSupplierId}`
        : '/api/products-catalog';

      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
    } finally {
      setLoading(false);
    }
  }

  // Simple search filter (supplier filter already applied by API)
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">🔄 Caricamento catalogo...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/ordini-smart-v2"
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-400" />
                Catalogo Prodotti
              </h1>
              <p className="text-white/60 mt-1">
                Visualizza stock, vendite e aggiungi prodotti agli ordini
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Cerca prodotto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nome prodotto..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Filter Mode */}
            <div>
              <label className="block text-sm text-white/60 mb-2">Modalità visualizzazione</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilterMode('all');
                    setSelectedSupplierId(null);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg transition-all font-semibold ${
                    filterMode === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  Tutti i Prodotti
                </button>
                <button
                  onClick={() => setFilterMode('supplier')}
                  className={`flex-1 px-4 py-2 rounded-lg transition-all font-semibold ${
                    filterMode === 'supplier'
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  Solo Fornitore
                </button>
              </div>
            </div>
          </div>

          {/* Supplier Dropdown - show only when filterMode is 'supplier' */}
          {filterMode === 'supplier' && (
            <div className="mt-4">
              <label className="block text-sm text-white/60 mb-2">Seleziona fornitore</label>
              <select
                value={selectedSupplierId || ''}
                onChange={(e) => {
                  const newSupplierId = Number(e.target.value) || null;
                  setSelectedSupplierId(newSupplierId);
                }}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="">-- Scegli un fornitore --</option>
                {allSuppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-4 text-sm text-white/60">
            Visualizzati: <span className="font-bold text-white">{filteredProducts.length}</span> prodotti
            {filterMode === 'supplier' && selectedSupplierId && (
              <span className="ml-2">
                • <span className="text-blue-300">{allSuppliers.find(s => s.id === selectedSupplierId)?.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 overflow-hidden hover:border-white/30 transition-all"
            >
              {/* Product Image */}
              <div
                className="relative h-32 bg-white/10 cursor-pointer hover:bg-white/20 transition-colors"
                onClick={() => setSelectedProduct(product)}
              >
                {product.image_url ? (
                  <img
                    src={`data:image/jpeg;base64,${product.image_url}`}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-white/20" />
                  </div>
                )}
                {/* Stock Badge */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  product.current_stock > 10
                    ? 'bg-green-500/80 text-white'
                    : product.current_stock > 0
                    ? 'bg-orange-500/80 text-white'
                    : 'bg-red-500/80 text-white'
                }`}>
                  Stock: {product.current_stock.toFixed(1)} {product.uom}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <h3 className="text-white font-semibold text-xs mb-1.5 line-clamp-2 h-8">
                  {product.name}
                </h3>

                <div className="text-xs text-white/60 mb-2">
                  {product.supplier_name}
                </div>

                {/* Sales Stats */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-white/80">
                    <span>Vendite 5gg:</span>
                    <span className="font-semibold flex items-center gap-1">
                      {product.sales_5_days.toFixed(1)} {product.uom}
                      {product.sales_5_days > product.sales_10_days/2 ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-white/80">
                    <span>Vendite 10gg:</span>
                    <span className="font-semibold">{product.sales_10_days.toFixed(1)} {product.uom}</span>
                  </div>
                  <div className="flex items-center justify-between text-white/80">
                    <span>Vendite 14gg:</span>
                    <span className="font-semibold">{product.sales_14_days.toFixed(1)} {product.uom}</span>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={() => alert(`🚧 Aggiunta prodotto "${product.name}" in arrivo!`)}
                  className="w-full mt-3 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all font-semibold text-xs"
                >
                  ➕ Aggiungi all'Ordine
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <p className="text-white/60 text-lg">Nessun prodotto trovato</p>
            <p className="text-white/40 text-sm mt-2">Prova a modificare i filtri di ricerca</p>
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
                {selectedProduct.image_url ? (
                  <img
                    src={`data:image/jpeg;base64,${selectedProduct.image_url}`}
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
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenuto */}
            <div className="p-6">
              {/* Nome prodotto */}
              <h2 className="text-2xl font-bold text-white mb-4">{selectedProduct.name}</h2>

              {/* Informazioni principali */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Fornitore */}
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-slate-400 text-sm mb-1">Fornitore</div>
                  <div className="text-white font-semibold">{selectedProduct.supplier_name}</div>
                </div>

                {/* Prezzo medio */}
                {selectedProduct.avg_price > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="text-emerald-400 text-sm mb-1">Prezzo Medio</div>
                    <div className="text-white font-bold text-xl">
                      €{selectedProduct.avg_price.toFixed(2)}
                      <span className="text-slate-400 text-base font-normal ml-1">
                        / {selectedProduct.uom}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stock corrente */}
                <div className={`rounded-lg p-3 ${
                  selectedProduct.current_stock > 10
                    ? 'bg-green-500/10 border border-green-500/30'
                    : selectedProduct.current_stock > 0
                    ? 'bg-orange-500/10 border border-orange-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  <div className={`text-sm mb-1 ${
                    selectedProduct.current_stock > 10
                      ? 'text-green-400'
                      : selectedProduct.current_stock > 0
                      ? 'text-orange-400'
                      : 'text-red-400'
                  }`}>
                    Stock Corrente
                  </div>
                  <div className="text-white font-bold text-xl">
                    {selectedProduct.current_stock.toFixed(1)} {selectedProduct.uom}
                  </div>
                </div>
              </div>

              {/* Statistiche vendite */}
              <div className="mb-6">
                <div className="text-slate-400 text-sm mb-3">Statistiche Vendite</div>
                <div className="space-y-3">
                  <div className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white">Vendite ultimi 5 giorni</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{selectedProduct.sales_5_days.toFixed(1)} {selectedProduct.uom}</span>
                      {selectedProduct.sales_5_days > selectedProduct.sales_10_days/2 ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white">Vendite ultimi 10 giorni</span>
                    <span className="text-white font-bold">{selectedProduct.sales_10_days.toFixed(1)} {selectedProduct.uom}</span>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-white">Vendite ultimi 14 giorni</span>
                    <span className="text-white font-bold">{selectedProduct.sales_14_days.toFixed(1)} {selectedProduct.uom}</span>
                  </div>
                </div>
              </div>

              {/* Pulsanti azione */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Chiudi
                </button>
                <button
                  onClick={() => {
                    alert(`🚧 Aggiunta prodotto "${selectedProduct.name}" in arrivo!`);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-lg transition-all"
                >
                  ➕ Aggiungi all'Ordine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
