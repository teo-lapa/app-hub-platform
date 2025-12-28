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
}

export interface StoredConversation {
  sessionId: string;
  customerId?: number;
  customerName?: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  messages: Message[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CONVERSATION_PREFIX = 'lapa_conv:';
const CONVERSATION_TTL = 60 * 60 * 24; // 24 ore

/**
 * Salva una conversazione nel KV
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

    await kv.set(key, serializable, { ex: CONVERSATION_TTL });
    console.log(`💾 Conversazione salvata: ${conversation.sessionId} (${conversation.messages.length} messaggi)`);
  } catch (error) {
    console.error('❌ Errore salvataggio conversazione:', error);
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
 * Aggiunge un messaggio a una conversazione esistente
 */
export async function addMessageToConversation(
  sessionId: string,
  message: Message,
  customerInfo?: { customerId?: number; customerName?: string; customerType?: 'b2b' | 'b2c' | 'anonymous' }
): Promise<StoredConversation> {
  let conversation = await loadConversation(sessionId);

  if (!conversation) {
    // Crea nuova conversazione
    conversation = {
      sessionId,
      customerId: customerInfo?.customerId,
      customerName: customerInfo?.customerName,
      customerType: customerInfo?.customerType || 'anonymous',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Aggiorna info cliente se fornite
  if (customerInfo) {
    if (customerInfo.customerId) conversation.customerId = customerInfo.customerId;
    if (customerInfo.customerName) conversation.customerName = customerInfo.customerName;
    if (customerInfo.customerType) conversation.customerType = customerInfo.customerType;
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
