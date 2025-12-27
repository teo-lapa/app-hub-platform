'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw, Calendar, Tag, AlertTriangle, Sparkles } from 'lucide-react';

interface ExpiryConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lotNumber: string, expiryDate: string) => void;
  onRetry: () => void;
  productName: string;
  extractedLot: string;
  extractedExpiry: string;
  confidence: number;
  currentLot?: string;
  currentExpiry?: string;
}

export function ExpiryConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onRetry,
  productName,
  extractedLot,
  extractedExpiry,
  confidence,
  currentLot,
  currentExpiry
}: ExpiryConfirmModalProps) {
  const [lotNumber, setLotNumber] = useState(extractedLot);
  const [expiryDate, setExpiryDate] = useState(extractedExpiry);

  // Update fields when extracted data changes
  useEffect(() => {
    setLotNumber(extractedLot);
    setExpiryDate(extractedExpiry);
  }, [extractedLot, extractedExpiry]);

  const handleConfirm = () => {
    onConfirm(lotNumber, expiryDate);
  };

  // Format date for display
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
      // Try to parse various date formats
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try DD/MM/YYYY format
        const parts = dateString.split(/[\/\-\.]/);
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return dateString;
      }
      return date.toISOString().split('T')[0];
    } catch {
      return dateString;
    }
  };

  const getConfidenceColor = () => {
    if (confidence >= 80) return 'text-green-400 bg-green-500/20';
    if (confidence >= 50) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getConfidenceLabel = () => {
    if (confidence >= 80) return 'Alta';
    if (confidence >= 50) return 'Media';
    return 'Bassa';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <h3 className="text-white font-semibold">Dati Estratti</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-white/80 text-sm mt-1 truncate">{productName}</p>
          </div>

          {/* Confidence Indicator */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Affidabilita lettura AI</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor()}`}>
                {getConfidenceLabel()} ({confidence}%)
              </span>
            </div>
            {confidence < 70 && (
              <div className="flex items-center gap-2 mt-2 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Verifica i dati prima di confermare</span>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="p-4 space-y-4">
            {/* Current values comparison */}
            {(currentLot || currentExpiry) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                <p className="text-blue-400 font-medium mb-1">Valori attuali:</p>
                <div className="text-blue-300/70">
                  {currentLot && <p>Lotto: {currentLot}</p>}
                  {currentExpiry && <p>Scadenza: {new Date(currentExpiry).toLocaleDateString('it-IT')}</p>}
                </div>
              </div>
            )}

            {/* Lot Number */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Tag className="w-4 h-4" />
                Numero Lotto
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Inserisci numero lotto"
                className="w-full px-4 py-3 bg-slate-700 border border-white/20 rounded-xl focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-white"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Calendar className="w-4 h-4" />
                Data Scadenza
              </label>
              <input
                type="date"
                value={formatDateForInput(expiryDate)}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-white/20 rounded-xl focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 bg-slate-900/50 flex gap-3">
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Riprova Foto
            </button>
            <button
              onClick={handleConfirm}
              disabled={!lotNumber && !expiryDate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Conferma
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
