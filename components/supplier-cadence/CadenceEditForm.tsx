'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, X, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadenceWithMetadata, UpdateCadenceRequest } from '@/lib/types/supplier-cadence';
import { useUpdateCadence } from '@/lib/hooks/useSupplierCadence';
import { toast } from 'sonner';

interface CadenceEditFormProps {
  cadence: CadenceWithMetadata;
  onClose?: () => void;
  className?: string;
}

// Available cadence options (in days)
const CADENCE_OPTIONS = [2, 3, 5, 7, 10, 15, 20, 30];

export function CadenceEditForm({ cadence, onClose, className }: CadenceEditFormProps) {
  const [cadenceValue, setCadenceValue] = useState(cadence.cadence_value || 3);
  const [isActive, setIsActive] = useState(cadence.is_active);
  const [notes, setNotes] = useState(cadence.notes || '');
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = useUpdateCadence();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track changes
  useEffect(() => {
    const changed =
      cadenceValue !== cadence.cadence_value ||
      isActive !== cadence.is_active ||
      notes !== (cadence.notes || '');

    setHasChanges(changed);
  }, [cadenceValue, isActive, notes, cadence]);

  // Autosave with debounce
  const scheduleAutosave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 500);
  };

  // Save changes
  const handleSave = async () => {
    if (!hasChanges) return;

    const updates: UpdateCadenceRequest = {
      cadence_value: cadenceValue,
      is_active: isActive,
      notes: notes || null,
      updated_by: 'user',
    };

    try {
      await updateMutation.mutateAsync({ id: cadence.id, data: updates });
      toast.success('Cadenza aggiornata con successo');
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to update cadence:', error);
      toast.error('Errore durante il salvataggio');
    }
  };

  // Handle cadence change
  const handleCadenceChange = (value: number) => {
    setCadenceValue(value);
    scheduleAutosave();
  };

  // Handle toggle change
  const handleToggleChange = (value: boolean) => {
    setIsActive(value);
    scheduleAutosave();
  };

  // Handle notes blur
  const handleNotesBlur = () => {
    if (hasChanges) {
      scheduleAutosave();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{cadence.supplier_name}</h3>
          <p className="text-sm text-slate-400 mt-0.5">Modifica configurazione cadenza</p>
        </div>

        {/* Save Indicator */}
        {updateMutation.isPending && (
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvataggio...
          </div>
        )}

        {hasChanges && !updateMutation.isPending && (
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <Save className="h-4 w-4" />
            Non salvato
          </div>
        )}

        {!hasChanges && !updateMutation.isPending && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="h-4 w-4" />
            Salvato
          </div>
        )}
      </div>

      {/* Cadence Dropdown */}
      <div className="space-y-2">
        <label htmlFor="cadence-select" className="block text-sm font-medium text-slate-300">
          Frequenza ordini (giorni)
        </label>
        <select
          id="cadence-select"
          value={cadenceValue}
          onChange={(e) => handleCadenceChange(Number(e.target.value))}
          className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
        >
          {CADENCE_OPTIONS.map((days) => (
            <option key={days} value={days}>
              Ogni {days} {days === 1 ? 'giorno' : 'giorni'}
            </option>
          ))}
        </select>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between gap-4 p-3 bg-slate-900 rounded-lg">
        <div>
          <p className="text-sm font-medium text-white">Stato cadenza</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isActive ? 'Ordini automatici attivi' : 'Ordini automatici disattivati'}
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={() => handleToggleChange(!isActive)}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800',
            isActive ? 'bg-green-500' : 'bg-slate-600'
          )}
          role="switch"
          aria-checked={isActive}
        >
          <span
            className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              isActive ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Notes Field */}
      <div className="space-y-2">
        <label htmlFor="cadence-notes" className="block text-sm font-medium text-slate-300">
          Note (opzionale)
        </label>
        <textarea
          id="cadence-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Aggiungi note sulla cadenza ordini..."
          rows={3}
          className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
        />
      </div>

      {/* Stats Info */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
        <div>
          <p className="text-xs text-slate-500">Media reale</p>
          <p className="text-sm font-medium text-white mt-0.5">
            {cadence.calculated_cadence_days
              ? `${cadence.calculated_cadence_days.toFixed(1)} giorni`
              : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Lead time medio</p>
          <p className="text-sm font-medium text-white mt-0.5">
            {cadence.average_lead_time_days} {cadence.average_lead_time_days === 1 ? 'giorno' : 'giorni'}
          </p>
        </div>
      </div>

      {/* Actions */}
      {onClose && (
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Inline Cadence Dropdown (for table inline editing)
 */
interface InlineCadenceDropdownProps {
  cadence: CadenceWithMetadata;
  onUpdate: (value: number) => void;
  className?: string;
}

export function InlineCadenceDropdown({
  cadence,
  onUpdate,
  className,
}: InlineCadenceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(cadence.cadence_value || 3);

  const handleSelect = (value: number) => {
    setSelectedValue(value);
    onUpdate(value);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium inline-flex items-center gap-2 min-w-[100px]"
      >
        {selectedValue} giorni
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1 min-w-[150px]">
            {CADENCE_OPTIONS.map((days) => (
              <button
                key={days}
                onClick={() => handleSelect(days)}
                className={cn(
                  'w-full px-4 py-2 text-left text-sm transition-colors',
                  days === selectedValue
                    ? 'bg-blue-500/20 text-blue-400 font-medium'
                    : 'text-white hover:bg-slate-700'
                )}
              >
                Ogni {days} {days === 1 ? 'giorno' : 'giorni'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
