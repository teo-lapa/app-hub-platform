'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';
import {
  StatusBadge,
  UrgencyBadge,
  ComparisonBadge,
  CadenceTypeBadge,
} from './CadenceBadge';
import { InlineCadenceDropdown } from './CadenceEditForm';
import { useUpdateCadence } from '@/lib/hooks/useSupplierCadence';
import { toast } from 'sonner';

interface CadenceTableProps {
  cadences: CadenceWithMetadata[];
  onEdit?: (cadence: CadenceWithMetadata) => void;
  className?: string;
}

export function CadenceTable({ cadences, onEdit, className }: CadenceTableProps) {
  const updateMutation = useUpdateCadence();

  // Handle inline cadence update
  const handleCadenceUpdate = async (id: number, value: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { cadence_value: value },
      });
      toast.success('Cadenza aggiornata');
    } catch (error) {
      toast.error('Errore durante laggiornamento');
    }
  };

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

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Fornitore
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Cadenza
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Confronto
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Prossimo Ordine
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Lead Time
            </th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
              Stato
            </th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-slate-300">
              Azioni
            </th>
          </tr>
        </thead>

        <tbody>
          {cadences.map((cadence, index) => (
            <CadenceTableRow
              key={cadence.id}
              cadence={cadence}
              index={index}
              onCadenceUpdate={handleCadenceUpdate}
              onEdit={onEdit}
              formatDate={formatDate}
            />
          ))}

          {cadences.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-slate-400">
                Nessuna cadenza trovata
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Individual Table Row with animations
 */
interface CadenceTableRowProps {
  cadence: CadenceWithMetadata;
  index: number;
  onCadenceUpdate: (id: number, value: number) => void;
  onEdit?: (cadence: CadenceWithMetadata) => void;
  formatDate: (date: string | null) => string;
}

function CadenceTableRow({
  cadence,
  index,
  onCadenceUpdate,
  onEdit,
  formatDate,
}: CadenceTableRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Row highlight based on urgency
  const getRowHighlight = () => {
    if (!cadence.is_active) return '';
    if (cadence.days_overdue > 0) return 'bg-red-500/5 border-l-2 border-red-500';
    if (cadence.days_until_next_order === 0) return 'bg-orange-500/5 border-l-2 border-orange-500';
    if (cadence.days_until_next_order === 1) return 'bg-yellow-500/5 border-l-2 border-yellow-500';
    return '';
  };

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'border-b border-slate-700/50 transition-colors',
        getRowHighlight(),
        isHovered && 'bg-slate-700/20'
      )}
    >
      {/* Supplier Name */}
      <td className="py-4 px-4">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-white">{cadence.supplier_name}</span>
          <span className="text-xs text-slate-400">
            {cadence.total_orders_last_6m} ordini (6m)
          </span>
        </div>
      </td>

      {/* Cadence Configuration */}
      <td className="py-4 px-4">
        <InlineCadenceDropdown
          cadence={cadence}
          onUpdate={(value) => onCadenceUpdate(cadence.id, value)}
        />
      </td>

      {/* Comparison Badge */}
      <td className="py-4 px-4">
        <ComparisonBadge
          configuredCadence={cadence.cadence_value}
          calculatedCadence={cadence.calculated_cadence_days}
        />
      </td>

      {/* Next Order Date */}
      <td className="py-4 px-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-white">{formatDate(cadence.next_order_date)}</span>
          </div>
          <UrgencyBadge
            daysUntilOrder={cadence.days_until_next_order}
            daysOverdue={cadence.days_overdue}
            isActive={cadence.is_active}
          />
        </div>
      </td>

      {/* Lead Time */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-white">
            {cadence.average_lead_time_days} {cadence.average_lead_time_days === 1 ? 'gg' : 'gg'}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <StatusBadge isActive={cadence.is_active} />
      </td>

      {/* Actions */}
      <td className="py-4 px-4 text-right">
        <button
          onClick={() => onEdit?.(cadence)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            'text-slate-400 hover:text-white hover:bg-slate-700',
            isHovered && 'opacity-100',
            !isHovered && 'opacity-0'
          )}
        >
          <Edit2 className="h-4 w-4" />
          Modifica
        </button>
      </td>
    </motion.tr>
  );
}
