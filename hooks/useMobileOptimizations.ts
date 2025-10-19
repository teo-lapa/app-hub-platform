'use client';

import { useEffect, useState, useCallback } from 'react';

interface MobileOptimizationsOptions {
  enablePullToRefresh?: boolean;
  enableHapticFeedback?: boolean;
  onRefresh?: () => Promise<void>;
}

export function useMobileOptimizations({
  enablePullToRefresh = false,
  enableHapticFeedback = true,
  onRefresh
}: MobileOptimizationsOptions = {}) {
  const [isOnline, setIsOnline] = useState(true);
  const [isPulling, setIsPulling] = useState(false);

  // Detect online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Haptic feedback helper
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (!enableHapticFeedback) return;

    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [enableHapticFeedback]);

  // Pull to refresh implementation
  useEffect(() => {
    if (!enablePullToRefresh || !onRefresh) return;

    let startY = 0;
    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        currentY = e.touches[0].pageY;
        const diff = currentY - startY;

        if (diff > 80) {
          setIsPulling(true);
          vibrate(10);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (isPulling) {
        vibrate([50, 50]);
        setIsPulling(false);
        await onRefresh();
      }
      startY = 0;
      currentY = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enablePullToRefresh, onRefresh, isPulling, vibrate]);

  return {
    isOnline,
    isPulling,
    vibrate
  };
}
