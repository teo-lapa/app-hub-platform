import { MatchedProduct } from '../components/types';

export interface StoredAIMessage {
  id: string; // UUID
  timestamp: number;
  messageType: 'text' | 'audio' | 'image' | 'recording' | 'document';
  transcription: string;
  matches: MatchedProduct[];
  // File originale salvato come base64
  fileData?: {
    base64: string;
    mimeType: string;
    fileName: string;
    size: number;
  };
}

export interface CustomerAIStorage {
  customerId: number;
  customerName: string;
  messages: StoredAIMessage[];
  lastActivity: number; // timestamp ultima interazione
}

interface AIStorageData {
  customers: CustomerAIStorage[];
}

const STORAGE_KEY = 'catalogo-ai-storage-v1';
const MAX_AGE_DAYS = 7;
const MAX_CUSTOMERS = 15;
const CUSTOMERS_TO_REMOVE = 5;

/**
 * Genera un UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Carica i dati dal localStorage
 */
function loadStorage(): AIStorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return { customers: [] };
    }
    return JSON.parse(data) as AIStorageData;
  } catch (error) {
    console.error('Errore nel caricamento dello storage AI:', error);
    return { customers: [] };
  }
}

/**
 * Salva i dati nel localStorage
 */
function saveStorage(data: AIStorageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Errore nel salvataggio dello storage AI:', error);
    // Se lo storage è pieno, proviamo a fare pulizia forzata
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      try {
        cleanupOldMessages(true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (retryError) {
        console.error('Impossibile salvare anche dopo la pulizia:', retryError);
      }
    }
  }
}

/**
 * Pulisce messaggi vecchi e clienti in eccesso
 */
export function cleanupOldMessages(aggressive: boolean = false): void {
  try {
    const storage = loadStorage();
    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    // Rimuovi messaggi più vecchi di MAX_AGE_DAYS
    storage.customers = storage.customers.map(customer => ({
      ...customer,
      messages: customer.messages.filter(msg =>
        (now - msg.timestamp) < maxAge
      )
    }));

    // Rimuovi clienti senza messaggi
    storage.customers = storage.customers.filter(customer =>
      customer.messages.length > 0
    );

    // Se ci sono più di MAX_CUSTOMERS, rimuovi i CUSTOMERS_TO_REMOVE più vecchi
    const maxCustomers = aggressive ? Math.floor(MAX_CUSTOMERS / 2) : MAX_CUSTOMERS;
    if (storage.customers.length > maxCustomers) {
      // Ordina per lastActivity (più vecchio prima)
      storage.customers.sort((a, b) => a.lastActivity - b.lastActivity);

      // Rimuovi i più vecchi
      const toRemove = aggressive ? storage.customers.length - maxCustomers : CUSTOMERS_TO_REMOVE;
      storage.customers = storage.customers.slice(toRemove);
    }

    saveStorage(storage);
  } catch (error) {
    console.error('Errore durante la pulizia dello storage AI:', error);
  }
}

/**
 * Carica i messaggi per un cliente specifico
 */
export function getMessagesForCustomer(customerId: number): StoredAIMessage[] {
  try {
    // Esegui pulizia automatica
    cleanupOldMessages();

    const storage = loadStorage();
    const customer = storage.customers.find(c => c.customerId === customerId);
    return customer?.messages || [];
  } catch (error) {
    console.error('Errore nel caricamento dei messaggi:', error);
    return [];
  }
}

/**
 * Aggiunge un nuovo messaggio per un cliente
 */
export function addMessage(
  customerId: number,
  customerName: string,
  message: Omit<StoredAIMessage, 'id' | 'timestamp'>
): void {
  try {
    const storage = loadStorage();
    const now = Date.now();

    // Trova o crea il cliente
    let customer = storage.customers.find(c => c.customerId === customerId);

    if (!customer) {
      customer = {
        customerId,
        customerName,
        messages: [],
        lastActivity: now
      };
      storage.customers.push(customer);
    }

    // Crea il messaggio completo
    const fullMessage: StoredAIMessage = {
      ...message,
      id: generateUUID(),
      timestamp: now
    };

    // Aggiungi il messaggio e aggiorna lastActivity
    customer.messages.push(fullMessage);
    customer.lastActivity = now;

    saveStorage(storage);
  } catch (error) {
    console.error('Errore nell\'aggiunta del messaggio:', error);
  }
}

/**
 * Pulisce tutti i messaggi di un cliente specifico
 */
export function clearMessagesForCustomer(customerId: number): void {
  try {
    const storage = loadStorage();

    // Rimuovi il cliente o svuota i suoi messaggi
    storage.customers = storage.customers.filter(c => c.customerId !== customerId);

    saveStorage(storage);
  } catch (error) {
    console.error('Errore nella pulizia dei messaggi del cliente:', error);
  }
}

/**
 * Pulisce tutti i messaggi di tutti i clienti
 */
export function clearAllMessages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Errore nella pulizia completa dello storage:', error);
  }
}

/**
 * Ottiene statistiche sullo storage (utile per debug/monitoring)
 */
export function getStorageStats(): {
  totalCustomers: number;
  totalMessages: number;
  oldestActivity: number | null;
  newestActivity: number | null;
} {
  try {
    const storage = loadStorage();
    const totalMessages = storage.customers.reduce((sum, c) => sum + c.messages.length, 0);
    const activities = storage.customers.map(c => c.lastActivity);

    return {
      totalCustomers: storage.customers.length,
      totalMessages,
      oldestActivity: activities.length > 0 ? Math.min(...activities) : null,
      newestActivity: activities.length > 0 ? Math.max(...activities) : null
    };
  } catch (error) {
    console.error('Errore nel recupero delle statistiche:', error);
    return {
      totalCustomers: 0,
      totalMessages: 0,
      oldestActivity: null,
      newestActivity: null
    };
  }
}
