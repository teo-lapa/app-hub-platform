'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Download,
  DollarSign,
  Users,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface ProductSearchResult {
  id: number;
  name: string;
  default_code?: string;
  barcode?: string;
}

interface AnalysisData {
  product: any;
  suppliers: any[];
  purchaseOrders: any[];
  saleOrders: any[];
  statistics: {
    totalPurchased: number;
    totalSold: number;
    totalRevenue: number;
    totalPurchaseCost: number;
    profit: number;
    marginPercent: number;
    roi: number;
    monthlyAvgSales: number;
    weeklyAvgSales: number;
    daysOfCoverage: number;
  };
  topSuppliers: any[];
  topCustomers: any[];
  reorderSuggestion: {
    reorderPoint: number;
    safetyStock: number;
    optimalOrderQty: number;
    currentStock: number;
    actionRequired: boolean;
    actionMessage: string;
    leadTime: number;
  };
  period: {
    dateFrom: string;
    dateTo: string;
  };
}

export default function AnalisiProdottoPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced search with Odoo API
  useEffect(() => {
    if (searchTerm.length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Call Odoo product search API
        const response = await fetch(
          `/api/maestro/products/search?q=${encodeURIComponent(searchTerm)}&limit=20`
        );

        if (!response.ok) {
          throw new Error('Errore nella ricerca prodotti');
        }

        const data = await response.json();

        if (data.success && data.products) {
          // Map Odoo products to our format
          const products: ProductSearchResult[] = data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            default_code: p.code || p.default_code,
            barcode: p.barcode
          }));
          setSearchResults(products);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Search error:', err);
        toast.error('Errore durante la ricerca prodotti');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAnalyze = async () => {
    if (!selectedProduct) {
      toast.error('Seleziona un prodotto');
      return;
    }

    if (new Date(dateTo) < new Date(dateFrom)) {
      toast.error('Data fine deve essere >= data inizio');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        productName: selectedProduct.name,
        dateFrom,
        dateTo,
      });

      const response = await fetch(`/api/analisi-prodotto?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'analisi');
      }

      setAnalysisData(data);
      toast.success('Analisi completata!');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          📊 Analisi Prodotti
        </h1>
        <p className="text-purple-200">
          Analisi dettagliata vendite, acquisti e margini per prodotto
        </p>
      </motion.div>

      {/* Search Form - Sticky */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-4 z-40 mb-8"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Product Search */}
            <div className="lg:col-span-5 relative">
              <label className="block text-sm font-medium text-purple-200 mb-2">
                <Search className="inline w-4 h-4 mr-1" />
                Cerca Prodotto
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca per nome prodotto..."
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-lg shadow-xl border border-purple-300/30 max-h-60 overflow-y-auto z-50"
                  >
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setSelectedProduct(product);
                          setSearchTerm(product.name);
                          setSearchResults([]);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-purple-500/20 transition-colors border-b border-slate-700 last:border-0"
                      >
                        <div className="text-white font-medium">{product.name}</div>
                        {product.barcode && (
                          <div className="text-purple-300 text-sm mt-1">
                            Barcode: {product.barcode}
                          </div>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date From */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-purple-200 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Data Inizio
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Date To */}
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-purple-200 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Data Fine
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Analyze Button */}
            <div className="lg:col-span-1 flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={!selectedProduct || isAnalyzing}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analisi...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Analizza
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Analysis Results */}
      <AnimatePresence>
        {analysisData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Fatturato Totale"
                value={`CHF ${analysisData.statistics.totalRevenue.toFixed(2)}`}
                icon={<DollarSign className="w-6 h-6" />}
                gradient="from-green-500 to-emerald-600"
              />
              <KPICard
                title="Costi Totali"
                value={`CHF ${analysisData.statistics.totalPurchaseCost.toFixed(2)}`}
                icon={<ShoppingCart className="w-6 h-6" />}
                gradient="from-red-500 to-rose-600"
              />
              <KPICard
                title="Profitto Netto"
                value={`CHF ${analysisData.statistics.profit.toFixed(2)}`}
                icon={<TrendingUp className="w-6 h-6" />}
                gradient="from-blue-500 to-cyan-600"
              />
              <KPICard
                title="Margine"
                value={`${analysisData.statistics.marginPercent.toFixed(1)}%`}
                icon={<Package className="w-6 h-6" />}
                gradient="from-purple-500 to-pink-600"
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Purchase Stats */}
              <StatsCard title="Statistiche Acquisti" icon={<ShoppingCart className="w-5 h-5" />}>
                <StatRow label="Totale Acquistato" value={`${analysisData.statistics.totalPurchased} ${analysisData.product.uom[1]}`} />
                <StatRow label="Spesa Totale" value={`CHF ${analysisData.statistics.totalPurchaseCost.toFixed(2)}`} />
                <StatRow label="Numero Ordini" value={analysisData.purchaseOrders.length} />
                <StatRow label="Fornitori Unici" value={analysisData.topSuppliers.length} />
              </StatsCard>

              {/* Sales Stats */}
              <StatsCard title="Statistiche Vendite" icon={<Users className="w-5 h-5" />}>
                <StatRow label="Totale Venduto" value={`${analysisData.statistics.totalSold} ${analysisData.product.uom[1]}`} />
                <StatRow label="Fatturato Totale" value={`CHF ${analysisData.statistics.totalRevenue.toFixed(2)}`} />
                <StatRow label="Numero Ordini" value={analysisData.saleOrders.length} />
                <StatRow label="Clienti Unici" value={analysisData.topCustomers.length} />
              </StatsCard>

              {/* Inventory Stats */}
              <StatsCard title="Magazzino" icon={<Warehouse className="w-5 h-5" />}>
                <StatRow label="Giacenza Attuale" value={`${analysisData.product.qtyAvailable} ${analysisData.product.uom[1]}`} />
                <StatRow label="In Arrivo" value={`${analysisData.product.incomingQty} ${analysisData.product.uom[1]}`} />
                <StatRow label="Giorni Copertura" value={`${analysisData.statistics.daysOfCoverage.toFixed(1)} giorni`} />
                <StatRow label="Media Vendita/Mese" value={`${analysisData.statistics.monthlyAvgSales.toFixed(0)} ${analysisData.product.uom[1]}`} />

                {/* Stock Locations */}
                {analysisData.product.locations && analysisData.product.locations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-purple-200 font-semibold mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Ubicazioni
                    </h4>
                    <div className="space-y-2">
                      {analysisData.product.locations.map((loc: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg">
                          <span className="text-white font-medium text-sm">{loc.location}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-green-400 font-semibold">{loc.available.toFixed(1)}</span>
                            {loc.reserved > 0 && (
                              <span className="text-yellow-400 text-xs">
                                ({loc.reserved.toFixed(1)} ris.)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </StatsCard>

              {/* Reorder Suggestion */}
              <StatsCard
                title="Suggerimenti Riordino"
                icon={<AlertCircle className="w-5 h-5" />}
                highlight={analysisData.reorderSuggestion.actionRequired}
              >
                <StatRow label="Punto Riordino" value={`${analysisData.reorderSuggestion.reorderPoint.toFixed(0)} ${analysisData.product.uom[1]}`} />
                <StatRow label="Scorta Sicurezza" value={`${analysisData.reorderSuggestion.safetyStock.toFixed(0)} ${analysisData.product.uom[1]}`} />
                <StatRow label="Qtà Ottimale" value={`${analysisData.reorderSuggestion.optimalOrderQty.toFixed(0)} ${analysisData.product.uom[1]}`} />
                {analysisData.reorderSuggestion.actionRequired && (
                  <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <p className="text-red-200 text-sm font-semibold">
                      🚨 {analysisData.reorderSuggestion.actionMessage}
                    </p>
                  </div>
                )}
              </StatsCard>
            </div>

            {/* Top Customers */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" />
                Top 10 Clienti
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-300/30">
                      <th className="text-left py-3 px-4 text-purple-200 font-medium">#</th>
                      <th className="text-left py-3 px-4 text-purple-200 font-medium">Cliente</th>
                      <th className="text-right py-3 px-4 text-purple-200 font-medium">Quantità</th>
                      <th className="text-right py-3 px-4 text-purple-200 font-medium">Fatturato</th>
                      <th className="text-right py-3 px-4 text-purple-200 font-medium">Ordini</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.topCustomers.slice(0, 10).map((customer, index) => (
                      <tr key={index} className="border-b border-slate-700/50 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-purple-300">{index + 1}</td>
                        <td className="py-3 px-4 text-white font-medium">{customer.customerName}</td>
                        <td className="py-3 px-4 text-right text-purple-200">
                          {customer.qty.toFixed(0)} {analysisData.product.uom[1]}
                        </td>
                        <td className="py-3 px-4 text-right text-green-400 font-semibold">
                          CHF {customer.revenue.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-200">{customer.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Suppliers */}
            {analysisData.topSuppliers.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-6 h-6" />
                  Fornitori
                </h3>
                <div className="space-y-3">
                  {analysisData.topSuppliers.map((supplier, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg border border-purple-300/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-white font-semibold">{supplier.supplierName}</h4>
                          <p className="text-purple-200 text-sm mt-1">
                            {supplier.orders} ordini • {supplier.qty.toFixed(0)} {analysisData.product.uom[1]}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">CHF {supplier.cost.toFixed(2)}</p>
                          <p className="text-purple-200 text-sm">
                            CHF {supplier.avgPrice.toFixed(2)}/{analysisData.product.uom[1]}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 text-center"
        >
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-200 font-semibold">{error}</p>
        </motion.div>
      )}

      {/* Empty State */}
      {!analysisData && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Package className="w-20 h-20 text-purple-300/50 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            Seleziona un prodotto per iniziare
          </h3>
          <p className="text-purple-200">
            Cerca un prodotto e scegli il periodo per visualizzare l'analisi dettagliata
          </p>
        </motion.div>
      )}
    </div>
  );
}

// KPI Card Component
function KPICard({ title, value, icon, gradient }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 shadow-lg`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-white/80">{icon}</div>
      </div>
      <h3 className="text-white/80 text-sm font-medium mb-1">{title}</h3>
      <p className="text-white text-3xl font-bold">{value}</p>
    </motion.div>
  );
}

// Stats Card Component
function StatsCard({ title, icon, children, highlight = false }: any) {
  return (
    <div className={`bg-white/10 backdrop-blur-lg rounded-2xl p-6 border ${highlight ? 'border-red-500/50' : 'border-white/20'}`}>
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

// Stat Row Component
function StatRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
      <span className="text-purple-200">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}
