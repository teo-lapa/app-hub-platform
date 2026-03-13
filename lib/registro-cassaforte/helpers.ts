// Helper functions for Registro Cassaforte

import type { BanknoteCount, CoinCount } from './types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(amount);
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('it-CH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('it-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const calculateBanknotesTotal = (banknotes: BanknoteCount[]): number => {
  return banknotes.reduce((sum, b) => sum + b.denomination * b.count, 0);
};

export const calculateCoinsTotal = (coins: CoinCount[]): number => {
  return coins.reduce((sum, c) => sum + c.denomination * c.count, 0);
};

export const calculateTotal = (banknotes: BanknoteCount[], coins: CoinCount[]): number => {
  return calculateBanknotesTotal(banknotes) + calculateCoinsTotal(coins);
};

export const isSerialNumberDuplicate = (serialNumber: string, banknotes: BanknoteCount[]): boolean => {
  if (!serialNumber) return false;
  return banknotes.some(b => b.serial_numbers.includes(serialNumber));
};

export const isValidSerialNumber = (serialNumber: string): boolean => {
  if (!serialNumber) return false;
  const cleaned = serialNumber.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.length === 10;
};

/**
 * Escape HTML to prevent XSS in Odoo chatter messages
 */
export const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
