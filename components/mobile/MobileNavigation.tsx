'use client';

import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Grid3X3, User, Settings, Menu, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';

interface NavItem {
  icon: typeof Home;
  label: string;
  href: string;
  requiresAuth?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Grid3X3, label: 'Apps', href: '/apps', requiresAuth: true },
  { icon: User, label: 'Profilo', href: '/profile', requiresAuth: true },
  { icon: Settings, label: 'Impostazioni', href: '/settings', requiresAuth: true },
];

export function MobileNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const handleLogout = async () => {
    await logout();
    // Dopo logout, vai alla homepage (landing page)
    router.push('/');
  };

  return (
    <div className="mobile-nav safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          // Skip auth-required items if user is not logged in
          if (item.requiresAuth && !user) return null;

          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.href}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation(item.href)}
              className={`
                relative flex flex-col items-center justify-center btn-mobile rounded-xl transition-colors
                ${isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", duration: 0.6 }}
                />
              )}

              <Icon className="w-5 h-5 mb-1 relative z-10" />
              <span className="text-xs font-medium relative z-10">{item.label}</span>
            </motion.button>
          );
        })}

        {/* Menu with logout for authenticated users */}
        {user && (
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="relative"
          >
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center btn-mobile rounded-xl transition-colors text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              <LogOut className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Esci</span>
            </button>
          </motion.div>
        )}

        {/* Login button for unauthenticated users */}
        {!user && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/auth')}
            className="flex flex-col items-center justify-center btn-mobile rounded-xl transition-colors text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
          >
            <User className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Login</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}