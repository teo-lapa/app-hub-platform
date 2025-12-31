/**
 * LAPA AI - Conversation Memory Service
 *
 * Gestisce la memoria persistente delle conversazioni per ogni cliente.
 * Salva su Supabase e mantiene contesto tra sessioni.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  supabaseUrl: string;
  supabaseKey: string;
  anthropicApiKey: string;
  maxMessagesInContext: number;  // Quanti messaggi tenere nel contesto immediato
  summarizeAfterMessages: number; // Dopo quanti messaggi fare un riassunto
}

// ============================================================================
// CONVERSATION MEMORY SERVICE
// ============================================================================

export class ConversationMemoryService {
  private supabase: SupabaseClient;
  private anthropic: Anthropic;
  private config: MemoryConfig;

  // Cache in-memory per performance
  private memoryCache: Map<number, CustomerMemory> = new Map();

  constructor(config: MemoryConfig) {
    this.config = config;

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

    console.log('🧠 ConversationMemoryService inizializzato');
  }

  // ============================================================================
  // LOAD & SAVE MEMORY
  // ============================================================================

  /**
   * Carica la memoria di un cliente da Supabase
   */
  async loadMemory(customerId: number): Promise<CustomerMemory | null> {
    // Check cache first
    if (this.memoryCache.has(customerId)) {
      console.log(`🧠 Memory loaded from cache for customer ${customerId}`);
      return this.memoryCache.get(customerId)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('customer_memories')
        .select('*')
        .eq('customer_id', customerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No row found - customer has no memory yet
          console.log(`🧠 No memory found for customer ${customerId}`);
          return null;
        }
        throw error;
      }

      const memory: CustomerMemory = {
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        customer_type: data.customer_type,
        current_session_id: data.current_session_id,
        messages: data.messages || [],
        conversation_summary: data.conversation_summary || '',
        customer_facts: data.customer_facts || [],
        favorite_products: data.favorite_products || [],
        last_interaction: data.last_interaction,
        total_sessions: data.total_sessions || 1
      };

      // Cache it
      this.memoryCache.set(customerId, memory);
      console.log(`🧠 Memory loaded from DB for customer ${customerId} (${memory.messages.length} messages, ${memory.total_sessions} sessions)`);

      return memory;

    } catch (error) {
      console.error('❌ Error loading memory:', error);
      return null;
    }
  }

  /**
   * Salva la memoria di un cliente su Supabase
   */
  async saveMemory(memory: CustomerMemory): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('customer_memories')
        .upsert({
          customer_id: memory.customer_id,
          customer_name: memory.customer_name,
          customer_type: memory.customer_type,
          current_session_id: memory.current_session_id,
          messages: memory.messages,
          conversation_summary: memory.conversation_summary,
          customer_facts: memory.customer_facts,
          favorite_products: memory.favorite_products,
          last_interaction: memory.last_interaction,
          total_sessions: memory.total_sessions,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'customer_id'
        });

      if (error) throw error;

      // Update cache
      this.memoryCache.set(memory.customer_id, memory);
      console.log(`🧠 Memory saved for customer ${memory.customer_id}`);

      return true;

    } catch (error) {
      console.error('❌ Error saving memory:', error);
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
      await this.extractFacts(memory, message.content);
    }

    // Extract products shown if it's an assistant message
    if (message.role === 'assistant' && message.metadata?.products_shown) {
      this.updateFavoriteProducts(memory, message.metadata.products_shown);
    }

    // Check if we need to summarize
    if (memory.messages.length >= this.config.summarizeAfterMessages) {
      await this.summarizeConversation(memory);
    }

    // Save to DB
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
    parts.push(`Ultima interazione: ${memory.last_interaction}`);

    // 2. Customer facts (learned from past conversations)
    if (memory.customer_facts.length > 0) {
      parts.push('\nFATTI IMPORTANTI SUL CLIENTE:');
      memory.customer_facts.forEach(fact => {
        parts.push(`- ${fact}`);
      });
    }

    // 3. Favorite products
    if (memory.favorite_products.length > 0) {
      parts.push('\nPRODOTTI PREFERITI/FREQUENTI:');
      parts.push(memory.favorite_products.join(', '));
    }

    // 4. Conversation summary (past conversations)
    if (memory.conversation_summary) {
      parts.push('\nRIASSUNTO CONVERSAZIONI PRECEDENTI:');
      parts.push(memory.conversation_summary);
    }

    // 5. Recent messages (current session)
    const recentMessages = memory.messages.slice(-this.config.maxMessagesInContext);
    if (recentMessages.length > 0) {
      parts.push('\nCONVERSAZIONE RECENTE:');
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? 'Cliente' : 'AI';
        parts.push(`${role}: ${msg.content.substring(0, 500)}${msg.content.length > 500 ? '...' : ''}`);
      });
    }

    return parts.join('\n');
  }

  // ============================================================================
  // AI-POWERED MEMORY FEATURES
  // ============================================================================

  /**
   * Estrae fatti importanti dal messaggio dell'utente
   */
  private async extractFacts(memory: CustomerMemory, userMessage: string): Promise<void> {
    // Quick checks for common facts
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
      this.addFactIfNew(memory, 'Appassionato di pasta romana tradizionale');
    }
    if (lowerMessage.includes('pizza')) {
      this.addFactIfNew(memory, 'Fa/vende pizza');
    }

    // Quantity indicators
    if (lowerMessage.includes('grossista') || lowerMessage.includes('ingrosso') || lowerMessage.includes('grandi quantità')) {
      this.addFactIfNew(memory, 'Compra in grandi quantità');
    }
  }

  private addFactIfNew(memory: CustomerMemory, fact: string): void {
    if (!memory.customer_facts.includes(fact)) {
      memory.customer_facts.push(fact);
      console.log(`🧠 New fact learned about customer ${memory.customer_id}: ${fact}`);
    }
  }

  /**
   * Aggiorna i prodotti preferiti basandosi su quelli mostrati/richiesti
   */
  private updateFavoriteProducts(memory: CustomerMemory, products: string[]): void {
    products.forEach(product => {
      if (!memory.favorite_products.includes(product)) {
        memory.favorite_products.push(product);
        // Keep only last 20 favorite products
        if (memory.favorite_products.length > 20) {
          memory.favorite_products.shift();
        }
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
        .map(m => `${m.role === 'user' ? 'Cliente' : 'AI'}: ${m.content}`)
        .join('\n');

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.3,
        system: `Sei un assistente che crea riassunti concisi di conversazioni.
Estrai SOLO le informazioni importanti:
- Cosa ha cercato/ordinato il cliente
- Problemi riscontrati
- Preferenze espresse
- Decisioni prese

NON includere saluti o convenevoli. Sii conciso (max 200 parole).`,
        messages: [{
          role: 'user',
          content: `Riassumi questa conversazione:\n\n${conversationText}`
        }]
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      // Append to existing summary
      if (memory.conversation_summary) {
        memory.conversation_summary = `${memory.conversation_summary}\n\n--- Sessione precedente ---\n${summary}`;
      } else {
        memory.conversation_summary = summary;
      }

      // Keep summary under 2000 chars
      if (memory.conversation_summary.length > 2000) {
        memory.conversation_summary = memory.conversation_summary.slice(-2000);
      }

      // Remove summarized messages, keep only recent ones
      memory.messages = memory.messages.slice(-this.config.maxMessagesInContext);

      console.log(`🧠 Conversation summarized. New summary length: ${memory.conversation_summary.length} chars`);

    } catch (error) {
      console.error('❌ Error summarizing conversation:', error);
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
      const { error } = await this.supabase
        .from('customer_memories')
        .delete()
        .eq('customer_id', customerId);

      if (error) throw error;

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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseKey || !anthropicApiKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY');
    }

    memoryServiceInstance = new ConversationMemoryService({
      supabaseUrl,
      supabaseKey,
      anthropicApiKey,
      maxMessagesInContext: 10,  // Keep last 10 messages in immediate context
      summarizeAfterMessages: 20  // Summarize after 20 messages
    });
  }
  return memoryServiceInstance;
}

export function createMemoryService(config: MemoryConfig): ConversationMemoryService {
  return new ConversationMemoryService(config);
}
