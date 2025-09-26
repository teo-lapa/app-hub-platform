'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator as CalculatorIcon, X } from 'lucide-react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title?: string;
  initialValue?: string;
}

export function Calculator({ isOpen, onClose, onConfirm, title = "Calcolatrice", initialValue = "0" }: CalculatorProps) {
  const [display, setDisplay] = useState(initialValue);
  const [operation, setOperation] = useState<string | null>(null);
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const handleNumber = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(display);
    } else if (operation) {
      const currentValue = previousValue || '0';
      const newValue = calculate(parseFloat(currentValue), inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(String(newValue));
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(parseFloat(previousValue), inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setOperation(null);
    setPreviousValue(null);
    setWaitingForNewValue(false);
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const handleConfirm = () => {
    onConfirm(display);
    onClose();
    handleClear();
  };

  const handleCancel = () => {
    onClose();
    handleClear();
  };

  if (!isOpen) return null;

  const buttonClass = "aspect-square bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95";
  const operationButtonClass = "aspect-square bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95";
  const actionButtonClass = "col-span-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95 h-12";
  const cancelButtonClass = "col-span-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95 h-12";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-strong rounded-xl p-6 w-full max-w-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <CalculatorIcon className="w-5 h-5 text-blue-400" />
              {title}
            </h3>
            <button
              onClick={handleCancel}
              className="glass p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Display */}
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-right">
            <div className="text-3xl font-mono font-bold text-white truncate">
              {display}
            </div>
            {operation && previousValue && (
              <div className="text-sm text-gray-400 mt-1">
                {previousValue} {operation}
              </div>
            )}
          </div>

          {/* Calculator Grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {/* First Row */}
            <button onClick={handleClear} className={buttonClass}>C</button>
            <button onClick={() => setDisplay(display.slice(0, -1) || '0')} className={buttonClass}>⌫</button>
            <button onClick={() => handleOperation('÷')} className={operationButtonClass}>÷</button>
            <button onClick={() => handleOperation('×')} className={operationButtonClass}>×</button>

            {/* Second Row */}
            <button onClick={() => handleNumber('7')} className={buttonClass}>7</button>
            <button onClick={() => handleNumber('8')} className={buttonClass}>8</button>
            <button onClick={() => handleNumber('9')} className={buttonClass}>9</button>
            <button onClick={() => handleOperation('-')} className={operationButtonClass}>-</button>

            {/* Third Row */}
            <button onClick={() => handleNumber('4')} className={buttonClass}>4</button>
            <button onClick={() => handleNumber('5')} className={buttonClass}>5</button>
            <button onClick={() => handleNumber('6')} className={buttonClass}>6</button>
            <button onClick={() => handleOperation('+')} className={operationButtonClass}>+</button>

            {/* Fourth Row */}
            <button onClick={() => handleNumber('1')} className={buttonClass}>1</button>
            <button onClick={() => handleNumber('2')} className={buttonClass}>2</button>
            <button onClick={() => handleNumber('3')} className={buttonClass}>3</button>
            <button onClick={handleEquals} className="aspect-square row-span-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95">=</button>

            {/* Fifth Row */}
            <button onClick={() => handleNumber('0')} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold text-lg transition-colors active:scale-95 h-12">0</button>
            <button onClick={handleDecimal} className={buttonClass}>.</button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-3">
            <button onClick={handleConfirm} className={actionButtonClass}>
              Conferma
            </button>
            <button onClick={handleCancel} className={cancelButtonClass}>
              Annulla
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}