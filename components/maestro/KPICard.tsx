'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

const colorClasses = {
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  green: 'bg-green-500/10 text-green-500 border-green-500/20',
  orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  red: 'bg-red-500/10 text-red-500 border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
};

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel = 'vs last month',
  subtitle,
  color = 'blue'
}: KPICardProps) {
  const isPositiveTrend = trend !== undefined && trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 lg:p-6 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-slate-400 truncate">{title}</p>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1 sm:mt-2 truncate" suppressHydrationWarning>{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 hidden sm:block">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          'p-2 sm:p-2.5 lg:p-3 rounded-lg border flex-shrink-0',
          colorClasses[color]
        )}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center mt-2 sm:mt-3 lg:mt-4 gap-1">
          {isPositiveTrend ? (
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
          )}
          <span className={cn(
            'text-xs sm:text-sm font-medium',
            isPositiveTrend ? 'text-green-500' : 'text-red-500'
          )}>
            {isPositiveTrend ? '+' : ''}{trend}%
          </span>
          <span className="text-xs sm:text-sm text-slate-500 ml-1 hidden sm:inline">{trendLabel}</span>
        </div>
      )}
    </motion.div>
  );
}
