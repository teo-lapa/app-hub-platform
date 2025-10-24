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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            Ultimi Ordini
          </h2>
        </div>
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Nessun ordine recente</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-600" />
          Ultimi Ordini
        </h2>
        <Link
          href="/portale-clienti/ordini"
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          Vedi tutti
        </Link>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
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
              className="border-l-4 border-blue-500 pl-4 py-3 bg-gray-50 dark:bg-gray-900/50 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors cursor-pointer"
            >
              {/* Order number and date */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {order.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(order.date_order)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                    <Euro className="h-4 w-4" />
                    {formatCurrency(order.amount_total)}
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${stateColor}`}>
                  <StateIcon className="h-3.5 w-3.5" />
                  {order.state_label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer action */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/portale-clienti/catalogo"
          className="block w-full py-3 text-center text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
        >
          Crea Nuovo Ordine
        </Link>
      </div>
    </motion.div>
  );
}
