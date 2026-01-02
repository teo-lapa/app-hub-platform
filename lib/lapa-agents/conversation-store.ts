/**
 * CONVERSATION STORE - Persistenza conversazioni su Vercel KV
 *
 * Salva e carica le conversazioni dal KV per mantenere lo storico
 * tra diverse invocazioni serverless
 */

import { kv } from '@vercel/kv';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentId?: string;
  channel?: 'web' | 'whatsapp' | 'api';  // Da dove viene il messaggio
  // Chi ha scritto questo messaggio (per messaggi utente in conversazioni condivise padre/figli)
  senderId?: number;      // ID del partner che ha scritto (es. Mario = 1001)
  senderName?: string;    // Nome del partner che ha scritto (es. "Mario Rossi")
  data?: any;  // Per salvare dati come pending_products per selezioni successive
  metadata?: {
    attachments?: Array<{
      name: string;
      content: string; // base64
      mimetype: string;
    }>;
    [key: string]: any;
  };
}

export interface StoredConversation {
  sessionId: string;  // Ora basato su customerId/parentId, non più random
  customerId?: number;  // ID del cliente principale (o ultimo che ha scritto)
  parentId?: number;    // ID dell'azienda padre (se esiste) - per conversazioni condivise
  customerName?: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  channels?: ('web' | 'whatsapp' | 'api')[];  // Canali usati in questa conversazione
  messages: Message[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CONVERSATION_PREFIX = 'lapa_conv:';
const MAX_CONVERSATIONS = 100; // Mantieni le ultime 100 conversazioni (non più basato su tempo)

/**
 * Salva una conversazione nel KV
 * NOTA: Non usa più TTL - le conversazioni vengono mantenute per quantità, non per tempo
 */
export async function saveConversation(conversation: StoredConversation): Promise<void> {
  try {
    const key = `${CONVERSATION_PREFIX}${conversation.sessionId}`;

    // Converti Date in ISO strings per serializzazione
    const serializable = {
      ...conversation,
      messages: conversation.messages.map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
      })),
      createdAt: conversation.createdAt instanceof Date ? conversation.createdAt.toISOString() : conversation.createdAt,
      updatedAt: new Date().toISOString()
    };

    // Salva SENZA TTL - le conversazioni persistono finché non vengono pulite
    await kv.set(key, serializable);
    console.log(`💾 Conversazione salvata: ${conversation.sessionId} (${conversation.messages.length} messaggi)`);

    // Ogni tanto pulisci le conversazioni vecchie (1% delle volte per non rallentare)
    if (Math.random() < 0.01) {
      cleanupOldConversations().catch(err => console.warn('⚠️ Cleanup error:', err));
    }
  } catch (error) {
    console.error('❌ Errore salvataggio conversazione:', error);
  }
}

/**
 * Pulisce le conversazioni più vecchie se superiamo MAX_CONVERSATIONS
 * Mantiene sempre le ultime 100 conversazioni ordinate per updatedAt
 */
export async function cleanupOldConversations(): Promise<number> {
  try {
    const keys = await kv.keys(`${CONVERSATION_PREFIX}*`);

    if (keys.length <= MAX_CONVERSATIONS) {
      return 0; // Niente da pulire
    }

    console.log(`🧹 Cleanup: ${keys.length} conversazioni trovate, limite ${MAX_CONVERSATIONS}`);

    // Carica tutte le conversazioni per ordinarle per data
    const conversations: { key: string; updatedAt: Date }[] = [];
    for (const key of keys) {
      const data = await kv.get<any>(key);
      if (data?.updatedAt) {
        conversations.push({
          key,
          updatedAt: new Date(data.updatedAt)
        });
      }
    }

    // Ordina per data (più recenti prima)
    conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Elimina le conversazioni oltre il limite
    const toDelete = conversations.slice(MAX_CONVERSATIONS);
    let deleted = 0;

    for (const conv of toDelete) {
      await kv.del(conv.key);
      deleted++;
    }

    console.log(`🗑️ Cleanup completato: ${deleted} conversazioni eliminate`);
    return deleted;
  } catch (error) {
    console.error('❌ Errore cleanup conversazioni:', error);
    return 0;
  }
}

/**
 * Carica una conversazione dal KV
 */
export async function loadConversation(sessionId: string): Promise<StoredConversation | null> {
  try {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    const data = await kv.get<any>(key);

    if (!data) {
      console.log(`📭 Nessuna conversazione trovata per: ${sessionId}`);
      return null;
    }

    // Converti ISO strings in Date
    const conversation: StoredConversation = {
      ...data,
      messages: data.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };

    console.log(`📂 Conversazione caricata: ${sessionId} (${conversation.messages.length} messaggi)`);
    return conversation;
  } catch (error) {
    console.error('❌ Errore caricamento conversazione:', error);
    return null;
  }
}

