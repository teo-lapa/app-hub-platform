'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className = '',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  const opacity = useTransform(y, [0, threshold], [0, 1]);
  const rotate = useTransform(y, [0, threshold], [0, 180]);
  const scale = useTransform(y, [0, threshold], [0.8, 1]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      y.set(0);
    }
  }, [isRefreshing, onRefresh, y]);

  const handleDragEnd = useCallback(() => {
    const currentY = y.get();
    if (currentY >= threshold && !isRefreshing) {
      handleRefresh();
    } else {
      y.set(0);
    }
  }, [y, threshold, isRefreshing, handleRefresh]);

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh relative overflow-hidden ${className}`}
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: threshold }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="relative"
      >
        {/* Pull indicator */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center">
          <motion.div
            style={{ opacity, scale }}
            className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-black/90 backdrop-blur-sm rounded-full shadow-lg"
          >
            <motion.div style={{ rotate }}>
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </motion.div>
            <span className="text-sm font-medium">
              {isRefreshing ? 'Aggiornamento...' : 'Trascina per aggiornare'}
            </span>
          </motion.div>
        </div>

        {children}
      </motion.div>
    </div>
  );
}