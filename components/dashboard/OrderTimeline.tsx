'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  Loader2,
  Settings,
  Package,
} from 'lucide-react';
import { useOrderTimeline } from '@/lib/hooks/useOrderTimeline';
import { TimelineSection } from './TimelineSection';
import { cn } from '@/lib/utils';

interface OrderTimelineProps {
  compact?: boolean; // Per versione compatta in altre pagine
}

export function OrderTimeline({ compact = false }: OrderTimelineProps) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useOrderTimeline();

  // Navigate to supplier order page
  const handleNavigateToOrder = (supplierId: number) => {
    // TODO: Implement navigation to supplier order page
    // For now, navigate to supplier cadence settings
    router.push(`/settings/supplier-cadence?supplier=${supplierId}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'bg-slate-800 border border-slate-700 rounded-2xl p-6',
          compact && 'p-4'
        )}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-400">Caricamento ordini programmati...</span>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-slate-800 border border-red-500/30 rounded-2xl p-6"
      >
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Errore caricamento ordini
          </h3>
          <p className="text-slate-400 mb-4">
            {error instanceof Error ? error.message : 'Errore sconosciuto'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Riprova
          </button>
        </div>
      </motion.div>
    );
  }

  // No data state
  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
      >
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-slate-500 mx-auto mb-4 opacity-50" />
          <p className="text-slate-400">Nessun dato disponibile</p>
        </div>
      </motion.div>
    );
  }

  // Empty state (all good!)
  if (data.counts.total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-8"
      >
        <div className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">
            Tutto in regola! 🎉
          </h3>
          <p className="text-green-200 mb-6">
            Nessun ordine urgente da effettuare nei prossimi 7 giorni
          </p>
          <Link href="/settings/supplier-cadence">
            <button className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto">
              <Settings className="h-5 w-5" />
              <span>Gestisci Cadenze</span>
            </button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'space-y-6',
        compact && 'space-y-4'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn(
            'font-bold text-white flex items-center gap-3',
            compact ? 'text-xl' : 'text-2xl'
          )}>
            <Package className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
            Ordini Programmati
          </h2>
          <p className={cn(
            'text-slate-400 mt-1',
            compact ? 'text-sm' : 'text-base'
          )}>
            {data.counts.total} fornitori da ordinare nei prossimi 7 giorni
          </p>
        </div>

        <Link href="/settings/supplier-cadence">
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm border border-slate-600">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Gestisci Cadenze</span>
            <span className="sm:hidden">Gestisci</span>
          </button>
        </Link>
      </div>

      {/* Separator */}
      <div className="border-t border-slate-700" />

      {/* Timeline Sections */}
      <div className="space-y-4">
        {/* OVERDUE - Highest Priority */}
        {data.counts.overdue > 0 && (
          <TimelineSection
            title="IN RITARDO"
            icon={<AlertCircle className="h-5 w-5 animate-pulse" />}
            count={data.counts.overdue}
            suppliers={data.overdue}
            urgency="overdue"
            onNavigateToOrder={handleNavigateToOrder}
            defaultExpanded={true}
          />
        )}

        {/* TODAY */}
        {data.counts.today > 0 && (
          <TimelineSection
            title="DA ORDINARE OGGI"
            icon={<AlertCircle className="h-5 w-5" />}
            count={data.counts.today}
            suppliers={data.today}
            urgency="today"
            onNavigateToOrder={handleNavigateToOrder}
            defaultExpanded={true}
          />
        )}

        {/* TOMORROW */}
        {data.counts.tomorrow > 0 && (
          <TimelineSection
            title="DA ORDINARE DOMANI"
            icon={<Clock className="h-5 w-5" />}
            count={data.counts.tomorrow}
            suppliers={data.tomorrow}
            urgency="tomorrow"
            onNavigateToOrder={handleNavigateToOrder}
            isCollapsible={compact}
            defaultExpanded={!compact}
          />
        )}

        {/* THIS WEEK */}
        {data.counts.thisWeek > 0 && (
          <TimelineSection
            title="PROSSIMI 7 GIORNI"
            icon={<Calendar className="h-5 w-5" />}
            count={data.counts.thisWeek}
            suppliers={data.thisWeek}
            urgency="this_week"
            onNavigateToOrder={handleNavigateToOrder}
            isCollapsible={true}
            defaultExpanded={!compact}
          />
        )}
      </div>

      {/* Footer Info */}
      {!compact && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <p className="text-xs text-slate-400 text-center">
            Le cadenze ordini sono calcolate automaticamente in base allo storico acquisti.
            Puoi personalizzarle nella sezione{' '}
            <Link href="/settings/supplier-cadence" className="text-blue-400 hover:text-blue-300 underline">
              Gestione Cadenze
            </Link>
            .
          </p>
        </div>
      )}
    </motion.div>
  );
}
