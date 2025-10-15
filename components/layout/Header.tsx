'use client';

import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store/authStore';
import { useAppStore } from '@/lib/store/appStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import DynamicLogo from '@/app/components/DynamicLogo';
import { Search, LogOut, User, Menu } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuthStore();
  const { searchQuery, setSearchQuery } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="flex items-center gap-3"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex-shrink-0"
              >
                {/* Logo più piccolo su mobile (48px), normale su desktop (64px) */}
                <div className="block sm:hidden">
                  <DynamicLogo size={48} className="" />
                </div>
                <div className="hidden sm:block">
                  <DynamicLogo size={64} className="" />
                </div>
              </motion.div>

              <div className="flex flex-col">
                <motion.h1
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-bold text-red-600 dark:text-red-400 text-base sm:text-xl"
                >
                  LAPA
                </motion.h1>
                <motion.p
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs text-muted-foreground font-medium hidden sm:block"
                >
                  Fornitore Ristoranti
                </motion.p>
              </div>
            </motion.div>
          </div>

          {/* Search Bar - Hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca app..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass pl-10 pr-4 py-2 rounded-xl border border-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 md:gap-3">
            {/* Pricing Link - Hidden on mobile */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('/pricing', '_self')}
              className="hidden sm:flex glass-strong px-4 py-2 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors text-sm font-medium"
            >
              Prezzi
            </motion.button>

            <ThemeToggle />

            {/* User Menu */}
            {user && (
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="glass-strong p-2 rounded-xl flex items-center gap-2 hover:bg-white/20 dark:hover:bg-black/20 transition-all"
                >
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-semibold">
                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium">{user.name || 'User'}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {user.role?.replace('_', ' ')}
                    </div>
                  </div>
                </motion.button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 glass-strong rounded-xl border border-white/20 overflow-hidden shadow-xl z-50"
                  >
                    <div className="p-3 border-b border-white/10">
                      <div className="font-medium">{user.name || 'User'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 inline-block">
                        {user.role?.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          router.push('/profile');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm"
                      >
                        <User className="w-4 h-4" />
                        Profilo
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors text-sm"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}