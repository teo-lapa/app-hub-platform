'use client';

import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Search, LogOut, User, Menu } from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { user, logout } = useAuthStore();
  const { searchQuery, setSearchQuery } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong border-b border-white/10 sticky top-0 z-40 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-3"
          >
            <div className="text-2xl">🚀</div>
            <div>
              <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">
                App Hub
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">
                La tua piattaforma di app
              </p>
            </div>
          </motion.div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
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
          <div className="flex items-center gap-3">
            {/* Pricing Link */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('/pricing', '_self')}
              className="glass-strong px-4 py-2 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors text-sm font-medium"
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
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {user.role.replace('_', ' ')}
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
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 inline-block">
                        {user.role.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          // Aggiungi navigazione al profilo
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