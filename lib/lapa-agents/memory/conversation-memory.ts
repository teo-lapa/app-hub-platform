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

// ============================================================================
// AVATAR TYPES - Stili di comunicazione (Ologrammi Merenda semplificati)
// ============================================================================

/**
 * 4 Stili di comunicazione
 */
export type CommunicationStyle =
  | 'diretto'      // Dominante - Vai al punto, no chiacchiere
  | 'analitico'    // Dominante - Dammi dati, confronti, logica
  | 'relazionale'  // Gregario - Chiacchieriamo, come stai?
  | 'pratico';     // Gregario - Fammi facile, zero pensieri

export type PersonalityCategory = 'dominante' | 'gregario';

export type BusinessType =
  | 'ristorante'
  | 'pizzeria'
  | 'ristorante_pizzeria'
  | 'bar_gelateria'
  | 'pasticceria'
  | 'hotel'
  | 'negozio_alimentare'
  | 'catering'
  | 'food_truck'
  | 'altro';

export type ContactRole =
  | 'titolare'
  | 'direttore'
  | 'chef'
  | 'pizzaiolo'
  | 'pasticcere'
  | 'responsabile_ordini'
  | 'responsabile_cucina'
  | 'amministrazione'
  | 'commercialista'
  | 'cameriere'
  | 'altro';

/**
 * Guida comunicazione per l'AI
 */
export interface CommunicationGuide {
  keywords_to_use?: string[];
  keywords_to_avoid?: string[];
  sales_approach?: string;
  greeting_example?: string;
}

/**
 * Date importanti (compleanno, anniversario, etc.)
 */
export interface ImportantDate {
  date: string;        // Formato MM-DD
  occasion: string;
  year?: number;
}

/**
 * Follow-up da fare
 */
export interface FollowUp {
  id: string;
  action: string;
  created_at: string;
  due_date?: string;
  done: boolean;
  done_at?: string;
}

/**
 * Arricchimento web (dati da social, Google, sito)
 */
export interface WebEnrichment {
  website_url?: string;
  menu_items?: string[];
  cuisine_style?: string;
  price_range?: string;
  specialties?: string[];
  google_rating?: number;
  google_reviews_count?: number;
  instagram_handle?: string;
  instagram_followers?: number;
  last_enrichment_date?: string;
}

/**
 * Pattern di acquisto (da Odoo)
 */
export interface PurchasePatterns {
  order_frequency_days?: number;
  preferred_delivery_days?: string[];
  top_products?: Array<{
    product_id: number;
    product_name: string;
    quantity_avg: number;
  }>;
  avg_order_value?: number;
  total_revenue?: number;
  total_orders?: number;
  last_order_date?: string;
}

/**
 * Avatar dell'azienda (livello company)
 */
export interface CompanyAvatar {
  odoo_partner_id: number;
  partner_type: 'cliente' | 'fornitore';
  business_type?: BusinessType;
  industry?: string;
  city?: string;
  address?: string;
  website?: string;
  web_enrichment?: WebEnrichment;
  purchase_patterns?: PurchasePatterns;
  company_notes?: string[];
}

/**
 * Avatar del contatto (livello persona)
 */
export interface ContactAvatar {
  odoo_partner_id: number;
  name: string;
  role?: ContactRole;
  role_description?: string;
  email?: string;
  phone?: string;
  mobile?: string;

  // Stile comunicazione (4 stili Merenda)
  communication_style: CommunicationStyle;
  personality_category: PersonalityCategory;
  preferred_tone: 'formale' | 'informale' | 'amichevole';
  uses_emoji: boolean;
  preferred_language: 'it' | 'de' | 'fr' | 'en';
  message_length: 'corto' | 'medio' | 'dettagliato';
  communication_guide?: CommunicationGuide;

  // Info personali
  birthday?: string;            // Formato MM-DD
  important_dates?: ImportantDate[];
  personal_notes?: string[];

