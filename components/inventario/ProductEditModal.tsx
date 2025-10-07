'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, X, Calculator, Calendar, Tag } from 'lucide-react';

interface ProductEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    name: string;
    code?: string;
    image?: string;
    stockQuantity: number;
    countedQuantity: number;
    uom?: string;
    lot?: {
      id: number;
      name: string;
      expiration_date?: string;
    };
  } | null;
  onConfirm: (data: {
    quantity: number;
    lotName: string;
    expiryDate: string;
  }) => void;
  onOpenCalculator: (currentValue: string) => void;
  calculatorValue?: string;
}

export function ProductEditModal({
  isOpen,
  onClose,
  product,
  onConfirm,
  onOpenCalculator,
  calculatorValue
}: ProductEditModalProps) {
  const [quantity, setQuantity] = useState('');
  const [lotName, setLotName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    if (product) {
      console.log('🔍 [ProductEditModal] Prodotto ricevuto:', product);
      console.log('🏷️ [ProductEditModal] Lotto:', product.lot);

      setQuantity(calculatorValue || product.countedQuantity.toString());
      setLotName(product.lot?.name || '');
      // Formatta la data per input type="date" (YYYY-MM-DD)
      if (product.lot?.expiration_date) {
        const date = new Date(product.lot.expiration_date);
        const formattedDate = date.toISOString().split('T')[0];
        setExpiryDate(formattedDate);
        console.log('📅 [ProductEditModal] Scadenza formattata:', formattedDate);
      } else {
        setExpiryDate('');
      }

      console.log('✅ [ProductEditModal] Stati impostati - Lotto:', product.lot?.name, 'Scadenza:', product.lot?.expiration_date);
    }
  }, [product, calculatorValue]);

  useEffect(() => {
    if (calculatorValue) {
      setQuantity(calculatorValue);
    }
  }, [calculatorValue]);

  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0;
    onConfirm({
      quantity: qty,
      lotName: lotName.trim(),
      expiryDate: expiryDate
    });
    onClose();
  };

  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Modifica Prodotto</h3>
                <p className="text-sm text-gray-400">Aggiorna quantità, lotto e scadenza</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Product Info */}
            <div className="flex items-start gap-4 mb-6 glass rounded-xl p-4">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-700 flex items-center justify-center">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{product.name}</h4>
                {product.code && (
                  <p className="text-sm text-gray-400">Codice: {product.code}</p>
                )}
                <div className="mt-2 glass px-3 py-2 rounded-lg inline-block">
                  <span className="text-sm text-gray-400">Stock sistema: </span>
                  <span className="font-bold text-blue-400">
                    {product.stockQuantity} {product.uom || 'PZ'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Quantità */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Calculator className="w-4 h-4 text-blue-400" />
                  QUANTITÀ CONTATA *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quantity}
                    readOnly
                    placeholder="0"
                    className="flex-1 glass px-4 py-3 rounded-xl border-2 border-blue-500/50 focus:border-blue-500 focus:outline-none font-semibold text-lg text-center cursor-pointer"
                    onClick={() => onOpenCalculator(quantity)}
                  />
                  <button
                    onClick={() => onOpenCalculator(quantity)}
                    className="glass-strong px-4 py-3 rounded-xl hover:bg-blue-500/20 transition-colors border border-blue-500/30"
                  >
                    <Calculator className="w-5 h-5 text-blue-400" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Clicca per aprire la calcolatrice
                </p>
              </div>

              {/* Lotto */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Tag className="w-4 h-4 text-yellow-400" />
                  LOTTO/SERIE
                </label>
                <input
                  type="text"
                  value={lotName}
                  onChange={(e) => setLotName(e.target.value)}
                  placeholder="Inserisci numero lotto (opzionale)"
                  className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-yellow-500/50 focus:outline-none"
                />
              </div>

              {/* Scadenza */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  SCADENZA
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full glass px-4 py-3 rounded-xl border border-white/20 focus:border-orange-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 glass-weak rounded-xl p-4 border-l-4 border-blue-500">
              <p className="text-sm text-gray-300">
                💡 <strong>Suggerimento:</strong> Inserisci la quantità fisica trovata,
                il lotto e la scadenza del prodotto. Questi dati verranno salvati su Odoo.
              </p>
            </div>
          </div>

          {/* Footer - Action Buttons */}
          <div className="p-6 border-t border-white/20 bg-gray-900/50">
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={!quantity || parseFloat(quantity) < 0}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-500/25"
              >
                ✓ Conferma Conteggio
              </button>
              <button
                onClick={onClose}
                className="glass-strong px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
