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
      className={`pull-to-refresh relative ${className}`}
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        // RIMOSSO overscrollBehaviorY: 'contain' - causa problemi di scroll su Android
      }}
    >
      <div className="relative min-h-full">
        {children}
      </div>
    </div>
  );
}