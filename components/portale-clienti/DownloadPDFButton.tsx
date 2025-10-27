'use client';

import React, { useState } from 'react';

interface DownloadPDFButtonProps {
  /** Funzione async per scaricare il PDF */
  onDownload: () => Promise<void>;
  /** Testo del bottone (opzionale, default "PDF") */
  label?: string;
  /** Mostra solo icona (nasconde testo, default false) */
  iconOnly?: boolean;
  /** Variante colore */
  variant?: 'purple' | 'blue' | 'gray';
  /** Dimensione */
  size?: 'sm' | 'md';
  /** Classe CSS custom */
  className?: string;
}

export function DownloadPDFButton({
  onDownload,
  label = 'PDF',
  iconOnly = false,
  variant = 'purple',
  size = 'sm',
  className = '',
}: DownloadPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    setLoading(true);
    try {
      await onDownload();
    } catch (error: any) {
      console.error('Errore download PDF:', error);
      alert(error.message || 'Errore durante il download del PDF');
    } finally {
      setLoading(false);
    }
  };

  // Stili varianti
  const variantClasses = {
    purple: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
    blue: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
    gray: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
  };

  // Stili dimensioni
  const sizeClasses = {
    sm: 'px-2 py-1.5 sm:px-3 text-xs sm:text-sm',
    md: 'px-3 py-2 sm:px-4 text-sm sm:text-base',
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        font-medium rounded-md transition-colors whitespace-nowrap
        flex items-center gap-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      title={loading ? 'Download in corso...' : 'Scarica PDF'}
    >
      {loading ? (
        <svg
          className="animate-spin w-3 h-3 sm:w-4 sm:h-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="w-3 h-3 sm:w-4 sm:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )}

      {!iconOnly && (
        <span className="hidden sm:inline">{loading ? 'Download...' : label}</span>
      )}
    </button>
  );
}
