'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Lock, Zap, Star, ExternalLink } from 'lucide-react';
import { App } from '@/lib/types';
import { useAuthStore } from '@/lib/store/authStore';
import { useAppStore } from '@/lib/store/appStore';

interface MobileAppCardProps {
  app: App;
  index: number;
}

export function MobileAppCard({ app, index }: MobileAppCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setShowUpgradeModal } = useAppStore();

  const handleClick = () => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Check access permissions
    const userRole = user.role;
    const requiredRole = app.requiredRole;

    const hasAccess =
      requiredRole === 'visitor' ||
      (requiredRole === 'free_user' && ['free_user', 'pro_user', 'admin'].includes(userRole)) ||
      (requiredRole === 'pro_user' && ['pro_user', 'admin'].includes(userRole)) ||
      (requiredRole === 'admin' && userRole === 'admin');

    if (!hasAccess) {
      setShowUpgradeModal(true);
      return;
    }

    if (app.url) {
      router.push(app.url);
    }
  };

  const isLocked = user ? !['pro_user', 'admin'].includes(user.role) && app.requiredRole === 'pro_user' : app.requiredRole !== 'visitor';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.1,
        type: 'spring',
        stiffness: 100,
        damping: 15,
      }}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="mobile-card p-4 cursor-pointer group relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white/50 to-purple-50/50 dark:from-blue-900/20 dark:via-gray-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 5 }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 ${isLocked ? 'grayscale' : ''}`}
            >
              {app.icon}
            </motion.div>

            <div className="flex-1">
              <h3 className={`font-semibold text-lg ${isLocked ? 'text-gray-500' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400'} transition-colors`}>
                {app.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {app.category}
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-1">
            {isLocked && (
              <div className="p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <Lock className="w-3 h-3 text-gray-500" />
              </div>
            )}
            {app.isPopular && !isLocked && (
              <div className="p-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <Star className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
              </div>
            )}
            {app.isNew && !isLocked && (
              <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Zap className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className={`text-sm mb-4 line-clamp-2 ${isLocked ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {app.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Access level indicator */}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              app.requiredRole === 'visitor'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : app.requiredRole === 'free_user'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : app.requiredRole === 'pro_user'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            }`}>
              {app.requiredRole === 'visitor' && 'Gratis'}
              {app.requiredRole === 'free_user' && 'Free'}
              {app.requiredRole === 'pro_user' && 'Pro'}
              {app.requiredRole === 'admin' && 'Admin'}
            </span>
          </div>

          <motion.div
            whileHover={{ x: 2 }}
            className={`p-2 rounded-full transition-colors ${
              isLocked
                ? 'bg-gray-100 dark:bg-gray-800'
                : 'bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40'
            }`}
          >
            <ExternalLink className={`w-4 h-4 ${
              isLocked
                ? 'text-gray-400'
                : 'text-blue-600 dark:text-blue-400'
            }`} />
          </motion.div>
        </div>

        {/* Premium overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white/90 dark:bg-black/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sblocca con Pro
              </span>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}