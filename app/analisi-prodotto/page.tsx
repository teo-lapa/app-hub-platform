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

interface TopProduct {
  productName: string;
  totalRevenue: number;
  totalQuantity: number;
  marginPercent: number;
  orderCount: number;
  customerCount: number;
  uom: string;
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
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

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

  // Fetch top products when component mounts or dates change
  useEffect(() => {
    fetchTopProducts();
  }, [dateFrom, dateTo]);

  const fetchTopProducts = async () => {
    if (new Date(dateTo) < new Date(dateFrom)) {
      return;
    }

    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        limit: '20',
      });

      const response = await fetch(`/api/analisi-prodotto/top-products?${params}`);
      const data = await response.json();

      console.log('🔍 Top products API response:', data);

      if (response.ok && data.success) {
        const products = Array.isArray(data.products) ? data.products : [];
        console.log(`✅ Setting ${products.length} top products`);
        setTopProducts(products);
      } else {
        console.error('❌ API returned error:', data);
        setTopProducts([]);
        toast.error(data.error || 'Errore caricamento prodotti');
      }
    } catch (err) {
      console.error('❌ Error fetching top products:', err);
      setTopProducts([]);
      toast.error('Errore durante il caricamento dei prodotti');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleAnalyzeInternal = async (productNameOverride?: string) => {
    const productName = productNameOverride || selectedProduct?.name;

    if (!productName) {
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
        productName,
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

  const handleAnalyze = () => {
    handleAnalyzeInternal();
  };

  const handleBackToDashboard = () => {
    setAnalysisData(null);
    setError(null);
    setSelectedProduct(null);
    setSearchTerm('');
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              📊 Analisi Prodotti
            </h1>
            <p className="text-purple-200">
              Analisi dettagliata vendite, acquisti e margini per prodotto
            </p>
          </div>

          {/* Back Button - shown when analysis is present */}
          <AnimatePresence>
            {analysisData && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-lg border border-white/20 text-white font-medium transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
                Torna alla Dashboard
              </motion.button>
            )}
          </AnimatePresence>
        </div>
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
                <StatRow label="Totale Acquistato" value={`${analysisData.statistics.totalPurchased.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="Spesa Totale" value={`CHF ${analysisData.statistics.totalPurchaseCost.toFixed(2)}`} />
                <StatRow label="Numero Ordini" value={analysisData.purchaseOrders?.length || 0} />
                <StatRow label="Fornitori Unici" value={analysisData.topSuppliers?.length || 0} />
              </StatsCard>

              {/* Sales Stats */}
              <StatsCard title="Statistiche Vendite" icon={<Users className="w-5 h-5" />}>
                <StatRow label="Totale Venduto" value={`${analysisData.statistics.totalSold.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="Fatturato Totale" value={`CHF ${analysisData.statistics.totalRevenue.toFixed(2)}`} />
                <StatRow label="Numero Ordini" value={analysisData.saleOrders?.length || 0} />
                <StatRow label="Clienti Unici" value={analysisData.topCustomers?.length || 0} />
              </StatsCard>

              {/* Inventory Stats */}
              <StatsCard title="Magazzino" icon={<Warehouse className="w-5 h-5" />}>
                <StatRow label="Giacenza Attuale" value={`${analysisData.product.qtyAvailable.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="In Arrivo" value={`${analysisData.product.incomingQty.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="Giorni Copertura" value={`${analysisData.statistics.daysOfCoverage.toFixed(1)} giorni`} />
                <StatRow label="Media Vendita/Mese" value={`${analysisData.statistics.monthlyAvgSales.toFixed(2)} ${analysisData.product.uom}`} />

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
                <StatRow label="Punto Riordino" value={`${analysisData.reorderSuggestion.reorderPoint.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="Scorta Sicurezza" value={`${analysisData.reorderSuggestion.safetyStock.toFixed(2)} ${analysisData.product.uom}`} />
                <StatRow label="Qtà Ottimale" value={`${analysisData.reorderSuggestion.optimalOrderQty.toFixed(2)} ${analysisData.product.uom}`} />
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
                          {customer.qty.toFixed(2)} {analysisData.product.uom}
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
            {analysisData.topSuppliers && analysisData.topSuppliers.length > 0 && (
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
                            {supplier.orders} ordini • {supplier.qty.toFixed(2)} {analysisData.product.uom}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold">CHF {supplier.cost.toFixed(2)}</p>
                          <p className="text-purple-200 text-sm">
                            CHF {supplier.avgPrice.toFixed(2)}/{analysisData.product.uom}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analisi Intelligente */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30"
            >
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <TrendingUp className="w-7 h-7 text-purple-400" />
                Analisi Intelligente
              </h3>

              {(() => {
                const totalPurchased = analysisData.statistics.totalPurchased;
                const totalSold = analysisData.statistics.totalSold;
                const qtyAvailable = analysisData.product.qtyAvailable;
                const purchaseCost = analysisData.statistics.totalPurchaseCost;
                const revenue = analysisData.statistics.totalRevenue;

                // Calcola metriche
                const percentageSold = totalPurchased > 0 ? (totalSold / totalPurchased) * 100 : 0;
                const missingQty = totalPurchased - totalSold - qtyAvailable;
                const avgPurchasePrice = totalPurchased > 0 ? purchaseCost / totalPurchased : 0;
                const avgSalePrice = totalSold > 0 ? revenue / totalSold : 0;
                const theoreticalMargin = avgSalePrice > 0 ? ((avgSalePrice - avgPurchasePrice) / avgSalePrice) * 100 : 0;
                const actualMargin = revenue > 0 ? ((revenue - purchaseCost) / revenue) * 100 : 0;

                // Determina problemi
                const hasLowSalesRate = percentageSold < 50;
                const hasMissingStock = missingQty > (totalPurchased * 0.1); // >10% mancante
                const hasNegativeMargin = actualMargin < 0;
                const hasLowMargin = actualMargin < 15 && actualMargin >= 0;

                return (
                  <div className="space-y-6">
                    {/* Metriche Chiave */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* % Venduto */}
                      <div className={`bg-white/10 rounded-xl p-4 border-2 ${percentageSold < 30 ? 'border-red-500/50' : percentageSold < 70 ? 'border-yellow-500/50' : 'border-green-500/50'}`}>
                        <p className="text-purple-200 text-sm mb-1">Percentuale Venduta</p>
                        <p className={`text-3xl font-bold ${percentageSold < 30 ? 'text-red-400' : percentageSold < 70 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {percentageSold.toFixed(1)}%
                        </p>
                        <p className="text-purple-300 text-xs mt-1">
                          {totalSold.toFixed(2)} / {totalPurchased.toFixed(2)} {analysisData.product.uom}
                        </p>
                      </div>

                      {/* Giacenza */}
                      <div className="bg-white/10 rounded-xl p-4 border-2 border-blue-500/50">
                        <p className="text-purple-200 text-sm mb-1">In Magazzino</p>
                        <p className="text-3xl font-bold text-blue-400">
                          {qtyAvailable.toFixed(2)}
                        </p>
                        <p className="text-purple-300 text-xs mt-1">
                          {((qtyAvailable / totalPurchased) * 100).toFixed(1)}% del totale acquistato
                        </p>
                      </div>

                      {/* Mancante/Disperso */}
                      <div className={`bg-white/10 rounded-xl p-4 border-2 ${missingQty > 0 ? 'border-orange-500/50' : 'border-green-500/50'}`}>
                        <p className="text-purple-200 text-sm mb-1">Mancante/Disperso</p>
                        <p className={`text-3xl font-bold ${missingQty > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                          {missingQty.toFixed(2)}
                        </p>
                        <p className="text-purple-300 text-xs mt-1">
                          {missingQty > 0 ? `${((missingQty / totalPurchased) * 100).toFixed(1)}% perso` : 'Nessuna perdita'}
                        </p>
                      </div>

                      {/* Margine Teorico vs Reale */}
                      <div className={`bg-white/10 rounded-xl p-4 border-2 ${actualMargin < 0 ? 'border-red-500/50' : actualMargin < 15 ? 'border-yellow-500/50' : 'border-green-500/50'}`}>
                        <p className="text-purple-200 text-sm mb-1">Margine Teorico</p>
                        <p className="text-2xl font-bold text-green-400">
                          {theoreticalMargin.toFixed(1)}%
                        </p>
                        <p className={`text-sm mt-1 font-semibold ${actualMargin < 0 ? 'text-red-400' : actualMargin < 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                          Reale: {actualMargin.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Alert e Problemi */}
                    {(hasNegativeMargin || hasMissingStock || hasLowSalesRate || hasLowMargin) && (
                      <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-6">
                        <h4 className="text-red-400 font-bold text-lg mb-4 flex items-center gap-2">
                          <AlertCircle className="w-6 h-6" />
                          Problemi Identificati
                        </h4>
                        <div className="space-y-3">
                          {hasNegativeMargin && (
                            <div className="flex items-start gap-3 bg-red-500/20 p-4 rounded-lg">
                              <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-red-300 font-semibold">Margine Negativo ({actualMargin.toFixed(1)}%)</p>
                                <p className="text-red-200 text-sm mt-1">
                                  Stai perdendo CHF {Math.abs(revenue - purchaseCost).toFixed(2)}.
                                  Il margine teorico dovrebbe essere {theoreticalMargin.toFixed(1)}% ma è negativo a causa di perdite/scarti.
                                </p>
                              </div>
                            </div>
                          )}

                          {hasMissingStock && (
                            <div className="flex items-start gap-3 bg-orange-500/20 p-4 rounded-lg">
                              <Package className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-orange-300 font-semibold">Prodotto Mancante/Disperso ({missingQty.toFixed(2)} {analysisData.product.uom})</p>
                                <p className="text-orange-200 text-sm mt-1">
                                  Hai acquistato {totalPurchased.toFixed(2)} {analysisData.product.uom} ma ne hai venduto solo {totalSold.toFixed(2)} {analysisData.product.uom}
                                  e hai in magazzino {qtyAvailable.toFixed(2)} {analysisData.product.uom}.
                                  Mancano {missingQty.toFixed(2)} {analysisData.product.uom} ({((missingQty / totalPurchased) * 100).toFixed(1)}%).
                                </p>
                                <p className="text-orange-200 text-sm mt-2">
                                  <strong>Possibili cause:</strong> Scarti/scadenze, prodotto regalato/omaggiato, errori di inventario, furti/perdite.
                                </p>
                              </div>
                            </div>
                          )}

                          {hasLowSalesRate && !hasNegativeMargin && (
                            <div className="flex items-start gap-3 bg-yellow-500/20 p-4 rounded-lg">
                              <TrendingDown className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-yellow-300 font-semibold">Basso Tasso di Vendita ({percentageSold.toFixed(1)}%)</p>
                                <p className="text-yellow-200 text-sm mt-1">
                                  Hai venduto solo il {percentageSold.toFixed(1)}% di quello che hai acquistato.
                                  Hai ancora {qtyAvailable.toFixed(2)} {analysisData.product.uom} in magazzino.
                                </p>
                              </div>
                            </div>
                          )}

                          {hasLowMargin && !hasNegativeMargin && (
                            <div className="flex items-start gap-3 bg-yellow-500/20 p-4 rounded-lg">
                              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-yellow-300 font-semibold">Margine Basso ({actualMargin.toFixed(1)}%)</p>
                                <p className="text-yellow-200 text-sm mt-1">
                                  Il margine reale ({actualMargin.toFixed(1)}%) è inferiore alla soglia raccomandata del 15%.
                                  Il margine teorico su vendite dirette è {theoreticalMargin.toFixed(1)}%.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tutto OK */}
                    {!hasNegativeMargin && !hasMissingStock && !hasLowSalesRate && !hasLowMargin && (
                      <div className="bg-green-500/10 border-2 border-green-500/50 rounded-xl p-6">
                        <h4 className="text-green-400 font-bold text-lg mb-2 flex items-center gap-2">
                          <TrendingUp className="w-6 h-6" />
                          Prodotto Performante
                        </h4>
                        <p className="text-green-200">
                          Questo prodotto ha buone performance: margine positivo ({actualMargin.toFixed(1)}%),
                          vendite regolari ({percentageSold.toFixed(1)}% venduto), e perdite minime.
                        </p>
                      </div>
                    )}

                    {/* Breakdown Dettagliato */}
                    <div className="bg-white/5 rounded-xl p-5">
                      <h4 className="text-white font-semibold mb-4">Breakdown Dettagliato</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-purple-200">Prezzo Medio Acquisto</span>
                          <span className="text-white font-semibold">CHF {avgPurchasePrice.toFixed(2)}/{analysisData.product.uom}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-purple-200">Prezzo Medio Vendita</span>
                          <span className="text-white font-semibold">CHF {avgSalePrice.toFixed(2)}/{analysisData.product.uom}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-purple-200">Margine per Unità</span>
                          <span className={`font-semibold ${(avgSalePrice - avgPurchasePrice) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            CHF {(avgSalePrice - avgPurchasePrice).toFixed(2)}/{analysisData.product.uom}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-purple-200">Profitto Teorico Massimo</span>
                          <span className="text-green-400 font-semibold">
                            CHF {((avgSalePrice - avgPurchasePrice) * totalPurchased).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
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

      {/* Top Products Grid */}
      {!analysisData && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Top Prodotti per Fatturato
            </h2>
            <p className="text-purple-200 text-sm">
              {topProducts.length} prodotti trovati
            </p>
          </div>

          {/* Loading Skeleton */}
          {isLoadingProducts && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-6 bg-white/20 rounded w-3/4"></div>
                    <div className="w-10 h-10 bg-white/20 rounded-lg"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-8 bg-white/20 rounded w-1/2"></div>
                    <div className="h-6 bg-white/20 rounded w-1/3"></div>
                    <div className="h-4 bg-white/20 rounded w-2/3"></div>
                    <div className="h-4 bg-white/20 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {!isLoadingProducts && topProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topProducts.map((product, index) => (
                <ProductCard
                  key={index}
                  product={product}
                  onClick={() => handleAnalyzeInternal(product.productName)}
                />
              ))}
            </div>
          )}

          {/* Empty State - No Products Found */}
          {!isLoadingProducts && topProducts.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <Package className="w-20 h-20 text-purple-300/50 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">
                Nessun prodotto trovato
              </h3>
              <p className="text-purple-200">
                Prova a modificare il periodo selezionato
              </p>
            </motion.div>
          )}
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

// Product Card Component
function ProductCard({ product, onClick }: { product: TopProduct; onClick: () => void }) {
  // Validate product data
  if (!product || typeof product !== 'object') {
    console.error('Invalid product data:', product);
    return null;
  }

  const margin = product.marginPercent ?? 0;
  const revenue = product.totalRevenue ?? 0;
  const quantity = product.totalQuantity ?? 0;
  const orders = product.orderCount ?? 0;
  const customers = product.customerCount ?? 0;
  const productName = product.productName || 'Prodotto senza nome';
  const uom = product.uom || 'Pz';

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'green';
    if (margin >= 15) return 'yellow';
    return 'red';
  };

  const getMarginBadgeClasses = (margin: number) => {
    if (margin >= 30) return 'bg-green-500/20 text-green-300 border-green-500/50';
    if (margin >= 15) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
    return 'bg-red-500/20 text-red-300 border-red-500/50';
  };

  const getIconColorClasses = (margin: number) => {
    if (margin >= 30) return 'text-green-400 bg-green-500/20';
    if (margin >= 15) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getBorderColorClasses = (margin: number) => {
    if (margin >= 30) return 'border-green-500/30 hover:border-green-500/60';
    if (margin >= 15) return 'border-yellow-500/30 hover:border-yellow-500/60';
    return 'border-red-500/30 hover:border-red-500/60';
  };

  const truncateName = (name: string, maxLength: number = 50) => {
    if (!name || name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-xl p-6 border ${getBorderColorClasses(margin)} cursor-pointer transition-all shadow-lg hover:shadow-2xl`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-white font-semibold text-lg leading-tight flex-1 pr-2" title={productName}>
          {truncateName(productName)}
        </h3>
        <div className={`p-2.5 rounded-lg ${getIconColorClasses(margin)}`}>
          <Package className="w-5 h-5" />
        </div>
      </div>

      {/* Revenue - Big and Green */}
      <div className="mb-4">
        <p className="text-green-400 text-3xl font-bold mb-1">
          CHF {revenue.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-purple-200 text-xs">Fatturato Totale</p>
      </div>

      {/* Margin Badge */}
      <div className="mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${getMarginBadgeClasses(margin)}`}>
          {margin >= 30 && <TrendingUp className="w-4 h-4" />}
          {margin < 15 && <TrendingDown className="w-4 h-4" />}
          Margine: {margin.toFixed(1)}%
        </span>
      </div>

      {/* Quantity */}
      <div className="mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-purple-300" />
        <span className="text-white font-medium">
          {quantity.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {uom}
        </span>
      </div>

      {/* Orders and Customers */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-1.5 text-purple-200 text-sm">
          <ShoppingCart className="w-4 h-4" />
          <span>{orders} ordini</span>
        </div>
        <div className="flex items-center gap-1.5 text-purple-200 text-sm">
          <Users className="w-4 h-4" />
          <span>{customers} clienti</span>
        </div>
      </div>
    </motion.div>
  );
}
