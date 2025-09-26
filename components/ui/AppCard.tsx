'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { App, UserRole } from '@/lib/types';
import { useAuthStore } from '@/lib/store/authStore';
import { useAppStore } from '@/lib/store/appStore';
import { Lock, Star, Sparkles, Clock } from 'lucide-react';

interface AppCardProps {
  app: App;
  index: number;
}

export function AppCard({ app, index }: AppCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { setShowUpgradeModal } = useAppStore();

  const userRole = user?.role || 'visitor';
  const hasAccess =
    app.requiredRole === 'visitor' ||
    (app.requiredRole === 'free_user' && ['free_user', 'pro_user', 'admin'].includes(userRole)) ||
    (app.requiredRole === 'pro_user' && ['pro_user', 'admin'].includes(userRole)) ||
    (app.requiredRole === 'admin' && userRole === 'admin');

  const handleClick = () => {
    if (app.isNew && app.url === '#') {
      return;
    }

    if (!hasAccess) {
      setShowUpgradeModal(true);
      return;
    }

    if (app.url) {
      window.location.href = app.url;
    }
  };

  const getBadgeColor = () => {
    switch (app.requiredRole) {
      case 'visitor':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'free_user':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'pro_user':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'admin':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getBadgeText = () => {
    switch (app.requiredRole) {
      case 'visitor':
        return 'GRATIS';
      case 'free_user':
        return 'FREE';
      case 'pro_user':
        return 'PRO';
      case 'admin':
        return 'ADMIN';
      default:
        return 'FREE';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -8 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleClick}
      className={`relative group cursor-pointer ${
        (!app.url || app.url === '#') ? 'cursor-not-allowed opacity-75' : ''
      }`}
    >
      <div className="glass-strong rounded-2xl p-6 h-full border transition-all duration-300 hover:border-white/30 dark:hover:border-white/20 hover:shadow-xl hover:shadow-blue-500/10 mobile-card md:glass-strong md:rounded-2xl">
        {/* Badge Status */}
        <div className="flex items-center justify-between mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getBadgeColor()}`}>
            {getBadgeText()}
          </span>

          {/* Indicatori speciali */}
          <div className="flex items-center gap-1">
            {app.isNew && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </motion.div>
            )}
            {app.isPopular && (
              <Star className="w-4 h-4 text-orange-400 fill-current" />
            )}
          </div>
        </div>

        {/* Icona App */}
        <div className="flex items-center justify-center mb-4">
          <motion.div
            className="text-6xl"
            animate={isHovered ? { scale: 1.1, rotate: [0, -10, 10, 0] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {app.icon}
          </motion.div>
        </div>

        {/* Titolo e Descrizione */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-center group-hover:text-blue-400 transition-colors">
            {app.name}
          </h3>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {app.description}
          </p>
        </div>

        {/* Indicatore di accesso */}
        {!hasAccess && app.url && app.url !== '#' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0.7 }}
            className="absolute top-4 right-4"
          >
            <div className="glass-strong p-2 rounded-full">
              <Lock className="w-3 h-3 text-red-400" />
            </div>
          </motion.div>
        )}

        {/* Indicatore Coming Soon */}
        {(!app.url || app.url === '#') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0.7 }}
            className="absolute top-4 right-4"
          >
            <div className="glass-strong p-2 rounded-full">
              <Clock className="w-3 h-3 text-orange-400" />
            </div>
          </motion.div>
        )}

        {/* Glow effect on hover */}
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          initial={false}
          animate={{ opacity: isHovered ? 1 : 0 }}
        />
      </div>
    </motion.div>
  );
}