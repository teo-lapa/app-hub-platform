'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Package, TrendingUp, TrendingDown } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'supplier'>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  // Get unique suppliers for dropdown
  const suppliers = Array.from(
    new Map(products.map(p => [p.supplier_id, { id: p.supplier_id, name: p.supplier_name }])).values()
  ).filter(s => s.id > 0).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    loadProducts();
  }, []);

  // Auto-select supplier from URL params
  useEffect(() => {
    const supplierIdParam = searchParams.get('supplier_id');
    if (supplierIdParam && products.length > 0) {
      const supplierId = parseInt(supplierIdParam);
      setFilterMode('supplier');
      setSelectedSupplierId(supplierId);
    }
  }, [searchParams, products]);

  async function loadProducts() {
    try {
      setLoading(true);

      // Build API URL with supplier filter if present
      const supplierIdParam = searchParams.get('supplier_id');
      const apiUrl = supplierIdParam
        ? `/api/products-catalog?supplier_id=${supplierIdParam}`
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
                onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800 [&>option]:text-white"
              >
                <option value="">-- Scegli un fornitore --</option>
                {suppliers.map(supplier => (
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
                • <span className="text-blue-300">{suppliers.find(s => s.id === selectedSupplierId)?.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden hover:border-white/30 transition-all"
            >
              {/* Product Image */}
              <div className="relative h-48 bg-white/10">
                {product.image_url ? (
                  <img
                    src={`data:image/jpeg;base64,${product.image_url}`}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-white/20" />
                  </div>
                )}
                {/* Stock Badge */}
                <div className={`absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-bold ${
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
              <div className="p-4">
                <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2 h-10">
                  {product.name}
                </h3>

                <div className="text-xs text-white/60 mb-3">
                  {product.supplier_name}
                </div>

                {/* Sales Stats */}
                <div className="space-y-2 text-xs">
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
                  className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all font-semibold text-sm"
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
    </div>
  );
}
