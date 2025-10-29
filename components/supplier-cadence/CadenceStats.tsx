'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CadenceStatsProps {
  totalActive: number;
  dueThisWeek: number;
  dueToday: number;
  overdue?: number;
  className?: string;
}

/**
 * CadenceStats - Header KPI cards showing cadence statistics
 * Follows KPICard pattern from Maestro dashboard
 */
export function CadenceStats({
  totalActive,
  dueThisWeek,
  dueToday,
  overdue = 0,
  className,
}: CadenceStatsProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {/* Total Active Cadences */}
      <StatCard
        title="Cadenze Attive"
        value={totalActive}
        icon={CheckCircle2}
        color="green"
        subtitle="Fornitori con ordini ricorrenti"
        delay={0}
      />

      {/* Due This Week */}
      <StatCard
        title="Questa Settimana"
        value={dueThisWeek}
        icon={Clock}
        color="blue"
        subtitle="Ordini da effettuare"
        delay={0.1}
      />

      {/* Due Today + Overdue */}
      <StatCard
        title="Oggi"
        value={dueToday}
        icon={AlertCircle}
        color={dueToday > 0 ? 'orange' : 'green'}
        subtitle={overdue > 0 ? `${overdue} in ritardo` : 'Tutto in regola'}
        delay={0.2}
        highlight={dueToday > 0}
      />
    </div>
  );
}

/**
 * Individual Stat Card
 */
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  subtitle?: string;
  delay?: number;
  highlight?: boolean;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  delay = 0,
  highlight = false,
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        'bg-slate-800 border rounded-lg p-4 lg:p-6 transition-all',
        highlight
          ? 'border-orange-500/40 hover:border-orange-500/60 shadow-lg shadow-orange-500/10'
          : 'border-slate-700 hover:border-slate-600'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-xs sm:text-sm font-medium text-slate-400 truncate">{title}</p>

          {/* Value */}
          <h3
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-2 truncate"
            suppressHydrationWarning
          >
            {value}
          </h3>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 sm:mt-2 line-clamp-1">{subtitle}</p>
          )}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'p-2 sm:p-2.5 lg:p-3 rounded-lg border flex-shrink-0',
            colorClasses[color]
          )}
        >
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
        </div>
      </div>
    </motion.div>
  );
}
