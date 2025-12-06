'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Search, Package, ArrowLeft, Calendar, RefreshCw,
  Truck, Users, ShoppingCart, AlertTriangle, TrendingUp,
  Clock, MapPin, DollarSign, Percent, Gift, Scale,
  ChevronDown, ChevronUp, ExternalLink, Box, Eye, Fingerprint,
  ArrowDownCircle, ArrowUpCircle, RotateCcw, Trash2, Shuffle, HelpCircle, User
} from 'lucide-react';

// Types
interface Product {
  id: number;
  name: string;
  code: string | null;
  barcode: string | null;
  category: string | null;
  stock: number;
  price: number;
  image: string | null;
}

interface ProductStoryData {
  product: {
    id: number;
    name: string;
    code: string | null;
    barcode: string | null;
    category: string | null;
    image: string | null;
    prices: { list: number; cost: number };
    stock: { available: number; virtual: number; incoming: number; outgoing: number };
  };
  suppliers: {
    list: Array<{
      supplierId: number;
      supplierName: string;
      totalQty: number;
      totalReceived: number;
      totalValue: number;
      avgPrice: number;
      lastPurchase: string;
      orders: Array<{ orderName: string; date: string; qty: number; received: number; price: number; state: string }>;
    }>;
    info: Array<{ id: number; supplierId: number; supplierName: string; price: number; minQty: number; leadTime: number }>;
    totals: { totalQty: number; totalValue: number; supplierCount: number };
  };
  sales: {
    customers: Array<{
      customerId: number;
      customerName: string;
      totalQty: number;
      totalDelivered: number;
      totalRevenue: number;
      totalMargin: number;
      avgPrice: number;
      avgMarginPercent: number;
      lastSale: string;
      orders: Array<{ orderName: string; date: string; qty: number; delivered: number; price: number; discount: number; margin: number; state: string }>;
    }>;
    totals: { totalQty: number; totalRevenue: number; customerCount: number };
  };
  gifts: {
    list: Array<{ orderName: string; customerName: string; date: string; qty: number; value: number }>;
    totalQty: number;
    totalValue: number;
  };
  inventory: {
    currentStock: number;
    theoreticalStock: number;
    discrepancy: number;
    discrepancyPercent: number;
    breakdown: { purchased: number; sold: number; gifts: number; scrapped: number; adjustments: number };
    locations: Array<{ location: string; quantity: number; reserved: number; lot: string | null }>;
    scraps: Array<{ date: string; qty: number; origin: string | null }>;
  };
  movements: Array<{
    id: number;
    date: string;
    quantity: number;
    type: 'in' | 'out' | 'internal' | 'adjustment';
    from: string;
    to: string;
    origin: string | null;
    picking: string | null;
  }>;
  profitability: {
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercent: number;
    marginPerUnit: number;
  };
  lots: Array<{
    name: string;
    qty: number;
    expirationDate: string | null;
    isExpired: boolean;
    isExpiringSoon: boolean;
  }>;
}

// Detective Mode Types
interface DetectiveData {
  product: {
    id: number;
    name: string;
    currentStock: number;
    virtualStock: number;
    incoming: number;
    outgoing: number;
  };
  summary: {
    totalMovements: number;
    entries: {
      total: number;
      purchases: number;
      adjustments: number;
      customerReturns: number;
      unknown: number;
    };
    exits: {
      total: number;
      sales: number;
      gifts: number;
      adjustments: number;
      supplierReturns: number;
      scraps: number;
      unknown: number;
    };
    internal: number;
    theoreticalStock: number;
    realStock: number;
    discrepancy: number;
    docsComparison: {
      purchasedFromDocs: number;
      purchasedFromMoves: number;
      soldFromDocs: number;
      soldFromMoves: number;
      giftsFromDocs: number;
      giftsFromMoves: number;
    };
  };
  findings: Array<{
    severity: 'info' | 'warning' | 'error';
    message: string;
    details?: string;
  }>;
  recentAdjustments: Array<{
    type: string;
    date: string;
    quantity: number;
    direction: string;
    description: string;
    reference: string | null;
    from: string;
    to: string;
    user: string | null;
    impact: number;
  }>;
  timeline: Array<{
    type: string;
    date: string;
    quantity: number;
    direction: string;
    description: string;
    reference: string | null;
    from: string;
    to: string;
    user: string | null;
    impact: number;
  }>;
}

