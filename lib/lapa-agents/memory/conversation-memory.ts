/**
 * LAPA AI - Conversation Memory Service
 *
 * Gestisce la memoria persistente delle conversazioni per ogni cliente.
 * Usa Vercel KV (Redis) per storage veloce e persistente.
 */

import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    agentId?: string;
    intent?: string;
    products_shown?: string[];
    recipe_detected?: string;
  };
}

export interface CustomerMemory {
  customer_id: number;
  customer_name: string;
  customer_type: 'b2b' | 'b2c' | 'anonymous';

  // Conversazione corrente
  current_session_id: string;
  messages: ConversationMessage[];

  // Riassunto delle conversazioni passate (per contesto lungo termine)
  conversation_summary: string;

  // Fatti importanti sul cliente (appresi dalle conversazioni)
  customer_facts: string[];

  // Prodotti preferiti/acquistati frequentemente
  favorite_products: string[];

  // Ultimo aggiornamento
  last_interaction: string;

  // Contatore sessioni
  total_sessions: number;
}

export interface MemoryConfig {
  anthropicApiKey: string;
  maxMessagesInContext: number;  // Quanti messaggi tenere nel contesto immediato
  summarizeAfterMessages: number; // Dopo quanti messaggi fare un riassunto
}

// ============================================================================
// CONVERSATION MEMORY SERVICE (Vercel KV)
// ============================================================================

export class ConversationMemoryService {
  private anthropic: Anthropic;
  private config: MemoryConfig;

  // Cache in-memory per performance
  private memoryCache: Map<number, CustomerMemory> = new Map();

  // Prefix per le chiavi KV
  private readonly KEY_PREFIX = 'lapa:memory:';

  constructor(config: MemoryConfig) {
    this.config = config;
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    console.log('🧠 ConversationMemoryService inizializzato (Vercel KV)');
  }

  // ============================================================================
  // KEY HELPERS
  // ============================================================================

  private getKey(customerId: number): string {
    return `${this.KEY_PREFIX}${customerId}`;
  }

  // ============================================================================
  // LOAD & SAVE MEMORY
  // ============================================================================

  /**
   * Carica la memoria di un cliente da Vercel KV
   */
  async loadMemory(customerId: number): Promise<CustomerMemory | null> {
    // Check cache first
    if (this.memoryCache.has(customerId)) {
      console.log(`🧠 Memory loaded from cache for customer ${customerId}`);
      return this.memoryCache.get(customerId)!;
    }

    try {
      const data = await kv.get<CustomerMemory>(this.getKey(customerId));

      if (!data) {
        console.log(`🧠 No memory found for customer ${customerId}`);
        return null;
      }

      // Cache it
      this.memoryCache.set(customerId, data);
      console.log(`🧠 Memory loaded from KV for customer ${customerId} (${data.messages?.length || 0} messages, ${data.total_sessions || 1} sessions)`);

      return data;

    } catch (error) {
      console.error('❌ Error loading memory from KV:', error);
      return null;
    }
  }

