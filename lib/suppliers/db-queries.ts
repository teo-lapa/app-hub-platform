/**
 * Database Queries for Supplier Avatars
 *
 * Tutte le query al database per gestire i fornitori e le loro cadenze
 */

import { sql } from '@vercel/postgres';
import type { CadenceType, Weekday, CadenceStatus } from '@/lib/types/supplier-cadence';

// ============================================================================
// Types
// ============================================================================

export interface SupplierAvatar {
  id: string;
  odoo_supplier_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  first_order_date: Date | null;
  last_order_date: Date | null;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  average_lead_time_days: number;
  min_lead_time_days: number | null;
  max_lead_time_days: number | null;
  cadence_type: CadenceType;
  cadence_value: number;
  next_order_date: Date | null;
  days_until_next_order: number | null;
  last_cadence_order_date: Date | null;
  top_products: any[];
  product_categories: any;
  reliability_score: number;
  quality_score: number;
  price_competitiveness_score: number;
  delivery_performance_score: number;
  critical_products_count: number;
  high_urgency_products_count: number;
  medium_urgency_products_count: number;
  assigned_buyer_id: number | null;
  assigned_buyer_name: string | null;
  is_active: boolean;
  is_preferred: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  last_sync_odoo: Date | null;
}

export interface CreateSupplierInput {
  odoo_supplier_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  cadence_type?: CadenceType;
  cadence_value?: number;
  average_lead_time_days?: number;
  last_cadence_order_date?: string | null;
  is_active?: boolean;
  critical_products_count?: number;
  notes?: string | null;
}

export interface UpdateSupplierInput {
  cadence_type?: CadenceType;
  cadence_value?: number;
  last_cadence_order_date?: string | null;
  is_active?: boolean;
  critical_products_count?: number;
  notes?: string | null;
}