// Period options
const PERIOD_OPTIONS = [
  { value: 'all', label: 'Tutto' },
  { value: '1y', label: 'Ultimo anno' },
  { value: '6m', label: '6 mesi' },
  { value: '3m', label: '3 mesi' },
  { value: '1m', label: '1 mese' },
];

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(value);
};

// Helper function to format date
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('it-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Calculate date range from period
const getDateRange = (period: string) => {
  const now = new Date();
  let dateFrom: string | null = null;

  switch (period) {
    case '1m':
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '3m':
      dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '6m':
      dateFrom = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '1y':
      dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
  }

  return { dateFrom, dateTo: now.toISOString().split('T')[0] };
};

export default function ProductStoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productData, setProductData] = useState<ProductStoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [period, setPeriod] = useState('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['inventory']));

  // Detective Mode state
  const [detectiveMode, setDetectiveMode] = useState(false);
  const [detectiveData, setDetectiveData] = useState<DetectiveData | null>(null);
  const [isLoadingDetective, setIsLoadingDetective] = useState(false);

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/super-dashboard/product-story/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.products);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchProducts(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  // Load product story
  const loadProductStory = useCallback(async (productId: number) => {
    setIsLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRange(period);
      const params = new URLSearchParams({ productId: productId.toString() });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/super-dashboard/product-story?${params}`);
      const data = await res.json();
      if (data.success) {
        setProductData(data);
      }
    } catch (error) {
      console.error('Load product story error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Reload when period changes
  useEffect(() => {
    if (selectedProduct) {
      loadProductStory(selectedProduct.id);
    }
  }, [period, selectedProduct, loadProductStory]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowResults(false);
    setSearchQuery(product.name);
    loadProductStory(product.id);
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Load Detective Mode data
  const loadDetectiveData = useCallback(async (productId: number) => {
    setIsLoadingDetective(true);
    try {
      const res = await fetch(`/api/super-dashboard/product-story/detective?productId=${productId}`);
      const data = await res.json();
      if (data.success) {
        setDetectiveData(data);
      }
    } catch (error) {
      console.error('Detective mode error:', error);
    } finally {
      setIsLoadingDetective(false);
    }
  }, []);

  // Toggle Detective Mode
  const toggleDetectiveMode = () => {
    if (!detectiveMode && selectedProduct && !detectiveData) {
      loadDetectiveData(selectedProduct.id);
    }
    setDetectiveMode(!detectiveMode);
    if (!detectiveMode) {
      setExpandedSections(new Set(['detective']));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/super-dashboard"
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <Package className="w-6 h-6 text-violet-400" />
                <h1 className="text-xl font-bold text-white">Product Story</h1>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca prodotto per nome, codice, barcode o fornitore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-lg"
              />
              {isSearching && (
                <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto"
                >
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-0"
                    >
                      <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                        {product.image ? (
                          <img src={`data:image/png;base64,${product.image}`} alt="" className="w-10 h-10 object-contain" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-white font-medium truncate">{product.name}</div>
                        <div className="flex items-center gap-3 text-sm text-slate-400">
                          {product.code && <span>Cod: {product.code}</span>}
                          {product.barcode && <span>BC: {product.barcode}</span>}
                          <span className={product.stock > 0 ? 'text-green-400' : 'text-red-400'}>
                            Stock: {product.stock}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-slate-400 text-sm">
                        {formatCurrency(product.price)}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {/* No Product Selected */}
        {!selectedProduct && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl text-slate-400 mb-2">Cerca un prodotto</h2>
            <p className="text-slate-500">Inserisci il nome, codice, barcode o fornitore per vedere la storia completa</p>
          </motion.div>
        )}

        {/* Product Data */}
        {productData && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Product Header */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  {productData.product.image ? (
                    <img src={`data:image/png;base64,${productData.product.image}`} alt="" className="w-20 h-20 object-contain" />
                  ) : (
                    <Package className="w-12 h-12 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">{productData.product.name}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                    {productData.product.code && (
                      <span className="flex items-center gap-1">
                        <Box className="w-4 h-4" /> Codice: {productData.product.code}
                      </span>
                    )}
                    {productData.product.barcode && (
                      <span className="flex items-center gap-1">
                        <span className="font-mono">|||</span> Barcode: {productData.product.barcode}
                      </span>
                    )}
                    {productData.product.category && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {productData.product.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Prezzo Listino</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(productData.product.prices.list)}</div>
                  <div className="text-sm text-slate-500">Costo: {formatCurrency(productData.product.prices.cost)}</div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700/50">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">{productData.product.stock.available}</div>
                  <div className="text-sm text-slate-400">Giacenza</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{productData.product.stock.incoming}</div>
                  <div className="text-sm text-slate-400">In Arrivo</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-400">{productData.product.stock.outgoing}</div>
                  <div className="text-sm text-slate-400">In Uscita</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-violet-400">{productData.product.stock.virtual}</div>
                  <div className="text-sm text-slate-400">Virtuale</div>
                </div>
              </div>

              {/* Detective Mode Button */}
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <button
                  onClick={toggleDetectiveMode}
                  className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
                    detectiveMode
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Fingerprint className="w-6 h-6" />
                  <span className="text-lg">
                    {detectiveMode ? 'Detective Mode ATTIVO' : 'Attiva Detective Mode'}
                  </span>
                  <span className="text-sm opacity-75">
                    - Analisi approfondita movimenti
                  </span>
                </button>
              </div>
            </div>

            {/* Detective Mode Section */}
            {detectiveMode && (
              <SectionCard
                title="Detective Mode - Analisi Completa"
                icon={<Fingerprint className="w-5 h-5" />}
                gradient="from-amber-500 to-orange-500"
                expanded={expandedSections.has('detective')}
                onToggle={() => toggleSection('detective')}
              >
                {isLoadingDetective ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
                    <span className="ml-3 text-slate-400">Analizzando tutti i movimenti...</span>
                  </div>
                ) : detectiveData ? (
                  <DetectiveModeSection data={detectiveData} />
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    Impossibile caricare i dati del Detective Mode
                  </div>
                )}
              </SectionCard>
            )}

            {/* Inventory Check - Most Important! */}
            <SectionCard
              title="Verifica Giacenza"
              icon={<Scale className="w-5 h-5" />}
              gradient="from-red-500 to-orange-500"
              expanded={expandedSections.has('inventory')}
              onToggle={() => toggleSection('inventory')}
            >
              <InventoryCheckSection data={productData.inventory} />
            </SectionCard>

            {/* Suppliers Section */}
            <SectionCard
              title="Fornitori & Acquisti"
              icon={<Truck className="w-5 h-5" />}
              gradient="from-blue-500 to-cyan-500"
              badge={`${productData.suppliers.totals.supplierCount} fornitori`}
              expanded={expandedSections.has('suppliers')}
              onToggle={() => toggleSection('suppliers')}
            >
              <SuppliersSection data={productData.suppliers} />
            </SectionCard>

            {/* Sales Section */}
            <SectionCard
              title="Vendite & Clienti"
              icon={<Users className="w-5 h-5" />}
              gradient="from-green-500 to-emerald-500"
              badge={`${productData.sales.totals.customerCount} clienti`}
              expanded={expandedSections.has('sales')}
              onToggle={() => toggleSection('sales')}
            >
              <SalesSection data={productData.sales} />
            </SectionCard>

            {/* Gifts Section */}
            {productData.gifts.totalQty > 0 && (
              <SectionCard
                title="Omaggi"
                icon={<Gift className="w-5 h-5" />}
                gradient="from-pink-500 to-rose-500"
                badge={`${productData.gifts.totalQty} unita`}
                expanded={expandedSections.has('gifts')}
                onToggle={() => toggleSection('gifts')}
              >
                <GiftsSection data={productData.gifts} />
              </SectionCard>
            )}

            {/* Profitability Section */}
            <SectionCard
              title="Profittabilita"
              icon={<DollarSign className="w-5 h-5" />}
              gradient="from-yellow-500 to-amber-500"
              expanded={expandedSections.has('profitability')}
              onToggle={() => toggleSection('profitability')}
            >
              <ProfitabilitySection data={productData.profitability} />
            </SectionCard>

            {/* Movements Section */}
            <SectionCard
              title="Movimenti Magazzino"
              icon={<Clock className="w-5 h-5" />}
              gradient="from-slate-500 to-slate-600"
              badge={`${productData.movements.length} movimenti`}
              expanded={expandedSections.has('movements')}
              onToggle={() => toggleSection('movements')}
            >
              <MovementsSection data={productData.movements} />
            </SectionCard>

            {/* Lots Section */}
            {productData.lots.length > 0 && (
              <SectionCard
                title="Lotti & Scadenze"
                icon={<Calendar className="w-5 h-5" />}
                gradient="from-purple-500 to-indigo-500"
                badge={`${productData.lots.length} lotti`}
                expanded={expandedSections.has('lots')}
                onToggle={() => toggleSection('lots')}
              >
                <LotsSection data={productData.lots} />
              </SectionCard>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

// Section Card Component
function SectionCard({
  title,
  icon,
  gradient,
  badge,
  expanded,
  onToggle,
  children
}: {
  title: string;
  icon: React.ReactNode;
  gradient: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`bg-gradient-to-br ${gradient} p-2 rounded-lg text-white`}>
            {icon}
          </div>
          <span className="text-lg font-semibold text-white">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-6 pt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Inventory Check Section
function InventoryCheckSection({ data }: { data: ProductStoryData['inventory'] }) {
  const discrepancyStatus = Math.abs(data.discrepancy) === 0 ? 'ok' :
    Math.abs(data.discrepancyPercent) < 5 ? 'warning' : 'error';

  const statusColors = {
    ok: 'bg-green-500/20 border-green-500 text-green-400',
    warning: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    error: 'bg-red-500/20 border-red-500 text-red-400'
  };

  return (
    <div className="space-y-6">
      {/* Discrepancy Alert */}
      <div className={`p-4 rounded-lg border-2 ${statusColors[discrepancyStatus]}`}>
        <div className="flex items-center gap-3 mb-2">
          {discrepancyStatus === 'ok' ? (
            <TrendingUp className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
          <span className="text-lg font-bold">
            {discrepancyStatus === 'ok' ? 'Giacenza OK' :
              discrepancyStatus === 'warning' ? 'Piccola Discrepanza' : 'Discrepanza Rilevata!'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <div className="text-sm opacity-80">Giacenza Teorica</div>
            <div className="text-2xl font-bold">{data.theoreticalStock.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Giacenza Reale</div>
            <div className="text-2xl font-bold">{data.currentStock}</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Discrepanza</div>
            <div className="text-2xl font-bold">
              {data.discrepancy > 0 ? '+' : ''}{data.discrepancy.toFixed(1)}
              <span className="text-sm ml-1">({data.discrepancyPercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-green-400 text-2xl font-bold">+{data.breakdown.purchased}</div>
          <div className="text-sm text-slate-400">Acquistati</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-red-400 text-2xl font-bold">-{data.breakdown.sold}</div>
          <div className="text-sm text-slate-400">Venduti</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-pink-400 text-2xl font-bold">-{data.breakdown.gifts}</div>
          <div className="text-sm text-slate-400">Omaggi</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-orange-400 text-2xl font-bold">-{data.breakdown.scrapped}</div>
          <div className="text-sm text-slate-400">Scarti</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${data.breakdown.adjustments >= 0 ? 'text-blue-400' : 'text-purple-400'}`}>
            {data.breakdown.adjustments >= 0 ? '+' : ''}{data.breakdown.adjustments.toFixed(1)}
          </div>
          <div className="text-sm text-slate-400">Rettifiche</div>
        </div>
      </div>

      {/* Locations */}
      {data.locations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Ubicazioni</h4>
          <div className="grid gap-2">
            {data.locations.map((loc, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-700/20 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">{loc.location}</span>
                  {loc.lot && <span className="text-xs bg-slate-600 px-2 py-0.5 rounded">Lotto: {loc.lot}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-semibold">{loc.quantity}</span>
                  {loc.reserved > 0 && (
                    <span className="text-orange-400 text-sm">({loc.reserved} riservati)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Suppliers Section
function SuppliersSection({ data }: { data: ProductStoryData['suppliers'] }) {
  const [expandedSupplier, setExpandedSupplier] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{data.totals.totalQty}</div>
          <div className="text-sm text-slate-400">Totale Acquistato</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-cyan-400">{formatCurrency(data.totals.totalValue)}</div>
          <div className="text-sm text-slate-400">Valore Totale</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{data.totals.supplierCount}</div>
          <div className="text-sm text-slate-400">Fornitori</div>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="space-y-2">
        {data.list.map((supplier) => (
          <div key={supplier.supplierId} className="bg-slate-700/20 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedSupplier(expandedSupplier === supplier.supplierId ? null : supplier.supplierId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
            >
              <div>
                <div className="text-white font-medium">{supplier.supplierName}</div>
                <div className="text-sm text-slate-400">
                  Ultimo: {formatDate(supplier.lastPurchase)} | Media: {formatCurrency(supplier.avgPrice)}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white font-semibold">{supplier.totalReceived} unita</div>
                  <div className="text-sm text-slate-400">{formatCurrency(supplier.totalValue)}</div>
                </div>
                {expandedSupplier === supplier.supplierId ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {expandedSupplier === supplier.supplierId && (
              <div className="px-4 pb-4 border-t border-slate-700/50">
                <table className="w-full mt-3 text-sm">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left py-2">Ordine</th>
                      <th className="text-left py-2">Data</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Ricevuti</th>
                      <th className="text-right py-2">Prezzo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.orders.slice(0, 10).map((order, i) => (
                      <tr key={i} className="border-t border-slate-700/30">
                        <td className="py-2 text-slate-300">{order.orderName}</td>
                        <td className="py-2 text-slate-400">{formatDate(order.date)}</td>
                        <td className="py-2 text-right text-slate-300">{order.qty}</td>
                        <td className="py-2 text-right text-green-400">{order.received}</td>
                        <td className="py-2 text-right text-slate-300">{formatCurrency(order.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Sales Section
function SalesSection({ data }: { data: ProductStoryData['sales'] }) {
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{data.totals.totalQty}</div>
          <div className="text-sm text-slate-400">Totale Venduto</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{formatCurrency(data.totals.totalRevenue)}</div>
          <div className="text-sm text-slate-400">Fatturato</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-white">{data.totals.customerCount}</div>
          <div className="text-sm text-slate-400">Clienti</div>
        </div>
      </div>

      {/* Customers List */}
      <div className="space-y-2">
        {data.customers.slice(0, 20).map((customer) => (
          <div key={customer.customerId} className="bg-slate-700/20 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedCustomer(expandedCustomer === customer.customerId ? null : customer.customerId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
            >
              <div>
                <div className="text-white font-medium">{customer.customerName}</div>
                <div className="text-sm text-slate-400">
                  Ultimo: {formatDate(customer.lastSale)} | Margine: {customer.avgMarginPercent.toFixed(1)}%
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-white font-semibold">{customer.totalDelivered} unita</div>
                  <div className="text-sm text-green-400">{formatCurrency(customer.totalRevenue)}</div>
                </div>
                {expandedCustomer === customer.customerId ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {expandedCustomer === customer.customerId && (
              <div className="px-4 pb-4 border-t border-slate-700/50">
                <table className="w-full mt-3 text-sm">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left py-2">Ordine</th>
                      <th className="text-left py-2">Data</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Prezzo</th>
                      <th className="text-right py-2">Sconto</th>
                      <th className="text-right py-2">Margine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.slice(0, 10).map((order, i) => (
                      <tr key={i} className="border-t border-slate-700/30">
                        <td className="py-2 text-slate-300">{order.orderName}</td>
                        <td className="py-2 text-slate-400">{formatDate(order.date)}</td>
                        <td className="py-2 text-right text-slate-300">{order.delivered}</td>
                        <td className="py-2 text-right text-slate-300">{formatCurrency(order.price)}</td>
                        <td className="py-2 text-right text-orange-400">{order.discount}%</td>
                        <td className="py-2 text-right text-green-400">{formatCurrency(order.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Gifts Section
function GiftsSection({ data }: { data: ProductStoryData['gifts'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-pink-500/10 rounded-lg p-4 text-center border border-pink-500/30">
          <div className="text-2xl font-bold text-pink-400">{data.totalQty}</div>
          <div className="text-sm text-slate-400">Unita Omaggiate</div>
        </div>
        <div className="bg-pink-500/10 rounded-lg p-4 text-center border border-pink-500/30">
          <div className="text-2xl font-bold text-pink-400">{formatCurrency(data.totalValue)}</div>
          <div className="text-sm text-slate-400">Valore Omaggi</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.list.map((gift, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-700/20 rounded-lg px-4 py-3">
            <div>
              <div className="text-white">{gift.customerName}</div>
              <div className="text-sm text-slate-400">{gift.orderName} - {formatDate(gift.date)}</div>
            </div>
            <div className="text-right">
              <div className="text-pink-400 font-semibold">{gift.qty} unita</div>
              <div className="text-sm text-slate-400">{formatCurrency(gift.value)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Profitability Section
function ProfitabilitySection({ data }: { data: ProductStoryData['profitability'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{formatCurrency(data.totalRevenue)}</div>
          <div className="text-sm text-slate-400">Fatturato</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{formatCurrency(data.totalCost)}</div>
          <div className="text-sm text-slate-400">Costi</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{formatCurrency(data.totalMargin)}</div>
          <div className="text-sm text-slate-400">Margine</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{data.marginPercent.toFixed(1)}%</div>
          <div className="text-sm text-slate-400">Margine %</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{formatCurrency(data.marginPerUnit)}</div>
          <div className="text-sm text-slate-400">Margine/Unit</div>
        </div>
      </div>

      {/* Margin Progress Bar */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Margine rispetto al fatturato</span>
          <span>{data.marginPercent.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-slate-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(data.marginPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Movements Section
function MovementsSection({ data }: { data: ProductStoryData['movements'] }) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'internal' | 'adjustment'>('all');

  const filteredMovements = filter === 'all' ? data : data.filter(m => m.type === filter);

  const typeIcons = {
    in: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/20' },
    out: { icon: <ShoppingCart className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/20' },
    internal: { icon: <Package className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    adjustment: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'in', 'out', 'internal', 'adjustment'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === type ? 'bg-violet-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {type === 'all' ? 'Tutti' : type === 'in' ? 'Entrate' : type === 'out' ? 'Uscite' : type === 'internal' ? 'Interni' : 'Rettifiche'}
          </button>
        ))}
      </div>

      {/* Movements List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMovements.slice(0, 30).map((move) => {
          const typeStyle = typeIcons[move.type];
          return (
            <div key={move.id} className="flex items-center gap-4 bg-slate-700/20 rounded-lg px-4 py-3">
              <div className={`p-2 rounded-lg ${typeStyle.bg} ${typeStyle.color}`}>
                {typeStyle.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {move.type === 'in' ? '+' : move.type === 'out' ? '-' : ''}{move.quantity} unita
                  </span>
                  {move.origin && (
                    <span className="text-xs bg-slate-600 px-2 py-0.5 rounded">{move.origin}</span>
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  {move.from} → {move.to}
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {formatDate(move.date)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lots Section
function LotsSection({ data }: { data: ProductStoryData['lots'] }) {
  return (
    <div className="space-y-2">
      {data.map((lot, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded-lg px-4 py-3 ${
            lot.isExpired ? 'bg-red-500/20 border border-red-500/50' :
              lot.isExpiringSoon ? 'bg-yellow-500/20 border border-yellow-500/50' :
                'bg-slate-700/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Calendar className={`w-4 h-4 ${
              lot.isExpired ? 'text-red-400' : lot.isExpiringSoon ? 'text-yellow-400' : 'text-slate-400'
            }`} />
            <div>
              <div className="text-white font-medium">{lot.name}</div>
              <div className="text-sm text-slate-400">
                {lot.expirationDate ? `Scadenza: ${formatDate(lot.expirationDate)}` : 'Nessuna scadenza'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">{lot.qty} unita</span>
            {lot.isExpired && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">SCADUTO</span>
            )}
            {lot.isExpiringSoon && !lot.isExpired && (
              <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs rounded">IN SCADENZA</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Detective Mode Section
function DetectiveModeSection({ data }: { data: DetectiveData }) {
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'adjustments' | 'timeline'>('summary');

  const typeIcons: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    purchase: { icon: <ArrowDownCircle className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Acquisto' },
    sale: { icon: <ArrowUpCircle className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Vendita' },
    gift: { icon: <Gift className="w-4 h-4" />, color: 'text-pink-400', bg: 'bg-pink-500/20', label: 'Omaggio' },
    adjustment_in: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Rettifica +' },
    adjustment_out: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Rettifica -' },
    scrap: { icon: <Trash2 className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Scarto' },
    internal: { icon: <Shuffle className="w-4 h-4" />, color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Interno' },
    return_supplier: { icon: <RotateCcw className="w-4 h-4" />, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Reso Fornitore' },
    return_customer: { icon: <RotateCcw className="w-4 h-4" />, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Reso Cliente' },
    unknown: { icon: <HelpCircle className="w-4 h-4" />, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Sconosciuto' },
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap border-b border-slate-700 pb-4">
        {[
          { id: 'summary', label: 'Riepilogo', icon: <Eye className="w-4 h-4" /> },
          { id: 'findings', label: `Risultati (${data.findings.length})`, icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'adjustments', label: 'Rettifiche', icon: <Scale className="w-4 h-4" /> },
          { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Stock Calculation */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-orange-400" />
              Calcolo Giacenza da Movimenti
            </h4>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Totale Entrate</div>
                <div className="text-2xl font-bold text-green-400">+{data.summary.entries.total}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Totale Uscite</div>
                <div className="text-2xl font-bold text-red-400">-{data.summary.exits.total}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Giacenza Teorica</div>
                <div className="text-2xl font-bold text-white">{data.summary.theoreticalStock.toFixed(1)}</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Giacenza Reale</div>
                <div className="text-2xl font-bold text-violet-400">{data.summary.realStock}</div>
              </div>
            </div>

            {/* Discrepancy */}
            {Math.abs(data.summary.discrepancy) > 0.5 && (
              <div className={`p-4 rounded-lg border-2 ${
                data.summary.discrepancy > 0 ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-red-500/10 border-red-500/50'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${data.summary.discrepancy > 0 ? 'text-yellow-400' : 'text-red-400'}`} />
                  <span className={`font-semibold ${data.summary.discrepancy > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    Discrepanza: {data.summary.discrepancy > 0 ? '+' : ''}{data.summary.discrepancy.toFixed(1)} unita
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  {data.summary.discrepancy > 0
                    ? 'La giacenza reale è superiore a quella calcolata dai movimenti.'
                    : 'La giacenza reale è inferiore a quella calcolata dai movimenti.'}
                </p>
              </div>
            )}
          </div>

          {/* Movement Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Entries */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-md font-semibold text-green-400 mb-4 flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5" />
                Dettaglio Entrate (+{data.summary.entries.total})
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Acquisti da fornitori</span>
                  <span className="text-green-400 font-semibold">+{data.summary.entries.purchases}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Rettifiche positive</span>
                  <span className="text-emerald-400 font-semibold">+{data.summary.entries.adjustments}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Resi da clienti</span>
                  <span className="text-cyan-400 font-semibold">+{data.summary.entries.customerReturns}</span>
                </div>
                {data.summary.entries.unknown > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-300">Non classificati</span>
                    <span className="text-purple-400 font-semibold">+{data.summary.entries.unknown}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Exits */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h4 className="text-md font-semibold text-red-400 mb-4 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5" />
                Dettaglio Uscite (-{data.summary.exits.total})
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Vendite a clienti</span>
                  <span className="text-blue-400 font-semibold">-{data.summary.exits.sales}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Omaggi</span>
                  <span className="text-pink-400 font-semibold">-{data.summary.exits.gifts}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Rettifiche negative</span>
                  <span className="text-orange-400 font-semibold">-{data.summary.exits.adjustments}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Resi a fornitori</span>
                  <span className="text-yellow-400 font-semibold">-{data.summary.exits.supplierReturns}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Scarti</span>
                  <span className="text-red-400 font-semibold">-{data.summary.exits.scraps}</span>
                </div>
                {data.summary.exits.unknown > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-300">Non classificati</span>
                    <span className="text-purple-400 font-semibold">-{data.summary.exits.unknown}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Internal Transfers Note */}
          <div className="bg-slate-700/30 rounded-lg p-4 flex items-center gap-3">
            <Shuffle className="w-5 h-5 text-slate-400" />
            <span className="text-slate-300">
              <strong>{data.summary.internal}</strong> unita movimentate internamente (non influenzano la giacenza)
            </span>
          </div>

          {/* Total Movements */}
          <div className="text-center text-slate-400">
            Analizzati <strong className="text-white">{data.summary.totalMovements}</strong> movimenti totali
          </div>
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <div className="space-y-4">
          {data.findings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="text-lg font-medium text-green-400">Tutto in ordine!</p>
              <p>Non sono stati rilevati problemi o anomalie.</p>
            </div>
          ) : (
            data.findings.map((finding, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border-l-4 ${
                  finding.severity === 'error' ? 'bg-red-500/10 border-red-500' :
                  finding.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500' :
                  'bg-blue-500/10 border-blue-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  {finding.severity === 'error' ? (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  ) : finding.severity === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-blue-400" />
                  )}
                  <span className={`font-semibold ${
                    finding.severity === 'error' ? 'text-red-400' :
                    finding.severity === 'warning' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`}>
                    {finding.message}
                  </span>
                </div>
                {finding.details && (
                  <p className="text-sm text-slate-400 mt-2 ml-7">{finding.details}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm mb-4">
            Le rettifiche inventario sono modifiche manuali alla giacenza. Qui puoi vedere chi ha fatto quale modifica e quando.
          </p>

          {data.recentAdjustments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Scale className="w-12 h-12 mx-auto mb-3 text-slate-500" />
              <p>Nessuna rettifica inventario trovata per questo prodotto.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.recentAdjustments.map((adj, i) => {
                const typeStyle = typeIcons[adj.type] || typeIcons.unknown;
                return (
                  <div key={i} className="flex items-center gap-4 bg-slate-700/20 rounded-lg px-4 py-3">
                    <div className={`p-2 rounded-lg ${typeStyle.bg} ${typeStyle.color}`}>
                      {typeStyle.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${adj.impact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {adj.impact >= 0 ? '+' : ''}{adj.quantity} unita
                        </span>
                        <span className="text-slate-400 text-sm">({typeStyle.label})</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {adj.from} → {adj.to}
                      </div>
                      {adj.reference && (
                        <div className="text-xs text-slate-500 mt-1">
                          Rif: {adj.reference}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-300">{formatDate(adj.date)}</div>
                      {adj.user && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <User className="w-3 h-3" />
                          {adj.user}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.timeline.map((move, i) => {
            const typeStyle = typeIcons[move.type] || typeIcons.unknown;
            return (
              <div key={i} className="flex items-center gap-4 bg-slate-700/20 rounded-lg px-4 py-3">
                <div className={`p-2 rounded-lg ${typeStyle.bg} ${typeStyle.color}`}>
                  {typeStyle.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${
                      move.direction === 'in' ? 'text-green-400' :
                      move.direction === 'out' ? 'text-red-400' :
                      'text-slate-300'
                    }`}>
                      {move.direction === 'in' ? '+' : move.direction === 'out' ? '-' : ''}{move.quantity}
                    </span>
                    <span className="text-sm text-slate-400">{move.description}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {move.from} → {move.to}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-300">{formatDate(move.date)}</div>
                  {move.reference && (
                    <div className="text-xs text-slate-500">{move.reference}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
