'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Heart, Package, Truck, AlertCircle, Percent, BarChart, Building2, Activity, RefreshCcw, X, ChevronDown, ChevronUp, Radar, Calculator } from 'lucide-react';
import Link from 'next/link';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  gradient: string;
  subtitle?: string;
  index: number;
}

function KPICard({ title, value, change, changeType, icon, gradient, subtitle, index }: KPICardProps) {
  const changeColor = changeType === 'up' ? 'text-green-400' : changeType === 'down' ? 'text-red-400' : 'text-slate-400';
  const ChangeIcon = changeType === 'up' ? TrendingUp : changeType === 'down' ? TrendingDown : null;

  // Determina il link per ogni card
  const getCardLink = () => {
    switch (title) {
      case 'Margini': return '/super-dashboard/margini';
      case 'Analisi Prodotti': return '/analisi-prodotto';
      case 'Banca': return '/import-movimenti-ubs';
      case 'App Usage': return '/super-dashboard/app-usage';
      case 'Budget': return '/super-dashboard/budget';
      // Revenue, Orders, Customers pages non ancora implementate
      default: return '#';
    }
  };

  const cardContent = (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group cursor-pointer"
    >
      <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 shadow-2xl border border-white/10 overflow-hidden`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
              {icon}
            </div>
            {ChangeIcon && (
              <div className={`flex items-center gap-1 ${changeColor} text-sm font-semibold`}>
                <ChangeIcon className="w-4 h-4" />
                {change}
              </div>
            )}
          </div>

          <h3 className="text-white/80 text-sm font-medium mb-1">
            {title}
          </h3>

          <div className="text-3xl font-bold text-white mb-1">
            {value}
          </div>

          {subtitle && (
            <p className="text-white/60 text-xs">
              {subtitle}
            </p>
          )}
        </div>

        {/* Sparkline placeholder */}
        <div className="absolute bottom-0 right-0 w-24 h-12 opacity-20">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            <polyline
              points="0,40 20,35 40,38 60,20 80,25 100,15"
              fill="none"
              stroke="white"
              strokeWidth="2"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );

  // Wrappa con Link se il card ha una pagina dedicata
  const cardLink = getCardLink();
  if (cardLink !== '#') {
    return <Link href={cardLink}>{cardContent}</Link>;
  }

  return cardContent;
}

interface KPIData {
  revenue: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  orders: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  customers: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  healthScore: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  stockValue: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  deliveries: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
  margins: {
    value: number;
    change: number;
    changeType: 'up' | 'down';
    subtitle: string;
  };
}

interface KPISummarySectionProps {
  period: string;
}

// Recurring Products Lost Modal Component
function RecurringProductsLostModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/recurring-products-lost')
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setData(result.data);
            // Auto-expand top 3 customers
            const top3 = result.data.customers.slice(0, 3).map((c: any) => c.customerId);
            setExpandedCustomers(new Set(top3));
          }
        })
        .catch(err => console.error('Error loading recurring products:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const toggleCustomer = (customerId: number) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-orange-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <RefreshCcw className="w-7 h-7" />
                  Prodotti Ricorsivi Persi
                </h2>
                <p className="text-orange-100 mt-1">
                  Clienti che hanno smesso di comprare prodotti che acquistavano regolarmente (3+ settimane consecutive)
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-orange-400">{data.summary.totalCustomersAffected}</div>
                    <div className="text-orange-200 text-sm">Clienti Coinvolti</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{data.summary.totalProductsLost}</div>
                    <div className="text-red-200 text-sm">Prodotti Persi</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">CHF {data.summary.totalEstimatedLoss.toLocaleString()}</div>
                    <div className="text-purple-200 text-sm">Fatturato Perso (stima)</div>
                  </div>
                </div>

                <div className="text-slate-400 text-sm mb-4">
                  Analisi settimane W{data.summary.historicalWeeks[data.summary.historicalWeeks.length - 1]} - W{data.summary.historicalWeeks[0]} vs ultime 2 settimane (W{data.summary.recentWeeks[1]}-W{data.summary.recentWeeks[0]})
                </div>

                {/* Customers List */}
                <div className="space-y-3">
                  {data.customers.map((customer: any, index: number) => (
                    <div key={customer.customerId} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                      <button
                        onClick={() => toggleCustomer(customer.customerId)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="text-left">
                            <div className="text-white font-semibold">{customer.customerName}</div>
                            <div className="text-orange-300 text-sm">{customer.products.length} prodotti persi</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-red-400 font-bold">-CHF {customer.totalLoss.toFixed(0)}</div>
                            <div className="text-slate-400 text-xs">fatturato perso</div>
                          </div>
                          {expandedCustomers.has(customer.customerId) ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Products List */}
                      <AnimatePresence>
                        {expandedCustomers.has(customer.customerId) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/10 bg-white/5"
                          >
                            <div className="p-4 space-y-2">
                              {customer.products.map((product: any, pIndex: number) => (
                                <div key={pIndex} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                  <div>
                                    <div className="text-white text-sm font-medium">{product.productName}</div>
                                    <div className="text-slate-400 text-xs">
                                      W{product.consecutiveWeeks[0]}-W{product.consecutiveWeeks[product.consecutiveWeeks.length - 1]} ({product.consecutiveWeeks.length} sett. consecutive)
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-orange-300 text-sm">{product.avgQtyPerWeek}/sett</div>
                                    <div className="text-red-400 text-xs">-CHF {product.estimatedLoss.toFixed(0)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {data.customers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <RefreshCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun prodotto ricorsivo perso trovato!</p>
                    <p className="text-sm mt-2">Tutti i clienti continuano ad acquistare regolarmente.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-red-400">
                Errore nel caricamento dei dati
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function KPISummarySection({ period }: KPISummarySectionProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringStats, setRecurringStats] = useState<{ count: number; loss: number } | null>(null);
  const [salesRadarStats, setSalesRadarStats] = useState<{ interactions: number; vendors: number } | null>(null);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/super-dashboard/kpi?period=${period}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setKpiData(result.data);
        } else {
          throw new Error(result.error || 'Failed to load KPI data');
        }
      } catch (err: any) {
        console.error('Error fetching KPIs:', err);
        setError(err.message || 'Failed to load KPI data');
      } finally {
        setLoading(false);
      }
    }

    fetchKPIs();
  }, [period]);

  // Fetch recurring products stats for the card
  useEffect(() => {
    fetch('/api/recurring-products-lost')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setRecurringStats({
            count: result.data.summary.totalCustomersAffected,
            loss: result.data.summary.totalEstimatedLoss
          });
        }
      })
      .catch(err => console.error('Error fetching recurring stats:', err));
  }, []);

  // Fetch Sales Radar activity stats for the card
  useEffect(() => {
    fetch('/api/super-dashboard/sales-radar-activity?period=week')
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setSalesRadarStats({
            interactions: result.data.summary.totalInteractions,
            vendors: result.data.summary.activeVendors
          });
        }
      })
      .catch(err => console.error('Error fetching sales radar stats:', err));
  }, []);

  // Show loading state
  if (loading) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            KPI Overview
            <span className="text-sm font-normal text-slate-400 ml-2">
              • Caricamento...
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl p-6 animate-pulse">
              <div className="h-8 bg-slate-700 rounded mb-3 w-1/2" />
              <div className="h-10 bg-slate-700 rounded mb-2" />
              <div className="h-4 bg-slate-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Show error state
  if (error || !kpiData) {
    return (
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            KPI Overview
          </h2>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Errore nel caricamento dei KPI</h3>
              <p className="text-sm text-red-300 mt-1">{error || 'Dati non disponibili'}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Build KPI display data from API response
  const kpis = [
    {
      title: 'Revenue',
      value: `CHF ${(kpiData.revenue.value / 1000000).toFixed(1)}M`,
      change: `${kpiData.revenue.change > 0 ? '+' : ''}${kpiData.revenue.change}%`,
      changeType: kpiData.revenue.changeType,
      icon: <DollarSign className="w-6 h-6 text-white" />,
      gradient: 'from-emerald-500 to-teal-600',
      subtitle: kpiData.revenue.subtitle,
    },
    {
      title: 'Orders',
      value: kpiData.orders.value.toLocaleString(),
      change: `${kpiData.orders.change > 0 ? '+' : ''}${kpiData.orders.change}%`,
      changeType: kpiData.orders.changeType,
      icon: <ShoppingCart className="w-6 h-6 text-white" />,
      gradient: 'from-blue-500 to-cyan-600',
      subtitle: kpiData.orders.subtitle,
    },
    {
      title: 'Analisi Prodotti',
      value: 'Vai',
      change: '',
      changeType: 'neutral' as const,
      icon: <BarChart className="w-6 h-6 text-white" />,
      gradient: 'from-indigo-500 to-purple-600',
      subtitle: 'Analisi dettagliata vendite e margini per prodotto',
    },
    {
      title: 'Customers',
      value: kpiData.customers.value.toString(),
      change: `${kpiData.customers.change > 0 ? '+' : ''}${kpiData.customers.change}`,
      changeType: kpiData.customers.changeType,
      icon: <Users className="w-6 h-6 text-white" />,
      gradient: 'from-purple-500 to-pink-600',
      subtitle: kpiData.customers.subtitle,
    },
    {
      title: 'Health Score',
      value: `${kpiData.healthScore.value}/100`,
      change: `${kpiData.healthScore.change}pts`,
      changeType: kpiData.healthScore.changeType,
      icon: <Heart className="w-6 h-6 text-white" />,
      gradient: 'from-orange-500 to-red-600',
      subtitle: kpiData.healthScore.subtitle,
    },
    {
      title: 'Stock Value',
      value: `CHF ${(kpiData.stockValue.value / 1000).toFixed(0)}K`,
      change: `${kpiData.stockValue.change}%`,
      changeType: kpiData.stockValue.changeType,
      icon: <Package className="w-6 h-6 text-white" />,
      gradient: 'from-violet-500 to-purple-600',
      subtitle: kpiData.stockValue.subtitle,
    },
    {
      title: 'Deliveries',
      value: kpiData.deliveries.value.toString(),
      change: `${kpiData.deliveries.change > 0 ? '+' : ''}${kpiData.deliveries.change}`,
      changeType: kpiData.deliveries.changeType,
      icon: <Truck className="w-6 h-6 text-white" />,
      gradient: 'from-amber-500 to-orange-600',
      subtitle: kpiData.deliveries.subtitle,
    },
    {
      title: 'Margini',
      value: `CHF ${(kpiData.margins.value / 1000).toFixed(0)}K`,
      change: `${kpiData.margins.change > 0 ? '+' : ''}${kpiData.margins.change}%`,
      changeType: kpiData.margins.changeType,
      icon: <Percent className="w-6 h-6 text-white" />,
      gradient: 'from-rose-500 to-pink-600',
      subtitle: kpiData.margins.subtitle,
    },
    {
      title: 'Banca',
      value: 'Carica CSV',
      change: '',
      changeType: 'neutral' as const,
      icon: <Building2 className="w-6 h-6 text-white" />,
      gradient: 'from-cyan-500 to-blue-600',
      subtitle: 'Importa movimenti bancari da UBS',
    },
    {
      title: 'App Usage',
      value: 'Analytics',
      change: '',
      changeType: 'neutral' as const,
      icon: <Activity className="w-6 h-6 text-white" />,
      gradient: 'from-teal-500 to-cyan-600',
      subtitle: 'Monitora utilizzo delle app e statistiche',
    },
    {
      title: 'Budget',
      value: 'Planner',
      change: '',
      changeType: 'neutral' as const,
      icon: <Calculator className="w-6 h-6 text-white" />,
      gradient: 'from-emerald-500 to-green-600',
      subtitle: 'Pianifica budget per fatturato',
    },
  ];

  return (
    <section>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-4"
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">📊</span>
          KPI Overview
          <span className="text-sm font-normal text-slate-400 ml-2">
            • {period === 'today' ? 'Oggi' : period === 'week' ? 'Questa Settimana' : period === 'month' ? 'Questo Mese' : period === 'quarter' ? 'Questo Trimestre' : 'Quest\'Anno'}
          </span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} index={index} />
        ))}

        {/* Recurring Products Lost Card - Special clickable card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: kpis.length * 0.1, duration: 0.5 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="relative group cursor-pointer"
          onClick={() => setShowRecurringModal(true)}
        >
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 shadow-2xl border border-white/10 overflow-hidden h-full">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                  <RefreshCcw className="w-6 h-6 text-white" />
                </div>
                {recurringStats && recurringStats.count > 0 && (
                  <div className="flex items-center gap-1 text-red-200 text-sm font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    {recurringStats.count}
                  </div>
                )}
              </div>
              <h3 className="text-white/80 text-sm font-medium mb-1">
                Prodotti Ricorsivi
              </h3>
              <div className="text-2xl font-bold text-white mb-1">
                {recurringStats ? `${recurringStats.count} persi` : 'Analizza'}
              </div>
              <p className="text-white/60 text-xs">
                {recurringStats ? `CHF ${recurringStats.loss.toLocaleString()} a rischio` : 'Clienti che hanno smesso di acquistare'}
              </p>
            </div>
            <div className="absolute bottom-0 right-0 w-24 h-12 opacity-20">
              <svg viewBox="0 0 100 50" className="w-full h-full">
                <polyline
                  points="0,20 20,25 40,15 60,30 80,10 100,35"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  className="animate-pulse"
                />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Sales Radar Activity Card - Link to dedicated page */}
        <Link href="/super-dashboard/sales-radar-activity">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: (kpis.length + 1) * 0.1, duration: 0.5 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative group cursor-pointer"
          >
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-6 shadow-2xl border border-white/10 overflow-hidden h-full">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                    <Radar className="w-6 h-6 text-white" />
                  </div>
                  {salesRadarStats && salesRadarStats.interactions > 0 && (
                    <div className="flex items-center gap-1 text-indigo-200 text-sm font-semibold">
                      <Activity className="w-4 h-4" />
                      {salesRadarStats.interactions}
                    </div>
                  )}
                </div>
                <h3 className="text-white/80 text-sm font-medium mb-1">
                  Sales Radar
                </h3>
                <div className="text-2xl font-bold text-white mb-1">
                  {salesRadarStats ? `${salesRadarStats.interactions} attività` : 'Monitor'}
                </div>
                <p className="text-white/60 text-xs">
                  {salesRadarStats ? `${salesRadarStats.vendors} venditori attivi` : 'Monitora attività venditori'}
                </p>
              </div>
              <div className="absolute bottom-0 right-0 w-24 h-12 opacity-20">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                  <polyline
                    points="0,30 25,25 50,35 75,15 100,20"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    className="animate-pulse"
                  />
                </svg>
              </div>
            </div>
          </motion.div>
        </Link>
      </div>

      {/* Recurring Products Lost Modal */}
      <RecurringProductsLostModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
      />
    </section>
  );
}