  // Relazione
  relationship_notes?: string;
  decision_maker: boolean;
  best_contact_time?: string;

  // Follow-up
  followups?: FollowUp[];
}

// ============================================================================
// CUSTOMER MEMORY (Extended with Avatar)
// ============================================================================

export interface CustomerMemory {
  customer_id: number;        // ID usato come chiave (per B2B = company_id, per B2C = customer_id)
  customer_name: string;      // Nome azienda per B2B, nome cliente per B2C
  customer_type: 'b2b' | 'b2c' | 'anonymous';

  // Per B2B: traccia anche l'ID dell'azienda padre
  company_id?: number;        // ID dell'azienda (parent) per clienti B2B
  company_name?: string;      // Nome dell'azienda

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

  // ========================================
  // AVATAR DATA (NEW)
  // ========================================

  // Avatar azienda (dati business, ordini, web enrichment)
  company_avatar?: CompanyAvatar;

  // Avatar contatto corrente (stile comunicazione, info personali)
  contact_avatar?: ContactAvatar;

  // Contatti multipli per azienda (mappa odoo_partner_id -> ContactAvatar)
  contacts?: Record<number, ContactAvatar>;

  // ID del contatto attivo nella sessione corrente
  active_contact_id?: number;
}

export interface MemoryConfig {
  anthropicApiKey: string;
  maxMessagesInContext: number;  // Quanti messaggi tenere nel contesto immediato
  summarizeAfterMessages: number; // Dopo quanti messaggi fare un riassunto
}

// ============================================================================
// COMMUNICATION STYLE GUIDES - Istruzioni per l'AI
// ============================================================================

