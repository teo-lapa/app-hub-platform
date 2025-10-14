/**
 * Sistema di Sincronizzazione Bidirezionale
 * Gestisce sync tra IndexedDB locale e Odoo
 */

import { getPickingDB } from '@/lib/db/pickingDB';
import { getPickingClient } from '@/lib/odoo/pickingClient';
import { Operation } from '@/lib/types/picking';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class PickingSyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private syncCallbacks: ((status: SyncStatus, result?: SyncResult) => void)[] = [];

  /**
   * Avvia sincronizzazione automatica
   * @param intervalSeconds Intervallo in secondi (default 30s)
   */
  startAutoSync(intervalSeconds: number = 30): void {
    if (this.syncInterval) {
      console.warn('⚠️ [Sync] Auto-sync già attivo');
      return;
    }

    console.log(`✅ [Sync] Auto-sync avviato (ogni ${intervalSeconds}s)`);

    this.syncInterval = setInterval(() => {
      this.syncToOdoo();
    }, intervalSeconds * 1000);

    // Esegui subito una sincronizzazione
    this.syncToOdoo();
  }

  /**
   * Ferma sincronizzazione automatica
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('✅ [Sync] Auto-sync fermato');
    }
  }

  /**
   * Sincronizza le modifiche locali verso Odoo
   */
  async syncToOdoo(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('⏳ [Sync] Sincronizzazione già in corso, skip');
      return { success: true, syncedCount: 0, failedCount: 0, errors: [] };
    }

    this.isSyncing = true;
    this.notifyCallbacks('syncing');

    const db = getPickingDB();
    const client = getPickingClient();

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: []
    };

    try {
      // Ottieni tutti gli item non sincronizzati
      const unsyncedItems = await db.getUnsyncedItems();

      if (unsyncedItems.length === 0) {
        console.log('✅ [Sync] Nessun dato da sincronizzare');
        this.notifyCallbacks('success', result);
        return result;
      }

      console.log(`🔄 [Sync] Sincronizzazione di ${unsyncedItems.length} operazioni...`);

      // Sincronizza ogni item
      for (const item of unsyncedItems) {
        try {
          // Salva su Odoo
          const success = await client.updateOperationQuantity(item.operationId, item.qtyDone);

          if (success) {
            // Marca come sincronizzato
            await db.markAsSynced(item.id!);
            result.syncedCount++;
            console.log(`✅ [Sync] Operation ${item.operationId} sincronizzata (qty: ${item.qtyDone})`);
          } else {
            throw new Error('Odoo returned false');
          }
        } catch (error: any) {
          console.error(`❌ [Sync] Errore sync operation ${item.operationId}:`, error);
          result.failedCount++;
          result.errors.push(`Operation ${item.operationId}: ${error.message}`);

          // Incrementa retry count
          await db.incrementRetryCount(item.id!);

          // Se troppi tentativi falliti, segnala errore critico
          if (item.retryCount >= 5) {
            result.success = false;
            console.error(`❌ [Sync] Operation ${item.operationId} fallita dopo 5 tentativi!`);
          }
        }
      }

      // Pulisci vecchi item sincronizzati (oltre 1 ora)
      await db.cleanOldSyncedItems(60);

      const status: SyncStatus = result.failedCount > 0 ? 'error' : 'success';
      this.notifyCallbacks(status, result);

      console.log(`✅ [Sync] Completata: ${result.syncedCount} ok, ${result.failedCount} errori`);

    } catch (error: any) {
      console.error('❌ [Sync] Errore generale sincronizzazione:', error);
      result.success = false;
      result.errors.push(error.message);
      this.notifyCallbacks('error', result);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sincronizza da Odoo verso locale (refresh dati)
   * Controlla se ci sono aggiornamenti su Odoo
   */
  async syncFromOdoo(batchId: number, zoneId: string): Promise<boolean> {
    const db = getPickingDB();
    const client = getPickingClient();

    try {
      console.log(`🔄 [Sync] Controllo aggiornamenti da Odoo per zona ${zoneId}...`);

      // Carica dati freschi da Odoo
      const freshLocations = await client.getZoneLocationsWithOperations(batchId, zoneId);

      // Carica tutte le operazioni per ogni ubicazione
      const operationsMap: { [locationId: number]: Operation[] } = {};

      for (const location of freshLocations) {
        const operations = await client.getLocationOperations(batchId, location.id);
        operationsMap[location.id] = operations;
      }

      // Salva in cache locale (sovrascrive)
      await db.saveZoneData(batchId, zoneId, freshLocations, operationsMap);

      console.log(`✅ [Sync] Dati aggiornati da Odoo per zona ${zoneId}`);
      return true;

    } catch (error) {
      console.error('❌ [Sync] Errore sincronizzazione da Odoo:', error);
      return false;
    }
  }

  /**
   * Aggiungi callback per notifiche di stato
   */
  onSyncStatusChange(callback: (status: SyncStatus, result?: SyncResult) => void): void {
    this.syncCallbacks.push(callback);
  }

  /**
   * Rimuovi callback
   */
  removeCallback(callback: (status: SyncStatus, result?: SyncResult) => void): void {
    this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Notifica tutti i callback
   */
  private notifyCallbacks(status: SyncStatus, result?: SyncResult): void {
    this.syncCallbacks.forEach(cb => cb(status, result));
  }

  /**
   * Controlla se ci sono dati non sincronizzati
   */
  async hasUnsyncedData(): Promise<boolean> {
    const db = getPickingDB();
    const unsynced = await db.getUnsyncedItems();
    return unsynced.length > 0;
  }

  /**
   * Ottieni il numero di item non sincronizzati
   */
  async getUnsyncedCount(): Promise<number> {
    const db = getPickingDB();
    const unsynced = await db.getUnsyncedItems();
    return unsynced.length;
  }

  /**
   * Forza sincronizzazione immediata
   */
  async forceSyncNow(): Promise<SyncResult> {
    console.log('🔄 [Sync] Sincronizzazione forzata...');
    return await this.syncToOdoo();
  }

  /**
   * Stato sincronizzazione
   */
  get isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

// Singleton instance
let syncManagerInstance: PickingSyncManager | null = null;

export function getSyncManager(): PickingSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new PickingSyncManager();
  }
  return syncManagerInstance;
}

export default PickingSyncManager;
