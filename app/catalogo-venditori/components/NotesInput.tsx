'use client';

import { useState, useEffect, useRef } from 'react';

interface NotesInputProps {
  orderNotes: string;
  warehouseNotes: string;
  onOrderNotesChange: (value: string) => void;
  onWarehouseNotesChange: (value: string) => void;
}

export default function NotesInput({
  orderNotes,
  warehouseNotes,
  onOrderNotesChange,
  onWarehouseNotesChange
}: NotesInputProps) {
  const [orderCharCount, setOrderCharCount] = useState(0);
  const [warehouseCharCount, setWarehouseCharCount] = useState(0);
  const orderTextareaRef = useRef<HTMLTextAreaElement>(null);
  const warehouseTextareaRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 500;

  useEffect(() => {
    setOrderCharCount(orderNotes.length);
  }, [orderNotes]);

  useEffect(() => {
    setWarehouseCharCount(warehouseNotes.length);
  }, [warehouseNotes]);

  // Auto-resize textarea for order notes
  useEffect(() => {
    if (orderTextareaRef.current) {
      orderTextareaRef.current.style.height = 'auto';
      orderTextareaRef.current.style.height = `${Math.max(100, orderTextareaRef.current.scrollHeight)}px`;
    }
  }, [orderNotes]);

  // Auto-resize textarea for warehouse notes
  useEffect(() => {
    if (warehouseTextareaRef.current) {
      warehouseTextareaRef.current.style.height = 'auto';
      warehouseTextareaRef.current.style.height = `${Math.max(100, warehouseTextareaRef.current.scrollHeight)}px`;
    }
  }, [warehouseNotes]);

  const handleOrderNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxChars) {
      onOrderNotesChange(newValue);
    }
  };

  const handleWarehouseNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxChars) {
      onWarehouseNotesChange(newValue);
    }
  };

  const getCharCountColor = (count: number) => {
    const percentage = (count / maxChars) * 100;
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* ORDER NOTES (Customer-visible) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300 flex items-center justify-between" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <span>
            Note Ordine
            <span className="text-slate-500 ml-2">(visibili al cliente)</span>
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded ${getCharCountColor(orderCharCount)} bg-slate-900`} style={{ fontSize: '12px', lineHeight: '1.5' }}>
            {orderCharCount}/{maxChars}
          </span>
        </label>

        <div className="relative">
          <textarea
            ref={orderTextareaRef}
            value={orderNotes}
            onChange={handleOrderNotesChange}
            placeholder="Note per il cliente (es. informazioni sulla consegna, preferenze, ecc.)"
            rows={3}
            className="w-full min-h-[80px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none placeholder:text-slate-500"
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitFontSmoothing: 'antialiased',
            }}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-400">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Queste note saranno visibili al cliente nell'ordine
          </p>
        </div>
      </div>

      {/* WAREHOUSE NOTES (Internal) */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300 flex items-center justify-between" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <span>
            Note Magazzino
            <span className="text-slate-500 ml-2">(interne)</span>
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded ${getCharCountColor(warehouseCharCount)} bg-slate-900`} style={{ fontSize: '12px', lineHeight: '1.5' }}>
            {warehouseCharCount}/{maxChars}
          </span>
        </label>

        <div className="relative">
          <textarea
            ref={warehouseTextareaRef}
            value={warehouseNotes}
            onChange={handleWarehouseNotesChange}
            placeholder="Note per il magazzino (es. prodotto in scadenza, attenzione speciale, ecc.)"
            rows={3}
            className="w-full min-h-[80px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none placeholder:text-slate-500"
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitFontSmoothing: 'antialiased',
            }}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-400">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Note interne per il magazzino (non visibili al cliente)
          </p>
        </div>
      </div>
    </div>
  );
}
