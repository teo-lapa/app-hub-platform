'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Delete, Check, Calculator } from 'lucide-react';

interface NumericKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  initialValue?: number;
  maxValue?: number;
  title?: string;
  productName?: string;
}

export function NumericKeyboard({
  isOpen,
  onClose,
  onConfirm,
  initialValue = 0,
  maxValue,
  title = "Inserisci Quantità",
  productName
}: NumericKeyboardProps) {
  const [value, setValue] = useState(initialValue.toString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue.toString());
      setError(null);
    }
  }, [isOpen, initialValue]);

  const handleKeyPress = (key: string) => {
    setError(null);

    if (key === 'C') {
      setValue('0');
      return;
    }

    if (key === '←') {
      if (value.length > 1) {
        setValue(value.slice(0, -1));
      } else {
        setValue('0');
      }
      return;
    }

    if (key === '.') {
      if (!value.includes('.')) {
        setValue(value + '.');
      }
      return;
    }

    // Aggiungi numero
    if (value === '0' && key !== '.') {
      setValue(key);
    } else {
      const newValue = value + key;

      // Verifica max value
      if (maxValue !== undefined) {
        const numValue = parseFloat(newValue);
        if (numValue > maxValue) {
          setError(`Max: ${maxValue}`);
          // Vibrazione per feedback errore
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
          return;
        }
      }

      setValue(newValue);
    }
  };

  const handleConfirm = () => {
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue < 0) {
      setError('Valore non valido');
      return;
    }

    if (maxValue !== undefined && numValue > maxValue) {
      setError(`Il valore non può superare ${maxValue}`);
      return;
    }

    // Vibrazione per feedback conferma
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }

    onConfirm(numValue);
    onClose();
  };

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', '←']
  ];

  if (!isOpen) return null;

  const displayValue = parseFloat(value) || 0;
  const percentage = maxValue ? Math.min((displayValue / maxValue) * 100, 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="glass-strong rounded-t-xl p-4 border-b border-white/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-400" />
                {title}
              </h3>
              <button
                onClick={onClose}
                className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {productName && (
              <p className="text-sm text-muted-foreground truncate">
                {productName}
              </p>
            )}
          </div>

          {/* Display */}
          <div className="glass-strong p-4 border-b border-white/20">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 font-mono">
                {value}
              </div>

              {maxValue !== undefined && (
                <>
                  <div className="text-sm text-muted-foreground mb-2">
                    Max: {maxValue}
                  </div>

                  {/* Progress Bar */}
                  <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full ${percentage > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm mt-2"
                >
                  {error}
                </motion.p>
              )}
            </div>
          </div>

          {/* Keyboard */}
          <div className="glass-strong p-4 rounded-b-xl">
            <div className="grid grid-cols-3 gap-2 mb-2">
              {/* Clear button */}
              <button
                onClick={() => handleKeyPress('C')}
                className="glass py-4 px-4 rounded-lg hover:bg-red-500/20 transition-colors text-red-400 font-semibold"
              >
                C
              </button>

              {/* Empty space */}
              <div></div>

              {/* Delete button */}
              <button
                onClick={() => handleKeyPress('←')}
                className="glass py-4 px-4 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Number Keys */}
            {keys.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-3 gap-2 mb-2">
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className={`glass py-4 px-4 rounded-lg hover:bg-white/20 transition-all text-lg font-semibold
                      ${key === '0' ? 'col-span-1' : ''}
                      ${key === '←' ? 'flex items-center justify-center' : ''}
                    `}
                  >
                    {key === '←' ? <Delete className="w-5 h-5" /> : key}
                  </button>
                ))}
              </div>
            ))}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={onClose}
                className="glass-strong py-3 px-4 rounded-lg hover:bg-white/20 transition-colors font-semibold"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Conferma
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}