  /**
   * Salva la memoria di un cliente su Vercel KV
   */
  async saveMemory(memory: CustomerMemory): Promise<boolean> {
    try {
      // Salva su KV con TTL di 90 giorni (7776000 secondi)
      await kv.set(this.getKey(memory.customer_id), memory, {
        ex: 7776000 // 90 giorni
      });

      // Update cache
      this.memoryCache.set(memory.customer_id, memory);
      console.log(`🧠 Memory saved for customer ${memory.customer_id}`);

      return true;

    } catch (error) {
      console.error('❌ Error saving memory to KV:', error);
      return false;
    }
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Aggiunge un messaggio alla memoria del cliente
   */
  async addMessage(
    customerId: number,
    customerName: string,
    customerType: 'b2b' | 'b2c' | 'anonymous',
    sessionId: string,
    message: ConversationMessage
  ): Promise<CustomerMemory> {

    // Load or create memory
    let memory = await this.loadMemory(customerId);

    if (!memory) {
      // Create new memory for this customer
      memory = {
        customer_id: customerId,
        customer_name: customerName,
        customer_type: customerType,
        current_session_id: sessionId,
        messages: [],
        conversation_summary: '',
        customer_facts: [],
        favorite_products: [],
        last_interaction: new Date().toISOString(),
        total_sessions: 1
      };
    }

    // Check if new session
    if (memory.current_session_id !== sessionId) {
      memory.current_session_id = sessionId;
      memory.total_sessions += 1;
      console.log(`🧠 New session started for customer ${customerId} (session #${memory.total_sessions})`);
    }

    // Add message
    memory.messages.push(message);
    memory.last_interaction = new Date().toISOString();

    // Extract facts from message if it's a user message
    if (message.role === 'user') {
      this.extractFacts(memory, message.content);
    }

    // Extract products shown if it's an assistant message
    if (message.role === 'assistant' && message.metadata?.products_shown) {
      this.updateFavoriteProducts(memory, message.metadata.products_shown);
    }

    // Check if we need to summarize
    if (memory.messages.length >= this.config.summarizeAfterMessages) {
      await this.summarizeConversation(memory);
    }

    // Save to KV
    await this.saveMemory(memory);

    return memory;
  }

  /**
   * Ottiene il contesto completo per l'AI (riassunto + messaggi recenti)
   */
  getContextForAI(memory: CustomerMemory): string {
    const parts: string[] = [];

    // 1. Customer info
    parts.push(`CLIENTE: ${memory.customer_name} (${memory.customer_type.toUpperCase()})`);
    parts.push(`Sessioni totali: ${memory.total_sessions}`);

    // 2. Customer facts (learned from past conversations)
    if (memory.customer_facts.length > 0) {
      parts.push('\nFATTI SUL CLIENTE:');
      memory.customer_facts.slice(-5).forEach(fact => {
        parts.push(`- ${fact}`);
      });
    }

    // 3. Favorite products (recently shown/requested)
    if (memory.favorite_products.length > 0) {
      parts.push('\nPRODOTTI GIÀ VISTI/RICHIESTI:');
      parts.push(memory.favorite_products.slice(-10).join(', '));
    }

    // 4. Conversation summary (past conversations)
    if (memory.conversation_summary) {
      parts.push('\nRIASSUNTO PRECEDENTI:');
      parts.push(memory.conversation_summary);
    }

    // 5. Recent messages (current session) - only last few
    const recentMessages = memory.messages.slice(-this.config.maxMessagesInContext);
    if (recentMessages.length > 0) {
      parts.push('\nULTIMI MESSAGGI:');
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? 'Cliente' : 'AI';
        const shortContent = msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : '');
        parts.push(`${role}: ${shortContent}`);
      });
    }

    return parts.join('\n');
  }

  // ============================================================================
  // FACT EXTRACTION (Simple, no AI call)
  // ============================================================================

  /**
   * Estrae fatti importanti dal messaggio dell'utente (senza chiamata AI)
   */
  private extractFacts(memory: CustomerMemory, userMessage: string): void {
    const lowerMessage = userMessage.toLowerCase();

    // Restaurant/business type
    if (lowerMessage.includes('ristorante') || lowerMessage.includes('pizzeria') || lowerMessage.includes('trattoria')) {
      this.addFactIfNew(memory, 'Gestisce un ristorante/pizzeria');
    }
    if (lowerMessage.includes('hotel') || lowerMessage.includes('albergo')) {
      this.addFactIfNew(memory, 'Lavora nel settore alberghiero');
    }
    if (lowerMessage.includes('negozio') || lowerMessage.includes('bottega')) {
      this.addFactIfNew(memory, 'Ha un negozio/bottega');
    }

    // Dietary preferences
    if (lowerMessage.includes('vegano') || lowerMessage.includes('vegan')) {
      this.addFactIfNew(memory, 'Interessato a prodotti vegani');
    }
    if (lowerMessage.includes('senza glutine') || lowerMessage.includes('gluten free') || lowerMessage.includes('celiaco')) {
      this.addFactIfNew(memory, 'Cerca prodotti senza glutine');
    }

    // Cooking preferences
    if (lowerMessage.includes('carbonara') || lowerMessage.includes('amatriciana') || lowerMessage.includes('gricia')) {
      this.addFactIfNew(memory, 'Appassionato di pasta romana');
    }
    if (lowerMessage.includes('pizza')) {
      this.addFactIfNew(memory, 'Interessato a prodotti per pizza');
    }

    // Quantity indicators
    if (lowerMessage.includes('grossista') || lowerMessage.includes('ingrosso') || lowerMessage.includes('grandi quantità')) {
      this.addFactIfNew(memory, 'Compra in grandi quantità');
    }
  }

  private addFactIfNew(memory: CustomerMemory, fact: string): void {
    if (!memory.customer_facts.includes(fact)) {
      memory.customer_facts.push(fact);
      // Keep only last 10 facts
      if (memory.customer_facts.length > 10) {
        memory.customer_facts.shift();
      }
      console.log(`🧠 New fact: ${fact}`);
    }
  }

  /**
   * Aggiorna i prodotti preferiti basandosi su quelli mostrati/richiesti
   */
  private updateFavoriteProducts(memory: CustomerMemory, products: string[]): void {
    products.forEach(product => {
      // Remove if exists (to move to end)
      const index = memory.favorite_products.indexOf(product);
      if (index > -1) {
        memory.favorite_products.splice(index, 1);
      }
      // Add to end
      memory.favorite_products.push(product);
      // Keep only last 20
      if (memory.favorite_products.length > 20) {
        memory.favorite_products.shift();
      }
    });
  }

  /**
   * Riassume la conversazione quando diventa troppo lunga
   */
  private async summarizeConversation(memory: CustomerMemory): Promise<void> {
    console.log(`🧠 Summarizing conversation for customer ${memory.customer_id} (${memory.messages.length} messages)`);

    // Get messages to summarize (all except recent ones)
    const messagesToSummarize = memory.messages.slice(0, -this.config.maxMessagesInContext);

    if (messagesToSummarize.length < 5) {
      return; // Not enough to summarize
    }

    try {
      const conversationText = messagesToSummarize
        .map(m => `${m.role === 'user' ? 'Cliente' : 'AI'}: ${m.content.substring(0, 200)}`)
        .join('\n');

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.3,
        system: `Riassumi questa conversazione in 2-3 frasi. Focus su: cosa ha cercato/chiesto il cliente, problemi, preferenze. Sii conciso.`,
        messages: [{
          role: 'user',
          content: conversationText
        }]
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      // Append to existing summary
      if (memory.conversation_summary) {
        memory.conversation_summary = `${memory.conversation_summary} | ${summary}`;
      } else {
        memory.conversation_summary = summary;
      }

      // Keep summary under 1000 chars
      if (memory.conversation_summary.length > 1000) {
        memory.conversation_summary = memory.conversation_summary.slice(-1000);
      }

      // Remove summarized messages, keep only recent ones
      memory.messages = memory.messages.slice(-this.config.maxMessagesInContext);

      console.log(`🧠 Summarized. New length: ${memory.conversation_summary.length} chars`);

    } catch (error) {
      console.error('❌ Error summarizing:', error);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Pulisce la cache in-memory
   */
  clearCache(): void {
    this.memoryCache.clear();
    console.log('🧠 Memory cache cleared');
  }

  /**
   * Elimina la memoria di un cliente (GDPR compliance)
   */
  async deleteMemory(customerId: number): Promise<boolean> {
    try {
      await kv.del(this.getKey(customerId));
      this.memoryCache.delete(customerId);
      console.log(`🧠 Memory deleted for customer ${customerId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
      return false;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryServiceInstance: ConversationMemoryService | null = null;

export function getMemoryService(): ConversationMemoryService {
  if (!memoryServiceInstance) {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY');
    }

    memoryServiceInstance = new ConversationMemoryService({
      anthropicApiKey,
      maxMessagesInContext: 8,   // Keep last 8 messages in immediate context
      summarizeAfterMessages: 16 // Summarize after 16 messages
    });
  }
  return memoryServiceInstance;
}

export function createMemoryService(config: MemoryConfig): ConversationMemoryService {
  return new ConversationMemoryService(config);
}
