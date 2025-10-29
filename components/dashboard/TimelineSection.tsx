'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';
import { ScheduledOrderCard } from './ScheduledOrderCard';
import { cn } from '@/lib/utils';

interface TimelineSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  suppliers: CadenceWithMetadata[];
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week';
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onNavigateToOrder: (supplierId: number) => void;
}

const urgencyColors = {
  overdue: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    iconBg: 'bg-red-500/20',
  },
  today: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    iconBg: 'bg-orange-500/20',
  },
  tomorrow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    iconBg: 'bg-yellow-500/20',
  },
  this_week: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
  },
};

export function TimelineSection({
  title,
  icon,
  count,
  suppliers,
  urgency,
  isCollapsible = false,
  defaultExpanded = true,
  onNavigateToOrder,
}: TimelineSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colors = urgencyColors[urgency];

  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border backdrop-blur-sm overflow-hidden',
        colors.border,
        colors.bg
      )}
    >
      {/* Header */}
      <button
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full p-4 flex items-center justify-between transition-all',
          isCollapsible && 'cursor-pointer hover:bg-white/5'
        )}
        disabled={!isCollapsible}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-lg', colors.iconBg)}>
            <div className={colors.text}>{icon}</div>
          </div>
          <div className="text-left">
            <h3 className={cn('text-lg font-bold flex items-center gap-2', colors.text)}>
              {title}
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-sm font-bold',
                colors.iconBg,
                colors.text
              )}>
                {count}
              </span>
            </h3>
            {suppliers.length > 0 && suppliers[0].next_order_date && (
              <p className="text-xs text-slate-400 mt-0.5">
                {urgency === 'overdue'
                  ? 'Ordini in ritardo - priorità massima'
                  : urgency === 'today'
                  ? 'Da ordinare entro oggi'
                  : urgency === 'tomorrow'
                  ? 'Da ordinare domani'
                  : 'Pianificati nei prossimi 7 giorni'}
              </p>
            )}
          </div>
        </div>

        {isCollapsible && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={colors.text}
          >
            <ChevronDown className="h-5 w-5" />
          </motion.div>
        )}
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suppliers.map((supplier, index) => (
                  <ScheduledOrderCard
                    key={supplier.id}
                    supplier={supplier}
                    onNavigateToOrder={onNavigateToOrder}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
