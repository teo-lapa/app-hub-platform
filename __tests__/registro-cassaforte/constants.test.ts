import { describe, it, expect } from 'vitest';
import {
  BANKNOTE_DENOMINATIONS,
  COIN_DENOMINATIONS,
  BANKNOTE_COLORS,
  SUCCESS_TIMEOUT_MS,
} from '@/lib/registro-cassaforte/constants';

describe('constants', () => {
  it('has CHF banknote denominations in descending order', () => {
    expect(BANKNOTE_DENOMINATIONS).toEqual([1000, 200, 100, 50, 20, 10]);
    for (let i = 1; i < BANKNOTE_DENOMINATIONS.length; i++) {
      expect(BANKNOTE_DENOMINATIONS[i]).toBeLessThan(BANKNOTE_DENOMINATIONS[i - 1]!);
    }
  });

  it('has CHF coin denominations in descending order', () => {
    expect(COIN_DENOMINATIONS).toEqual([5, 2, 1, 0.5, 0.2, 0.1, 0.05]);
    for (let i = 1; i < COIN_DENOMINATIONS.length; i++) {
      expect(COIN_DENOMINATIONS[i]).toBeLessThan(COIN_DENOMINATIONS[i - 1]!);
    }
  });

  it('has a color for every banknote denomination', () => {
    for (const denom of BANKNOTE_DENOMINATIONS) {
      expect(BANKNOTE_COLORS[denom]).toBeDefined();
      expect(typeof BANKNOTE_COLORS[denom]).toBe('string');
    }
  });

  it('has a reasonable success timeout', () => {
    expect(SUCCESS_TIMEOUT_MS).toBe(10000);
    expect(SUCCESS_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
