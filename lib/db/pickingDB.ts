/**
 * IndexedDB Wrapper per Prelievo Zone
 * Database locale ultra-veloce per operazioni di picking
 */

import { Operation, StockLocation } from '@/lib/types/picking';

const DB_NAME = 'PickingDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  ZONES: 'zones',           // Cache dati zona completa
  OPERATIONS: 'operations', // Operazioni per ubicazione
  LOCATIONS: 'locations',   // Ubicazioni
  SYNC_QUEUE: 'syncQueue',  // Coda di sincronizzazione
  METADATA: 'metadata'      // Metadati (timestamp, batch corrente, ecc)
};

export interface ZoneData {
  batchId: number;
  zoneId: string;
  locations: StockLocation[];
  operations: { [locationId: number]: Operation[] };
  timestamp: number;
}

export interface SyncQueueItem {
  id?: number;
  operationId: number;
  qtyDone: number;
  timestamp: number;
  synced: boolean;
  retryCount: number;
}

export interface Metadata {
  key: string;
  value: any;
  timestamp: number;
}

class PickingDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  /**
   * Inizializza il database
   */
  private async init(): Promise<void> {
    // Check se siamo nel browser
    if (typeof window === 'undefined') {
      console.warn('⚠️ [PickingDB] IndexedDB non disponibile (SSR)');
      return Promise.resolve();
    }

    if (!window.indexedDB) {
      console.warn('⚠️ [PickingDB] IndexedDB non supportato in questo browser');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [PickingDB] Errore apertura database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [PickingDB] Database aperto con successo');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store per dati zona completa
        if (!db.objectStoreNames.contains(STORES.ZONES)) {
          const zoneStore = db.createObjectStore(STORES.ZONES, { keyPath: ['batchId', 'zoneId'] });
          zoneStore.createIndex('timestamp', 'timestamp');
        }

        // Store per operazioni
        if (!db.objectStoreNames.contains(STORES.OPERATIONS)) {
          const opStore = db.createObjectStore(STORES.OPERATIONS, { keyPath: 'id' });
          opStore.createIndex('locationId', 'locationId');
          opStore.createIndex('batchId', 'batchId');
        }

        // Store per ubicazioni
        if (!db.objectStoreNames.contains(STORES.LOCATIONS)) {
          const locStore = db.createObjectStore(STORES.LOCATIONS, { keyPath: 'id' });
          locStore.createIndex('batchId', 'batchId');
          locStore.createIndex('zoneId', 'zoneId');
        }

        // Store per coda sincronizzazione
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('synced', 'synced');
          syncStore.createIndex('timestamp', 'timestamp');
        }

        // Store per metadata
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        console.log('✅ [PickingDB] Database creato/aggiornato');
      };
    });
  }

  /**
   * Assicura che il DB sia inizializzato
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      throw new Error('IndexedDB disponibile solo nel browser');
    }

    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database non inizializzato');
    }
    return this.db;
  }

  // ==================== ZONE DATA ====================

  /**
   * Salva tutti i dati di una zona (ubicazioni + operazioni)
   */
  async saveZoneData(batchId: number, zoneId: string, locations: StockLocation[], operationsMap: { [locationId: number]: Operation[] }): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.ZONES], 'readwrite');
    const store = tx.objectStore(STORES.ZONES);

    const zoneData: ZoneData = {
      batchId,
      zoneId,
      locations,
      operations: operationsMap,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(zoneData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`✅ [PickingDB] Salvati dati zona ${zoneId} per batch ${batchId}`);
  }

  /**
   * Carica tutti i dati di una zona
   */
  async loadZoneData(batchId: number, zoneId: string): Promise<ZoneData | null> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.ZONES], 'readonly');
    const store = tx.objectStore(STORES.ZONES);

    return new Promise((resolve, reject) => {
      const request = store.get([batchId, zoneId]);
      request.onsuccess = () => {
        const data = request.result as ZoneData | undefined;
        if (data) {
          console.log(`✅ [PickingDB] Caricati dati zona ${zoneId} dalla cache locale`);
        }
        resolve(data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Elimina i dati di una zona specifica
   */
  async deleteZoneData(batchId: number, zoneId: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.ZONES], 'readwrite');
    const store = tx.objectStore(STORES.ZONES);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete([batchId, zoneId]);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`✅ [PickingDB] Eliminati dati zona ${zoneId}`);
  }

  // ==================== OPERATIONS ====================

  /**
   * Aggiorna una singola operazione (qty_done)
   */
  async updateOperation(operation: Operation): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.OPERATIONS], 'readwrite');
    const store = tx.objectStore(STORES.OPERATIONS);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(operation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Carica operazioni per una ubicazione
   */
  async getLocationOperations(locationId: number): Promise<Operation[]> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.OPERATIONS], 'readonly');
    const store = tx.objectStore(STORES.OPERATIONS);
    const index = store.index('locationId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(locationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SYNC QUEUE ====================

  /**
   * Aggiungi operazione alla coda di sincronizzazione
   */
  async addToSyncQueue(operationId: number, qtyDone: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    const item: SyncQueueItem = {
      operationId,
      qtyDone,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`📤 [PickingDB] Aggiunto alla coda sync: operation ${operationId}, qty ${qtyDone}`);
  }

  /**
   * Ottieni tutti gli item non sincronizzati
   */
  async getUnsyncedItems(): Promise<SyncQueueItem[]> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.SYNC_QUEUE], 'readonly');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    return new Promise((resolve, reject) => {
      const items: SyncQueueItem[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as SyncQueueItem;
          if (!item.synced) {
            items.push(item);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Marca un item come sincronizzato
   */
  async markAsSynced(itemId: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    // Prima leggi l'item
    const getRequest = store.get(itemId);

    await new Promise<void>((resolve, reject) => {
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.synced = true;
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Incrementa retry count per un item
   */
  async incrementRetryCount(itemId: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);

    const getRequest = store.get(itemId);

    await new Promise<void>((resolve, reject) => {
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.retryCount++;
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Pulisce item sincronizzati più vecchi di X minuti
   */
  async cleanOldSyncedItems(minutesOld: number = 60): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = tx.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('synced');

    const cutoffTime = Date.now() - (minutesOld * 60 * 1000);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(true)); // Solo sincronizzati (synced = true)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value as SyncQueueItem;
          if (item.timestamp < cutoffTime) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ==================== METADATA ====================

  /**
   * Salva metadata
   */
  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.METADATA], 'readwrite');
    const store = tx.objectStore(STORES.METADATA);

    const metadata: Metadata = {
      key,
      value,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Leggi metadata
   */
  async getMetadata(key: string): Promise<any> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.METADATA], 'readonly');
    const store = tx.objectStore(STORES.METADATA);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const metadata = request.result as Metadata | undefined;
        resolve(metadata?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILITY ====================

  /**
   * Pulisce TUTTO il database (per debug o cambio batch)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    const storeNames = [STORES.ZONES, STORES.OPERATIONS, STORES.LOCATIONS, STORES.SYNC_QUEUE, STORES.METADATA];
    const tx = db.transaction(storeNames, 'readwrite');

    const promises = storeNames.map(storeName => {
      return new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    console.log('✅ [PickingDB] Database pulito completamente');
  }

  /**
   * Pulisce solo i dati di un batch specifico
   */
  async clearBatchData(batchId: number): Promise<void> {
    const db = await this.ensureDB();

    // Pulisci ZONES per questo batch
    const zonesTx = db.transaction([STORES.ZONES], 'readwrite');
    const zonesStore = zonesTx.objectStore(STORES.ZONES);

    await new Promise<void>((resolve, reject) => {
      const request = zonesStore.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const data = cursor.value as ZoneData;
          if (data.batchId === batchId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    console.log(`✅ [PickingDB] Puliti dati batch ${batchId}`);
  }

  /**
   * Ottieni statistiche database
   */
  async getStats(): Promise<{ zones: number; operations: number; syncQueue: number; unsynced: number }> {
    const db = await this.ensureDB();

    const countStore = async (storeName: string): Promise<number> => {
      const tx = db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    const unsyncedItems = await this.getUnsyncedItems();

    return {
      zones: await countStore(STORES.ZONES),
      operations: await countStore(STORES.OPERATIONS),
      syncQueue: await countStore(STORES.SYNC_QUEUE),
      unsynced: unsyncedItems.length
    };
  }
}

// Singleton instance
let pickingDBInstance: PickingDB | null = null;

export function getPickingDB(): PickingDB {
  if (!pickingDBInstance) {
    pickingDBInstance = new PickingDB();
  }
  return pickingDBInstance;
}

export default PickingDB;
