'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  const THRESHOLD = 80; // Pixels to pull before triggering refresh
  const MAX_PULL = 120; // Maximum pull distance

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].pageY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing && startY.current > 0) {
        currentY.current = e.touches[0].pageY;
        const distance = Math.min(currentY.current - startY.current, MAX_PULL);

        if (distance > 0) {
          setPullDistance(distance);
          setCanRefresh(distance >= THRESHOLD);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);

        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 50]);
        }

        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
          setCanRefresh(false);
        }
      } else {
        // Reset
        setPullDistance(0);
        setCanRefresh(false);
      }

      startY.current = 0;
      currentY.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, isRefreshing, pullDistance, onRefresh]);

  const rotation = Math.min((pullDistance / THRESHOLD) * 360, 360);

  return (
    <div className="relative">
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{
              opacity: 1,
              y: Math.min(pullDistance / 2, 40)
            }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
          >
            <div
              className={`flex items-center justify-center h-12 w-12 rounded-full border-2 ${
                canRefresh || isRefreshing
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-slate-700/50 border-slate-600'
              }`}
            >
              <RefreshCw
                className={`h-6 w-6 ${
                  canRefresh || isRefreshing ? 'text-blue-400' : 'text-slate-400'
                } ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${rotation}deg)`
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance / 2, 40)}px)` : undefined,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
