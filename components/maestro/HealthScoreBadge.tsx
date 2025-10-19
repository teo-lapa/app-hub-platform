'use client';

import { motion } from 'framer-motion';
import { cn, getHealthScoreColor, getHealthScoreBg } from '@/lib/utils';

interface HealthScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthScoreBadge({
  score,
  size = 'md',
  showLabel = true
}: HealthScoreBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const getLabel = (score: number) => {
    if (score >= 80) return 'Eccellente';
    if (score >= 60) return 'Buono';
    if (score >= 40) return 'Attenzione';
    return 'Critico';
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-semibold border',
        sizeClasses[size],
        getHealthScoreBg(score)
      )}
    >
      <div className={cn(
        'flex items-center gap-1.5',
        getHealthScoreColor(score)
      )}>
        <div className={cn(
          'h-2 w-2 rounded-full',
          score >= 80 ? 'bg-green-500' :
          score >= 60 ? 'bg-yellow-500' :
          score >= 40 ? 'bg-orange-500' :
          'bg-red-500'
        )} />
        <span>{score}</span>
      </div>
      {showLabel && (
        <span className="text-slate-300">{getLabel(score)}</span>
      )}
    </motion.div>
  );
}
