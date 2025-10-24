'use client';

import { motion } from 'framer-motion';
import { ShoppingCart, MessageCircle, Truck, Package, FileText, User } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  const actions = [
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
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700"
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Azioni Rapide
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                {/* Background gradient on hover */}
                <div className={`
                  absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-10
                  rounded-xl transition-opacity duration-300
                `} />

                {/* Card content */}
                <div className={`
                  relative p-4 rounded-xl border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-800
                  group-hover:border-transparent group-hover:shadow-lg
                  transition-all duration-300
                `}>
                  {/* Icon */}
                  <div className={`${action.bgColor} rounded-lg p-3 w-fit mx-auto mb-3`}>
                    <Icon className={`h-6 w-6 ${action.iconColor}`} />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white text-center mb-1">
                    {action.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {action.description}
                  </p>
                </div>

                {/* Shine effect */}
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
