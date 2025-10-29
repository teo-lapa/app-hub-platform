'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';

// Components
import { CadenceStats } from '@/components/supplier-cadence/CadenceStats';
import { CadenceFilters } from '@/components/supplier-cadence/CadenceFilters';
import { CadenceTable } from '@/components/supplier-cadence/CadenceTable';
import { CadenceCardList } from '@/components/supplier-cadence/CadenceCard';
import { CadenceEditForm } from '@/components/supplier-cadence/CadenceEditForm';

// Hooks & Types
import { useSupplierCadences, useCadenceStats } from '@/lib/hooks/useSupplierCadence';
import { CadenceWithMetadata } from '@/lib/types/supplier-cadence';

/**
 * Supplier Cadence Management Page
 *
 * Full-featured page for managing recurring supplier order cadences.
 * Features:
 * - KPI stats header
 * - Search & filters
 * - Responsive table (desktop) / cards (mobile)
 * - Inline editing with autosave
 * - Real-time updates with React Query
 */
export default function SupplierCadencePage() {
  const router = useRouter();

  // State
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'next_order_date' | 'supplier_name'>('next_order_date');
  const [editingCadence, setEditingCadence] = useState<CadenceWithMetadata | null>(null);

  // Hydration check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch cadences with filters
  const { data: cadences = [], isLoading, error } = useSupplierCadences({
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
    search: searchQuery || undefined,
  });

  // Compute stats
  const stats = useCadenceStats(cadences);

  // Client-side sort (since API returns sorted by next_order_date)
  const sortedCadences = [...cadences].sort((a, b) => {
    if (sortBy === 'supplier_name') {
      return a.supplier_name.localeCompare(b.supplier_name);
    }
    // Default: next_order_date
    if (!a.next_order_date) return 1;
    if (!b.next_order_date) return -1;
    return a.next_order_date.localeCompare(b.next_order_date);
  });

  // Handle edit cadence
  const handleEdit = (cadence: CadenceWithMetadata) => {
    setEditingCadence(cadence);
  };

  // Handle close edit modal
  const handleCloseEdit = () => {
    setEditingCadence(null);
  };

  // Prevent SSR/hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Toast Notifications */}
      <Toaster position="top-right" richColors />

      {/* Page Container */}
      <div className="container mx-auto px-4 py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 lg:mb-8"
        >
          {/* Back Button + Title */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              aria-label="Torna indietro"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white">
                Gestione Cadenze Fornitori
              </h1>
              <p className="text-sm lg:text-base text-slate-400 mt-1">
                Configura frequenza ordini ricorrenti per i tuoi fornitori
              </p>
            </div>
          </div>
        </motion.div>

        {/* KPI Stats */}
        <CadenceStats
          totalActive={stats.totalActive}
          dueThisWeek={stats.dueThisWeek}
          dueToday={stats.dueToday}
          overdue={stats.overdue}
          className="mb-6 lg:mb-8"
        />

        {/* Filters */}
        <CadenceFilters
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          onSortChange={setSortBy}
          totalCount={cadences.length}
          filteredCount={sortedCadences.length}
          className="mb-6"
        />

        {/* Content: Loading / Error / Data */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-400">Caricamento cadenze...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
            <p className="text-red-400 font-medium">Errore durante il caricamento</p>
            <p className="text-sm text-red-300 mt-1">
              {error instanceof Error ? error.message : 'Errore sconosciuto'}
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <CadenceTable cadences={sortedCadences} onEdit={handleEdit} />
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden">
              <CadenceCardList cadences={sortedCadences} onEdit={handleEdit} />
            </div>
          </>
        )}
      </div>

      {/* Edit Modal/Drawer (when editing) */}
      {editingCadence && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseEdit}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-2xl mx-4 mb-4 lg:mb-0"
          >
            <CadenceEditForm cadence={editingCadence} onClose={handleCloseEdit} />
          </motion.div>
        </div>
      )}
    </div>
  );
}
