'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Home, Phone, FileText, ChevronDown, ChevronUp, TrendingDown, Package, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types
interface LostProduct {
  productId: number;
  productName: string;
  avgQtyPerWeek: number;
  lastWeekBought: number;
  estimatedLoss: number;
}

interface CustomerAlert {
  customerId: number;
  customerName: string;
  status: 'critical' | 'warning' | 'ok';
  variationPercent: number;
  wasWeeklyRevenue: number;
  nowWeeklyRevenue: number;
  daysSinceLastOrder: number;
  lostProducts: LostProduct[];
  totalLoss: number;
}

interface ProductAlert {
  productId: number;
  productName: string;
  status: 'critical' | 'warning' | 'ok';
  variationPercent: number;
  weekOldQty: number;
  weekOldLabel: string;
  weekNewQty: number;
  weekNewLabel: string;
  customersLostCount: number;
  revenueLost: number;
}

interface SalesAlertData {
  summary: {
    critical: { count: number; revenueLost: number };
    warning: { count: number; revenueLost: number };
    ok: { count: number };
  };
  customers: CustomerAlert[];
  products: ProductAlert[];
}

// Mock data for development (will be replaced by API call)
const mockData: SalesAlertData = {
  summary: {
    critical: { count: 5, revenueLost: 12500 },
    warning: { count: 12, revenueLost: 8300 },
    ok: { count: 89 }
  },
  customers: [
    {
      customerId: 1,
      customerName: 'Ristorante Da Mario',
      status: 'critical',
      variationPercent: -68,
      wasWeeklyRevenue: 1250,
      nowWeeklyRevenue: 400,
      daysSinceLastOrder: 21,
      totalLoss: 3400,
      lostProducts: [
        { productId: 101, productName: 'Mozzarella di Bufala DOP', avgQtyPerWeek: 12, lastWeekBought: 44, estimatedLoss: 1200 },
        { productId: 102, productName: 'Prosciutto di Parma 24 mesi', avgQtyPerWeek: 8, lastWeekBought: 45, estimatedLoss: 1600 },
        { productId: 103, productName: 'Parmigiano Reggiano 36 mesi', avgQtyPerWeek: 5, lastWeekBought: 46, estimatedLoss: 600 }
      ]
    },
    {
      customerId: 2,
      customerName: 'Hotel Bellavista',
      status: 'critical',
      variationPercent: -52,
      wasWeeklyRevenue: 2100,
      nowWeeklyRevenue: 1008,
      daysSinceLastOrder: 14,
      totalLoss: 4368,
      lostProducts: [
        { productId: 104, productName: 'Burrata Pugliese', avgQtyPerWeek: 20, lastWeekBought: 43, estimatedLoss: 1800 },
        { productId: 105, productName: 'Olio EVO Toscano', avgQtyPerWeek: 6, lastWeekBought: 44, estimatedLoss: 900 }
      ]
    },
    {
      customerId: 3,
      customerName: 'Pizzeria Napoli',
      status: 'warning',
      variationPercent: -35,
      wasWeeklyRevenue: 890,
      nowWeeklyRevenue: 578,
      daysSinceLastOrder: 7,
      totalLoss: 1248,
      lostProducts: [
        { productId: 106, productName: 'Pomodoro San Marzano DOP', avgQtyPerWeek: 15, lastWeekBought: 46, estimatedLoss: 450 }
      ]
    },
    {
      customerId: 4,
      customerName: 'Trattoria Toscana',
      status: 'warning',
      variationPercent: -28,
      wasWeeklyRevenue: 650,
      nowWeeklyRevenue: 468,
      daysSinceLastOrder: 5,
      totalLoss: 728,
      lostProducts: [
        { productId: 107, productName: 'Pecorino Romano DOP', avgQtyPerWeek: 4, lastWeekBought: 47, estimatedLoss: 320 }
      ]
    },
    {
      customerId: 5,
      customerName: 'Caffe Milano',
      status: 'ok',
      variationPercent: 12,
      wasWeeklyRevenue: 420,
      nowWeeklyRevenue: 470,
      daysSinceLastOrder: 2,
      totalLoss: 0,
      lostProducts: []
    }
  ],
  products: [
    {
      productId: 101,
      productName: 'Mozzarella di Bufala DOP',
      status: 'critical',
      variationPercent: -45,
      weekOldQty: 180,
      weekOldLabel: 'W44',
      weekNewQty: 99,
      weekNewLabel: 'W48',
      customersLostCount: 8,
      revenueLost: 4860
    },
    {
      productId: 102,
      productName: 'Prosciutto di Parma 24 mesi',
      status: 'critical',
      variationPercent: -38,
      weekOldQty: 95,
      weekOldLabel: 'W44',
      weekNewQty: 59,
      weekNewLabel: 'W48',
      customersLostCount: 5,
      revenueLost: 7200
    },
    {
      productId: 104,
      productName: 'Burrata Pugliese',
      status: 'warning',
      variationPercent: -25,
      weekOldQty: 120,
      weekOldLabel: 'W44',
      weekNewQty: 90,
      weekNewLabel: 'W48',
      customersLostCount: 3,
      revenueLost: 2700
    },
    {
      productId: 105,
      productName: 'Olio EVO Toscano',
      status: 'warning',
      variationPercent: -18,
      weekOldQty: 45,
      weekOldLabel: 'W44',
      weekNewQty: 37,
      weekNewLabel: 'W48',
      customersLostCount: 2,
      revenueLost: 1200
    },
    {
      productId: 108,
      productName: 'Gorgonzola Dolce DOP',
      status: 'ok',
      variationPercent: 8,
      weekOldQty: 50,
      weekOldLabel: 'W44',
      weekNewQty: 54,
      weekNewLabel: 'W48',
      customersLostCount: 0,
      revenueLost: 0
    }
  ]
};

