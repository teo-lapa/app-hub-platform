'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store/appStore';
import { useAuthStore } from '@/lib/store/authStore';
import { AppCard } from '@/components/ui/AppCard';
import { Search, Package } from 'lucide-react';

export function AppGrid() {
  const { filteredApps, searchQuery } = useAppStore();
  const { user } = useAuthStore();

  if (filteredApps.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="glass-strong p-8 rounded-3xl mb-6"
        >
          {searchQuery ? (
            <Search className="w-16 h-16 text-muted-foreground mx-auto" />
          ) : (
            <Package className="w-16 h-16 text-muted-foreground mx-auto" />
          )}
        </motion.div>

        <h3 className="text-xl font-semibold mb-2">
          {searchQuery ? 'Nessun risultato trovato' : 'Nessuna app disponibile'}
        </h3>

        <p className="text-muted-foreground max-w-md">
          {searchQuery
            ? `Non abbiamo trovato app che corrispondono a "${searchQuery}". Prova con termini diversi.`
            : 'Non ci sono app disponibili in questa categoria al momento.'
          }
        </p>

        {searchQuery && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => useAppStore.getState().setSearchQuery('')}
            className="mt-4 glass-strong px-6 py-3 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors"
          >
            Cancella ricerca
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="glass-strong px-4 py-2 rounded-xl">
            <span className="text-sm text-muted-foreground">
              {filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''} trovate
            </span>
          </div>

          {user && (
            <div className="glass-strong px-4 py-2 rounded-xl">
              <span className="text-sm">
                Piano: <span className="font-semibold capitalize text-blue-400">
                  {user.role?.replace('_', ' ')}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              useAppStore.getState().setCategory('Tutti');
              useAppStore.getState().setSearchQuery('');
            }}
            className="glass-strong px-4 py-2 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors text-sm"
          >
            Mostra tutto
          </motion.button>
        </div>
      </motion.div>

      {/* App Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 tablet-grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
      >
        {filteredApps.map((app, index) => (
          <AppCard key={app.id} app={app} index={index} />
        ))}
      </motion.div>

      {/* Load More - Placeholder per futuro */}
      {filteredApps.length >= 12 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center pt-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-strong px-8 py-4 rounded-xl hover:bg-white/20 dark:hover:bg-black/20 transition-colors font-medium"
          >
            Carica altre app
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}