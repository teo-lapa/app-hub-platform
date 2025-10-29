/**
 * Supplier Order Cadence - Database Client
 * Gestisce pianificazione ordini ricorrenti ai fornitori
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Query con indici ottimizzati (supplier_id, next_order_date)
 * - Partial index su is_active per ridurre index size
 * - Batch queries dove possibile
 * - Connection pooling tramite @vercel/postgres
 * - Query result caching ready (aggiungere Redis se necessario)
 *
 * FALLBACK MODE: Se POSTGRES_URL non configurato, usa memoria in-memory (non persistente)
 */

import { sql } from '@vercel/postgres';
import {
  SupplierOrderCadence,
  SupplierOrderCadenceHistory,
  CreateCadenceRequest,
  UpdateCadenceRequest,
  CadenceWithMetadata,
  SupplierToOrderToday,
  UpcomingSupplierOrder,
  CadenceFilters,
  PaginationOptions,
  PaginatedCadences,
  CadenceStatistics,
  calculateCadenceStatus,
} from '@/lib/types/supplier-cadence';

// ========== CONFIG ==========

const hasDatabase = !!process.env.POSTGRES_URL;

// In-memory storage (fallback quando DB non configurato)
const memoryStore = {
  cadences: new Map<number, SupplierOrderCadence>(), // Key: supplier_id
  history: new Map<number, SupplierOrderCadenceHistory[]>(), // Key: cadence_id
  nextId: 1,
  nextHistoryId: 1,
};

if (!hasDatabase) {
  console.warn(
    '⚠️  POSTGRES_URL not found - Using in-memory storage (cadences will be lost on restart)'
  );
}

// ========== HELPER FUNCTIONS ==========

/**
 * Enricha cadenza con metadata calcolati
 */