export const COMMUNICATION_STYLE_GUIDES: Record<CommunicationStyle, {
  description: string;
  category: PersonalityCategory;
  do: string[];
  dont: string[];
  keywords: string[];
  example_greeting: string;
  example_pitch: string;
}> = {
  diretto: {
    description: "Dominante - Vai dritto al punto, efficiente, risultati",
    category: "dominante",
    do: [
      "Vai subito al punto",
      "Proponi soluzioni concrete",
      "Rispetta il suo tempo",
      "Lascialo decidere velocemente",
      "Riconosci i suoi successi"
    ],
    dont: [
      "Non fare giri di parole",
      "Non sommergere di dettagli inutili",
      "Non farlo aspettare",
      "Non essere indeciso"
    ],
    keywords: ["subito", "risultato", "efficiente", "deciso", "migliore"],
    example_greeting: "Ciao! Ho quello che ti serve:",
    example_pitch: "Mozzarella Bufala DOP. 12 pezzi, CHF 89. Consegna domani. Confermo?"
  },

  analitico: {
    description: "Dominante - Dati, confronti, logica, precisione",
    category: "dominante",
    do: [
      "Fornisci dati precisi",
      "Fai confronti oggettivi",
      "Cita certificazioni e qualità",
      "Spiega il rapporto qualità-prezzo",
      "Lascia che analizzi"
    ],
    dont: [
      "Non essere vago",
      "Non dire 'fidati di me'",
      "Non saltare i dettagli tecnici",
      "Non pressare per decisioni immediate"
    ],
    keywords: ["dati", "confronto", "certificato", "qualità", "analisi", "rapporto"],
    example_greeting: "Buongiorno, ti mando i dettagli richiesti:",
    example_pitch: "Mozzarella A: CHF 6.90/kg, shelf life 48h. Mozzarella B: CHF 7.40/kg, shelf life 72h (+50%). Costo +7%, durata +50% = meno sprechi."
  },

  relazionale: {
    description: "Gregario - Relazione, chiacchiere, calore umano",
    category: "gregario",
    do: [
      "Chiedi come sta",
      "Ricorda dettagli personali",
      "Fai complimenti sinceri",
      "Mostra interesse genuino",
      "Crea connessione emotiva"
    ],
    dont: [
      "Non essere freddo o distaccato",
      "Non andare subito al business",
      "Non ignorare le sue emozioni",
      "Non essere troppo formale"
    ],
    keywords: ["come stai", "famiglia", "insieme", "contento", "grazie"],
    example_greeting: "Ciao Marco! Come va? Come è andato il weekend?",
    example_pitch: "Ho pensato a te quando è arrivata questa Burrata freschissima! I tuoi clienti impazziranno, vedrai che soddisfazione!"
  },

  pratico: {
    description: "Gregario - Semplicità, zero pensieri, comfort",
    category: "gregario",
    do: [
      "Rendi tutto semplice",
      "Offri soluzioni chiavi in mano",
      "Elimina la complessità",
      "Rassicura che pensi tu a tutto",
      "Proponi ordini automatici"
    ],
    dont: [
      "Non complicare",
      "Non dare troppe opzioni",
      "Non creare lavoro extra",
      "Non mettere fretta"
    ],
    keywords: ["semplice", "facile", "pensiamo noi", "come sempre", "zero pensieri"],
    example_greeting: "Ciao! Ho preparato tutto come al solito:",
    example_pitch: "Ecco il tuo ordine settimanale pronto. Stesse quantità di sempre. Confermi con 'ok' e domani è da te."
  }
};

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
   * NOTA: Memoria permanente senza TTL
   */
  async saveMemory(memory: CustomerMemory): Promise<boolean> {
    try {
      // Salva su KV senza TTL (memoria permanente)
      await kv.set(this.getKey(memory.customer_id), memory);

      // Update cache
      this.memoryCache.set(memory.customer_id, memory);
      console.log(`🧠 Memory saved for ${memory.company_name || memory.customer_name} (ID: ${memory.customer_id})`);

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
   * Per clienti B2B: usa company_id come chiave per condividere la memoria tra tutti i contatti dell'azienda
   * Per clienti B2C: usa customer_id
   */
  async addMessage(
    customerId: number,
    customerName: string,
    customerType: 'b2b' | 'b2c' | 'anonymous',
    sessionId: string,
    message: ConversationMessage,
    companyId?: number,       // ID dell'azienda padre (per B2B)
    companyName?: string      // Nome dell'azienda padre (per B2B)
  ): Promise<CustomerMemory> {

    // Per B2B con azienda padre, usa l'ID azienda come chiave memoria
    const memoryKeyId = (customerType === 'b2b' && companyId) ? companyId : customerId;
    const memoryName = (customerType === 'b2b' && companyName) ? companyName : customerName;

    // Load or create memory
    let memory = await this.loadMemory(memoryKeyId);

    if (!memory) {
      // Create new memory for this customer/company
      memory = {
        customer_id: memoryKeyId,
        customer_name: memoryName,
        customer_type: customerType,
        company_id: companyId,
        company_name: companyName,
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
      console.log(`🧠 New session started for ${companyName || customerName} (ID: ${memoryKeyId}, session #${memory.total_sessions})`);
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
   * Ottiene il contesto completo per l'AI (riassunto + messaggi recenti + stile comunicazione)
   */
  getContextForAI(memory: CustomerMemory): string {
    const parts: string[] = [];

    // 1. Customer/Company info
    if (memory.customer_type === 'b2b' && memory.company_name) {
      parts.push(`AZIENDA: ${memory.company_name} (B2B)`);
    } else {
      parts.push(`CLIENTE: ${memory.customer_name} (${memory.customer_type.toUpperCase()})`);
    }
    parts.push(`Sessioni totali: ${memory.total_sessions}`);

    // 2. Company Avatar info (business type, purchase patterns)
    if (memory.company_avatar) {
      const ca = memory.company_avatar;
      if (ca.business_type) {
        parts.push(`Tipo attività: ${ca.business_type}`);
      }
      if (ca.city) {
        parts.push(`Città: ${ca.city}`);
      }
      if (ca.purchase_patterns) {
        const pp = ca.purchase_patterns;
        if (pp.total_orders && pp.avg_order_value) {
          parts.push(`Storico: ${pp.total_orders} ordini, media CHF ${pp.avg_order_value.toFixed(0)}`);
        }
        if (pp.top_products && pp.top_products.length > 0) {
          parts.push(`Prodotti preferiti: ${pp.top_products.slice(0, 3).map(p => p.product_name).join(', ')}`);
        }
      }
      if (ca.web_enrichment?.google_rating) {
        parts.push(`Rating Google: ${ca.web_enrichment.google_rating}/5`);
      }
    }

    // 3. Contact Avatar - STILE COMUNICAZIONE (fondamentale per l'AI)
    const contact = memory.contact_avatar || (memory.active_contact_id && memory.contacts?.[memory.active_contact_id]);
    if (contact) {
      const style = contact.communication_style;
      const guide = COMMUNICATION_STYLE_GUIDES[style];

      parts.push('\n═══ STILE COMUNICAZIONE ═══');
      parts.push(`Contatto: ${contact.name}${contact.role ? ` (${contact.role})` : ''}`);
      parts.push(`Stile: ${style.toUpperCase()} - ${guide.description}`);
      parts.push(`Tono: ${contact.preferred_tone} | Emoji: ${contact.uses_emoji ? 'sì' : 'no'} | Lingua: ${contact.preferred_language}`);

      parts.push('\nCOSA FARE:');
      guide.do.forEach(d => parts.push(`✓ ${d}`));

      parts.push('\nCOSA NON FARE:');
      guide.dont.forEach(d => parts.push(`✗ ${d}`));

      parts.push(`\nKeywords da usare: ${guide.keywords.join(', ')}`);
      parts.push(`Esempio saluto: "${guide.example_greeting}"`);

      // Custom guide if available
      if (contact.communication_guide) {
        const cg = contact.communication_guide;
        if (cg.keywords_to_use?.length) {
          parts.push(`Keywords personali: ${cg.keywords_to_use.join(', ')}`);
        }
        if (cg.sales_approach) {
          parts.push(`Approccio vendita: ${cg.sales_approach}`);
        }
      }

      // Personal notes
      if (contact.personal_notes?.length) {
        parts.push('\nNOTE PERSONALI:');
        contact.personal_notes.slice(-3).forEach(note => parts.push(`- ${note}`));
      }

      // Check special dates
      const today = new Date();
      const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (contact.birthday === todayMMDD) {
        parts.push('\n🎂 OGGI È IL SUO COMPLEANNO! Fai gli auguri!');
      }
      const todayEvents = contact.important_dates?.filter(d => d.date === todayMMDD);
      if (todayEvents?.length) {
        parts.push(`\n📅 Oggi: ${todayEvents.map(e => e.occasion).join(', ')}`);
      }

      // Pending followups
      const pendingFollowups = contact.followups?.filter(f => !f.done);
      if (pendingFollowups?.length) {
        parts.push('\n📋 FOLLOW-UP DA FARE:');
        pendingFollowups.slice(0, 3).forEach(f => parts.push(`- ${f.action}`));
      }

      parts.push('═══════════════════════════\n');
    }

    // 4. Customer facts (learned from past conversations)
    if (memory.customer_facts.length > 0) {
      parts.push('FATTI SUL CLIENTE:');
      memory.customer_facts.slice(-5).forEach(fact => {
        parts.push(`- ${fact}`);
      });
    }

    // 5. Favorite products (recently shown/requested)
    if (memory.favorite_products.length > 0) {
      parts.push('\nPRODOTTI GIÀ VISTI/RICHIESTI:');
      parts.push(memory.favorite_products.slice(-10).join(', '));
    }

    // 6. Conversation summary (past conversations)
    if (memory.conversation_summary) {
      parts.push('\nRIASSUNTO PRECEDENTI:');
      parts.push(memory.conversation_summary);
    }

    // 7. Recent messages (current session) - only last few
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

  // ============================================================================
  // AVATAR MANAGEMENT METHODS
  // ============================================================================

  /**
   * Aggiorna l'avatar dell'azienda
   */
  async updateCompanyAvatar(
    customerId: number,
    avatar: Partial<CompanyAvatar>
  ): Promise<CustomerMemory | null> {
    const memory = await this.loadMemory(customerId);
    if (!memory) {
      console.error(`❌ Cannot update company avatar: memory not found for ${customerId}`);
      return null;
    }

    memory.company_avatar = {
      ...memory.company_avatar,
      ...avatar
    } as CompanyAvatar;

    await this.saveMemory(memory);
    console.log(`🧠 Company avatar updated for ${customerId}`);
    return memory;
  }

  /**
   * Aggiorna l'avatar del contatto
   */
  async updateContactAvatar(
    customerId: number,
    contactId: number,
    avatar: Partial<ContactAvatar>
  ): Promise<CustomerMemory | null> {
    const memory = await this.loadMemory(customerId);
    if (!memory) {
      console.error(`❌ Cannot update contact avatar: memory not found for ${customerId}`);
      return null;
    }

    // Initialize contacts map if needed
    if (!memory.contacts) {
      memory.contacts = {};
    }

    // Get existing contact or create new
    const existingContact = memory.contacts[contactId] || {
      odoo_partner_id: contactId,
      name: avatar.name || 'Unknown',
      communication_style: 'relazionale' as CommunicationStyle,
      personality_category: 'gregario' as PersonalityCategory,
      preferred_tone: 'informale' as const,
      uses_emoji: true,
      preferred_language: 'it' as const,
      message_length: 'medio' as const,
      decision_maker: false
    };

    // Merge with new data
    memory.contacts[contactId] = {
      ...existingContact,
      ...avatar
    } as ContactAvatar;

    // Also set as active contact and contact_avatar
    memory.active_contact_id = contactId;
    memory.contact_avatar = memory.contacts[contactId];

    await this.saveMemory(memory);
    console.log(`🧠 Contact avatar updated for contact ${contactId} of customer ${customerId}`);
    return memory;
  }

  /**
   * Imposta il contatto attivo per la sessione
   */
  async setActiveContact(customerId: number, contactId: number): Promise<boolean> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return false;

    if (memory.contacts?.[contactId]) {
      memory.active_contact_id = contactId;
      memory.contact_avatar = memory.contacts[contactId];
      await this.saveMemory(memory);
      console.log(`🧠 Active contact set to ${contactId} for customer ${customerId}`);
      return true;
    }

    console.warn(`⚠️ Contact ${contactId} not found in contacts for customer ${customerId}`);
    return false;
  }

  /**
   * Aggiunge una nota personale al contatto attivo
   */
  async addPersonalNote(customerId: number, note: string, contactId?: number): Promise<boolean> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return false;

    const targetContactId = contactId || memory.active_contact_id;
    if (!targetContactId || !memory.contacts?.[targetContactId]) {
      console.warn(`⚠️ No contact found to add note for customer ${customerId}`);
      return false;
    }

    const contact = memory.contacts[targetContactId];
    if (!contact.personal_notes) {
      contact.personal_notes = [];
    }

    // Avoid duplicates
    if (!contact.personal_notes.includes(note)) {
      contact.personal_notes.push(note);
      // Keep max 20 notes
      if (contact.personal_notes.length > 20) {
        contact.personal_notes.shift();
      }
    }

    // Update contact_avatar if this is the active contact
    if (memory.active_contact_id === targetContactId) {
      memory.contact_avatar = contact;
    }

    await this.saveMemory(memory);
    console.log(`🧠 Personal note added for contact ${targetContactId}`);
    return true;
  }

  /**
   * Aggiunge un follow-up da fare per il contatto attivo
   */
  async addFollowup(
    customerId: number,
    action: string,
    dueDate?: string,
    contactId?: number
  ): Promise<boolean> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return false;

    const targetContactId = contactId || memory.active_contact_id;
    if (!targetContactId || !memory.contacts?.[targetContactId]) {
      console.warn(`⚠️ No contact found to add followup for customer ${customerId}`);
      return false;
    }

    const contact = memory.contacts[targetContactId];
    if (!contact.followups) {
      contact.followups = [];
    }

    contact.followups.push({
      id: `fu_${Date.now()}`,
      action,
      created_at: new Date().toISOString(),
      due_date: dueDate,
      done: false
    });

    // Keep max 50 followups
    if (contact.followups.length > 50) {
      // Remove oldest completed followups first
      const completed = contact.followups.filter(f => f.done);
      if (completed.length > 0) {
        contact.followups = contact.followups.filter(f => !f.done || f !== completed[0]);
      } else {
        contact.followups.shift();
      }
    }

    // Update contact_avatar if this is the active contact
    if (memory.active_contact_id === targetContactId) {
      memory.contact_avatar = contact;
    }

    await this.saveMemory(memory);
    console.log(`🧠 Followup added for contact ${targetContactId}: ${action}`);
    return true;
  }

  /**
   * Segna un follow-up come completato
   */
  async markFollowupDone(
    customerId: number,
    followupIdOrAction: string,
    contactId?: number
  ): Promise<boolean> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return false;

    const targetContactId = contactId || memory.active_contact_id;
    if (!targetContactId || !memory.contacts?.[targetContactId]) {
      return false;
    }

    const contact = memory.contacts[targetContactId];
    if (!contact.followups) return false;

    // Find by ID or by action substring
    const followup = contact.followups.find(
      f => f.id === followupIdOrAction || f.action.toLowerCase().includes(followupIdOrAction.toLowerCase())
    );

    if (followup) {
      followup.done = true;
      followup.done_at = new Date().toISOString();

      // Update contact_avatar if this is the active contact
      if (memory.active_contact_id === targetContactId) {
        memory.contact_avatar = contact;
      }

      await this.saveMemory(memory);
      console.log(`🧠 Followup marked done: ${followup.action}`);
      return true;
    }

    return false;
  }

  /**
   * Ottiene l'avatar del contatto attivo (alias per compatibilità)
   */
  async getAvatar(customerId: number): Promise<ContactAvatar | null> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return null;
    return memory.contact_avatar || null;
  }

  /**
   * Aggiorna l'avatar (alias per compatibilità con vecchio AvatarService)
   */
  async updateAvatar(customerId: number, data: Partial<ContactAvatar>): Promise<CustomerMemory | null> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return null;

    const contactId = memory.active_contact_id || customerId;
    return this.updateContactAvatar(customerId, contactId, data);
  }

  /**
   * Ottiene i follow-up pendenti per un contatto
   */
  async getPendingFollowups(customerId: number, contactId?: number): Promise<FollowUp[]> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return [];

    const targetContactId = contactId || memory.active_contact_id;
    if (!targetContactId || !memory.contacts?.[targetContactId]) {
      return [];
    }

    const contact = memory.contacts[targetContactId];
    return (contact.followups || []).filter(f => !f.done);
  }

  /**
   * Verifica date speciali per oggi
   */
  async checkSpecialDates(customerId: number, contactId?: number): Promise<{
    isBirthday: boolean;
    todayEvents: string[];
  }> {
    const memory = await this.loadMemory(customerId);
    if (!memory) return { isBirthday: false, todayEvents: [] };

    const targetContactId = contactId || memory.active_contact_id;
    if (!targetContactId || !memory.contacts?.[targetContactId]) {
      return { isBirthday: false, todayEvents: [] };
    }

    const contact = memory.contacts[targetContactId];
    const today = new Date();
    const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const isBirthday = contact.birthday === todayMMDD;
    const todayEvents = (contact.important_dates || [])
      .filter(d => d.date === todayMMDD)
      .map(d => d.occasion);

    return { isBirthday, todayEvents };
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
