/**
 * Sync Suppliers from Odoo to Database
 *
 * Sincronizza i fornitori da Odoo nel database supplier_avatars
 * con cadenze di riordino REALI calcolate dallo storico ordini
 */

import { upsertSupplier, getAllSuppliers } from './db-queries';
import { sql } from '@vercel/postgres';
import type { CadenceType } from '@/lib/types/supplier-cadence';

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_ADMIN_EMAIL;
const ODOO_PASSWORD = process.env.ODOO_ADMIN_PASSWORD;

interface OdooSupplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  country_id?: [number, string];
}

interface OdooPurchaseOrder {
  id: number;
  partner_id: [number, string];
  date_order: string;
  state: string;
  amount_total: number;
}

interface SupplierOrderStats {
  supplierId: number;
  supplierName: string;
  orderDates: string[];
  totalOrders: number;
  averageCadenceDays: number;
  lastOrderDate: string;
  averageLeadTime: number;
}

interface SyncOptions {
  dryRun?: boolean;
  monthsBack?: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  skipped: number;
  withCadence: number;
  withoutCadence: number;
  errorDetails?: Array<{ supplier: string; error: string }>;
}

/**
 * Autentica con Odoo e ottiene UID
 */
async function authenticateOdoo(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Odoo auth error: ${data.error.data?.message || data.error.message}`);
  }

  if (!data.result) {
    throw new Error('Autenticazione Odoo fallita - credenziali non valide');
  }

  return data.result;
}

/**
 * Ottiene tutti i fornitori da Odoo
 */
async function fetchSuppliersFromOdoo(uid: number): Promise<OdooSupplier[]> {
  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          'res.partner',
          'search_read',
          [[['supplier_rank', '>', 0]]],
          {
            fields: ['id', 'name', 'email', 'phone', 'city', 'country_id'],
            limit: 1000
          }
        ]
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Odoo fetch error: ${data.error.data?.message || data.error.message}`);
  }

  return data.result || [];
}

/**
 * Ottiene storico ordini di acquisto per un fornitore
 */
async function fetchPurchaseOrdersForSupplier(
  uid: number,
  supplierId: number,
  monthsBack: number
): Promise<OdooPurchaseOrder[]> {
  const dateFrom = new Date();
  dateFrom.setMonth(dateFrom.getMonth() - monthsBack);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          uid,
          ODOO_PASSWORD,
          'purchase.order',
          'search_read',
          [[
            ['partner_id', '=', supplierId],
            ['date_order', '>=', dateFromStr],
            ['state', 'in', ['purchase', 'done']]
          ]],
          {
            fields: ['id', 'partner_id', 'date_order', 'state', 'amount_total'],
            order: 'date_order asc'
          }
        ]
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    console.warn(`⚠️ [PURCHASE ORDERS] Error for supplier ${supplierId}:`, data.error.data?.message);
    return [];
  }

  return data.result || [];
}

/**
 * Calcola statistiche e cadenza reale da storico ordini
 */