function enrichCadenceWithMetadata(cadence: SupplierOrderCadence): CadenceWithMetadata {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calcola days_since_last_order
  let daysSinceLastOrder: number | null = null;
  if (cadence.last_order_date) {
    const lastDate = new Date(cadence.last_order_date);
    lastDate.setHours(0, 0, 0, 0);
    daysSinceLastOrder = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Calcola days_until_next_order
  let daysUntilNextOrder: number | null = null;
  if (cadence.next_order_date) {
    const nextDate = new Date(cadence.next_order_date);
    nextDate.setHours(0, 0, 0, 0);
    daysUntilNextOrder = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Calcola days_overdue
  let daysOverdue = 0;
  if (cadence.next_order_date && cadence.is_active) {
    const nextDate = new Date(cadence.next_order_date);
    nextDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
    daysOverdue = Math.max(0, diff);
  }

  // Calcola status
  const status = calculateCadenceStatus(cadence.next_order_date, cadence.is_active);

  // Calcola urgency basato su days_overdue e status
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (status === 'overdue' && daysOverdue > 7) {
    urgency = 'critical';
  } else if (status === 'overdue') {
    urgency = 'high';
  } else if (status === 'due_soon') {
    urgency = 'medium';
  }

  // Calcola is_overdue
  const is_overdue = daysOverdue > 0;

  // TODO: critical_products_count dovrebbe venire da una query al DB
  // Per ora usiamo 0 come placeholder
  const critical_products_count = 0;

  return {
    ...cadence,
    days_since_last_order: daysSinceLastOrder,
    days_until_next_order: daysUntilNextOrder,
    days_overdue: daysOverdue,
    status,
    urgency,
    is_overdue,
    critical_products_count,
  };
}

/**
 * Build WHERE clause dinamico per filtri
 */
function buildWhereClause(filters: CadenceFilters): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    params.push(filters.is_active);
  }

  if (filters.cadence_type) {
    conditions.push(`cadence_type = $${paramIndex++}`);
    params.push(filters.cadence_type);
  }

  if (filters.supplier_ids && filters.supplier_ids.length > 0) {
    conditions.push(`supplier_id = ANY($${paramIndex++})`);
    params.push(filters.supplier_ids);
  }

  if (filters.next_order_date_from) {
    conditions.push(`next_order_date >= $${paramIndex++}`);
    params.push(filters.next_order_date_from);
  }

  if (filters.next_order_date_to) {
    conditions.push(`next_order_date <= $${paramIndex++}`);
    params.push(filters.next_order_date_to);
  }

  if (filters.search) {
    conditions.push(`supplier_name ILIKE $${paramIndex++}`);
    params.push(`%${filters.search}%`);
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

// ========== CRUD OPERATIONS ==========

/**
 * Ottieni cadenza per fornitore (primary query)
 * PERFORMANCE: Usa index idx_supplier_cadence_supplier
 */
export async function getSupplierCadence(
  supplierId: number
): Promise<CadenceWithMetadata | null> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cadence = memoryStore.cadences.get(supplierId);
    if (!cadence) return null;
    return enrichCadenceWithMetadata(cadence);
  }

  // DATABASE mode - usa index su supplier_id
  const result = await sql<SupplierOrderCadence>`
    SELECT * FROM supplier_order_cadence
    WHERE supplier_id = ${supplierId}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  return enrichCadenceWithMetadata(result.rows[0]);
}

/**
 * Ottieni cadenza per ID
 */
export async function getCadenceById(id: number): Promise<CadenceWithMetadata | null> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    for (const cadence of Array.from(memoryStore.cadences.values())) {
      if (cadence.id === id) {
        return enrichCadenceWithMetadata(cadence);
      }
    }
    return null;
  }

  // DATABASE mode
  const result = await sql<SupplierOrderCadence>`
    SELECT * FROM supplier_order_cadence
    WHERE id = ${id}
    LIMIT 1
  `;

  if (result.rows.length === 0) return null;

  return enrichCadenceWithMetadata(result.rows[0]);
}

/**
 * Crea nuova cadenza
 * IMPORTANTE: supplier_id ha UNIQUE constraint
 */
export async function createSupplierCadence(
  data: CreateCadenceRequest
): Promise<CadenceWithMetadata> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    // Check UNIQUE constraint
    if (memoryStore.cadences.has(data.supplier_id)) {
      throw new Error(`Cadenza già esistente per supplier_id ${data.supplier_id}`);
    }

    const newCadence: SupplierOrderCadence = {
      id: memoryStore.nextId++,
      supplier_id: data.supplier_id,
      supplier_name: data.supplier_name,
      cadence_type: data.cadence_type,
      cadence_value: data.cadence_value ?? null,
      weekdays: data.weekdays ?? null,
      is_active: true,
      next_order_date: data.next_order_date ?? null,
      last_order_date: null,
      average_lead_time_days: data.average_lead_time_days ?? 0,
      total_orders_last_6m: 0,
      calculated_cadence_days: null,
      notes: data.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: data.updated_by ?? null,
    };

    memoryStore.cadences.set(data.supplier_id, newCadence);
    return enrichCadenceWithMetadata(newCadence);
  }

  // DATABASE mode
  const result = await sql<SupplierOrderCadence>`
    INSERT INTO supplier_order_cadence (
      supplier_id,
      supplier_name,
      cadence_type,
      cadence_value,
      weekdays,
      next_order_date,
      average_lead_time_days,
      notes,
      updated_by
    )
    VALUES (
      ${data.supplier_id},
      ${data.supplier_name},
      ${data.cadence_type},
      ${data.cadence_value ?? null},
      ${data.weekdays ? JSON.stringify(data.weekdays) : null},
      ${data.next_order_date ?? null},
      ${data.average_lead_time_days ?? 0},
      ${data.notes ?? null},
      ${data.updated_by ?? null}
    )
    RETURNING *
  `;

  return enrichCadenceWithMetadata(result.rows[0]);
}

/**
 * Aggiorna cadenza esistente
 * PERFORMANCE: Salva snapshot in history table per audit
 */
export async function updateSupplierCadence(
  supplierId: number,
  updates: UpdateCadenceRequest,
  changeReason?: string
): Promise<CadenceWithMetadata> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const existing = memoryStore.cadences.get(supplierId);
    if (!existing) {
      throw new Error(`Cadenza non trovata per supplier_id ${supplierId}`);
    }

    // Salva history
    const historyEntry: SupplierOrderCadenceHistory = {
      id: memoryStore.nextHistoryId++,
      cadence_id: existing.id,
      previous_cadence_type: existing.cadence_type,
      previous_cadence_value: existing.cadence_value,
      previous_weekdays: existing.weekdays,
      previous_next_order_date: existing.next_order_date,
      new_cadence_type: updates.cadence_type ?? existing.cadence_type,
      new_cadence_value: updates.cadence_value ?? existing.cadence_value,
      new_weekdays: updates.weekdays ?? existing.weekdays,
      new_next_order_date: updates.next_order_date ?? existing.next_order_date,
      change_reason: changeReason ?? null,
      changed_at: new Date().toISOString(),
      changed_by: updates.updated_by ?? null,
    };

    const history = memoryStore.history.get(existing.id) || [];
    history.push(historyEntry);
    memoryStore.history.set(existing.id, history);

    // Update cadence
    const updated: SupplierOrderCadence = {
      ...existing,
      ...(updates.cadence_type && { cadence_type: updates.cadence_type }),
      ...(updates.cadence_value !== undefined && { cadence_value: updates.cadence_value }),
      ...(updates.weekdays !== undefined && { weekdays: updates.weekdays }),
      ...(updates.is_active !== undefined && { is_active: updates.is_active }),
      ...(updates.next_order_date !== undefined && { next_order_date: updates.next_order_date }),
      ...(updates.last_order_date !== undefined && { last_order_date: updates.last_order_date }),
      ...(updates.average_lead_time_days !== undefined && {
        average_lead_time_days: updates.average_lead_time_days,
      }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      updated_at: new Date().toISOString(),
      updated_by: updates.updated_by ?? null,
    };

    memoryStore.cadences.set(supplierId, updated);
    return enrichCadenceWithMetadata(updated);
  }

  // DATABASE mode - usa transaction per consistenza
  await sql.query('BEGIN');

  try {
    // 1. Leggi cadenza corrente per history
    const current = await sql<SupplierOrderCadence>`
      SELECT * FROM supplier_order_cadence
      WHERE supplier_id = ${supplierId}
      LIMIT 1
    `;

    if (current.rows.length === 0) {
      throw new Error(`Cadenza non trovata per supplier_id ${supplierId}`);
    }

    const existing = current.rows[0];

    // 2. Salva history (se ci sono cambiamenti rilevanti)
    if (
      updates.cadence_type ||
      updates.cadence_value !== undefined ||
      updates.weekdays !== undefined ||
      updates.next_order_date !== undefined
    ) {
      await sql`
        INSERT INTO supplier_order_cadence_history (
          cadence_id,
          previous_cadence_type,
          previous_cadence_value,
          previous_weekdays,
          previous_next_order_date,
          new_cadence_type,
          new_cadence_value,
          new_weekdays,
          new_next_order_date,
          change_reason,
          changed_by
        )
        VALUES (
          ${existing.id},
          ${existing.cadence_type},
          ${existing.cadence_value},
          ${existing.weekdays ? JSON.stringify(existing.weekdays) : null},
          ${existing.next_order_date},
          ${updates.cadence_type ?? existing.cadence_type},
          ${updates.cadence_value ?? existing.cadence_value},
          ${updates.weekdays ? JSON.stringify(updates.weekdays) : existing.weekdays ? JSON.stringify(existing.weekdays) : null},
          ${updates.next_order_date ?? existing.next_order_date},
          ${changeReason ?? null},
          ${updates.updated_by ?? null}
        )
      `;
    }

    // 3. Update cadenza
    const result = await sql<SupplierOrderCadence>`
      UPDATE supplier_order_cadence
      SET
        cadence_type = COALESCE(${updates.cadence_type ?? null}, cadence_type),
        cadence_value = COALESCE(${updates.cadence_value ?? null}, cadence_value),
        weekdays = COALESCE(${updates.weekdays ? JSON.stringify(updates.weekdays) : null}, weekdays),
        is_active = COALESCE(${updates.is_active ?? null}, is_active),
        next_order_date = COALESCE(${updates.next_order_date ?? null}, next_order_date),
        last_order_date = COALESCE(${updates.last_order_date ?? null}, last_order_date),
        average_lead_time_days = COALESCE(${updates.average_lead_time_days ?? null}, average_lead_time_days),
        notes = COALESCE(${updates.notes ?? null}, notes),
        updated_by = ${updates.updated_by ?? null}
      WHERE supplier_id = ${supplierId}
      RETURNING *
    `;

    await sql.query('COMMIT');

    return enrichCadenceWithMetadata(result.rows[0]);
  } catch (error) {
    await sql.query('ROLLBACK');
    throw error;
  }
}

/**
 * Elimina cadenza
 * CASCADE: elimina anche history automaticamente (ON DELETE CASCADE)
 */
export async function deleteSupplierCadence(supplierId: number): Promise<void> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cadence = memoryStore.cadences.get(supplierId);
    if (cadence) {
      memoryStore.cadences.delete(supplierId);
      memoryStore.history.delete(cadence.id);
    }
    return;
  }

  // DATABASE mode
  await sql`
    DELETE FROM supplier_order_cadence
    WHERE supplier_id = ${supplierId}
  `;
}

// ========== QUERY HELPERS ==========

/**
 * Ottieni fornitori da ordinare oggi
 * PERFORMANCE: Usa view optimized suppliers_to_order_today
 */
export async function getSuppliersToOrderToday(): Promise<SupplierToOrderToday[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: SupplierToOrderToday[] = [];

    for (const cadence of Array.from(memoryStore.cadences.values())) {
      if (!cadence.is_active || !cadence.next_order_date) continue;

      const nextDate = new Date(cadence.next_order_date);
      nextDate.setHours(0, 0, 0, 0);

      if (nextDate <= today) {
        const daysSinceLastOrder = cadence.last_order_date
          ? Math.floor(
              (today.getTime() - new Date(cadence.last_order_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 0;

        const daysOverdue = Math.floor(
          (today.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        result.push({
          id: cadence.id,
          supplier_id: cadence.supplier_id,
          supplier_name: cadence.supplier_name,
          cadence_type: cadence.cadence_type,
          next_order_date: cadence.next_order_date,
          last_order_date: cadence.last_order_date,
          average_lead_time_days: cadence.average_lead_time_days,
          days_since_last_order: daysSinceLastOrder,
          days_overdue: Math.max(0, daysOverdue),
        });
      }
    }

    return result.sort((a, b) => {
      const dateA = new Date(a.next_order_date).getTime();
      const dateB = new Date(b.next_order_date).getTime();
      return dateA - dateB;
    });
  }

  // DATABASE mode - usa view ottimizzata
  const result = await sql<SupplierToOrderToday>`
    SELECT * FROM suppliers_to_order_today
  `;

  return result.rows;
}

/**
 * Ottieni fornitori da ordinare in range di date
 * PERFORMANCE: Usa partial index idx_supplier_cadence_next_order
 */
export async function getSuppliersToOrderInRange(
  startDate: string,
  endDate: string
): Promise<UpcomingSupplierOrder[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const result: UpcomingSupplierOrder[] = [];

    for (const cadence of Array.from(memoryStore.cadences.values())) {
      if (!cadence.is_active || !cadence.next_order_date) continue;

      const nextDate = new Date(cadence.next_order_date);
      nextDate.setHours(0, 0, 0, 0);

      if (nextDate >= start && nextDate <= end) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysUntil = Math.floor(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const suggestedDate = new Date(nextDate);
        suggestedDate.setDate(suggestedDate.getDate() - cadence.average_lead_time_days);

        result.push({
          id: cadence.id,
          supplier_id: cadence.supplier_id,
          supplier_name: cadence.supplier_name,
          cadence_type: cadence.cadence_type,
          cadence_value: cadence.cadence_value,
          next_order_date: cadence.next_order_date,
          last_order_date: cadence.last_order_date,
          average_lead_time_days: cadence.average_lead_time_days,
          days_until_order: daysUntil,
          suggested_order_date: suggestedDate.toISOString().split('T')[0],
        });
      }
    }

    return result.sort((a, b) => {
      const dateA = new Date(a.next_order_date).getTime();
      const dateB = new Date(b.next_order_date).getTime();
      return dateA - dateB;
    });
  }

  // DATABASE mode - query ottimizzata con index su next_order_date
  const result = await sql<UpcomingSupplierOrder>`
    SELECT
      soc.id,
      soc.supplier_id,
      soc.supplier_name,
      soc.cadence_type,
      soc.cadence_value,
      soc.next_order_date,
      soc.last_order_date,
      soc.average_lead_time_days,
      soc.next_order_date::date - CURRENT_DATE as days_until_order,
      (soc.next_order_date::date - (soc.average_lead_time_days * INTERVAL '1 day'))::date as suggested_order_date
    FROM supplier_order_cadence soc
    WHERE soc.is_active = true
      AND soc.next_order_date >= ${startDate}
      AND soc.next_order_date <= ${endDate}
    ORDER BY soc.next_order_date ASC
  `;

  return result.rows;
}

/**
 * Lista cadenze con filtri e paginazione
 * PERFORMANCE: Dynamic WHERE clause, usa indici appropriati
 */
export async function listCadences(
  filters: CadenceFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedCadences> {
  const limit = pagination.limit ?? 50;
  const offset = pagination.offset ?? 0;
  const orderBy = pagination.order_by ?? 'next_order_date';
  const orderDirection = pagination.order_direction ?? 'asc';

  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    let filtered = Array.from(memoryStore.cadences.values());

    // Apply filters
    if (filters.is_active !== undefined) {
      filtered = filtered.filter((c) => c.is_active === filters.is_active);
    }
    if (filters.cadence_type) {
      filtered = filtered.filter((c) => c.cadence_type === filters.cadence_type);
    }
    if (filters.supplier_ids && filters.supplier_ids.length > 0) {
      filtered = filtered.filter((c) => filters.supplier_ids!.includes(c.supplier_id));
    }
    if (filters.next_order_date_from) {
      filtered = filtered.filter(
        (c) => c.next_order_date && c.next_order_date >= filters.next_order_date_from!
      );
    }
    if (filters.next_order_date_to) {
      filtered = filtered.filter(
        (c) => c.next_order_date && c.next_order_date <= filters.next_order_date_to!
      );
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter((c) => c.supplier_name.toLowerCase().includes(search));
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[orderBy as keyof SupplierOrderCadence];
      let bVal: any = b[orderBy as keyof SupplierOrderCadence];

      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal < bVal) return orderDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return orderDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    const enriched = paginated.map(enrichCadenceWithMetadata);

    return {
      data: enriched,
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    };
  }

  // DATABASE mode - query ottimizzata
  const { clause, params } = buildWhereClause(filters);

  // Count total
  const countResult = await sql.query(
    `SELECT COUNT(*) as total FROM supplier_order_cadence ${clause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total);

  // Fetch paginated data
  const dataResult = await sql.query<SupplierOrderCadence>(
    `
    SELECT * FROM supplier_order_cadence
    ${clause}
    ORDER BY ${orderBy} ${orderDirection.toUpperCase()}
    LIMIT ${limit}
    OFFSET ${offset}
  `,
    params
  );

  const enriched = dataResult.rows.map(enrichCadenceWithMetadata);

  return {
    data: enriched,
    total,
    limit,
    offset,
    has_more: offset + limit < total,
  };
}