export interface SupplierFilters {
  is_active?: boolean;
  cadence_type?: CadenceType;
  search?: string;
  status?: CadenceStatus;
  sort_by?: 'next_order_date' | 'name' | 'last_order_date' | 'days_until_next_order';
  sort_direction?: 'asc' | 'desc';
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all suppliers with optional filters
 */
export async function getAllSuppliers(filters?: SupplierFilters): Promise<SupplierAvatar[]> {
  try {
    let query = `
      SELECT *
      FROM supplier_avatars
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by active status
    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    // Filter by cadence type
    if (filters?.cadence_type) {
      query += ` AND cadence_type = $${paramIndex}`;
      params.push(filters.cadence_type);
      paramIndex++;
    }

    // Search by name
    if (filters?.search) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Filter by status
    if (filters?.status) {
      switch (filters.status) {
        case 'on_time':
          query += ` AND days_until_next_order > 3`;
          break;
        case 'due_soon':
          query += ` AND days_until_next_order BETWEEN 1 AND 3`;
          break;
        case 'overdue':
          query += ` AND days_until_next_order < 0`;
          break;
        case 'inactive':
          query += ` AND is_active = false`;
          break;
      }
    }

    // Sorting
    const sortBy = filters?.sort_by || 'next_order_date';
    const sortDirection = filters?.sort_direction || 'asc';
    const sortColumn = sortBy === 'name' ? 'name' : sortBy;
    query += ` ORDER BY ${sortColumn} ${sortDirection.toUpperCase()}`;

    const result = await sql.query(query, params);
    return result.rows as SupplierAvatar[];
  } catch (error) {
    console.error('[DB] Error getting all suppliers:', error);
    throw error;
  }
}

/**
 * Get supplier by Odoo ID
 */
export async function getSupplierByOdooId(odooSupplierId: number): Promise<SupplierAvatar | null> {
  try {
    const result = await sql`
      SELECT * FROM supplier_avatars
      WHERE odoo_supplier_id = ${odooSupplierId}
    `;
    return result.rows[0] as SupplierAvatar || null;
  } catch (error) {
    console.error(`[DB] Error getting supplier ${odooSupplierId}:`, error);
    throw error;
  }
}

/**
 * Get supplier by UUID
 */
export async function getSupplierById(id: string): Promise<SupplierAvatar | null> {
  try {
    const result = await sql`
      SELECT * FROM supplier_avatars
      WHERE id = ${id}
    `;
    return result.rows[0] as SupplierAvatar || null;
  } catch (error) {
    console.error(`[DB] Error getting supplier by ID ${id}:`, error);
    throw error;
  }
}

/**
 * Create new supplier avatar
 */
export async function createSupplier(input: CreateSupplierInput): Promise<SupplierAvatar> {
  try {
    const result = await sql`
      INSERT INTO supplier_avatars (
        odoo_supplier_id,
        name,
        email,
        phone,
        city,
        cadence_type,
        cadence_value,
        average_lead_time_days,
        last_cadence_order_date,
        critical_products_count,
        notes
      ) VALUES (
        ${input.odoo_supplier_id},
        ${input.name},
        ${input.email || null},
        ${input.phone || null},
        ${input.city || null},
        ${input.cadence_type || 'fixed_days'},
        ${input.cadence_value || 7},
        ${input.average_lead_time_days || 3},
        ${input.last_cadence_order_date || null},
        ${input.critical_products_count || 0},
        ${input.notes || null}
      )
      RETURNING *
    `;
    return result.rows[0] as SupplierAvatar;
  } catch (error: any) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      throw new Error(`Supplier with Odoo ID ${input.odoo_supplier_id} already exists`);
    }
    console.error('[DB] Error creating supplier:', error);
    throw error;
  }
}

/**
 * Update supplier avatar
 */
export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<SupplierAvatar> {
  try {
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.cadence_type !== undefined) {
      updates.push(`cadence_type = $${paramIndex}`);
      values.push(input.cadence_type);
      paramIndex++;
    }

    if (input.cadence_value !== undefined) {
      updates.push(`cadence_value = $${paramIndex}`);
      values.push(input.cadence_value);
      paramIndex++;
    }

    if (input.last_cadence_order_date !== undefined) {
      updates.push(`last_cadence_order_date = $${paramIndex}`);
      values.push(input.last_cadence_order_date);
      paramIndex++;
    }

    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(input.is_active);
      paramIndex++;
    }

    if (input.critical_products_count !== undefined) {
      updates.push(`critical_products_count = $${paramIndex}`);
      values.push(input.critical_products_count);
      paramIndex++;
    }

    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(input.notes);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    // Add ID as last parameter
    values.push(id);

    const query = `
      UPDATE supplier_avatars
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Supplier with ID ${id} not found`);
    }

    return result.rows[0] as SupplierAvatar;
  } catch (error) {
    console.error(`[DB] Error updating supplier ${id}:`, error);
    throw error;
  }
}

/**
 * Delete (soft delete) supplier avatar
 */
export async function deleteSupplier(id: string): Promise<void> {
  try {
    const result = await sql`
      UPDATE supplier_avatars
      SET is_active = false
      WHERE id = ${id}
    `;

    if (result.rowCount === 0) {
      throw new Error(`Supplier with ID ${id} not found`);
    }
  } catch (error) {
    console.error(`[DB] Error deleting supplier ${id}:`, error);
    throw error;
  }
}

/**
 * Get urgent suppliers (today)
 */
export async function getUrgentSuppliersToday(): Promise<SupplierAvatar[]> {
  try {
    const result = await sql`
      SELECT * FROM v_urgent_orders_today
    `;
    return result.rows as SupplierAvatar[];
  } catch (error) {
    console.error('[DB] Error getting urgent suppliers today:', error);
    throw error;
  }
}

/**
 * Get suppliers for tomorrow
 */
export async function getSuppliersTomorrow(): Promise<SupplierAvatar[]> {
  try {
    const result = await sql`
      SELECT * FROM v_orders_tomorrow
    `;
    return result.rows as SupplierAvatar[];
  } catch (error) {
    console.error('[DB] Error getting suppliers tomorrow:', error);
    throw error;
  }
}

/**
 * Get upcoming suppliers (next 7 days)
 */
export async function getUpcomingSuppliers(days: number = 7): Promise<SupplierAvatar[]> {
  try {
    const result = await sql`
      SELECT * FROM supplier_avatars
      WHERE is_active = true
        AND days_until_next_order BETWEEN 0 AND ${days}
      ORDER BY days_until_next_order ASC, critical_products_count DESC
    `;
    return result.rows as SupplierAvatar[];
  } catch (error) {
    console.error('[DB] Error getting upcoming suppliers:', error);
    throw error;
  }
}

/**
 * Get statistics
 */
export async function getStatistics() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as total_active,
        COUNT(*) FILTER (WHERE is_active = false) as total_inactive,
        COUNT(*) FILTER (WHERE days_until_next_order = 0) as urgent_today,
        COUNT(*) FILTER (WHERE days_until_next_order = 1) as due_tomorrow,
        COUNT(*) FILTER (WHERE days_until_next_order BETWEEN 2 AND 7) as due_this_week,
        COUNT(*) FILTER (WHERE days_until_next_order < 0) as overdue,
        AVG(cadence_value) FILTER (WHERE is_active = true) as avg_cadence_days,
        AVG(reliability_score) FILTER (WHERE is_active = true) as avg_reliability_score
      FROM supplier_avatars
    `;

    return result.rows[0];
  } catch (error) {
    console.error('[DB] Error getting statistics:', error);
    throw error;
  }
}

/**
 * Upsert supplier (create or update)
 */
export async function upsertSupplier(input: CreateSupplierInput): Promise<SupplierAvatar> {
  try {
    // Check if exists
    const existing = await getSupplierByOdooId(input.odoo_supplier_id);

    if (existing) {
      // Update
      return await updateSupplier(existing.id, {
        cadence_type: input.cadence_type,
        cadence_value: input.cadence_value,
        last_cadence_order_date: input.last_cadence_order_date,
        critical_products_count: input.critical_products_count,
        notes: input.notes,
      });
    } else {
      // Create
      return await createSupplier(input);
    }
  } catch (error) {
    console.error('[DB] Error upserting supplier:', error);
    throw error;
  }
}
