'use client';

import { motion } from 'framer-motion';
import { Package, Calendar, Euro, CheckCircle, Clock, Send, FileText } from 'lucide-react';
import Link from 'next/link';

interface RecentOrder {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  state_label: string;
}

interface RecentOrdersProps {
  orders: RecentOrder[];
  isLoading?: boolean;
}

export function RecentOrders({ orders, isLoading }: RecentOrdersProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'sale':
      case 'done':
        return CheckCircle;
      case 'sent':
        return Send;
      case 'draft':
        return FileText;
      default:
        return Clock;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'sale':
      case 'done':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'sent':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      case 'draft':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/30';
      default:
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
          <div className="h-5 w-32 sm:h-6 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-24 sm:h-9 sm:w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 py-3 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="flex gap-3">
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            Ultimi Ordini
          </h2>
        </div>
        <div className="text-center py-8 sm:py-10 md:py-12">
          <Package className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Nessun ordine recente</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
          <Package className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          <span className="hidden sm:inline">Ultimi Ordini</span>
          <span className="sm:hidden">Ordini</span>
        </h2>
        <Link
          href="/portale-clienti/ordini"
          className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          <span className="hidden sm:inline">Vedi tutti</span>
          <span className="sm:hidden">Tutti</span>
        </Link>
      </div>

      {/* Orders List */}
      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        {orders.map((order, index) => {
          const StateIcon = getStateIcon(order.state);
          const stateColor = getStateColor(order.state);

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              className="border-l-4 border-blue-500 pl-2 sm:pl-3 md:pl-4 py-2 sm:py-2.5 md:py-3 bg-gray-50 dark:bg-gray-900/50 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors cursor-pointer"
            >
              {/* Order number and date */}
              <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                    {order.name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    <span className="truncate">{formatDate(order.date_order)}</span>
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white flex items-center gap-0.5 sm:gap-1">
                    <Euro className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{formatCurrency(order.amount_total)}</span>
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${stateColor}`}>
                  <StateIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5" />
                  <span className="truncate">{order.state_label}</span>
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer action */}
      <div className="mt-3 sm:mt-4 md:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/portale-clienti/catalogo"
          className="block w-full py-2 sm:py-2.5 md:py-3 text-center text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
        >
          Crea Nuovo Ordine
        </Link>
      </div>
    </motion.div>
  );
}
