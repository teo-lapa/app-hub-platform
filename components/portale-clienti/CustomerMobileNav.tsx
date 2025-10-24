'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  Package,
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

export function CustomerMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const cartItemsCount = useCartStore((state) => state.getTotalItems());

  const mobileNavItems: NavItem[] = [
    {
      icon: Home,
      label: 'Home',
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
      label: 'Ordini',
      href: '/portale-clienti/ordini',
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

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <nav className="mobile-nav safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badge = item.useBadgeFromCart ? cartItemsCount : undefined;

          return (
            <motion.button
              key={item.href}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation(item.href)}
              className={`
                relative flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-colors min-w-[60px]
                ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
              aria-label={item.label}
            >
              {/* Active Background */}
              {active && (
                <motion.div
                  layoutId="activeMobileTab"
                  className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', duration: 0.6 }}
                />
              )}

              {/* Icon with Badge */}
              <div className="relative z-10 mb-1">
                <Icon className="w-6 h-6" />
                {badge !== undefined && badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  >
                    {badge > 9 ? '9+' : badge}
                  </motion.span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] font-medium relative z-10">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