function calculateCadenceFromOrders(orders: OdooPurchaseOrder[]): SupplierOrderStats | null {
  if (orders.length === 0) {
    return null;
  }

  const orderDates = orders.map(o => o.date_order).sort();
  const lastOrderDate = orderDates[orderDates.length - 1];

  if (orders.length < 2) {
    // Solo 1 ordine - usa cadenza default di 14 giorni
    return {
      supplierId: orders[0].partner_id[0],
      supplierName: orders[0].partner_id[1],
      orderDates,
      totalOrders: 1,
      averageCadenceDays: 14,
      lastOrderDate,
      averageLeadTime: 3
    };
  }

  // Calcola intervalli tra ordini
  const intervals: number[] = [];
  for (let i = 1; i < orderDates.length; i++) {
    const prevDate = new Date(orderDates[i - 1]);
    const currDate = new Date(orderDates[i]);
    const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      intervals.push(diffDays);
    }
  }

  if (intervals.length === 0) {
    return {
      supplierId: orders[0].partner_id[0],
      supplierName: orders[0].partner_id[1],
      orderDates,
      totalOrders: orders.length,
      averageCadenceDays: 14,
      lastOrderDate,
      averageLeadTime: 3
    };
  }

  // Calcola media degli intervalli
  const avgInterval = Math.round(intervals.reduce((sum, val) => sum + val, 0) / intervals.length);

  // Arrotonda a cadenze sensate (3, 7, 14, 21, 30 giorni)
  let cadenceDays = avgInterval;
  if (avgInterval <= 5) cadenceDays = 3;
  else if (avgInterval <= 10) cadenceDays = 7;
  else if (avgInterval <= 17) cadenceDays = 14;
  else if (avgInterval <= 25) cadenceDays = 21;
  else cadenceDays = 30;

  // Lead time basato su frequenza (più frequente = più urgente = lead time minore)
  let leadTime = 3;
  if (cadenceDays <= 3) leadTime = 1;
  else if (cadenceDays <= 7) leadTime = 2;
  else leadTime = 3;

  return {
    supplierId: orders[0].partner_id[0],
    supplierName: orders[0].partner_id[1],
    orderDates,
    totalOrders: orders.length,
    averageCadenceDays: cadenceDays,
    lastOrderDate,
    averageLeadTime: leadTime
  };
}

/**
 * Azzera tutte le cadenze esistenti (mette is_active = false)
 */
async function resetAllCadences(): Promise<void> {
  try {
    await sql`
      UPDATE supplier_avatars
      SET is_active = false,
          notes = 'Cadenza azzerata per re-sync'
      WHERE is_active = true
    `;
    console.log('✅ [RESET] Tutte le cadenze azzerate');
  } catch (error) {
    console.error('❌ [RESET] Errore azzeramento cadenze:', error);
    throw error;
  }
}

/**
 * Sincronizza fornitori da Odoo al database
 */
