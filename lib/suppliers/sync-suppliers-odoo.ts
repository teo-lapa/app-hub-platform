/**
 * Sync Suppliers from Odoo to Database
 *
 * Sincronizza i fornitori da Odoo nel database supplier_avatars
 * con cadenze di riordino intelligenti basate sullo storico ordini
 */

import { upsertSupplier, getAllSuppliers } from './db-queries';
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

interface SyncOptions {
  dryRun?: boolean;
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  skipped: number;
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

  return data.result;
}

/**
 * Ottiene lista fornitori da Odoo
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
          [[['supplier_rank', '>', 0]]], // Solo fornitori attivi
          {
            fields: ['id', 'name', 'email', 'phone', 'city', 'country_id'],
            limit: 1000 // Tutti i fornitori (max 1000)
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
 * Calcola cadenza intelligente basata sullo storico (placeholder)
 *
 * TODO: Implementare analisi storico ordini da Odoo per calcolare cadenza ottimale
 * Per ora usa valori predefiniti intelligenti basati sul tipo di fornitore
 */
function calculateSmartCadence(supplier: OdooSupplier): {
  cadenceType: CadenceType;
  cadenceValue: number;
  averageLeadTime: number;
} {
  const supplierName = supplier.name.toLowerCase();

  // Logica euristica basata sul nome fornitore
  // In futuro sarà sostituita da analisi storico ordini reale

  if (supplierName.includes('food') || supplierName.includes('ferraiuolo')) {
    // Fornitore alimentari freschi - ordine frequente
    return {
      cadenceType: 'fixed_days' as CadenceType,
      cadenceValue: 7, // Ogni 7 giorni
      averageLeadTime: 2
    };
  }

  if (supplierName.includes('polo') || supplierName.includes('spa')) {
    // Fornitore grande distribuzione
    return {
      cadenceType: 'fixed_days' as CadenceType,
      cadenceValue: 3, // Ogni 3 giorni
      averageLeadTime: 1
    };
  }

  if (supplierName.includes('hygiene') || supplierName.includes('jirrolle')) {
    // Fornitore igiene/articoli non deperibili
    return {
      cadenceType: 'fixed_days' as CadenceType,
      cadenceValue: 7, // Ogni 7 giorni
      averageLeadTime: 3
    };
  }

  if (supplierName.includes('demaurex') || supplierName.includes('aligro')) {
    // Grossisti
    return {
      cadenceType: 'fixed_days' as CadenceType,
      cadenceValue: 3, // Ogni 3 giorni
      averageLeadTime: 2
    };
  }

  // Default per fornitori generici
  return {
    cadenceType: 'fixed_days' as CadenceType,
    cadenceValue: 7, // Ogni 7 giorni
    averageLeadTime: 3
  };
}

/**
 * Sincronizza fornitori da Odoo al database
 */
export async function syncSuppliersFromOdoo(options: SyncOptions = {}): Promise<SyncResult> {
  const { dryRun = false } = options;

  let synced = 0;
  let errors = 0;
  let skipped = 0;
  const errorDetails: Array<{ supplier: string; error: string }> = [];

  try {
    console.log('🔄 [SUPPLIER SYNC] Starting sync from Odoo...');

    // Step 1: Authenticate
    const uid = await authenticateOdoo();
    console.log('✅ [SUPPLIER SYNC] Authenticated with Odoo');

    // Step 2: Fetch suppliers
    const suppliers = await fetchSuppliersFromOdoo(uid);
    console.log(`📦 [SUPPLIER SYNC] Found ${suppliers.length} suppliers in Odoo`);

    if (dryRun) {
      console.log('🔍 [SUPPLIER SYNC] DRY RUN - No changes will be made');
      console.log('Suppliers preview:', suppliers.slice(0, 5).map(s => s.name));
      return {
        success: true,
        synced: 0,
        errors: 0,
        skipped: suppliers.length
      };
    }

    // Step 3: Upsert each supplier
    for (const supplier of suppliers) {
      try {
        const { cadenceType, cadenceValue, averageLeadTime } = calculateSmartCadence(supplier);

        await upsertSupplier({
          odoo_supplier_id: supplier.id,
          name: supplier.name,
          email: supplier.email || null,
          phone: supplier.phone || null,
          city: supplier.city || null,
          cadence_type: cadenceType,
          cadence_value: cadenceValue,
          average_lead_time_days: averageLeadTime,
          last_cadence_order_date: new Date().toISOString().split('T')[0], // Start from today
          notes: `Sincronizzato da Odoo il ${new Date().toISOString()}`
        });

        synced++;
        console.log(`✅ [SUPPLIER SYNC] Synced: ${supplier.name}`);
      } catch (error: any) {
        errors++;
        const errorMsg = error.message || 'Unknown error';
        errorDetails.push({ supplier: supplier.name, error: errorMsg });
        console.error(`❌ [SUPPLIER SYNC] Error syncing ${supplier.name}:`, errorMsg);
      }
    }

    console.log('✅ [SUPPLIER SYNC] Sync completed:', { synced, errors, skipped });

    return {
      success: true,
      synced,
      errors,
      skipped,
      errorDetails: errors > 0 ? errorDetails : undefined
    };

  } catch (error: any) {
    console.error('❌ [SUPPLIER SYNC] Fatal error:', error);
    return {
      success: false,
      synced,
      errors: errors + 1,
      skipped,
      errorDetails: [{ supplier: 'SYSTEM', error: error.message }]
    };
  }
}

/**
 * Ottiene statistiche sincronizzazione fornitori
 */
export async function getSupplierSyncStatus() {
  try {
    const suppliers = await getAllSuppliers({ is_active: true });

    const stats = {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.is_active).length,
      urgentToday: suppliers.filter(s => s.days_until_next_order === 0).length,
      dueTomorrow: suppliers.filter(s => s.days_until_next_order === 1).length,
      dueThisWeek: suppliers.filter(s => s.days_until_next_order !== null && s.days_until_next_order >= 0 && s.days_until_next_order <= 7).length,
      lastSync: suppliers.length > 0 ? suppliers[0].updated_at : null
    };

    return stats;
  } catch (error) {
    console.error('[SUPPLIER SYNC] Error getting stats:', error);
    return {
      totalSuppliers: 0,
      activeSuppliers: 0,
      urgentToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      lastSync: null
    };
  }
}
