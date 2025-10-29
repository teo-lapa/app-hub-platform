'use client';

import { cn } from '@/lib/utils';
import { Circle, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

/**
 * Status Badge - Active/Inactive status indicator
 */
interface StatusBadgeProps {
  isActive: boolean;
  className?: string;
}

export function StatusBadge({ isActive, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        isActive
          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
          : 'bg-slate-500/10 text-slate-500 border border-slate-500/20',
        className
      )}
    >
      <Circle className={cn('h-2 w-2', isActive ? 'fill-green-500' : 'fill-slate-500')} />
      {isActive ? 'Attivo' : 'Inattivo'}
    </span>
  );
}

/**
 * Urgency Badge - Shows how soon the order is due
 */
interface UrgencyBadgeProps {
  daysUntilOrder: number | null;
  daysOverdue: number;
  isActive: boolean;
  className?: string;
}

export function UrgencyBadge({
  daysUntilOrder,
  daysOverdue,
  isActive,
  className,
}: UrgencyBadgeProps) {
  if (!isActive) return null;

  // Overdue orders (red)
  if (daysOverdue > 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-red-500/10 text-red-500 border border-red-500/20',
          className
        )}
      >
        <AlertCircle className="h-3 w-3" />
        In ritardo di {daysOverdue}gg
      </span>
    );
  }

  // Due today (orange)
  if (daysUntilOrder === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-orange-500/10 text-orange-500 border border-orange-500/20',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Oggi
      </span>
    );
  }

  // Due tomorrow (yellow)
  if (daysUntilOrder === 1) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Domani
      </span>
    );
  }

  // Due this week (blue)
  if (daysUntilOrder !== null && daysUntilOrder >= 2 && daysUntilOrder <= 7) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-blue-500/10 text-blue-500 border border-blue-500/20',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Tra {daysUntilOrder} giorni
      </span>
    );
  }

  // Future orders (green)
  if (daysUntilOrder !== null && daysUntilOrder > 7) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-green-500/10 text-green-500 border border-green-500/20',
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Tra {daysUntilOrder} giorni
      </span>
    );
  }

  return null;
}

/**
 * Comparison Badge - Shows if cadence matches calculated average
 */
interface ComparisonBadgeProps {
  configuredCadence: number | null; // cadence_value (configured)
  calculatedCadence: number | null; // calculated_cadence_days (from data)
  className?: string;
}

export function ComparisonBadge({
  configuredCadence,
  calculatedCadence,
  className,
}: ComparisonBadgeProps) {
  // If no data, don't show badge
  if (!configuredCadence || !calculatedCadence) {
    return null;
  }

  const difference = Math.abs(configuredCadence - calculatedCadence);

  // Optimal: difference <= 0.5 days
  if (difference <= 0.5) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-green-500/10 text-green-500 border border-green-500/20',
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Ottimale
      </span>
    );
  }

  // Close: difference <= 1.5 days
  if (difference <= 1.5) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-blue-500/10 text-blue-500 border border-blue-500/20',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Simile ({calculatedCadence.toFixed(1)}gg)
      </span>
    );
  }

  // Different: difference > 1.5 days
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-orange-500/10 text-orange-500 border border-orange-500/20',
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      Diversa (media: {calculatedCadence.toFixed(1)}gg)
    </span>
  );
}

/**
 * Cadence Type Badge - Shows cadence configuration
 */
interface CadenceTypeBadgeProps {
  cadenceValue: number | null;
  className?: string;
}

export function CadenceTypeBadge({ cadenceValue, className }: CadenceTypeBadgeProps) {
  if (!cadenceValue) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-slate-700 text-slate-300 border border-slate-600',
        className
      )}
    >
      Ogni {cadenceValue} {cadenceValue === 1 ? 'giorno' : 'giorni'}
    </span>
  );
}
