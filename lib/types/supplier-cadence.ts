/**
 * TypeScript Types per Supplier Order Cadence
 *
 * Sistema di gestione cadenze ordini ricorrenti ai fornitori.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Tipi di cadenza supportati
 */
export enum CadenceType {
  FIXED_DAYS = 'fixed_days', // Ordine ogni N giorni fissi
  WEEKLY = 'weekly', // Ordine settimanale (giorni specifici)
  BIWEEKLY = 'biweekly', // Ordine bisettimanale (ogni 2 settimane)
  MONTHLY = 'monthly', // Ordine mensile (giorno fisso del mese)
}

/**
 * Giorni della settimana per cadenze settimanali
 */
export enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

/**
 * Nomi giorni settimana (per display UI)
 */
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  [Weekday.SUNDAY]: 'Domenica',
  [Weekday.MONDAY]: 'Lunedì',
  [Weekday.TUESDAY]: 'Martedì',
  [Weekday.WEDNESDAY]: 'Mercoledì',
  [Weekday.THURSDAY]: 'Giovedì',
  [Weekday.FRIDAY]: 'Venerdì',
  [Weekday.SATURDAY]: 'Sabato',
};

/**
 * Nomi giorni settimana abbreviati
 */
export const WEEKDAY_SHORT_NAMES: Record<Weekday, string> = {
  [Weekday.SUNDAY]: 'Dom',
  [Weekday.MONDAY]: 'Lun',
  [Weekday.TUESDAY]: 'Mar',
  [Weekday.WEDNESDAY]: 'Mer',
  [Weekday.THURSDAY]: 'Gio',
  [Weekday.FRIDAY]: 'Ven',
  [Weekday.SATURDAY]: 'Sab',
};

/**
 * Status della cadenza
 */
export type CadenceStatus = 'on_time' | 'due_soon' | 'overdue' | 'inactive';

// ============================================================================
// DATABASE MODELS
// ============================================================================

/**
 * Configurazione cadenza ordine fornitore (row database)
 */
export interface SupplierOrderCadence {
  id: number;
  supplier_id: number; // Odoo res.partner ID
  supplier_name: string;

  // Configurazione cadenza
  cadence_type: CadenceType;
  cadence_value: number | null; // Giorni tra ordini o giorno del mese
  weekdays: Weekday[] | null; // Array giorni settimana (0-6)

  // Pianificazione
  is_active: boolean;
  next_order_date: string | null; // ISO date string: "2025-10-29"
  last_order_date: string | null; // ISO date string

  // Statistiche
  average_lead_time_days: number; // Lead time medio fornitore
  total_orders_last_6m: number; // Numero ordini ultimi 6 mesi
  calculated_cadence_days: number | null; // Cadenza reale calcolata

  // Note
  notes: string | null;

  // Audit
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  updated_by: string | null;
}

/**
 * Storico modifiche cadenza
 */
export interface SupplierOrderCadenceHistory {
  id: number;
  cadence_id: number;

  // Configurazione precedente
  previous_cadence_type: CadenceType | null;
  previous_cadence_value: number | null;
  previous_weekdays: Weekday[] | null;
  previous_next_order_date: string | null;

  // Nuova configurazione
  new_cadence_type: CadenceType | null;
  new_cadence_value: number | null;
  new_weekdays: Weekday[] | null;
  new_next_order_date: string | null;

  // Motivo modifica
  change_reason: string | null;

  // Audit
  changed_at: string; // ISO timestamp
  changed_by: string | null;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Payload per creare nuova cadenza
 */
export interface CreateCadenceRequest {
  supplier_id: number;
  supplier_name: string;
  cadence_type: CadenceType;
  cadence_value?: number | null;
  weekdays?: Weekday[] | null;
  next_order_date?: string | null;
  average_lead_time_days?: number;
  notes?: string | null;
  updated_by?: string;
}

/**
 * Payload per aggiornare cadenza esistente
 */
export interface UpdateCadenceRequest {
  cadence_type?: CadenceType;
  cadence_value?: number | null;
  weekdays?: Weekday[] | null;
  is_active?: boolean;
  next_order_date?: string | null;
  last_order_date?: string | null;
  average_lead_time_days?: number;
  notes?: string | null;
  updated_by?: string;
}

/**
 * Response con cadenza e metadata aggiuntivi
 */
export interface CadenceWithMetadata extends SupplierOrderCadence {
  // Campi calcolati runtime
  days_since_last_order: number | null;
  days_until_next_order: number | null;
  days_overdue: number; // 0 se in tempo, >0 se in ritardo
  status: 'on_time' | 'due_soon' | 'overdue' | 'inactive';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  is_overdue: boolean;
  critical_products_count: number;
}

/**
 * Fornitore da ordinare oggi (view: suppliers_to_order_today)
 */
export interface SupplierToOrderToday {
  id: number;
  supplier_id: number;
  supplier_name: string;
  cadence_type: CadenceType;
  next_order_date: string;
  last_order_date: string | null;
  average_lead_time_days: number;
  days_since_last_order: number;
  days_overdue: number;
}

/**
 * Prossimo ordine pianificato (view: upcoming_supplier_orders)
 */
export interface UpcomingSupplierOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  cadence_type: CadenceType;
  cadence_value: number | null;
  next_order_date: string;
  last_order_date: string | null;
  average_lead_time_days: number;
  days_until_order: number;
  suggested_order_date: string; // Data suggerita considerando lead time
}

// ============================================================================
// QUERY FILTERS
// ============================================================================

/**
 * Filtri per query elenco cadenze
 */
