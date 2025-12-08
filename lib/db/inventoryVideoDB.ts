/**
 * IndexedDB per Video Recording - Inventario
 * Storage locale per chunks video con crash-recovery
 */

const DB_NAME = 'InventoryVideoDB';
const DB_VERSION = 1;

const STORES = {
  CHUNKS: 'chunks',       // Video chunks (Blob)
  RECORDINGS: 'recordings' // Metadata delle registrazioni
};

export interface VideoChunk {
  id?: number;
  locationId: number;
  chunkIndex: number;
  blob: Blob;
  timestamp: number;
}

export interface VideoRecording {
  locationId: number;
  startTime: number;
  endTime?: number;
  duration: number;
  uploadStatus: 'recording' | 'pending' | 'uploading' | 'uploaded' | 'failed';
  blobUrl?: string;
  chunksCount: number;
  retryCount: number;
}

class InventoryVideoDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.init();
    }
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    if (!window.indexedDB) {
      console.warn('⚠️ [InventoryVideoDB] IndexedDB non supportato');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [InventoryVideoDB] Errore apertura database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [InventoryVideoDB] Database aperto');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store per chunks video
        if (!db.objectStoreNames.contains(STORES.CHUNKS)) {
          const chunkStore = db.createObjectStore(STORES.CHUNKS, {
            keyPath: 'id',
            autoIncrement: true
          });
          chunkStore.createIndex('locationId', 'locationId');
          chunkStore.createIndex('locationId_chunkIndex', ['locationId', 'chunkIndex']);
        }

        // Store per metadata registrazioni
        if (!db.objectStoreNames.contains(STORES.RECORDINGS)) {
          const recStore = db.createObjectStore(STORES.RECORDINGS, { keyPath: 'locationId' });
          recStore.createIndex('uploadStatus', 'uploadStatus');
        }

        console.log('✅ [InventoryVideoDB] Schema creato');
      };
    });
  }

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

  // ==================== CHUNKS ====================

  /**
   * Salva un chunk video
   */
  async saveChunk(locationId: number, chunkIndex: number, blob: Blob): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.CHUNKS], 'readwrite');
    const store = tx.objectStore(STORES.CHUNKS);

    const chunk: VideoChunk = {
      locationId,
      chunkIndex,
      blob,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(chunk);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`📹 [InventoryVideoDB] Salvato chunk ${chunkIndex} per location ${locationId}`);
  }

  /**
   * Ottieni tutti i chunks per una location (ordinati)
   */
  async getChunks(locationId: number): Promise<Blob[]> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.CHUNKS], 'readonly');
    const store = tx.objectStore(STORES.CHUNKS);
    const index = store.index('locationId');

    const chunks: VideoChunk[] = await new Promise((resolve, reject) => {
      const request = index.getAll(locationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Ordina per chunkIndex
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    console.log(`📹 [InventoryVideoDB] Caricati ${chunks.length} chunks per location ${locationId}`);
    return chunks.map(c => c.blob);
  }

  /**
   * Conta chunks per una location
   */
  async countChunks(locationId: number): Promise<number> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.CHUNKS], 'readonly');
    const store = tx.objectStore(STORES.CHUNKS);
    const index = store.index('locationId');

    return new Promise((resolve, reject) => {
      const request = index.count(locationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Elimina tutti i chunks per una location
   */
  async clearChunks(locationId: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.CHUNKS], 'readwrite');
    const store = tx.objectStore(STORES.CHUNKS);
    const index = store.index('locationId');

    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(locationId);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    console.log(`🗑️ [InventoryVideoDB] Eliminati chunks per location ${locationId}`);
  }

  // ==================== RECORDINGS ====================

  /**
   * Inizia una nuova registrazione
   */
  async startRecording(locationId: number): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);

    const recording: VideoRecording = {
      locationId,
      startTime: Date.now(),
      duration: 0,
      uploadStatus: 'recording',
      chunksCount: 0,
      retryCount: 0
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(recording);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`🎬 [InventoryVideoDB] Iniziata registrazione location ${locationId}`);
  }

  /**
   * Aggiorna metadata registrazione
   */
  async updateRecording(locationId: number, updates: Partial<VideoRecording>): Promise<void> {
    const db = await this.ensureDB();

    // Use a single transaction for both read and write
    const tx = db.transaction([STORES.RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);

    // Get existing record within the same transaction
    const existing: VideoRecording | undefined = await new Promise((resolve, reject) => {
      const request = store.get(locationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!existing) {
      throw new Error(`Registrazione location ${locationId} non trovata`);
    }

    const updated = { ...existing, ...updates };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ottieni metadata registrazione
   */
  async getRecording(locationId: number): Promise<VideoRecording | null> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.RECORDINGS], 'readonly');
    const store = tx.objectStore(STORES.RECORDINGS);

    return new Promise((resolve, reject) => {
      const request = store.get(locationId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ottieni registrazioni in attesa di upload
   */
  async getPendingRecordings(): Promise<VideoRecording[]> {
    const db = await this.ensureDB();
    const tx = db.transaction([STORES.RECORDINGS], 'readonly');
    const store = tx.objectStore(STORES.RECORDINGS);
    const index = store.index('uploadStatus');

    const pending: VideoRecording[] = await new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const failed: VideoRecording[] = await new Promise((resolve, reject) => {
      const request = index.getAll('failed');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return [...pending, ...failed];
  }

  /**
   * Elimina registrazione e chunks
   */
  async deleteRecording(locationId: number): Promise<void> {
    await this.clearChunks(locationId);

    const db = await this.ensureDB();
    const tx = db.transaction([STORES.RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(locationId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`🗑️ [InventoryVideoDB] Eliminata registrazione location ${locationId}`);
  }

  /**
   * Elimina la registrazione ma conserva i chunks
   */
  async clearRecording(locationId: number): Promise<void> {
    await this.clearChunks(locationId);

    const db = await this.ensureDB();
    const tx = db.transaction([STORES.RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORES.RECORDINGS);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(locationId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`🗑️ [InventoryVideoDB] Pulita registrazione location ${locationId}`);
  }

  // ==================== UTILITY ====================

  /**
   * Combina tutti i chunks in un unico Blob
   */
  async combineChunks(locationId: number): Promise<Blob> {
    const chunks = await this.getChunks(locationId);
    if (chunks.length === 0) {
      throw new Error(`Nessun chunk trovato per location ${locationId}`);
    }

    // Determina il tipo dal primo chunk
    const mimeType = chunks[0].type || 'video/webm';
    const combinedBlob = new Blob(chunks, { type: mimeType });

    console.log(`📹 [InventoryVideoDB] Combinati ${chunks.length} chunks = ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB`);
    return combinedBlob;
  }

  /**
   * Stima spazio usato per una location
   */
  async getStorageSize(locationId: number): Promise<number> {
    const chunks = await this.getChunks(locationId);
    return chunks.reduce((total, chunk) => total + chunk.size, 0);
  }

  /**
   * Pulisci tutto il database
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    const storeNames = [STORES.CHUNKS, STORES.RECORDINGS];
    const tx = db.transaction(storeNames, 'readwrite');

    const promises = storeNames.map(storeName => {
      return new Promise<void>((resolve, reject) => {
        const request = tx.objectStore(storeName).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    console.log('✅ [InventoryVideoDB] Database pulito');
  }

  /**
   * Ottieni statistiche
   */
  async getStats(): Promise<{
    recordingsCount: number;
    pendingCount: number;
    totalChunks: number;
    totalSizeMB: number;
  }> {
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

    const pending = await this.getPendingRecordings();
    const totalChunks = await countStore(STORES.CHUNKS);

    // Calcola dimensione totale (approssimativa)
    let totalSize = 0;
    const tx = db.transaction([STORES.CHUNKS], 'readonly');
    const store = tx.objectStore(STORES.CHUNKS);

    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const chunk = cursor.value as VideoChunk;
          totalSize += chunk.blob.size;
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    return {
      recordingsCount: await countStore(STORES.RECORDINGS),
      pendingCount: pending.length,
      totalChunks,
      totalSizeMB: totalSize / 1024 / 1024
    };
  }
}

// Singleton
let instance: InventoryVideoDB | null = null;

export function getInventoryVideoDB(): InventoryVideoDB {
  if (!instance) {
    instance = new InventoryVideoDB();
  }
  return instance;
}

export default InventoryVideoDB;
