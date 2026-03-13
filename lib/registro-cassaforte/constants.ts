// Constants for Registro Cassaforte

export const BANKNOTE_DENOMINATIONS = [1000, 200, 100, 50, 20, 10];
export const COIN_DENOMINATIONS = [5, 2, 1, 0.5, 0.2, 0.1, 0.05];

export const BANKNOTE_COLORS: Record<number, string> = {
  10: 'from-yellow-400 to-amber-500',
  20: 'from-red-400 to-rose-500',
  50: 'from-green-400 to-emerald-500',
  100: 'from-blue-400 to-indigo-500',
  200: 'from-amber-600 to-orange-700',
  1000: 'from-purple-400 to-violet-500',
};

export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_CASSAFORTE_ADMIN_EMAIL || 'paul@lapa.ch';

// Auto-return to idle after success (ms)
export const SUCCESS_TIMEOUT_MS = 10000;
