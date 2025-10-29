/**
 * Mock Data per Supplier Order Cadence
 *
 * Dati basati sull'analisi reale Odoo (data/supplier-cadence-analysis.json)
 * Usato per development e testing prima dell'integrazione database.
 */

import type { SupplierOrderCadence, CadenceWithMetadata } from '@/lib/types/supplier-cadence';
import { CadenceType, Weekday, calculateCadenceStatus } from '@/lib/types/supplier-cadence';

// ============================================================================
// MOCK DATA STORAGE (in-memory per ora)
// ============================================================================

let mockSuppliers: SupplierOrderCadence[] = [
  // Top 20 fornitori dall'analisi Odoo con cadenze realistiche
  {
    id: 1,
    supplier_id: 1593,
    supplier_name: 'ALIGRO Demaurex & Cie SA',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 3,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-10-30', // Domani
    last_order_date: '2025-10-27',
    average_lead_time_days: 0.4,
    total_orders_last_6m: 60,
    calculated_cadence_days: 2.6,
    notes: 'Fornitore principale, consegna rapida',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-10-27T14:30:00Z',
    updated_by: 'admin',
  },
  {
    id: 2,
    supplier_id: 1490,
    supplier_name: 'LATTICINI MOLISANI TAMBURRO SRL',
    cadence_type: CadenceType.WEEKLY,
    cadence_value: null,
    weekdays: [Weekday.MONDAY, Weekday.THURSDAY], // Lunedì e Giovedì
    is_active: true,
    next_order_date: '2025-10-30', // Giovedì
    last_order_date: '2025-10-27',
    average_lead_time_days: 3.1,
    total_orders_last_6m: 53,
    calculated_cadence_days: 3,
    notes: 'Latticini freschi, ordine bi-settimanale',
    created_at: '2025-01-20T09:00:00Z',
    updated_at: '2025-10-27T20:30:25Z',
    updated_by: 'admin',
  },
  {
    id: 3,
    supplier_id: 979,
    supplier_name: 'Macelleria FULVI',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 3,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-10-31', // Venerdì (appena ordinato oggi)
    last_order_date: '2025-10-29',
    average_lead_time_days: 0.9,
    total_orders_last_6m: 48,
    calculated_cadence_days: 3.4,
    notes: 'Carne fresca, consegna giornaliera',
    created_at: '2025-02-01T08:00:00Z',
    updated_at: '2025-10-29T16:50:51Z',
    updated_by: 'admin',
  },
  {
    id: 4,
    supplier_id: 1622,
    supplier_name: 'Meyerhans Mühlen AG',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 5,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-01', // Sabato
    last_order_date: '2025-10-27',
    average_lead_time_days: 2.6,
    total_orders_last_6m: 38,
    calculated_cadence_days: 4.4,
    notes: 'Farine e cereali, ordine settimanale',
    created_at: '2025-02-10T11:00:00Z',
    updated_at: '2025-10-27T20:30:25Z',
    updated_by: 'admin',
  },
  {
    id: 5,
    supplier_id: 1526,
    supplier_name: 'PASTIFICIO MARCELLO',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 5,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-02', // Domenica
    last_order_date: '2025-10-28',
    average_lead_time_days: 2.3,
    total_orders_last_6m: 35,
    calculated_cadence_days: 4.8,
    notes: 'Pasta fresca e secca',
    created_at: '2025-02-15T10:30:00Z',
    updated_at: '2025-10-28T20:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 6,
    supplier_id: 1631,
    supplier_name: 'PRODEGA MARKT TRANSGOURMET SCHWEIZ AG',
    cadence_type: CadenceType.WEEKLY,
    cadence_value: null,
    weekdays: [Weekday.MONDAY],
    is_active: true,
    next_order_date: '2025-11-03', // Prossimo Lunedì
    last_order_date: '2025-10-25',
    average_lead_time_days: 1.5,
    total_orders_last_6m: 30,
    calculated_cadence_days: 5.6,
    notes: 'Grossista generico, ordine settimanale',
    created_at: '2025-03-01T09:00:00Z',
    updated_at: '2025-10-25T20:30:26Z',
    updated_by: 'admin',
  },
  {
    id: 7,
    supplier_id: 2304,
    supplier_name: 'Polo SpA',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 7,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-03', // Lunedì
    last_order_date: '2025-10-27',
    average_lead_time_days: 3.3,
    total_orders_last_6m: 27,
    calculated_cadence_days: 6.5,
    notes: 'Prodotti confezionati',
    created_at: '2025-03-10T14:00:00Z',
    updated_at: '2025-10-27T21:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 8,
    supplier_id: 1493,
    supplier_name: 'SORI\' ITALIA S.R.L.',
    cadence_type: CadenceType.WEEKLY,
    cadence_value: null,
    weekdays: [Weekday.FRIDAY],
    is_active: true,
    next_order_date: '2025-10-31', // Venerdì
    last_order_date: '2025-10-24',
    average_lead_time_days: 3.8,
    total_orders_last_6m: 24,
    calculated_cadence_days: 6.8,
    notes: 'Ordine settimanale il venerdì',
    created_at: '2025-03-15T11:30:00Z',
    updated_at: '2025-10-24T20:30:21Z',
    updated_by: 'admin',
  },
  {
    id: 9,
    supplier_id: 8751,
    supplier_name: 'jirrolle Hygieneartikel',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 7,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-10-29', // OGGI (overdue)
    last_order_date: '2025-10-15',
    average_lead_time_days: 3.6,
    total_orders_last_6m: 24,
    calculated_cadence_days: 7,
    notes: 'Articoli igienici, ordine settimanale',
    created_at: '2025-03-20T10:00:00Z',
    updated_at: '2025-10-15T20:30:23Z',
    updated_by: 'admin',
  },
  {
    id: 10,
    supplier_id: 9509,
    supplier_name: 'GIFFONIELLO S.R.L.',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 8,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-01', // Sabato
    last_order_date: '2025-10-24',
    average_lead_time_days: 3.8,
    total_orders_last_6m: 21,
    calculated_cadence_days: 8.2,
    notes: null,
    created_at: '2025-04-01T09:30:00Z',
    updated_at: '2025-10-24T20:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 11,
    supplier_id: 5725,
    supplier_name: 'DAGO PINSA GMBH',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 9,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-05', // Mercoledì
    last_order_date: '2025-10-27',
    average_lead_time_days: 1.8,
    total_orders_last_6m: 19,
    calculated_cadence_days: 9.2,
    notes: 'Pinsa romana surgelata',
    created_at: '2025-04-10T15:00:00Z',
    updated_at: '2025-10-27T09:35:47Z',
    updated_by: 'admin',
  },
  {
    id: 12,
    supplier_id: 6301,
    supplier_name: 'ItaEmpire S.r.l.',
    cadence_type: CadenceType.WEEKLY,
    cadence_value: null,
    weekdays: [Weekday.THURSDAY],
    is_active: true,
    next_order_date: '2025-10-30', // Giovedì
    last_order_date: '2025-10-24',
    average_lead_time_days: 7,
    total_orders_last_6m: 19,
    calculated_cadence_days: 8.4,
    notes: 'Import Italia, lead time lungo',
    created_at: '2025-04-20T12:00:00Z',
    updated_at: '2025-10-24T05:07:07Z',
    updated_by: 'admin',
  },
  {
    id: 13,
    supplier_id: 9637,
    supplier_name: 'PASTIFICIO STROPPA SRL',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 10,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-06', // Giovedì
    last_order_date: '2025-10-27',
    average_lead_time_days: 3.7,
    total_orders_last_6m: 16,
    calculated_cadence_days: 9.7,
    notes: 'Pasta artigianale',
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-10-27T12:04:48Z',
    updated_by: 'admin',
  },
  {
    id: 14,
    supplier_id: 1550,
    supplier_name: 'RISTORIS SRL',
    cadence_type: CadenceType.BIWEEKLY,
    cadence_value: null,
    weekdays: [Weekday.WEDNESDAY],
    is_active: true,
    next_order_date: '2025-11-05', // Mercoledì (bisettimanale)
    last_order_date: '2025-10-22',
    average_lead_time_days: 6,
    total_orders_last_6m: 13,
    calculated_cadence_days: 13,
    notes: 'Ordine bisettimanale, mercoledì',
    created_at: '2025-05-10T11:00:00Z',
    updated_at: '2025-10-22T20:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 15,
    supplier_id: 1497,
    supplier_name: 'GENNARO AURICCHIO S.P.A.',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 14,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-10-31', // Venerdì
    last_order_date: '2025-10-17',
    average_lead_time_days: 7.4,
    total_orders_last_6m: 12,
    calculated_cadence_days: 14.5,
    notes: 'Formaggi pregiati, ordine bisettimanale',
    created_at: '2025-05-15T13:00:00Z',
    updated_at: '2025-10-17T20:30:34Z',
    updated_by: 'admin',
  },
  {
    id: 16,
    supplier_id: 7847,
    supplier_name: 'SALUMIFICIO F.LLI COATI S.P.A.',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 15,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-07', // Venerdì
    last_order_date: '2025-10-23',
    average_lead_time_days: 6.3,
    total_orders_last_6m: 12,
    calculated_cadence_days: 14.6,
    notes: 'Salumi premium',
    created_at: '2025-06-01T09:00:00Z',
    updated_at: '2025-10-23T20:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 17,
    supplier_id: 1530,
    supplier_name: 'LATTERIA SOCIALE MANTOVA SOC. AGR. COOP.',
    cadence_type: CadenceType.BIWEEKLY,
    cadence_value: null,
    weekdays: [Weekday.SATURDAY],
    is_active: true,
    next_order_date: '2025-11-08', // Sabato (bisettimanale)
    last_order_date: '2025-10-25',
    average_lead_time_days: 10.5,
    total_orders_last_6m: 11,
    calculated_cadence_days: 16.8,
    notes: 'Latteria cooperativa, ordine bisettimanale sabato',
    created_at: '2025-06-10T10:30:00Z',
    updated_at: '2025-10-25T20:30:23Z',
    updated_by: 'admin',
  },
  {
    id: 18,
    supplier_id: 1528,
    supplier_name: 'TEAM TARTUFI SRLS',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 20,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-18', // Martedì
    last_order_date: '2025-10-29',
    average_lead_time_days: 2.5,
    total_orders_last_6m: 10,
    calculated_cadence_days: 19.2,
    notes: 'Tartufi stagionali',
    created_at: '2025-06-20T14:00:00Z',
    updated_at: '2025-10-29T20:30:22Z',
    updated_by: 'admin',
  },
  {
    id: 19,
    supplier_id: 1560,
    supplier_name: 'SAN GIORGIO SPA',
    cadence_type: CadenceType.MONTHLY,
    cadence_value: 15, // Giorno 15 del mese
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-15', // 15 novembre
    last_order_date: '2025-10-20',
    average_lead_time_days: 11.5,
    total_orders_last_6m: 10,
    calculated_cadence_days: 17.4,
    notes: 'Ordine mensile il 15 del mese',
    created_at: '2025-07-01T11:00:00Z',
    updated_at: '2025-10-20T20:30:23Z',
    updated_by: 'admin',
  },
  {
    id: 20,
    supplier_id: 1494,
    supplier_name: 'SALUMIFICIO SORRENTINO SRL',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 21,
    weekdays: null,
    is_active: true,
    next_order_date: '2025-11-17', // Lunedì
    last_order_date: '2025-10-27',
    average_lead_time_days: 4.9,
    total_orders_last_6m: 9,
    calculated_cadence_days: 21.4,
    notes: 'Salumi tradizionali',
    created_at: '2025-07-10T12:30:00Z',
    updated_at: '2025-10-27T21:30:22Z',
    updated_by: 'admin',
  },
  // Alcuni inattivi per testing
  {
    id: 21,
    supplier_id: 1522,
    supplier_name: 'FERRAIUOLO FOODS SRL',
    cadence_type: CadenceType.FIXED_DAYS,
    cadence_value: 3,
    weekdays: null,
    is_active: false, // DISATTIVATO
    next_order_date: null,
    last_order_date: '2025-07-15',
    average_lead_time_days: 4.6,
    total_orders_last_6m: 20,
    calculated_cadence_days: 3.5,
    notes: 'Temporaneamente disattivato per mancanza stock',
    created_at: '2025-07-15T09:00:00Z',
    updated_at: '2025-07-15T20:30:31Z',
    updated_by: 'admin',
  },
];