export async function syncSuppliersFromOdoo(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false, monthsBack = 6 } = options;

  let synced = 0;
  let errors = 0;
  let skipped = 0;
  let withCadence = 0;
  let withoutCadence = 0;
  const errorDetails: Array<{ supplier: string; error: string }> = [];

  try {
    console.log('🔄 [SUPPLIER SYNC] Starting sync from Odoo...');
    console.log(`📅 [SUPPLIER SYNC] Analyzing last ${monthsBack} months of purchase orders`);

    // STEP 0: Reset all existing cadences
    if (!dryRun) {
      console.log('🔄 [SUPPLIER SYNC] Resetting existing cadences...');
      await resetAllCadences();
    }

    // STEP 1: Authenticate
    const uid = await authenticateOdoo();
    console.log('✅ [SUPPLIER SYNC] Authenticated with Odoo');

    // STEP 2: Fetch all suppliers
    const suppliers = await fetchSuppliersFromOdoo(uid);
    console.log(`📦 [SUPPLIER SYNC] Found ${suppliers.length} suppliers in Odoo`);

    if (dryRun) {
      console.log('🔍 [SUPPLIER SYNC] DRY RUN - No changes will be made');
      return {
        success: true,
        synced: 0,
        errors: 0,
        skipped: suppliers.length,
        withCadence: 0,
        withoutCadence: 0
      };
    }

    // STEP 3: Process each supplier
    console.log('🔄 [SUPPLIER SYNC] Analyzing purchase orders for each supplier...');

    for (let i = 0; i < suppliers.length; i++) {
      const supplier = suppliers[i];

      // Progress log every 50 suppliers
      if ((i + 1) % 50 === 0) {
        console.log(`📊 [SUPPLIER SYNC] Progress: ${i + 1}/${suppliers.length} suppliers processed`);
      }

      try {
        // Fetch purchase orders for this supplier
        const orders = await fetchPurchaseOrdersForSupplier(uid, supplier.id, monthsBack);

        // Calculate cadence from orders
        const stats = calculateCadenceFromOrders(orders);

        if (stats && stats.totalOrders > 0) {
          // Supplier WITH cadence (has recent orders)
          await upsertSupplier({
            odoo_supplier_id: supplier.id,
            name: supplier.name,
            email: supplier.email || null,
            phone: supplier.phone || null,
            city: supplier.city || null,
            cadence_type: 'fixed_days' as CadenceType,
            cadence_value: stats.averageCadenceDays,
            average_lead_time_days: stats.averageLeadTime,
            last_cadence_order_date: stats.lastOrderDate,
            is_active: true,
            notes: `Cadenza calcolata da ${stats.totalOrders} ordini negli ultimi ${monthsBack} mesi. Media: ${stats.averageCadenceDays} giorni.`
          });

          withCadence++;
          console.log(`✅ [SUPPLIER SYNC] ${supplier.name}: Cadenza ${stats.averageCadenceDays} gg (${stats.totalOrders} ordini)`);
        } else {
          // Supplier WITHOUT cadence (no recent orders)
          await upsertSupplier({
            odoo_supplier_id: supplier.id,
            name: supplier.name,
            email: supplier.email || null,
            phone: supplier.phone || null,
            city: supplier.city || null,
            cadence_type: 'fixed_days' as CadenceType,
            cadence_value: 7, // Default placeholder
            average_lead_time_days: 3,
            last_cadence_order_date: null,
            is_active: false, // NOT ACTIVE - no recent orders
            notes: `Nessun ordine negli ultimi ${monthsBack} mesi`
          });

          withoutCadence++;
        }

        synced++;

      } catch (error: any) {
        errors++;
        const errorMsg = error.message || 'Unknown error';
        errorDetails.push({ supplier: supplier.name, error: errorMsg });
        console.error(`❌ [SUPPLIER SYNC] Error syncing ${supplier.name}:`, errorMsg);
      }
    }

    console.log('✅ [SUPPLIER SYNC] Sync completed!');
    console.log(`📊 [SUPPLIER SYNC] Stats:`, {
      total: synced,
      withCadence: `${withCadence} (attivi)`,
      withoutCadence: `${withoutCadence} (inattivi)`,
      errors
    });

    return {
      success: true,
      synced,
      errors,
      skipped,
      withCadence,
      withoutCadence,
      errorDetails: errors > 0 ? errorDetails : undefined
    };

  } catch (error: any) {
    console.error('❌ [SUPPLIER SYNC] Fatal error:', error);
    return {
      success: false,
      synced,
      errors: errors + 1,
      skipped,
      withCadence,
      withoutCadence,
      errorDetails: [{ supplier: 'SYSTEM', error: error.message }]
    };
  }
}

/**
 * Ottiene statistiche sincronizzazione fornitori
 */
export async function getSupplierSyncStatus() {
  try {
    const suppliers = await getAllSuppliers({});

    const activeSuppliers = suppliers.filter(s => s.is_active);
    const inactiveSuppliers = suppliers.filter(s => !s.is_active);

    const stats = {
      totalSuppliers: suppliers.length,
      activeSuppliers: activeSuppliers.length,
      inactiveSuppliers: inactiveSuppliers.length,
      urgentToday: activeSuppliers.filter(s => s.days_until_next_order === 0).length,
      dueTomorrow: activeSuppliers.filter(s => s.days_until_next_order === 1).length,
      dueThisWeek: activeSuppliers.filter(s => s.days_until_next_order !== null && s.days_until_next_order >= 0 && s.days_until_next_order <= 7).length,
      lastSync: suppliers.length > 0 ? suppliers[0].updated_at : null
    };

    return stats;
  } catch (error) {
    console.error('[SUPPLIER SYNC] Error getting stats:', error);
    return {
      totalSuppliers: 0,
      activeSuppliers: 0,
      inactiveSuppliers: 0,
      urgentToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      lastSync: null
    };
  }
}
