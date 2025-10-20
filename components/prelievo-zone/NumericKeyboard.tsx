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
  title = "Calcolatrice",
  productName
}: NumericKeyboardProps) {
  const [value, setValue] = useState(initialValue.toString());
  const [displayValue, setDisplayValue] = useState(initialValue.toString());
  const [operation, setOperation] = useState<string | null>(null);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue.toString());
      setDisplayValue(initialValue.toString());
      setOperation(null);
      setPreviousValue(null);
      setWaitingForOperand(false);
      setError(null);
    }
  }, [isOpen, initialValue]);

  const calculate = (firstOperand: number, secondOperand: number, op: string): number => {
    switch (op) {
      case '+':
        return firstOperand + secondOperand;
      case '-':
        return firstOperand - secondOperand;
      case '×':
        return firstOperand * secondOperand;
      case '÷':
        if (secondOperand === 0) {
          throw new Error('Divisione per zero');
        }
        return firstOperand / secondOperand;
      default:
        return secondOperand;
    }
  };

  const handleKeyPress = (key: string) => {
    setError(null);

    // Clear (C)
    if (key === 'C') {
      setValue('0');
      setDisplayValue('0');
      setOperation(null);
      setPreviousValue(null);
      setWaitingForOperand(false);
      return;
    }

    // Backspace (←)
    if (key === '←') {
      if (waitingForOperand) return;

      if (displayValue.length > 1) {
        const newValue = displayValue.slice(0, -1);
        setDisplayValue(newValue);
        setValue(newValue);
      } else {
        setDisplayValue('0');
        setValue('0');
      }
      return;
    }

    // Decimal point (.)
    if (key === '.') {
      if (waitingForOperand) {
        setDisplayValue('0.');
        setValue('0.');
        setWaitingForOperand(false);
      } else if (!displayValue.includes('.')) {
        const newValue = displayValue + '.';
        setDisplayValue(newValue);
        setValue(newValue);
      }
      return;
    }

    // Operations (+, -, ×, ÷)
    if (['+', '-', '×', '÷'].includes(key)) {
      const currentValue = parseFloat(displayValue);

      if (previousValue !== null && operation && !waitingForOperand) {
        try {
          const result = calculate(parseFloat(previousValue), currentValue, operation);
          setDisplayValue(result.toString());
          setValue(result.toString());
          setPreviousValue(result.toString());
        } catch (err: any) {
          setError(err.message);
          return;
        }
      } else {
        setPreviousValue(displayValue);
      }

      setOperation(key);
      setWaitingForOperand(true);
      return;
    }

    // Equals (=)
    if (key === '=') {
      if (previousValue !== null && operation) {
        try {
          const result = calculate(parseFloat(previousValue), parseFloat(displayValue), operation);
          setDisplayValue(result.toString());
          setValue(result.toString());
          setPreviousValue(null);
          setOperation(null);
          setWaitingForOperand(true);
        } catch (err: any) {
          setError(err.message);
        }
      }
      return;
    }

    // Numbers (0-9)
    if (waitingForOperand) {
      setDisplayValue(key);
      setValue(key);
      setWaitingForOperand(false);
    } else {
      const newValue = displayValue === '0' ? key : displayValue + key;
      setDisplayValue(newValue);
      setValue(newValue);
    }
  };

  const handleConfirm = () => {
    const numValue = parseFloat(displayValue);

    if (isNaN(numValue) || numValue < 0) {
      setError('Valore non valido');
      return;
    }

    // Vibrazione per feedback conferma
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }

    onConfirm(numValue);
    onClose();
  };

  // Layout calcolatrice con operazioni
  const keys = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['.', '0', '=', '+']
  ];

  if (!isOpen) return null;

  const currentDisplayValue = parseFloat(displayValue) || 0;
  const percentage = maxValue ? Math.min((currentDisplayValue / maxValue) * 100, 100) : 0;

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
              {/* Mostra operazione in corso */}
              {previousValue && operation && (
                <div className="text-sm text-blue-400 mb-1 font-mono">
                  {previousValue} {operation}
                </div>
              )}

              <div className="text-4xl font-bold mb-2 font-mono">
                {displayValue}
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
            {/* Clear and Delete buttons */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => handleKeyPress('C')}
                className="glass py-3 px-4 rounded-lg hover:bg-red-500/20 transition-colors text-red-400 font-semibold"
              >
                C
              </button>
              <button
                onClick={() => handleKeyPress('←')}
                className="glass py-3 px-4 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              >
                <Delete className="w-4 h-4" />
                Cancella
              </button>
            </div>

            {/* Number Keys with Operations - 4 columns */}
            {keys.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-2 mb-2">
                {row.map((key) => {
                  const isOperation = ['+', '-', '×', '÷', '='].includes(key);
                  const isEquals = key === '=';

                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`py-4 px-4 rounded-lg transition-all text-lg font-semibold
                        ${isEquals
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : isOperation
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'glass hover:bg-white/20'
                        }
                        ${operation === key && !isEquals ? 'ring-2 ring-blue-400' : ''}
                      `}
                    >
                      {key}
                    </button>
                  );
                })}
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