// Counter per ID auto-increment
let nextId = mockSuppliers.length + 1;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calcola prossima data ordine basato su cadenza
 */
export function calculateNextOrderDate(
  lastOrderDate: string,
  cadenceType: CadenceType,
  cadenceValue: number | null,
  weekdays: number[] | null
): string {
  const lastDate = new Date(lastOrderDate);
  const nextDate = new Date(lastDate);

  switch (cadenceType) {
    case CadenceType.FIXED_DAYS:
      if (cadenceValue) {
        nextDate.setDate(nextDate.getDate() + cadenceValue);
      }
      break;

    case CadenceType.WEEKLY:
      // Trova prossimo giorno della settimana
      if (weekdays && weekdays.length > 0) {
        nextDate.setDate(nextDate.getDate() + 1);
        while (!weekdays.includes(nextDate.getDay())) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }
      break;

    case CadenceType.BIWEEKLY:
      // +14 giorni dal ultimo ordine
      if (weekdays && weekdays.length > 0) {
        nextDate.setDate(nextDate.getDate() + 14);
      }
      break;

    case CadenceType.MONTHLY:
      // Prossimo mese, stesso giorno
      if (cadenceValue) {
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(Math.min(cadenceValue, getDaysInMonth(nextDate)));
      }
      break;
  }

  return nextDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

/**
 * Giorni in un mese
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calcola metadata aggiuntivi per cadenza
 */
export function enrichCadenceWithMetadata(
  cadence: SupplierOrderCadence
): CadenceWithMetadata {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let days_since_last_order: number | null = null;
  let days_until_next_order: number | null = null;
  let days_overdue = 0;

  if (cadence.last_order_date) {
    const lastDate = new Date(cadence.last_order_date);
    lastDate.setHours(0, 0, 0, 0);
    days_since_last_order = Math.floor(
      (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  if (cadence.next_order_date) {
    const nextDate = new Date(cadence.next_order_date);
    nextDate.setHours(0, 0, 0, 0);
    days_until_next_order = Math.floor(
      (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days_until_next_order < 0) {
      days_overdue = Math.abs(days_until_next_order);
    }
  }

  const status = calculateCadenceStatus(cadence.next_order_date, cadence.is_active);

  // Calcola urgency basato su days_overdue e status
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (status === 'overdue' && days_overdue > 7) {
    urgency = 'critical';
  } else if (status === 'overdue') {
    urgency = 'high';
  } else if (status === 'due_soon') {
    urgency = 'medium';
  }

  // Calcola is_overdue
  const is_overdue = days_overdue > 0;

  // Mock: critical_products_count
  const critical_products_count = 0;

  return {
    ...cadence,
    days_since_last_order,
    days_until_next_order,
    days_overdue,
    status,
    urgency,
    is_overdue,
    critical_products_count,
  };
}

/**
 * Filtra fornitori in base a criteri
 */
export function filterSuppliers(
  suppliers: SupplierOrderCadence[],
  filters: {
    is_active?: boolean;
    cadence_type?: CadenceType;
    search?: string;
    status?: 'on_time' | 'due_soon' | 'overdue' | 'inactive';
  }
): SupplierOrderCadence[] {
  let filtered = [...suppliers];

  // Filtro attivi/inattivi
  if (filters.is_active !== undefined) {
    filtered = filtered.filter(s => s.is_active === filters.is_active);
  }

  // Filtro tipo cadenza
  if (filters.cadence_type) {
    filtered = filtered.filter(s => s.cadence_type === filters.cadence_type);
  }

  // Ricerca testuale
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(s =>
      s.supplier_name.toLowerCase().includes(searchLower)
    );
  }

  // Filtro status (richiede calcolo metadata)
  if (filters.status) {
    filtered = filtered.filter(s => {
      const status = calculateCadenceStatus(s.next_order_date, s.is_active);
      return status === filters.status;
    });
  }

  return filtered;
}

/**
 * Ordina fornitori
 */
export function sortSuppliers(
  suppliers: SupplierOrderCadence[],
  sortBy: 'next_order_date' | 'supplier_name' | 'last_order_date' = 'next_order_date',
  direction: 'asc' | 'desc' = 'asc'
): SupplierOrderCadence[] {
  const sorted = [...suppliers];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'supplier_name':
        comparison = a.supplier_name.localeCompare(b.supplier_name);
        break;

      case 'next_order_date':
        // Null values last
        if (!a.next_order_date && !b.next_order_date) return 0;
        if (!a.next_order_date) return 1;
        if (!b.next_order_date) return -1;
        comparison = a.next_order_date.localeCompare(b.next_order_date);
        break;

      case 'last_order_date':
        // Null values last
        if (!a.last_order_date && !b.last_order_date) return 0;
        if (!a.last_order_date) return 1;
        if (!b.last_order_date) return -1;
        comparison = a.last_order_date.localeCompare(b.last_order_date);
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Calcola statistiche dashboard
 */
export function calculateStatistics(suppliers: SupplierOrderCadence[]) {
  const active = suppliers.filter(s => s.is_active);
  const inactive = suppliers.filter(s => !s.is_active);

  const today = new Date().toISOString().split('T')[0];
  const thisWeekEnd = new Date();
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  const thisWeekEndStr = thisWeekEnd.toISOString().split('T')[0];

  const due_today = active.filter(s => s.next_order_date === today).length;
  const due_this_week = active.filter(
    s => s.next_order_date && s.next_order_date <= thisWeekEndStr && s.next_order_date > today
  ).length;

  const overdue = active.filter(s => {
    if (!s.next_order_date) return false;
    return s.next_order_date < today;
  }).length;

  const by_cadence_type = {
    [CadenceType.FIXED_DAYS]: suppliers.filter(s => s.cadence_type === CadenceType.FIXED_DAYS).length,
    [CadenceType.WEEKLY]: suppliers.filter(s => s.cadence_type === CadenceType.WEEKLY).length,
    [CadenceType.BIWEEKLY]: suppliers.filter(s => s.cadence_type === CadenceType.BIWEEKLY).length,
    [CadenceType.MONTHLY]: suppliers.filter(s => s.cadence_type === CadenceType.MONTHLY).length,
  };

  return {
    total_active: active.length,
    total_inactive: inactive.length,
    due_today,
    due_this_week,
    overdue,
    by_cadence_type,
  };
}

// ============================================================================
// CRUD OPERATIONS (in-memory)
// ============================================================================

/**
 * Ottieni tutti i fornitori
 */
export function getAllSuppliers(): SupplierOrderCadence[] {
  return [...mockSuppliers];
}

/**
 * Ottieni fornitore per ID
 */
export function getSupplierById(id: number): SupplierOrderCadence | null {
  return mockSuppliers.find(s => s.id === id) || null;
}

/**
 * Crea nuova cadenza
 */
export function createSupplierCadence(
  data: Omit<SupplierOrderCadence, 'id' | 'created_at' | 'updated_at'>
): SupplierOrderCadence {
  const newCadence: SupplierOrderCadence = {
    ...data,
    id: nextId++,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockSuppliers.push(newCadence);
  return newCadence;
}

/**
 * Aggiorna cadenza esistente
 */
export function updateSupplierCadence(
  id: number,
  updates: Partial<Omit<SupplierOrderCadence, 'id' | 'created_at'>>
): SupplierOrderCadence | null {
  const index = mockSuppliers.findIndex(s => s.id === id);
  if (index === -1) return null;

  mockSuppliers[index] = {
    ...mockSuppliers[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  return mockSuppliers[index];
}

/**
 * Elimina cadenza
 */
export function deleteSupplierCadence(id: number): boolean {
  const index = mockSuppliers.findIndex(s => s.id === id);
  if (index === -1) return false;

  mockSuppliers.splice(index, 1);
  return true;
}

/**
 * Ottieni fornitori da ordinare oggi
 */
export function getSuppliersToOrderToday(): SupplierOrderCadence[] {
  const today = new Date().toISOString().split('T')[0];
  return mockSuppliers.filter(
    s => s.is_active && s.next_order_date && s.next_order_date <= today
  );
}

/**
 * Ottieni prossimi ordini (N giorni)
 */
export function getUpcomingOrders(days: number = 7): SupplierOrderCadence[] {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return mockSuppliers.filter(
    s =>
      s.is_active &&
      s.next_order_date &&
      s.next_order_date > todayStr &&
      s.next_order_date <= endDateStr
  );
}
