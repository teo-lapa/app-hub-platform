'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Package,
  TruckIcon,
  FileText,
  AlertTriangle,
  X,
  Loader2,
  Calendar,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deliveryDate: string) => void;
  subtotal: number;
  totalItems: number;
  deliveryNotes?: string;
  isProcessing?: boolean;
}

export function CheckoutModal({
  isOpen,
  onClose,
  onConfirm,
  subtotal,
  totalItems,
  deliveryNotes,
  isProcessing = false,
}: CheckoutModalProps) {
  // Calculate tomorrow's date as default
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const [deliveryDate, setDeliveryDate] = useState(getTomorrowDate());

  // Reset to tomorrow when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeliveryDate(getTomorrowDate());
    }
  }, [isOpen]);
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(price);
  };

  // Calculate discount if applicable
  const discountPercentage = subtotal >= 200 ? 5 : 0;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const total = subtotal - discountAmount;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full border border-slate-600/50 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border-b border-slate-600/50">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="flex items-center gap-4">
                <div className="bg-emerald-500/20 rounded-full p-3">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Conferma Ordine
                  </h2>
                  <p className="text-slate-300 text-sm mt-1">
                    Verifica i dettagli prima di confermare
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Order Summary */}
              <div className="bg-slate-700/30 rounded-xl p-5 space-y-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-400" />
                  Riepilogo Ordine
                </h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-slate-300">
                    <span>Prodotti</span>
                    <span className="font-medium">
                      {totalItems} {totalItems === 1 ? 'articolo' : 'articoli'}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-300">
                    <span>Subtotale</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>

                  {subtotal >= 100 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between text-emerald-400"
                    >
                      <div className="flex items-center gap-1.5">
                        <TruckIcon className="h-4 w-4" />
                        <span className="font-medium">Spedizione</span>
                      </div>
                      <span className="font-bold">GRATIS</span>
                    </motion.div>
                  )}

                  {discountPercentage > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between text-blue-400"
                    >
                      <span className="font-medium">
                        Sconto {discountPercentage}%
                      </span>
                      <span className="font-bold">
                        -{formatPrice(discountAmount)}
                      </span>
                    </motion.div>
                  )}

                  <div className="pt-3 border-t border-slate-600/50 flex justify-between">
                    <span className="text-xl font-bold text-white">Totale</span>
                    <span className="text-2xl font-bold text-yellow-400">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Date Input */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-700/30 rounded-xl p-5"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-emerald-400" />
                  Data Consegna Richiesta
                </h3>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={getTomorrowDate()}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400">
                    Seleziona la data in cui desideri ricevere l'ordine (minimo domani)
                  </p>
                </div>
              </motion.div>

              {/* Delivery Notes */}
              {deliveryNotes && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-700/30 rounded-xl p-5"
                >
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Note Consegna
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {deliveryNotes}
                  </p>
                </motion.div>
              )}

              {/* Important Notice */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4"
              >
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-yellow-400">
                      Informazioni Importanti
                    </h4>
                    <ul className="text-xs text-slate-300 space-y-1">
                      <li>• L'ordine verrà inviato al sistema per l'elaborazione</li>
                      <li>• Riceverai una conferma via email</li>
                      <li>• I tempi di consegna saranno comunicati successivamente</li>
                      <li>• Per modifiche contatta il servizio clienti</li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Annulla
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onConfirm(deliveryDate)}
                  disabled={isProcessing || !deliveryDate}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Elaborazione...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Conferma Ordine</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Success Animation Preview */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4"
                >
                  <p className="text-slate-400 text-sm">
                    Stiamo elaborando il tuo ordine...
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
