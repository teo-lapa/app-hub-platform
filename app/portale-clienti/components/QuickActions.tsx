'use client';

import { motion } from 'framer-motion';
import { ShoppingCart, Truck, Package, User, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  const actions = [
    {
      title: '🌟 Stella AI',
      description: 'Assistente personale',
      icon: Sparkles,
      href: '/stella-assistant',
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20',
      iconColor: 'text-pink-600 dark:text-pink-400'
    },
    {
      title: 'Nuovo Ordine',
      description: 'Sfoglia il catalogo',
      icon: ShoppingCart,
      href: '/portale-clienti/catalogo',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Tracking Consegne',
      description: 'Segui i tuoi ordini',
      icon: Truck,
      href: '/portale-clienti/consegne',
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'I Miei Ordini',
      description: 'Storico completo',
      icon: Package,
      href: '/portale-clienti/ordini',
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: 'Profilo',
      description: 'I tuoi dati',
      icon: User,
      href: '/portale-clienti/profilo',
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700"
    >
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6">
        Azioni Rapide
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link key={action.title} href={action.href}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{
                  scale: 1.05,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.95 }}
                className="relative group cursor-pointer"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-300`} />
                <div className={`relative p-2 sm:p-3 md:p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group-hover:border-transparent group-hover:shadow-lg transition-all duration-300`}>
                  <div className={`${action.bgColor} rounded-lg p-2 sm:p-2.5 md:p-3 w-fit mx-auto mb-2 sm:mb-2.5 md:mb-3`}>
                    <Icon className={`h-5 w-5 sm:h-5 sm:w-5 md:h-6 md:w-6 ${action.iconColor}`} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white text-center mb-0.5 sm:mb-1">
                    {action.title}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center">
                    {action.description}
                  </p>
                </div>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0"
                  whileHover={{
                    opacity: 0.2,
                    x: ['-100%', '100%'],
                    transition: { duration: 0.6 }
                  }}
                />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
