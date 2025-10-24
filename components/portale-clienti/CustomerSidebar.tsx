'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  Package,
  FileText,
  Truck,
  MessageCircle,
  User,
  LucideIcon,
} from 'lucide-react';
import { useCartStore } from '@/lib/store/cartStore';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  useBadgeFromCart?: boolean;
}

export function CustomerSidebar() {
  const pathname = usePathname();
  const cartItemsCount = useCartStore((state) => state.getTotalItems());

  const navigationItems: NavItem[] = [
    {
      icon: Home,
      label: 'Dashboard',
      href: '/portale-clienti',
    },
    {
      icon: ShoppingBag,
      label: 'Catalogo',
      href: '/portale-clienti/catalogo',
    },
    {
      icon: ShoppingCart,
      label: 'Carrello',
      href: '/portale-clienti/carrello',
      useBadgeFromCart: true,
    },
    {
      icon: Package,
      label: 'I Miei Ordini',
      href: '/portale-clienti/ordini',
    },
    {
      icon: FileText,
      label: 'Fatture',
      href: '/portale-clienti/fatture',
    },
    {
      icon: Truck,
      label: 'Consegne',
      href: '/portale-clienti/consegne',
    },
    {
      icon: MessageCircle,
      label: 'Assistenza',
      href: '/portale-clienti/assistenza',
    },
    {
      icon: User,
      label: 'Profilo',
      href: '/portale-clienti/profilo',
    },
  ];

  const isActive = (href: string) => {
    if (href === '/portale-clienti') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-72 glass-strong border-r border-white/20 dark:border-white/10 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Area Clienti
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gestisci i tuoi ordini
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badge = item.useBadgeFromCart ? cartItemsCount : undefined;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                    ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white/10'
                    }
                  `}
                >
                  {/* Active Indicator */}
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl"
                      initial={false}
                      transition={{ type: 'spring', duration: 0.6 }}
                    />
                  )}

                  {/* Icon */}
                  <Icon className="w-5 h-5 relative z-10" />

                  {/* Label */}
                  <span className="font-medium text-sm relative z-10 flex-1">
                    {item.label}
                  </span>

                  {/* Badge */}
                  {badge !== undefined && badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="relative z-10 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full"
                    >
                      {badge}
                    </motion.span>
                  )}

                  {/* Hover Effect */}
                  {!active && (
                    <div className="absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="glass rounded-xl p-4 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold text-sm mb-1 text-gray-900 dark:text-white">
            Serve aiuto?
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Il nostro team è pronto ad assisterti
          </p>
          <Link
            href="/portale-clienti/assistenza"
            className="block w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium hover:shadow-lg transition-shadow"
          >
            Contattaci
          </Link>
        </div>
      </div>
    </aside>
  );
}