// ========== STATISTICS ==========

/**
 * Ottieni statistiche dashboard cadenze
 * PERFORMANCE: Aggregate queries ottimizzate
 */
export async function getCadenceStatistics(): Promise<CadenceStatistics> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: CadenceStatistics = {
      total_active: 0,
      total_inactive: 0,
      due_today: 0,
      due_this_week: 0,
      overdue: 0,
      by_cadence_type: {
        fixed_days: 0,
        weekly: 0,
        biweekly: 0,
        monthly: 0,
      },
    };

    for (const cadence of Array.from(memoryStore.cadences.values())) {
      if (cadence.is_active) {
        stats.total_active++;
      } else {
        stats.total_inactive++;
      }

      stats.by_cadence_type[cadence.cadence_type]++;

      if (cadence.is_active && cadence.next_order_date) {
        const nextDate = new Date(cadence.next_order_date);
        nextDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          stats.due_today++;
        }
        if (diffDays >= 0 && diffDays <= 7) {
          stats.due_this_week++;
        }
        if (diffDays < 0) {
          stats.overdue++;
        }
      }
    }

    return stats;
  }

  // DATABASE mode - single aggregate query ottimizzata
  const result = await sql`
    SELECT
      COUNT(*) FILTER (WHERE is_active = true) as total_active,
      COUNT(*) FILTER (WHERE is_active = false) as total_inactive,
      COUNT(*) FILTER (WHERE is_active = true AND next_order_date = CURRENT_DATE) as due_today,
      COUNT(*) FILTER (WHERE is_active = true AND next_order_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as due_this_week,
      COUNT(*) FILTER (WHERE is_active = true AND next_order_date < CURRENT_DATE) as overdue,
      COUNT(*) FILTER (WHERE cadence_type = 'fixed_days') as fixed_days,
      COUNT(*) FILTER (WHERE cadence_type = 'weekly') as weekly,
      COUNT(*) FILTER (WHERE cadence_type = 'biweekly') as biweekly,
      COUNT(*) FILTER (WHERE cadence_type = 'monthly') as monthly
    FROM supplier_order_cadence
  `;

  const row = result.rows[0];

  return {
    total_active: parseInt(row.total_active || '0'),
    total_inactive: parseInt(row.total_inactive || '0'),
    due_today: parseInt(row.due_today || '0'),
    due_this_week: parseInt(row.due_this_week || '0'),
    overdue: parseInt(row.overdue || '0'),
    by_cadence_type: {
      fixed_days: parseInt(row.fixed_days || '0'),
      weekly: parseInt(row.weekly || '0'),
      biweekly: parseInt(row.biweekly || '0'),
      monthly: parseInt(row.monthly || '0'),
    },
  };
}

