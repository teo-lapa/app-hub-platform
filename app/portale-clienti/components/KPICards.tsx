'use client';

import { motion } from 'framer-motion';
import {
  ShoppingCart,
  TrendingUp,
  DollarSign,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

interface DashboardKPIs {
  orders_count: number;
  revenue_ytd: number;
  avg_order: number;
  credit_available: number;
  credit_limit: number;
  overdue_invoices: number;
  overdue_amount: number;
}

interface KPICardsProps {
  kpis: DashboardKPIs;
  isLoading?: boolean;
}

export function KPICards({ kpis, isLoading }: KPICardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: 'easeOut'
      }
    })
  };

  const kpiCards = [
    {
      title: 'Ordini questo mese',
      value: isLoading ? '...' : kpis.orders_count.toString(),
      icon: ShoppingCart,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Fatturato YTD',
      value: isLoading ? '...' : formatCurrency(kpis.revenue_ytd),
      icon: TrendingUp,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Ordine Medio',
      value: isLoading ? '...' : formatCurrency(kpis.avg_order),
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Credito Disponibile',
      value: isLoading ? '...' : formatCurrency(kpis.credit_available),
      subtitle: `Limite: ${formatCurrency(kpis.credit_limit)}`,
      icon: CreditCard,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      title: 'Fatture Scadute',
      value: isLoading ? '...' : kpis.overdue_invoices.toString(),
      subtitle: kpis.overdue_invoices > 0 ? formatCurrency(kpis.overdue_amount) : 'Nessuna scadenza',
      icon: AlertTriangle,
      color: kpis.overdue_invoices > 0 ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500',
      bgColor: kpis.overdue_invoices > 0
        ? 'bg-red-50 dark:bg-red-900/20'
        : 'bg-gray-50 dark:bg-gray-800/20',
      iconColor: kpis.overdue_invoices > 0
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400',
      alert: kpis.overdue_invoices > 0
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg animate-pulse"
          >
            <div className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 sm:mb-3 md:mb-4" />
            <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 sm:mb-3 w-2/3" />
            <div className="h-6 sm:h-7 md:h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
      {kpiCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            className={`
              relative overflow-hidden rounded-xl shadow-lg
              bg-white dark:bg-gray-800
              border border-gray-100 dark:border-gray-700
              ${card.alert ? 'ring-2 ring-red-500 ring-opacity-50' : ''}
            `}
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5`} />

            {/* Content */}
            <div className="relative p-3 sm:p-4 md:p-6">
              {/* Icon */}
              <div className={`${card.bgColor} rounded-lg p-2 sm:p-2.5 md:p-3 w-fit mb-2 sm:mb-3 md:mb-4`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${card.iconColor}`} />
              </div>

              {/* Title */}
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
                {card.title}
              </p>

              {/* Value */}
              <p className={`
                text-base sm:text-xl md:text-2xl font-bold mb-0.5 sm:mb-1
                ${card.alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}
              `}>
                {card.value}
              </p>

              {/* Subtitle */}
              {card.subtitle && (
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500">
                  {card.subtitle}
                </p>
              )}

              {/* Alert indicator */}
              {card.alert && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-2 sm:mt-3 flex items-center text-[10px] sm:text-xs text-red-600 dark:text-red-400 font-medium"
                >
                  <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                  <span className="hidden sm:inline">Richiede attenzione</span>
                  <span className="sm:hidden">Attenzione</span>
                </motion.div>
              )}
            </div>

            {/* Shine effect on hover */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
              whileHover={{
                opacity: 0.1,
                x: ['-100%', '100%'],
                transition: { duration: 0.6 }
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