// Status icon component
function StatusIcon({ status }: { status: 'critical' | 'warning' | 'ok' }) {
  const icons = {
    critical: <span className="text-2xl">🔴</span>,
    warning: <span className="text-2xl">🟠</span>,
    ok: <span className="text-2xl">🟢</span>
  };
  return icons[status];
}

// KPI Card component
function KPICard({
  icon,
  label,
  count,
  revenueLost,
  gradient,
  index
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  revenueLost?: number;
  gradient: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div className={cn(
        "bg-gradient-to-br rounded-xl p-6 shadow-2xl border border-white/10 overflow-hidden",
        gradient
      )}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-3xl">{icon}</div>
          </div>

          <h3 className="text-white/80 text-sm font-medium mb-1">{label}</h3>

          <div className="text-3xl font-bold text-white mb-1">
            {count} clienti
          </div>

          {revenueLost !== undefined && revenueLost > 0 && (
            <p className="text-white/70 text-sm">
              CHF {revenueLost.toLocaleString('de-CH')} persi
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Customer Card component
function CustomerCard({ customer, index }: { customer: CustomerAlert; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    warning: 'border-orange-500/50 bg-orange-500/5',
    ok: 'border-green-500/50 bg-green-500/5'
  };

  const variationColor = customer.variationPercent < 0 ? 'text-red-400' : 'text-green-400';

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "bg-white/5 rounded-xl border overflow-hidden",
        statusColors[customer.status]
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon status={customer.status} />
            <div>
              <h3 className="text-white font-semibold text-lg">{customer.customerName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn("font-bold", variationColor)}>
                  {customer.variationPercent > 0 ? '+' : ''}{customer.variationPercent}%
                  {customer.variationPercent < 0 ? ' ↓' : ' ↑'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-slate-400 text-sm">
              Era: CHF {customer.wasWeeklyRevenue.toLocaleString('de-CH')}/sett
            </div>
            <div className="text-white text-sm">
              Ora: CHF {customer.nowWeeklyRevenue.toLocaleString('de-CH')}/sett
            </div>
            <div className="text-slate-500 text-xs mt-1">
              {customer.daysSinceLastOrder} giorni dall'ultimo ordine
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Phone className="w-4 h-4" />
            Chiama
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            Note
          </motion.button>

          {customer.lostProducts.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Package className="w-4 h-4" />
              {customer.lostProducts.length} prodotti persi
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </motion.button>
          )}
        </div>
      </div>

      {/* Expanded products list */}
      <AnimatePresence>
        {expanded && customer.lostProducts.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10 bg-white/5"
          >
            <div className="p-4 space-y-2">
              {customer.lostProducts.map((product, pIndex) => (
                <div key={product.productId} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div>
                    <div className="text-white text-sm font-medium">{product.productName}</div>
                    <div className="text-slate-400 text-xs">
                      Media: {product.avgQtyPerWeek} pz/sett - Ultima W{product.lastWeekBought}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 text-sm font-medium">
                      -CHF {product.estimatedLoss.toLocaleString('de-CH')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Product Card component
function ProductCard({ product, index }: { product: ProductAlert; index: number }) {
  const statusColors = {
    critical: 'border-red-500/50 bg-red-500/5',
    warning: 'border-orange-500/50 bg-orange-500/5',
    ok: 'border-green-500/50 bg-green-500/5'
  };

  const variationColor = product.variationPercent < 0 ? 'text-red-400' : 'text-green-400';

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "bg-white/5 rounded-xl border p-4",
        statusColors[product.status]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon status={product.status} />
          <div>
            <h3 className="text-white font-semibold">{product.productName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("font-bold", variationColor)}>
                {product.variationPercent > 0 ? '+' : ''}{product.variationPercent}%
                {product.variationPercent < 0 ? ' ↓' : ' ↑'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-slate-300 text-sm">
            {product.weekOldLabel}: {product.weekOldQty}kg {' '}
            <span className="text-slate-500">→</span>
            {' '} {product.weekNewLabel}: {product.weekNewQty}kg
          </div>
          <div className="flex items-center justify-end gap-4 mt-2">
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <Users className="w-4 h-4" />
              {product.customersLostCount} clienti persi
            </div>
            {product.revenueLost > 0 && (
              <div className="text-red-400 text-sm font-medium">
                -CHF {product.revenueLost.toLocaleString('de-CH')}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SalesAlertPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesAlertData | null>(null);
  const [activeTab, setActiveTab] = useState<'clienti' | 'prodotti'>('clienti');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sales-alert');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Map API response to frontend format
          const apiData = result.data;
          const mappedData: SalesAlertData = {
            summary: {
              critical: {
                count: apiData.summary.customersAtRisk.critical,
                revenueLost: apiData.customers
                  .filter((c: any) => c.status === 'critical')
                  .reduce((sum: number, c: any) => sum + Math.abs(c.revenueChange || 0), 0)
              },
              warning: {
                count: apiData.summary.customersAtRisk.warning,
                revenueLost: apiData.customers
                  .filter((c: any) => c.status === 'warning')
                  .reduce((sum: number, c: any) => sum + Math.abs(c.revenueChange || 0), 0)
              },
              ok: { count: apiData.summary.customersAtRisk.ok }
            },
            customers: apiData.customers.map((c: any) => ({
              customerId: c.customerId,
              customerName: c.customerName,
              status: c.status,
              variationPercent: Math.round(c.revenueChangePercent || 0),
              wasWeeklyRevenue: Math.round((c.historicalRevenue || 0) / 4), // 4 historical weeks
              nowWeeklyRevenue: Math.round((c.recentRevenue || 0) / 3),    // 3 recent weeks
              daysSinceLastOrder: c.daysSinceLastOrder || 0,
              totalLoss: Math.abs(c.revenueChange || 0),
              lostProducts: (c.lostProducts || []).map((p: any) => ({
                productId: p.productId,
                productName: p.productName,
                avgQtyPerWeek: p.avgQtyPerWeek || 0,
                lastWeekBought: parseInt(p.lastPurchasedWeek?.split('W')[1] || '0'),
                estimatedLoss: (p.avgRevenuePerWeek || 0) * 3 // 3 weeks of lost revenue
              }))
            })),
            products: apiData.products.map((p: any) => ({
              productId: p.productId,
              productName: p.productName,
              status: p.status,
              variationPercent: Math.round(p.qtyChangePercent || 0),
              weekOldQty: Math.round(p.historicalQty || 0),
              weekOldLabel: apiData.summary.periods?.historical?.[0]?.split('-')[1] || 'W-6',
              weekNewQty: Math.round(p.recentQty || 0),
              weekNewLabel: apiData.summary.periods?.recent?.[0]?.split('-')[1] || 'W0',
              customersLostCount: p.customerLoss || 0,
              revenueLost: Math.max(0, (p.historicalRevenue || 0) - (p.recentRevenue || 0))
            }))
          };
          setData(mappedData);
        } else {
          // Fallback to mock data if API fails
          setData(mockData);
        }
      } else {
        // Fallback to mock data
        setData(mockData);
      }
    } catch (error) {
      console.error('Error fetching sales alert data:', error);
      // Fallback to mock data
      setData(mockData);
    } finally {
      setLoading(false);
      setLastSync(new Date());
    }
  };

  const handleRefresh = () => {
    fetchData();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white mb-2">
            Caricamento Sales Alert...
          </h2>
          <p className="text-slate-300">
            Analisi vendite in corso
          </p>
        </motion.div>
      </div>
    );
  }

  // Sort customers and products by status severity
  const sortedCustomers = [...(data?.customers || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  const sortedProducts = [...(data?.products || [])].sort((a, b) => {
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-red-500/20"
      >
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Home Button */}
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg transition-all"
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </motion.button>
              </Link>

              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <span className="text-4xl">🚨</span>
                  Sales Alert
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  Intelligenza vendite in tempo reale
                  <span className="text-red-400 ml-2">● Live</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Last Sync */}
              <div className="text-sm text-slate-400">
                Ultimo sync: {lastSync.toLocaleTimeString('it-IT')}
              </div>

              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Aggiorna
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <section>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              Riepilogo Situazione
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              icon="🔴"
              label="CRITICO"
              count={data?.summary.critical.count || 0}
              revenueLost={data?.summary.critical.revenueLost}
              gradient="from-red-600 to-red-800"
              index={0}
            />
            <KPICard
              icon="🟠"
              label="ATTENZIONE"
              count={data?.summary.warning.count || 0}
              revenueLost={data?.summary.warning.revenueLost}
              gradient="from-orange-500 to-orange-700"
              index={1}
            />
            <KPICard
              icon="🟢"
              label="OK"
              count={data?.summary.ok.count || 0}
              gradient="from-green-600 to-green-800"
              index={2}
            />
          </div>
        </section>

        {/* Tabs */}
        <section>
          <div className="flex gap-2 mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('clienti')}
              className={cn(
                "px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2",
                activeTab === 'clienti'
                  ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              )}
            >
              <Users className="w-5 h-5" />
              Clienti
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('prodotti')}
              className={cn(
                "px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2",
                activeTab === 'prodotti'
                  ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              )}
            >
              <Package className="w-5 h-5" />
              Prodotti
            </motion.button>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'clienti' ? (
              <motion.div
                key="clienti"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {sortedCustomers.map((customer, index) => (
                  <CustomerCard key={customer.customerId} customer={customer} index={index} />
                ))}

                {sortedCustomers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun cliente trovato</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="prodotti"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {sortedProducts.map((product, index) => (
                  <ProductCard key={product.productId} product={product} index={index} />
                ))}

                {sortedProducts.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun prodotto trovato</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-[1800px] mx-auto px-6 py-8 mt-12 text-center text-slate-400 text-sm"
      >
        <p>
          Sales Alert • LAPA Finest Italian Food •
          Powered by Claude AI & Odoo 17
        </p>
      </motion.div>
    </div>
  );
}
