'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import DynamicLogo from '@/app/components/DynamicLogo';

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showLogo?: boolean;
  actions?: React.ReactNode;
}

export function MobileHeader({ title, showBackButton = false, showLogo = false, actions }: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // Fix: invece di router.back() che può tornare a login,
    // controlliamo se c'è history, altrimenti andiamo a dashboard
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="status-bar-safe sticky top-0 z-40">
      <div className="glass-strong border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1">
            {showBackButton && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBack}
                className="p-2 rounded-xl hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            )}

            {showLogo ? (
              <div className="flex items-center gap-2">
                <DynamicLogo size={40} />
                <div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">LAPA</div>
                  <div className="text-xs text-muted-foreground">Fornitore</div>
                </div>
              </div>
            ) : title ? (
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {title}
                </h1>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <DynamicLogo size={40} />
                <div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">LAPA</div>
                  <div className="text-xs text-muted-foreground">Fornitore</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}