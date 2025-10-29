'use client';

import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Edit2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';
import {
  StatusBadge,
  UrgencyBadge,
  ComparisonBadge,
  CadenceTypeBadge,
} from './CadenceBadge';

interface CadenceCardProps {
  cadence: CadenceWithMetadata;
  onEdit?: (cadence: CadenceWithMetadata) => void;
  index?: number;
  className?: string;
}

/**
 * CadenceCard - Mobile card view for supplier cadences
 * Compact layout with all essential info
 */
export function CadenceCard({ cadence, onEdit, index = 0, className }: CadenceCardProps) {
  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  // Card highlight based on urgency
  const getCardHighlight = () => {
    if (!cadence.is_active) return 'border-slate-700';
    if (cadence.days_overdue > 0) return 'border-red-500/40 bg-red-500/5';
    if (cadence.days_until_next_order === 0) return 'border-orange-500/40 bg-orange-500/5';
    if (cadence.days_until_next_order === 1) return 'border-yellow-500/40 bg-yellow-500/5';
    return 'border-slate-700';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'bg-slate-800 border rounded-lg p-4 space-y-3 transition-all hover:border-slate-600',
        getCardHighlight(),
        className
      )}
    >
      {/* Header: Supplier Name + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{cadence.supplier_name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {cadence.total_orders_last_6m} ordini negli ultimi 6 mesi
          </p>
        </div>
        <StatusBadge isActive={cadence.is_active} />
      </div>

      {/* Cadence Configuration */}
      <div className="flex items-center gap-2 flex-wrap">
        <CadenceTypeBadge cadenceValue={cadence.cadence_value} />
        <ComparisonBadge
          configuredCadence={cadence.cadence_value}
          calculatedCadence={cadence.calculated_cadence_days}
        />
      </div>

      {/* Next Order Date */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-slate-400">Prossimo ordine:</span>
          <span className="font-medium text-white">{formatDate(cadence.next_order_date)}</span>
        </div>

        <UrgencyBadge
          daysUntilOrder={cadence.days_until_next_order}
          daysOverdue={cadence.days_overdue}
          isActive={cadence.is_active}
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
        {/* Lead Time */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-700 rounded-lg">
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Lead time</p>
            <p className="text-sm font-medium text-white">
              {cadence.average_lead_time_days} gg
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-700 rounded-lg">
            <Package className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Ordini (6m)</p>
            <p className="text-sm font-medium text-white">{cadence.total_orders_last_6m}</p>
          </div>
        </div>
      </div>

      {/* Notes (if present) */}
      {cadence.notes && (
        <div className="pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-400 line-clamp-2">{cadence.notes}</p>
        </div>
      )}

      {/* Edit Button */}
      <button
        onClick={() => onEdit?.(cadence)}
        className="w-full mt-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium inline-flex items-center justify-center gap-2"
      >
        <Edit2 className="h-4 w-4" />
        Modifica Cadenza
      </button>
    </motion.div>
  );
}

/**
 * CadenceCardList - Grid container for mobile cards
 */
interface CadenceCardListProps {
  cadences: CadenceWithMetadata[];
  onEdit?: (cadence: CadenceWithMetadata) => void;
  className?: string;
}

export function CadenceCardList({ cadences, onEdit, className }: CadenceCardListProps) {
  if (cadences.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nessuna cadenza trovata</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4', className)}>
      {cadences.map((cadence, index) => (
        <CadenceCard key={cadence.id} cadence={cadence} onEdit={onEdit} index={index} />
      ))}
    </div>
  );
}