export interface CadenceFilters {
  is_active?: boolean;
  cadence_type?: CadenceType;
  supplier_ids?: number[];
  next_order_date_from?: string; // ISO date
  next_order_date_to?: string; // ISO date
  search?: string; // Ricerca per supplier_name
}

/**
 * Opzioni paginazione
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  order_by?: 'next_order_date' | 'supplier_name' | 'last_order_date';
  order_direction?: 'asc' | 'desc';
}

/**
 * Response paginata
 */
export interface PaginatedCadences {
  data: CadenceWithMetadata[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Configurazione cadenza per form UI
 */
export interface CadenceFormData {
  cadence_type: CadenceType;
  cadence_value: number | null;
  weekdays: Weekday[];
  next_order_date: Date | null;
  notes: string;
}

/**
 * Statistiche dashboard cadenze
 */
export interface CadenceStatistics {
  total_active: number;
  total_inactive: number;
  due_today: number;
  due_this_week: number;
  overdue: number;
  by_cadence_type: Record<CadenceType, number>;
}

/**
 * Suggerimento prossima data ordine
 */
export interface NextOrderSuggestion {
  suggested_date: string; // ISO date
  calculation_method: 'fixed_days' | 'weekly' | 'biweekly' | 'monthly';
  based_on_last_order: boolean;
  days_from_now: number;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Valida configurazione cadenza
 */
export function validateCadenceConfig(
  type: CadenceType,
  value: number | null,
  weekdays: Weekday[] | null
): { valid: boolean; error?: string } {
  switch (type) {
    case CadenceType.FIXED_DAYS:
      if (!value || value < 1 || value > 365) {
        return { valid: false, error: 'Cadence value deve essere tra 1 e 365 giorni' };
      }
      break;

    case CadenceType.WEEKLY:
    case CadenceType.BIWEEKLY:
      if (!weekdays || weekdays.length === 0) {
        return { valid: false, error: 'Devi selezionare almeno un giorno della settimana' };
      }
      if (weekdays.some((w) => w < 0 || w > 6)) {
        return { valid: false, error: 'Weekday deve essere tra 0 (Domenica) e 6 (Sabato)' };
      }
      break;

    case CadenceType.MONTHLY:
      if (!value || value < 1 || value > 31) {
        return { valid: false, error: 'Giorno del mese deve essere tra 1 e 31' };
      }
      break;

    default:
      return { valid: false, error: 'Tipo cadenza non valido' };
  }

  return { valid: true };
}

/**
 * Calcola status cadenza basato su date
 */
export function calculateCadenceStatus(
  nextOrderDate: string | null,
  isActive: boolean
): 'on_time' | 'due_soon' | 'overdue' | 'inactive' {
  if (!isActive) {
    return 'inactive';
  }

  if (!nextOrderDate) {
    return 'inactive';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(nextOrderDate);
  nextDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'overdue';
  }
  if (diffDays <= 3) {
    return 'due_soon';
  }
  return 'on_time';
}

/**
 * Formatta cadenza per display UI
 */
export function formatCadenceDisplay(cadence: SupplierOrderCadence): string {
  switch (cadence.cadence_type) {
    case CadenceType.FIXED_DAYS:
      return `Ogni ${cadence.cadence_value} giorni`;

    case CadenceType.WEEKLY:
      if (cadence.weekdays) {
        const days = cadence.weekdays
          .map((w) => WEEKDAY_SHORT_NAMES[w as Weekday])
          .join(', ');
        return `Settimanale: ${days}`;
      }
      return 'Settimanale';

    case CadenceType.BIWEEKLY:
      if (cadence.weekdays) {
        const days = cadence.weekdays
          .map((w) => WEEKDAY_SHORT_NAMES[w as Weekday])
          .join(', ');
        return `Bisettimanale: ${days}`;
      }
      return 'Bisettimanale';

    case CadenceType.MONTHLY:
      return `Mensile (giorno ${cadence.cadence_value})`;

    default:
      return 'Sconosciuto';
  }
}

/**
 * Calcola prossima data ordine (client-side)
 */
export function calculateNextOrderDate(
  type: CadenceType,
  value: number | null,
  weekdays: Weekday[] | null,
  lastOrderDate: Date | null
): Date {
  const baseDate = lastOrderDate || new Date();

  switch (type) {
    case CadenceType.FIXED_DAYS:
      if (!value) return baseDate;
      const nextFixed = new Date(baseDate);
      nextFixed.setDate(nextFixed.getDate() + value);
      return nextFixed;

    case CadenceType.WEEKLY:
      // Trova prossimo giorno nella settimana
      if (!weekdays || weekdays.length === 0) return baseDate;
      const nextWeekly = new Date(baseDate);
      nextWeekly.setDate(nextWeekly.getDate() + 1);
      while (!weekdays.includes(nextWeekly.getDay() as Weekday)) {
        nextWeekly.setDate(nextWeekly.getDate() + 1);
        if (nextWeekly.getDate() - baseDate.getDate() > 7) break; // Safety
      }
      return nextWeekly;

    case CadenceType.BIWEEKLY:
      // Come weekly ma +14 giorni
      if (!weekdays || weekdays.length === 0) return baseDate;
      const nextBiweekly = new Date(baseDate);
      nextBiweekly.setDate(nextBiweekly.getDate() + 14);
      return nextBiweekly;

    case CadenceType.MONTHLY:
      // Prossimo mese, stesso giorno
      if (!value) return baseDate;
      const nextMonthly = new Date(baseDate);
      nextMonthly.setMonth(nextMonthly.getMonth() + 1);
      nextMonthly.setDate(Math.min(value, getDaysInMonth(nextMonthly)));
      return nextMonthly;

    default:
      return baseDate;
  }
}

/**
 * Helper: giorni in un mese
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
