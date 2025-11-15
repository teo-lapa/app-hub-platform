'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Heart, Package, Truck, AlertCircle, Percent, BarChart, Building2, Activity } from 'lucide-react';
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
      case 'Revenue': return '/super-dashboard/revenue';
      case 'Orders': return '/super-dashboard/orders';
      case 'Customers': return '/super-dashboard/customers';
      case 'Analisi Prodotti': return '/analisi-prodotto';
      case 'Banca': return '/import-movimenti-ubs';
      case 'App Usage': return '/super-dashboard/app-usage';
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

export function KPISummarySection({ period }: KPISummarySectionProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      </div>
    </section>
  );
}
