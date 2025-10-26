'use client';

import { motion } from 'framer-motion';
import { Truck, MapPin, Calendar, Package2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ActiveDelivery {
  id: number;
  name: string;
  scheduled_date: string;
  origin: string;
  state: string;
  state_label: string;
  location_dest: string;
}

interface ActiveDeliveriesProps {
  deliveries: ActiveDelivery[];
  isLoading?: boolean;
}

export function ActiveDeliveries({ deliveries, isLoading }: ActiveDeliveriesProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if today
    if (date.toDateString() === today.toDateString()) {
      return 'Oggi';
    }

    // Check if tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Domani';
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'assigned':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'confirmed':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      case 'waiting':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/30';
    }
  };

  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
          <div className="h-5 w-32 sm:h-6 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-24 sm:h-9 sm:w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            <span className="hidden sm:inline">Consegne Attive</span>
            <span className="sm:hidden">Consegne</span>
          </h2>
        </div>
        <div className="text-center py-8 sm:py-12">
          <Truck className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Nessuna consegna attiva</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
          <span className="hidden sm:inline">Consegne Attive</span>
          <span className="sm:hidden">Consegne</span>
        </h2>
        <Link
          href="/portale-clienti/consegne"
          className="px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors"
        >
          <span className="hidden sm:inline">Tracking</span>
          <Truck className="h-4 w-4 sm:hidden" />
        </Link>
      </div>

      {/* Deliveries List */}
      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        {deliveries.map((delivery, index) => {
          const stateColor = getStateColor(delivery.state);
          const todayDelivery = isToday(delivery.scheduled_date);

          return (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              className={`
                border rounded-lg p-2 sm:p-3 md:p-4 bg-gradient-to-br
                ${todayDelivery
                  ? 'border-green-300 dark:border-green-600 from-green-50 to-white dark:from-green-900/20 dark:to-gray-800'
                  : 'border-gray-200 dark:border-gray-700 from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800'
                }
                hover:shadow-md transition-all cursor-pointer
              `}
            >
              {/* Delivery info header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {delivery.name}
                  </h3>
                </div>
                {todayDelivery && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-2 py-1 text-xs font-bold text-white bg-green-600 rounded-full"
                  >
                    OGGI
                  </motion.span>
                )}
              </div>

              {/* Origin order */}
              {delivery.origin && delivery.origin !== 'N/A' && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <Package2 className="h-4 w-4" />
                  <span>Da ordine: <span className="font-medium">{delivery.origin}</span></span>
                </div>
              )}

              {/* Scheduled date */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span>Prevista: <span className="font-medium">{formatDate(delivery.scheduled_date)}</span></span>
              </div>

              {/* Destination */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{delivery.location_dest}</span>
              </div>

              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${stateColor}`}>
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {delivery.state_label}
                </span>

                {todayDelivery && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <AlertCircle className="h-5 w-5 text-green-600" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer info */}
      {deliveries.some(d => isToday(d.scheduled_date)) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
        >
          <Truck className="h-4 w-4" />
          <span className="font-medium">
            {deliveries.filter(d => isToday(d.scheduled_date)).length} consegna/e prevista/e per oggi
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
