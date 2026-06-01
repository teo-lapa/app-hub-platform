// Conteggio ferie LAPA: 20 giorni/anno, maturazione +1,66 gg per ogni mese compiuto.
// Maturazione a scatti mensili; scalano dal monte solo le ferie APPROVATE di tipo "Ferie pagate".

export const ANNUAL_DAYS = 20;
export const MONTHLY_ACCRUAL = ANNUAL_DAYS / 12; // 1,6667
export const PAID_LEAVE_TYPE_ID = 1; // "Ferie pagate"

// Mesi interi compiuti tra start (incluso) e end: scatta all'anniversario del giorno del mese.
export function completedMonths(start: Date, end: Date): number {
  if (end <= start) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function r1(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FerieBalance = {
  year: number;
  anchor: string;          // data inizio conteggio usata (override o first_contract_date)
  accrualStart: string;    // max(1 gennaio anno, anchor)
  monthsMatured: number;   // mesi compiuti a oggi nell'anno
  matured: number;         // giorni maturati a oggi
  entitlementYear: number; // giorni spettanti a fine anno (pro-rata se entrato a metà anno)
  taken: number;           // giorni godutu (Ferie pagate APPROVATE) nell'anno
  pending: number;         // giorni in attesa di approvazione
  remaining: number;       // disponibili adesso = matured - taken
  remainingYear: number;   // ancora da fare entro fine anno = entitlementYear - taken
};

/**
 * Calcola il saldo ferie per l'anno indicato (default: anno corrente).
 * anchorDate = x_ferie_start_date || first_contract_date (formato YYYY-MM-DD).
 * takenDays/pendingDays = somma number_of_days delle ferie pagate dell'anno, già filtrate per stato.
 */
export function computeBalance(opts: {
  anchorDate: string | null;
  takenDays: number;
  pendingDays: number;
  today?: Date;
}): FerieBalance {
  const today = opts.today ?? new Date();
  const year = today.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const anchor = opts.anchorDate ? new Date(opts.anchorDate + 'T00:00:00') : yearStart;
  // Anno "pulito": niente arretrati anni passati → si parte al massimo dal 1 gennaio.
  const accrualStart = anchor > yearStart ? anchor : yearStart;

  const monthsMatured = completedMonths(accrualStart, today);
  const monthsYear = completedMonths(accrualStart, yearEnd) + 1; // +1: il mese finale conta intero a fine anno

  const matured = r1(Math.min(monthsMatured * MONTHLY_ACCRUAL, ANNUAL_DAYS));
  const entitlementYear = r1(Math.min(monthsYear * MONTHLY_ACCRUAL, ANNUAL_DAYS));

  const taken = r1(opts.takenDays);
  const pending = r1(opts.pendingDays);

  return {
    year,
    anchor: toISO(anchor),
    accrualStart: toISO(accrualStart),
    monthsMatured,
    matured,
    entitlementYear,
    taken,
    pending,
    remaining: r1(matured - taken),
    remainingYear: r1(entitlementYear - taken),
  };
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Somma i giorni di ferie pagate dell'anno corrente da una lista di hr.leave.
// stateSet: stati da contare (es. ['validate'] per i goduti, ['confirm','validate1'] per gli in attesa).
export function sumPaidLeaveDays(
  leaves: Array<{ type_id?: number; holiday_status_id?: any; days?: number; number_of_days?: number; state: string; date_from?: string; request_date_from?: string }>,
  stateSet: string[],
  year: number,
): number {
  let sum = 0;
  for (const l of leaves) {
    const typeId = l.type_id ?? (Array.isArray(l.holiday_status_id) ? l.holiday_status_id[0] : l.holiday_status_id);
    if (typeId !== PAID_LEAVE_TYPE_ID) continue;
    if (!stateSet.includes(l.state)) continue;
    const ref = (l.date_from || l.request_date_from || '').toString();
    if (!ref.startsWith(String(year))) continue;
    sum += Number(l.days ?? l.number_of_days ?? 0);
  }
  return sum;
}
