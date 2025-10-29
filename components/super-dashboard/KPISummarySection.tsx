'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Heart, Package, Truck } from 'lucide-react';
import { mockKPIData } from '@/lib/super-dashboard/mockData';

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

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group"
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
}

interface KPISummarySectionProps {
  period: string;
}

export function KPISummarySection({ period }: KPISummarySectionProps) {
  // Build KPI display data from mockKPIData
  const kpis = [
    {
      title: 'Revenue',
      value: `CHF ${(mockKPIData.revenue.value / 1000000).toFixed(1)}M`,
      change: `${mockKPIData.revenue.change > 0 ? '+' : ''}${mockKPIData.revenue.change}%`,
      changeType: mockKPIData.revenue.changeType,
      icon: <DollarSign className="w-6 h-6 text-white" />,
      gradient: 'from-emerald-500 to-teal-600',
      subtitle: mockKPIData.revenue.subtitle,
    },
    {
      title: 'Orders',
      value: mockKPIData.orders.value.toLocaleString(),
      change: `${mockKPIData.orders.change > 0 ? '+' : ''}${mockKPIData.orders.change}%`,
      changeType: mockKPIData.orders.changeType,
      icon: <ShoppingCart className="w-6 h-6 text-white" />,
      gradient: 'from-blue-500 to-cyan-600',
      subtitle: mockKPIData.orders.subtitle,
    },
    {
      title: 'Customers',
      value: mockKPIData.customers.value.toString(),
      change: `${mockKPIData.customers.change > 0 ? '+' : ''}${mockKPIData.customers.change}`,
      changeType: mockKPIData.customers.changeType,
      icon: <Users className="w-6 h-6 text-white" />,
      gradient: 'from-purple-500 to-pink-600',
      subtitle: mockKPIData.customers.subtitle,
    },
    {
      title: 'Health Score',
      value: `${mockKPIData.healthScore.value}/100`,
      change: `${mockKPIData.healthScore.change}pts`,
      changeType: mockKPIData.healthScore.changeType,
      icon: <Heart className="w-6 h-6 text-white" />,
      gradient: 'from-orange-500 to-red-600',
      subtitle: mockKPIData.healthScore.subtitle,
    },
    {
      title: 'Stock Value',
      value: `CHF ${(mockKPIData.stockValue.value / 1000).toFixed(0)}K`,
      change: `${mockKPIData.stockValue.change}%`,
      changeType: mockKPIData.stockValue.changeType,
      icon: <Package className="w-6 h-6 text-white" />,
      gradient: 'from-violet-500 to-purple-600',
      subtitle: mockKPIData.stockValue.subtitle,
    },
    {
      title: 'Deliveries',
      value: mockKPIData.deliveries.value.toString(),
      change: `${mockKPIData.deliveries.change > 0 ? '+' : ''}${mockKPIData.deliveries.change}`,
      changeType: mockKPIData.deliveries.changeType,
      icon: <Truck className="w-6 h-6 text-white" />,
      gradient: 'from-amber-500 to-orange-600',
      subtitle: mockKPIData.deliveries.subtitle,
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} index={index} />
        ))}
      </div>
    </section>
  );
}