// ========== HISTORY ==========

/**
 * Ottieni storico modifiche cadenza
 */
export async function getCadenceHistory(cadenceId: number): Promise<SupplierOrderCadenceHistory[]> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    return memoryStore.history.get(cadenceId) || [];
  }

  // DATABASE mode - usa index su cadence_id
  const result = await sql<SupplierOrderCadenceHistory>`
    SELECT * FROM supplier_order_cadence_history
    WHERE cadence_id = ${cadenceId}
    ORDER BY changed_at DESC
  `;

  return result.rows;
}

// ========== BATCH OPERATIONS ==========

/**
 * Batch update: marca ordine come effettuato e calcola next_order_date
 * PERFORMANCE: Single transaction per consistency
 */
export async function markOrderCompleted(
  supplierId: number,
  orderDate: string,
  updatedBy?: string
): Promise<CadenceWithMetadata> {
  // TODO: Implementare calcolo automatico next_order_date usando funzione PL/pgSQL
  // Per ora: aggiorna last_order_date, next_order_date va calcolato manualmente o via trigger

  return updateSupplierCadence(
    supplierId,
    {
      last_order_date: orderDate,
      updated_by: updatedBy,
    },
    'Ordine completato'
  );
}

/**
 * Batch update: aggiorna statistiche da Odoo
 * PERFORMANCE: Batch update con single query
 */
