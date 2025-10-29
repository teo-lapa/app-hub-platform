'use client';

import { motion } from 'framer-motion';
import { Clock, TruckIcon, AlertTriangle, Package, ChevronRight } from 'lucide-react';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';
import { cn } from '@/lib/utils';

interface ScheduledOrderCardProps {
  supplier: CadenceWithMetadata;
  onNavigateToOrder: (supplierId: number) => void;
  index?: number;
}

export function ScheduledOrderCard({
  supplier,
  onNavigateToOrder,
  index = 0
}: ScheduledOrderCardProps) {
  const isOverdue = supplier.days_overdue > 0;
  const daysUntil = supplier.days_until_next_order;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onNavigateToOrder(supplier.supplier_id)}
      className={cn(
        "bg-white/5 backdrop-blur-sm rounded-xl p-4 cursor-pointer transition-all hover:bg-white/10 hover:scale-[1.02] border",
        isOverdue
          ? "border-red-500/30 hover:border-red-500/50"
          : "border-white/10 hover:border-white/20"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TruckIcon className="h-4 w-4 text-blue-300 flex-shrink-0" />
            <h4 className="text-white font-semibold text-base line-clamp-2">
              {supplier.supplier_name}
            </h4>
          </div>

          <div className="flex items-center gap-2 text-sm text-blue-200">
            <Clock className="h-3 w-3" />
            <span>Lead time: {supplier.average_lead_time_days} giorni</span>
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-blue-300 flex-shrink-0 ml-2" />
      </div>

      {/* Status Info */}
      <div className="space-y-2">
        {/* Critical Products Count */}
        {supplier.total_orders_last_6m > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-orange-500/10 text-orange-300 px-3 py-1.5 rounded-full text-xs font-semibold border border-orange-500/20">
              <AlertTriangle className="h-3 w-3" />
              <span>Prodotti da ordinare</span>
            </div>
          </div>
        )}

        {/* Order Frequency */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Package className="h-3 w-3" />
            <span>{supplier.total_orders_last_6m} ordini (ultimi 6 mesi)</span>
          </div>
          {supplier.calculated_cadence_days && (
            <span className="text-blue-300 font-medium">
              Media: ogni {supplier.calculated_cadence_days.toFixed(0)} gg
            </span>
          )}
        </div>

        {/* Urgency Status */}
        {isOverdue && (
          <div className="flex items-center gap-1.5 bg-red-500/10 text-red-300 px-3 py-1.5 rounded-full text-xs font-bold border border-red-500/20">
            <AlertTriangle className="h-3 w-3 animate-pulse" />
            <span>IN RITARDO di {supplier.days_overdue} giorni</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToOrder(supplier.supplier_id);
          }}
          className={cn(
            "w-full px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2",
            isOverdue
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          <span>Vai all'Ordine</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
