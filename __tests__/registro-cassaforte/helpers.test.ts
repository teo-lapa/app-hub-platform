import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  calculateBanknotesTotal,
  calculateCoinsTotal,
  calculateTotal,
  isSerialNumberDuplicate,
  isValidSerialNumber,
  escapeHtml,
} from '@/lib/registro-cassaforte/helpers';
import type { BanknoteCount, CoinCount } from '@/lib/registro-cassaforte/types';

describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0');
    expect(formatCurrency(0)).toContain('CHF');
  });

  it('formats positive amounts', () => {
    const result = formatCurrency(1234.50);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('CHF');
  });
});

describe('calculateBanknotesTotal', () => {
  it('returns 0 for empty array', () => {
    expect(calculateBanknotesTotal([])).toBe(0);
  });

  it('calculates total correctly', () => {
    const banknotes: BanknoteCount[] = [
      { denomination: 100, count: 3, serial_numbers: [] },
      { denomination: 50, count: 2, serial_numbers: [] },
      { denomination: 20, count: 5, serial_numbers: [] },
    ];
    expect(calculateBanknotesTotal(banknotes)).toBe(500);
  });

  it('handles zero counts', () => {
    const banknotes: BanknoteCount[] = [
      { denomination: 1000, count: 0, serial_numbers: [] },
      { denomination: 200, count: 0, serial_numbers: [] },
    ];
    expect(calculateBanknotesTotal(banknotes)).toBe(0);
  });
});

describe('calculateCoinsTotal', () => {
  it('returns 0 for empty array', () => {
    expect(calculateCoinsTotal([])).toBe(0);
  });

  it('calculates total with decimal denominations', () => {
    const coins: CoinCount[] = [
      { denomination: 2, count: 3 },
      { denomination: 0.5, count: 4 },
      { denomination: 0.1, count: 10 },
    ];
    expect(calculateCoinsTotal(coins)).toBeCloseTo(9, 2);
  });
});

describe('calculateTotal', () => {
  it('sums banknotes and coins', () => {
    const banknotes: BanknoteCount[] = [
      { denomination: 100, count: 2, serial_numbers: [] },
    ];
    const coins: CoinCount[] = [
      { denomination: 2, count: 5 },
    ];
    expect(calculateTotal(banknotes, coins)).toBe(210);
  });

  it('returns 0 for all empty', () => {
    expect(calculateTotal([], [])).toBe(0);
  });
});

describe('isSerialNumberDuplicate', () => {
  const banknotes: BanknoteCount[] = [
    { denomination: 100, count: 2, serial_numbers: ['ABC1234567', 'XYZ9876543'] },
    { denomination: 50, count: 1, serial_numbers: ['DEF1111111'] },
  ];

  it('returns true for existing serial', () => {
    expect(isSerialNumberDuplicate('ABC1234567', banknotes)).toBe(true);
  });

  it('returns false for new serial', () => {
    expect(isSerialNumberDuplicate('NEW0000000', banknotes)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSerialNumberDuplicate('', banknotes)).toBe(false);
  });
});

describe('isValidSerialNumber', () => {
  it('accepts valid 10-char alphanumeric', () => {
    expect(isValidSerialNumber('ABC1234567')).toBe(true);
  });

  it('accepts with dashes/spaces (stripped)', () => {
    expect(isValidSerialNumber('ABC-123-4567')).toBe(true);
  });

  it('rejects empty', () => {
    expect(isValidSerialNumber('')).toBe(false);
  });

  it('rejects too short', () => {
    expect(isValidSerialNumber('ABC123')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidSerialNumber('ABC12345678')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes all dangerous characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});