export async function updateCadenceStatistics(
  supplierId: number,
  stats: {
    average_lead_time_days?: number;
    total_orders_last_6m?: number;
    calculated_cadence_days?: number;
  }
): Promise<void> {
  // FALLBACK: In-memory mode
  if (!hasDatabase) {
    const cadence = memoryStore.cadences.get(supplierId);
    if (!cadence) return;

    if (stats.average_lead_time_days !== undefined) {
      cadence.average_lead_time_days = stats.average_lead_time_days;
    }
    if (stats.total_orders_last_6m !== undefined) {
      cadence.total_orders_last_6m = stats.total_orders_last_6m;
    }
    if (stats.calculated_cadence_days !== undefined) {
      cadence.calculated_cadence_days = stats.calculated_cadence_days;
    }
    cadence.updated_at = new Date().toISOString();

    return;
  }

  // DATABASE mode
  await sql`
    UPDATE supplier_order_cadence
    SET
      average_lead_time_days = COALESCE(${stats.average_lead_time_days ?? null}, average_lead_time_days),
      total_orders_last_6m = COALESCE(${stats.total_orders_last_6m ?? null}, total_orders_last_6m),
      calculated_cadence_days = COALESCE(${stats.calculated_cadence_days ?? null}, calculated_cadence_days)
    WHERE supplier_id = ${supplierId}
  `;
}
