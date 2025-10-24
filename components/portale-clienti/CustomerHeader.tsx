'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
  X,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';

export function CustomerHeader() {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notificationCount] = useState(3); // TODO: Get from API

  const handleLogout = async () => {
    await logout();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'CL';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return names[0][0] + names[1][0];
    }
    return user.name.substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 glass-strong border-b border-white/20 dark:border-white/10 safe-area-inset-top">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {showMobileMenu ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Logo */}
            <Link href="/portale-clienti" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div className="hidden md:block">
                <h1 className="font-bold text-lg text-gray-900 dark:text-white">
                  Portale Clienti
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {user?.azienda || 'Benvenuto'}
                </p>
              </div>
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Notifications */}
            <button
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 md:w-6 md:h-6" />
              {notificationCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                >
                  {notificationCount}
                </motion.span>
              )}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 md:gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getUserInitials()
                  )}
                </div>

                {/* User Info - Hidden on mobile */}
                <div className="hidden md:block text-left">
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>

                <ChevronDown
                  className={`w-4 h-4 transition-transform hidden md:block ${
                    showUserMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-56 glass-strong rounded-xl shadow-xl border border-white/20 dark:border-white/10 overflow-hidden"
                  >
                    {/* User Info in Dropdown */}
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="font-medium text-sm text-gray-900 dark:text-white">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {user?.email}
                      </p>
                      {user?.codiceCliente && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Cod. Cliente: {user.codiceCliente}
                        </p>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/portale-clienti/profilo"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm">Il Mio Profilo</span>
                      </Link>

                      <Link
                        href="/portale-clienti/profilo/impostazioni"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm">Impostazioni</span>
                      </Link>

                      <div className="border-t border-white/10 my-2" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm">Esci</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileMenu(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm lg:hidden z-50"
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-80 h-full bg-white dark:bg-gray-900 shadow-2xl"
            >
              {/* Mobile Menu Content - TODO: Add menu items */}
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Menu</h2>
                {/* Add navigation items here */}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
