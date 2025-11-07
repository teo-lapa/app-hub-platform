'use client';

import { useState, useEffect, useRef } from 'react';

interface NotesInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function NotesInput({ value, onChange }: NotesInputProps) {
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 500;

  useEffect(() => {
    setCharCount(value.length);
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(100, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxChars) {
      onChange(newValue);
    }
  };

  const getCharCountColor = () => {
    const percentage = (charCount / maxChars) * 100;
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300 flex items-center justify-between" style={{ fontSize: '14px', lineHeight: '1.5' }}>
        <span>
          Note per il Magazzino
          <span className="text-slate-500 ml-2">(opzionale)</span>
        </span>
        {/* Character Counter - Always visible */}
        <span className={`text-xs font-semibold px-2 py-1 rounded ${getCharCountColor()} bg-slate-900`} style={{ fontSize: '12px', lineHeight: '1.5' }}>
          {charCount}/{maxChars}
        </span>
      </label>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          placeholder="Note per il magazzino (es. prodotto in scadenza, attenzione speciale, ecc.)"
          rows={4}
          className="w-full min-h-[100px] px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none placeholder:text-slate-500"
          style={{
            fontSize: '16px',
            lineHeight: '1.5',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            WebkitFontSmoothing: 'antialiased',
          }}
        />
      </div>

      {/* Helper Text */}
      <div className="flex items-start gap-2 text-xs text-slate-400">
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p style={{ fontSize: '13px', lineHeight: '1.5' }}>
          Aggiungi informazioni per il magazzino, come prodotti in scadenza da prendere,
          attenzioni particolari nella preparazione, o note speciali sul confezionamento.
        </p>
      </div>

      {/* Warning at 90% capacity */}
      {charCount >= maxChars * 0.9 && charCount < maxChars && (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-3 flex items-start gap-2 animate-pulse">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-yellow-400 font-medium" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Stai per raggiungere il limite di caratteri
          </span>
        </div>
      )}

      {/* Max limit reached */}
      {charCount >= maxChars && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-400 font-medium" style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Limite massimo di caratteri raggiunto
          </span>
        </div>
      )}
    </div>
  );
}
