'use client';

import { useState, useEffect } from 'react';

interface DeliveryDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  customerId?: number | null;
}

export default function DeliveryDatePicker({ value, onChange, customerId }: DeliveryDatePickerProps) {
  const [lastDeliveryDate, setLastDeliveryDate] = useState<string | null>(null);
  const [loadingLastDelivery, setLoadingLastDelivery] = useState(false);

  // Fetch last delivery date when customerId changes
  useEffect(() => {
    if (!customerId) {
      setLastDeliveryDate(null);
      return;
    }

    const fetchLastDelivery = async () => {
      setLoadingLastDelivery(true);
      try {
        const response = await fetch(`/api/catalogo-venditori/last-delivery?customerId=${customerId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.lastDeliveryDate) {
            setLastDeliveryDate(data.lastDeliveryDate);
          } else {
            setLastDeliveryDate(null);
          }
        }
      } catch (error) {
        console.error('Error fetching last delivery:', error);
        setLastDeliveryDate(null);
      } finally {
        setLoadingLastDelivery(false);
      }
    };

    fetchLastDelivery();
  }, [customerId]);
  // Get tomorrow's date as default
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // Format date for display
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
    return date.toLocaleDateString('it-CH', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <label className="text-sm font-medium text-slate-300" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          Data Consegna Prevista
        </label>
      </div>

      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]} // Minimum today
          className="w-full min-h-[56px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          style={{
            fontSize: '16px',
            lineHeight: '1.5',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            colorScheme: 'dark', // Makes the date picker dark
          }}
        />

        {/* Display formatted date below */}
        {value && (
          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Consegna prevista: <strong>{formatDateForDisplay(value)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Last delivery info */}
      {lastDeliveryDate && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2 text-slate-300">
            <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              Ultima consegna: <strong className="text-white">{formatDateForDisplay(lastDeliveryDate)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="flex items-start gap-2 text-slate-300">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs" style={{ fontSize: '12px', lineHeight: '1.5' }}>
            La data di consegna predefinita è <strong className="text-white">domani</strong>. Puoi modificarla se necessario.
          </p>
        </div>
      </div>
    </div>
  );
}