/**
 * Info del cliente che sta scrivendo
 */
export interface CustomerInfo {
  customerId?: number;      // ID del partner che sta scrivendo
  customerName?: string;    // Nome del partner che sta scrivendo
  customerType?: 'b2b' | 'b2c' | 'anonymous';
  parentId?: number;        // ID dell'azienda padre (se figlio)
}

/**
 * Aggiunge un messaggio a una conversazione esistente
 *
 * IMPORTANTE: Il sessionId ora è basato su customerId/parentId per garantire
 * che lo stesso cliente veda sempre la sua cronologia.
 *
 * Per conversazioni padre/figli:
 * - sessionId = "customer-{parentId}" (tutti i figli vedono la stessa conv)
 * - Ogni messaggio salva senderId/senderName per sapere CHI ha scritto
 */
export async function addMessageToConversation(
  sessionId: string,
  message: Message,
  customerInfo?: CustomerInfo
): Promise<StoredConversation> {
  let conversation = await loadConversation(sessionId);

  if (!conversation) {
    // Crea nuova conversazione
    conversation = {
      sessionId,
      customerId: customerInfo?.customerId,
      parentId: customerInfo?.parentId,
      customerName: customerInfo?.customerName,
      customerType: customerInfo?.customerType || 'anonymous',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Aggiorna info conversazione se fornite
  if (customerInfo) {
    // Aggiorna sempre customerId e customerName con l'ultimo che ha scritto
    if (customerInfo.customerId) conversation.customerId = customerInfo.customerId;
    if (customerInfo.customerName) conversation.customerName = customerInfo.customerName;
    if (customerInfo.customerType) conversation.customerType = customerInfo.customerType;
    // parentId resta sempre lo stesso (è l'azienda padre)
    if (customerInfo.parentId && !conversation.parentId) {
      conversation.parentId = customerInfo.parentId;
    }
  }

  // Per messaggi utente, aggiungi info su chi ha scritto
  if (message.role === 'user' && customerInfo) {
    message.senderId = customerInfo.customerId;
    message.senderName = customerInfo.customerName;
  }

  // Traccia i canali usati nella conversazione
  if (message.channel) {
    if (!conversation.channels) {
      conversation.channels = [];
    }
    if (!conversation.channels.includes(message.channel)) {
      conversation.channels.push(message.channel);
    }
  }

  // Aggiungi messaggio
  conversation.messages.push(message);

  // Limita a 100 messaggi per sessione
  if (conversation.messages.length > 100) {
    conversation.messages = conversation.messages.slice(-100);
  }

  // Salva
  await saveConversation(conversation);

  return conversation;
}

/**
 * Ottieni le ultime conversazioni per la dashboard
 */
export async function getRecentConversations(limit: number = 20): Promise<StoredConversation[]> {
  try {
    // Cerca tutte le chiavi di conversazione
    const keys = await kv.keys(`${CONVERSATION_PREFIX}*`);

    if (keys.length === 0) {
      return [];
    }

    // Carica le conversazioni
    const conversations: StoredConversation[] = [];
    for (const key of keys.slice(0, limit * 2)) { // Carica più del necessario per filtrare
      const sessionId = key.replace(CONVERSATION_PREFIX, '');
      const conv = await loadConversation(sessionId);
      if (conv && conv.messages.length > 0) {
        conversations.push(conv);
      }
    }

    // Ordina per data aggiornamento e limita
    return conversations
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error('❌ Errore caricamento conversazioni recenti:', error);
    return [];
  }
}

/**
 * Ottieni conversazioni per un agente specifico
 */
export async function getConversationsByAgent(agentId: string, limit: number = 20): Promise<StoredConversation[]> {
  try {
    const allConversations = await getRecentConversations(100);

    // Filtra conversazioni che hanno messaggi da questo agente
    return allConversations
      .filter(conv => conv.messages.some(m => m.agentId === agentId))
      .slice(0, limit);
  } catch (error) {
    console.error(`❌ Errore caricamento conversazioni per agente ${agentId}:`, error);
    return [];
  }
}

/**
 * Elimina una conversazione
 */
export async function deleteConversation(sessionId: string): Promise<boolean> {
  try {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    await kv.del(key);
    console.log(`🗑️ Conversazione eliminata: ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Errore eliminazione conversazione:', error);
    return false;
  }
}
