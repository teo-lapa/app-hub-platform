/**
 * LAPA AI Assistant - Orchestrator
 *
 * Gestisce il routing intelligente dei messaggi del chatbot agli agenti appropriati.
 * Supporta clienti B2B (loggati) e B2C/anonimi (visitatori).
 */

import Anthropic from '@anthropic-ai/sdk';
import { OrdersAgent } from './agents/orders-agent';
import { InvoicesAgent } from './agents/invoices-agent';
import { ProductsAgent } from './agents/products-agent';
import { ShippingAgent } from './agents/shipping-agent';
import { getOdooClient } from '@/lib/odoo-client';

// Interface minima per OdooClient - compatibile con entrambe le implementazioni
export interface OdooClientInterface {
  searchRead?: (model: string, domain: any[], fields: string[], limit?: number, offset?: number) => Promise<any[]>;
  call?: (model: string, method: string, args: any[]) => Promise<any>;
  [key: string]: any;
}

export interface OdooSession {
  uid: number;
  session_id: string;
  db: string;
  login: string;
  password?: string;
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CustomerContext {
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  sessionId: string;
  conversationHistory: Message[];
  odooSession?: OdooSession;
  metadata?: {
    language?: string;
    source?: string;
    deviceType?: string;
    timestamp?: Date;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  suggestedActions?: string[];
  requiresHumanEscalation?: boolean;
  agentId: string;
  confidence?: number;
}

export type IntentType =
  | 'order_inquiry'        // Domande su ordini
  | 'invoice_inquiry'      // Domande su fatture
  | 'shipping_inquiry'     // Domande su spedizioni
  | 'product_inquiry'      // Domande su prodotti/catalogo
  | 'account_management'   // Gestione account
  | 'helpdesk'            // Supporto generico
  | 'pricing_quote'       // Richiesta preventivi
  | 'complaint'           // Reclami
  | 'general_info'        // Informazioni generali
  | 'unknown';            // Intento non chiaro

export interface Intent {
  type: IntentType;
  confidence: number;
  entities?: Record<string, any>;
  requiresAuth?: boolean;
}

// ============================================================================
// AGENT REGISTRY
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  intents: IntentType[];
  requiresAuth: boolean;
  priority: number;
  handler: (context: CustomerContext, intent: Intent) => Promise<AgentResponse>;
}

// ============================================================================
// LAPA AI ORCHESTRATOR
// ============================================================================

export class LapaAiOrchestrator {
  private anthropic: Anthropic;
  private odooClient: OdooClientInterface;
  private agents: Map<string, AgentConfig>;
  private conversationStore: Map<string, CustomerContext>;

  // Agenti specializzati
  private ordersAgent: OrdersAgent;
  private invoicesAgent: InvoicesAgent;
  private productsAgent: ProductsAgent;
  private shippingAgent: ShippingAgent;

  constructor(odooClient: OdooClientInterface) {
    // Initialize Anthropic SDK
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY non configurato');
    }

    this.anthropic = new Anthropic({ apiKey });
    this.odooClient = odooClient;
    this.agents = new Map();
    this.conversationStore = new Map();

    // Inizializza agenti specializzati
    this.ordersAgent = new OrdersAgent();
    this.invoicesAgent = new InvoicesAgent();
    this.productsAgent = new ProductsAgent('it');
    this.shippingAgent = ShippingAgent.getInstance();

    // Register default agents
    this.registerDefaultAgents();
  }

  // ============================================================================
  // INTENT ANALYSIS
  // ============================================================================

  /**
   * Analizza il messaggio dell'utente per determinare l'intento usando Claude
   */
  async analyzeIntent(message: string, context: CustomerContext): Promise<Intent> {
    try {
      const systemPrompt = this.buildIntentAnalysisPrompt(context);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          ...this.buildConversationHistory(context),
          {
            role: 'user',
            content: message
          }
        ]
      });

      // Parse Claude's response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return this.parseIntentResponse(content.text);

    } catch (error) {
      console.error('❌ Errore analisi intento:', error);

      // Fallback: analisi basica basata su keywords
      return this.fallbackIntentAnalysis(message);
    }
  }

  /**
   * Costruisce il prompt di sistema per l'analisi dell'intento
   */
  private buildIntentAnalysisPrompt(context: CustomerContext): string {
    const customerInfo = context.customerType === 'b2b'
      ? `Cliente B2B autenticato: ${context.customerName} (${context.customerEmail})`
      : context.customerType === 'b2c'
      ? 'Cliente B2C visitatore del sito'
      : 'Visitatore anonimo';

    return `Sei l'assistente AI di LAPA, un'azienda svizzera che importa e distribuisce prodotti alimentari italiani di alta qualità.

CONTESTO CLIENTE:
${customerInfo}

COMPITO:
Analizza il messaggio del cliente e determina l'intento principale. Rispondi SOLO con un JSON valido nel seguente formato:

{
  "type": "order_inquiry" | "invoice_inquiry" | "shipping_inquiry" | "product_inquiry" | "account_management" | "helpdesk" | "pricing_quote" | "complaint" | "general_info" | "unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "order_id": "SO123" (se menzionato),
    "product_name": "nome prodotto" (se menzionato),
    "invoice_number": "INV/2024/001" (se menzionato),
    "tracking_number": "123456" (se menzionato)
  },
  "requiresAuth": true/false
}

DEFINIZIONI INTENTI:
- order_inquiry: Domande su ordini esistenti, stato ordini, modifiche
- invoice_inquiry: Domande su fatture, pagamenti, estratti conto
- shipping_inquiry: Domande su spedizioni, tracking, consegne
- product_inquiry: Domande su prodotti, catalogo, disponibilità
- account_management: Gestione account, dati personali, password
- helpdesk: Supporto tecnico, problemi generali
- pricing_quote: Richiesta preventivi, listini prezzi
- complaint: Reclami, problemi con ordini/prodotti
- general_info: Informazioni generali sull'azienda, orari, contatti
- unknown: Intento non chiaro

IMPORTANTE:
- Se il messaggio richiede accesso a dati personali/ordini, imposta requiresAuth a true
- Estrai tutte le entità rilevanti (ID ordine, nome prodotto, ecc.)
- Sii preciso nella confidence (0.0 = totalmente incerto, 1.0 = certissimo)`;
  }

  /**
   * Costruisce la cronologia della conversazione per Claude
   */
  private buildConversationHistory(context: CustomerContext): Anthropic.MessageParam[] {
    // Prendi gli ultimi 5 messaggi per contesto
    const recentMessages = context.conversationHistory.slice(-5);

    return recentMessages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  /**
   * Parse la risposta JSON di Claude
   */
  private parseIntentResponse(response: string): Intent {
    try {
      // Estrai JSON dalla risposta (potrebbe avere testo prima/dopo)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        type: parsed.type || 'unknown',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        requiresAuth: parsed.requiresAuth || false
      };
    } catch (error) {
      console.error('❌ Errore parsing risposta Claude:', error);
      return {
        type: 'unknown',
        confidence: 0.3,
        requiresAuth: false
      };
    }
  }

  /**
   * Analisi intento fallback basata su keywords
   */
  private fallbackIntentAnalysis(message: string): Intent {
    const lowerMessage = message.toLowerCase();

    // Order keywords
    if (lowerMessage.match(/ordine|order|ordinato|acquisto|so\d+/i)) {
      return {
        type: 'order_inquiry',
        confidence: 0.7,
        requiresAuth: true
      };
    }

    // Invoice keywords
    if (lowerMessage.match(/fattura|invoice|pagamento|saldo|inv\//i)) {
      return {
        type: 'invoice_inquiry',
        confidence: 0.7,
        requiresAuth: true
      };
    }

    // Shipping keywords
    if (lowerMessage.match(/spedizione|consegna|tracking|ddt|delivery/i)) {
      return {
        type: 'shipping_inquiry',
        confidence: 0.7,
        requiresAuth: false
      };
    }

    // Product keywords
    if (lowerMessage.match(/prodotto|catalogo|disponibil|prezzo|product|price/i)) {
      return {
        type: 'product_inquiry',
        confidence: 0.7,
        requiresAuth: false
      };
    }

    // Complaint keywords
    if (lowerMessage.match(/reclamo|problema|difetto|complaint|issue|wrong/i)) {
      return {
        type: 'complaint',
        confidence: 0.8,
        requiresAuth: false
      };
    }

    return {
      type: 'helpdesk',
      confidence: 0.5,
      requiresAuth: false
    };
  }

  // ============================================================================
  // AGENT ROUTING
  // ============================================================================

  /**
   * Seleziona l'agente appropriato per gestire l'intento
   */
  private selectAgent(intent: Intent, context: CustomerContext): AgentConfig | null {
    // Filter agents che possono gestire questo intento
    const capableAgents = Array.from(this.agents.values())
      .filter(agent => agent.intents.includes(intent.type))
      .filter(agent => {
        // Se l'agente richiede auth, verifica che il cliente sia autenticato
        if (agent.requiresAuth) {
          return context.customerType === 'b2b' && context.odooSession;
        }
        return true;
      })
      .sort((a, b) => b.priority - a.priority);

    return capableAgents[0] || null;
  }

  // ============================================================================
  // MESSAGE PROCESSING
  // ============================================================================

  /**
   * Processa un messaggio del cliente e ritorna la risposta appropriata
   */
  async processMessage(
    message: string,
    sessionId: string,
    customerContext?: Partial<CustomerContext>
  ): Promise<AgentResponse> {
    try {
      // Recupera o crea il contesto della conversazione
      let context = this.conversationStore.get(sessionId);

      if (!context) {
        context = this.createContext(sessionId, customerContext);
        this.conversationStore.set(sessionId, context);
      } else {
        // Aggiorna context con nuove info se fornite
        if (customerContext) {
          context = { ...context, ...customerContext };
        }
      }

      // Aggiungi il messaggio dell'utente alla cronologia
      this.addMessage(context, {
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // 1. Analizza l'intento
      const intent = await this.analyzeIntent(message, context);
      console.log('📊 Intento identificato:', intent);

      // 2. Verifica se richiede autenticazione
      if (intent.requiresAuth && context.customerType !== 'b2b') {
        return this.handleAuthRequired(context, intent);
      }

      // 3. Seleziona l'agente appropriato
      const agent = this.selectAgent(intent, context);

      if (!agent) {
        return this.handleNoAgentAvailable(context, intent);
      }

      console.log('🤖 Agente selezionato:', agent.name);

      // 4. Esegui l'agente
      const response = await agent.handler(context, intent);

      // 5. Aggiungi la risposta alla cronologia
      this.addMessage(context, {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        agentId: response.agentId
      });

      // 6. Aggiorna il context store
      this.conversationStore.set(sessionId, context);

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error('❌ Errore processamento messaggio:', {
        message: errorMessage,
        stack: errorStack,
        name: error instanceof Error ? error.name : 'Unknown'
      });

      return {
        success: false,
        message: `Errore: ${errorMessage}`,
        requiresHumanEscalation: true,
        agentId: 'error_handler',
        confidence: 0,
        data: {
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: errorMessage
        }
      };
    }
  }

  /**
   * Crea un nuovo contesto per la conversazione
   */
  private createContext(
    sessionId: string,
    customerContext?: Partial<CustomerContext>
  ): CustomerContext {
    return {
      sessionId,
      customerType: customerContext?.customerType || 'anonymous',
      customerId: customerContext?.customerId,
      customerName: customerContext?.customerName,
      customerEmail: customerContext?.customerEmail,
      odooSession: customerContext?.odooSession,
      conversationHistory: [],
      metadata: {
        timestamp: new Date(),
        ...customerContext?.metadata
      }
    };
  }

  /**
   * Aggiunge un messaggio alla cronologia
   */
  private addMessage(context: CustomerContext, message: Message): void {
    context.conversationHistory.push(message);

    // Mantieni solo gli ultimi 50 messaggi per non esaurire la memoria
    if (context.conversationHistory.length > 50) {
      context.conversationHistory = context.conversationHistory.slice(-50);
    }
  }

  /**
   * Gestisce il caso in cui è richiesta l'autenticazione
   */
  private handleAuthRequired(context: CustomerContext, intent: Intent): AgentResponse {
    return {
      success: false,
      message: 'Per accedere a queste informazioni è necessario effettuare il login. ' +
               'Se sei un cliente B2B, accedi al tuo account per visualizzare ordini, fatture e altre informazioni riservate.',
      suggestedActions: [
        'Effettua il login',
        'Registrati come cliente B2B',
        'Contatta il supporto per assistenza'
      ],
      requiresHumanEscalation: false,
      agentId: 'auth_guard',
      confidence: 1.0
    };
  }

  /**
   * Gestisce il caso in cui nessun agente può gestire la richiesta
   */
  private handleNoAgentAvailable(context: CustomerContext, intent: Intent): AgentResponse {
    return {
      success: false,
      message: 'Mi dispiace, al momento non posso gestire direttamente questa richiesta. ' +
               'Un nostro operatore ti contatterà al più presto per assisterti.',
      suggestedActions: [
        'Chiamaci al +41 91 123 4567',
        'Scrivi a info@lapa.ch',
        'Visita la sezione FAQ'
      ],
      requiresHumanEscalation: true,
      agentId: 'fallback',
      confidence: 0
    };
  }

  // ============================================================================
  // AGENT REGISTRATION
  // ============================================================================

  /**
   * Registra un agente nel sistema
   */
  registerAgent(config: AgentConfig): void {
    this.agents.set(config.id, config);
    console.log(`✅ Agente registrato: ${config.name} (${config.id})`);
  }

  /**
   * Registra gli agenti di default
   */
  private registerDefaultAgents(): void {
    // HELPDESK AGENT - Gestisce richieste generiche
    this.registerAgent({
      id: 'helpdesk',
      name: 'Helpdesk Agent',
      description: 'Gestisce supporto generico e informazioni generali',
      intents: ['helpdesk', 'general_info', 'unknown'],
      requiresAuth: false,
      priority: 1,
      handler: async (context, intent) => {
        return await this.helpdeskAgentHandler(context, intent);
      }
    });

    // PRODUCT AGENT - Gestisce domande sui prodotti
    this.registerAgent({
      id: 'product',
      name: 'Product Agent',
      description: 'Gestisce domande su prodotti e catalogo',
      intents: ['product_inquiry', 'pricing_quote'],
      requiresAuth: false,
      priority: 5,
      handler: async (context, intent) => {
        return await this.productAgentHandler(context, intent);
      }
    });

    // ORDER AGENT - Gestisce ordini (richiede auth)
    this.registerAgent({
      id: 'order',
      name: 'Order Agent',
      description: 'Gestisce domande su ordini',
      intents: ['order_inquiry'],
      requiresAuth: true,
      priority: 8,
      handler: async (context, intent) => {
        return await this.orderAgentHandler(context, intent);
      }
    });

    // INVOICE AGENT - Gestisce fatture (richiede auth)
    this.registerAgent({
      id: 'invoice',
      name: 'Invoice Agent',
      description: 'Gestisce domande su fatture e pagamenti',
      intents: ['invoice_inquiry'],
      requiresAuth: true,
      priority: 8,
      handler: async (context, intent) => {
        return await this.invoiceAgentHandler(context, intent);
      }
    });

    // SHIPPING AGENT - Gestisce spedizioni
    this.registerAgent({
      id: 'shipping',
      name: 'Shipping Agent',
      description: 'Gestisce domande su spedizioni e tracking',
      intents: ['shipping_inquiry'],
      requiresAuth: false,
      priority: 7,
      handler: async (context, intent) => {
        return await this.shippingAgentHandler(context, intent);
      }
    });

    // COMPLAINT AGENT - Gestisce reclami
    this.registerAgent({
      id: 'complaint',
      name: 'Complaint Agent',
      description: 'Gestisce reclami e problemi',
      intents: ['complaint'],
      requiresAuth: false,
      priority: 9,
      handler: async (context, intent) => {
        return await this.complaintAgentHandler(context, intent);
      }
    });
  }

  // ============================================================================
  // AGENT HANDLERS
  // ============================================================================

  /**
   * Handler per l'agente Helpdesk
   */
  private async helpdeskAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    try {
      // Usa Claude per generare una risposta contestuale
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.7,
        system: this.buildHelpdeskPrompt(context),
        messages: this.buildConversationHistory(context)
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return {
        success: true,
        message: content.text,
        agentId: 'helpdesk',
        confidence: 0.8,
        suggestedActions: [
          'Vuoi parlare con un operatore?',
          'Hai altre domande?'
        ]
      };
    } catch (error) {
      console.error('❌ Errore helpdesk agent:', error);

      return {
        success: false,
        message: 'Mi dispiace, si è verificato un errore. Contatta il supporto a info@lapa.ch',
        requiresHumanEscalation: true,
        agentId: 'helpdesk'
      };
    }
  }

  /**
   * Handler per l'agente Product
   */
  private async productAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    try {
      const entities = intent.entities || {};

      // Se c'è un nome prodotto o query, cerca prodotti
      if (entities.product_name) {
        const searchResult = await this.productsAgent.searchProducts(
          { query: entities.product_name, active_only: true },
          10
        );

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const productsList = searchResult.data
            .slice(0, 5)
            .map((product: any, index: number) => {
              const code = product.default_code ? `[${product.default_code}] ` : '';
              const category = product.categ_id ? ` - ${product.categ_id[1]}` : '';
              return `${index + 1}. ${code}${product.name}${category} - ${product.list_price.toFixed(2)} EUR`;
            })
            .join('\n');

          return {
            success: true,
            message: `Ho trovato ${searchResult.data.length} prodotti:\n\n${productsList}\n\n` +
                     'Vuoi verificare la disponibilità o vedere i dettagli di un prodotto?',
            data: searchResult.data,
            agentId: 'product',
            confidence: 0.9,
            suggestedActions: [
              'Verifica disponibilità',
              'Calcola prezzo per quantità',
              'Vedi prodotti simili'
            ]
          };
        }

        return {
          success: false,
          message: `Non ho trovato prodotti che corrispondono a "${entities.product_name}". ` +
                   'Prova a cercare con un altro termine o esplora il catalogo per categoria.',
          agentId: 'product',
          confidence: 0.7,
          suggestedActions: [
            'Visualizza catalogo completo',
            'Cerca per categoria',
            'Richiedi assistenza'
          ]
        };
      }

      // Risposta generica per richieste di informazioni sui prodotti
      return {
        success: true,
        message: 'Sono qui per aiutarti a trovare i prodotti che cerchi. ' +
                 'Posso fornirti informazioni su disponibilità, prezzi e caratteristiche. ' +
                 'Quale prodotto ti interessa?',
        agentId: 'product',
        confidence: 0.7,
        suggestedActions: [
          'Visualizza catalogo completo',
          'Cerca per categoria',
          'Richiedi un preventivo'
        ]
      };

    } catch (error) {
      console.error('❌ Errore productAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore cercando i prodotti. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'product'
      };
    }
  }

  /**
   * Handler per l'agente Order
   */
  private async orderAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    if (!context.odooSession || !context.customerId) {
      return {
        success: false,
        message: 'Sessione non valida. Effettua nuovamente il login.',
        requiresHumanEscalation: false,
        agentId: 'order'
      };
    }

    try {
      // Verifica il tipo di richiesta dall'intento
      const entities = intent.entities || {};

      // Usa Odoo direttamente per recuperare gli ordini
      const odoo = await getOdooClient();

      // Se c'è un order_id specifico, mostra i dettagli
      if (entities.order_id) {
        const orders = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', context.customerId],
            ['name', 'ilike', entities.order_id]
          ],
          [
            'name', 'partner_id', 'date_order', 'state',
            'amount_total', 'currency_id', 'order_line'
          ],
          1
        );

        if (orders.length > 0) {
          const order = orders[0];
          const stateLabels: Record<string, string> = {
            draft: 'Bozza', sent: 'Inviato', sale: 'Confermato',
            done: 'Completato', cancel: 'Annullato'
          };

          return {
            success: true,
            message: `Ordine ${order.name}:\n` +
                     `Cliente: ${order.partner_id[1]}\n` +
                     `Data: ${order.date_order}\n` +
                     `Stato: ${stateLabels[order.state] || order.state}\n` +
                     `Totale: ${order.currency_id[1]} ${order.amount_total.toFixed(2)}\n` +
                     `Prodotti: ${Array.isArray(order.order_line) ? order.order_line.length : 0}`,
            data: order,
            agentId: 'order',
            confidence: 0.9
          };
        }

        return {
          success: false,
          message: `Non ho trovato l'ordine ${entities.order_id} nel tuo storico.`,
          agentId: 'order',
          confidence: 0.7
        };
      }

      // Altrimenti mostra lo storico ordini recenti
      const orders = await odoo.searchRead(
        'sale.order',
        [['partner_id', '=', context.customerId]],
        ['name', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
        10
      );

      if (orders && orders.length > 0) {
        const stateLabels: Record<string, string> = {
          draft: 'Bozza', sent: 'Inviato', sale: 'Confermato',
          done: 'Completato', cancel: 'Annullato'
        };

        const ordersList = orders
          .map((order: any, index: number) =>
            `${index + 1}. ${order.name} - ${stateLabels[order.state] || order.state} - ${order.currency_id[1]} ${order.amount_total.toFixed(2)} (${order.date_order})`
          )
          .join('\n');

        return {
          success: true,
          message: `Ecco i tuoi ultimi ${orders.length} ordini:\n\n${ordersList}\n\n` +
                   'Vuoi vedere i dettagli di un ordine specifico?',
          data: orders,
          agentId: 'order',
          confidence: 0.9,
          suggestedActions: [
            'Dettagli ordine specifico',
            'Filtra per stato',
            'Crea nuovo ordine'
          ]
        };
      }

      return {
        success: true,
        message: 'Non ho trovato ordini recenti per il tuo account. Vuoi creare un nuovo ordine?',
        agentId: 'order',
        confidence: 0.8,
        suggestedActions: [
          'Crea nuovo ordine',
          'Cerca prodotti',
          'Contatta supporto'
        ]
      };

    } catch (error) {
      console.error('❌ Errore orderAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando le informazioni sugli ordini. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'order'
      };
    }
  }

  /**
   * Handler per l'agente Invoice
   */
  private async invoiceAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    if (!context.odooSession || !context.customerId) {
      return {
        success: false,
        message: 'Sessione non valida. Effettua nuovamente il login.',
        requiresHumanEscalation: false,
        agentId: 'invoice'
      };
    }

    try {
      const entities = intent.entities || {};

      // Se c'è un invoice_number specifico, mostra i dettagli
      if (entities.invoice_number) {
        const odoo = await getOdooClient();
        const invoices = await odoo.searchRead(
          'account.move',
          [
            ['partner_id', '=', context.customerId],
            ['move_type', '=', 'out_invoice'],
            ['name', 'ilike', entities.invoice_number]
          ],
          ['id'],
          1
        );

        if (invoices.length > 0) {
          const invoiceDetails = await this.invoicesAgent.getInvoiceDetails(invoices[0].id);

          if (invoiceDetails.success && invoiceDetails.data) {
            const inv = invoiceDetails.data;
            const paymentStateLabels: Record<string, string> = {
              not_paid: 'Non pagata', in_payment: 'In pagamento',
              paid: 'Pagata', partial: 'Parzialmente pagata',
              reversed: 'Stornata', invoicing_legacy: 'Legacy'
            };

            return {
              success: true,
              message: `Fattura ${inv.name}:\n` +
                       `Cliente: ${inv.partner_name}\n` +
                       `Data: ${inv.invoice_date || 'N/A'}\n` +
                       `Scadenza: ${inv.invoice_date_due || 'N/A'}\n` +
                       `Stato: ${paymentStateLabels[inv.payment_state] || inv.payment_state}\n` +
                       `Totale: ${inv.currency_id[1]} ${inv.amount_total.toFixed(2)}\n` +
                       `Residuo: ${inv.currency_id[1]} ${inv.amount_residual.toFixed(2)}\n` +
                       `Prodotti: ${inv.lines.length}`,
              data: inv,
              agentId: 'invoice',
              confidence: 0.9
            };
          }
        }

        return {
          success: false,
          message: `Non ho trovato la fattura ${entities.invoice_number} nel tuo storico.`,
          agentId: 'invoice',
          confidence: 0.7
        };
      }

      // Altrimenti mostra le fatture aperte o recenti
      const invoicesResult = await this.invoicesAgent.getInvoices(context.customerId, 'all', 10);

      if (invoicesResult.success && invoicesResult.data && invoicesResult.data.length > 0) {
        const paymentStateLabels: Record<string, string> = {
          not_paid: 'Non pagata', in_payment: 'In pagamento',
          paid: 'Pagata', partial: 'Parzialmente pagata',
          reversed: 'Stornata', invoicing_legacy: 'Legacy'
        };

        const invoicesList = invoicesResult.data
          .map((inv: any, index: number) =>
            `${index + 1}. ${inv.name} - ${paymentStateLabels[inv.payment_state] || inv.payment_state} - ${inv.currency_id[1]} ${inv.amount_total.toFixed(2)}`
          )
          .join('\n');

        // Calcola il saldo aperto
        const balanceResult = await this.invoicesAgent.getOpenBalance(context.customerId);
        const balanceInfo = balanceResult.success && balanceResult.data
          ? `\n\nSaldo aperto totale: ${balanceResult.data.currency} ${balanceResult.data.total_due.toFixed(2)}`
          : '';

        return {
          success: true,
          message: `Ecco le tue ultime ${invoicesResult.data.length} fatture:\n\n${invoicesList}${balanceInfo}\n\n` +
                   'Vuoi vedere i dettagli di una fattura specifica?',
          data: {
            invoices: invoicesResult.data,
            balance: balanceResult.data
          },
          agentId: 'invoice',
          confidence: 0.9,
          suggestedActions: [
            'Dettagli fattura specifica',
            'Fatture non pagate',
            'Scarica fattura'
          ]
        };
      }

      return {
        success: true,
        message: 'Non ho trovato fatture nel tuo account.',
        agentId: 'invoice',
        confidence: 0.8,
        suggestedActions: [
          'Verifica storico ordini',
          'Contatta amministrazione'
        ]
      };

    } catch (error) {
      console.error('❌ Errore invoiceAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando le informazioni sulle fatture. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'invoice'
      };
    }
  }

  /**
   * Handler per l'agente Shipping
   */
  private async shippingAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    try {
      const entities = intent.entities || {};

      // Se c'è un tracking_number o order_id, traccia la spedizione
      if (entities.tracking_number || entities.order_id) {
        const trackingId = entities.tracking_number || entities.order_id;

        const trackingResult = await this.shippingAgent.trackShipment(trackingId);

        if (trackingResult.success && trackingResult.data) {
          const shipment = trackingResult.data;

          return {
            success: true,
            message: `Spedizione ${shipment.name}:\n` +
                     `Cliente: ${shipment.customer_name}\n` +
                     `Stato: ${shipment.state_label}\n` +
                     `Data prevista: ${shipment.scheduled_date || 'N/A'}\n` +
                     `Data consegna: ${shipment.date_done || 'In corso'}\n` +
                     `Autista: ${shipment.driver_name || 'Non assegnato'}\n` +
                     `Prodotti: ${shipment.products_count}`,
            data: shipment,
            agentId: 'shipping',
            confidence: 0.9,
            suggestedActions: [
              'Dettagli autista',
              'Calcola ETA',
              'Storico consegne'
            ]
          };
        }

        return {
          success: false,
          message: `Non ho trovato la spedizione con ID ${trackingId}.`,
          agentId: 'shipping',
          confidence: 0.7
        };
      }

      // Se c'è un customerId, mostra lo storico consegne
      if (context.customerId) {
        const historyResult = await this.shippingAgent.getDeliveryHistory(context.customerId, 10);

        if (historyResult.success && historyResult.data) {
          const history = historyResult.data;

          const deliveriesList = history.deliveries
            .slice(0, 5)
            .map((delivery: any, index: number) =>
              `${index + 1}. ${delivery.name} - ${delivery.state} - ${delivery.date}`
            )
            .join('\n');

          return {
            success: true,
            message: `Storico consegne:\n\n${deliveriesList}\n\n` +
                     `Totale consegne: ${history.total_deliveries}\n` +
                     `Puntualità: ${history.on_time_percentage}%\n` +
                     `Ultima consegna: ${history.last_delivery_date || 'N/A'}`,
            data: history,
            agentId: 'shipping',
            confidence: 0.9,
            suggestedActions: [
              'Traccia spedizione',
              'Tempi di consegna',
              'Zone di consegna'
            ]
          };
        }
      }

      // Risposta generica
      return {
        success: true,
        message: 'Posso aiutarti con informazioni sulle spedizioni. ' +
                 'Hai un numero di tracking o un numero d\'ordine da tracciare?',
        agentId: 'shipping',
        confidence: 0.7,
        suggestedActions: [
          'Traccia spedizione',
          'Tempi di consegna',
          'Zone di consegna'
        ]
      };

    } catch (error) {
      console.error('❌ Errore shippingAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando le informazioni sulle spedizioni. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'shipping'
      };
    }
  }

  /**
   * Handler per l'agente Complaint
   */
  private async complaintAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    // I reclami richiedono sempre escalation a umano
    return {
      success: true,
      message: 'Mi dispiace per il problema riscontrato. ' +
               'La tua segnalazione è importante per noi. ' +
               'Un nostro responsabile del servizio clienti ti contatterà al più presto per risolvere la situazione.',
      requiresHumanEscalation: true,
      agentId: 'complaint',
      confidence: 1.0,
      suggestedActions: [
        'Lascia i tuoi contatti',
        'Allega foto del problema',
        'Chiamaci subito al +41 91 123 4567'
      ]
    };
  }

  /**
   * Costruisce il prompt di sistema per l'agente helpdesk
   */
  private buildHelpdeskPrompt(context: CustomerContext): string {
    return `Sei l'assistente AI di LAPA, un'azienda svizzera che importa e distribuisce prodotti alimentari italiani di alta qualità.

INFORMAZIONI AZIENDA:
- Nome: LAPA - finest italian food GmbH
- Settore: Importazione e distribuzione prodotti alimentari italiani
- Mercato: Svizzera (principalmente Canton Ticino)
- Clienti: B2B (ristoranti, hotel, negozi) e B2C (consumatori finali)

CONTATTO:
- Email: info@lapa.ch
- Telefono: +41 91 XXX XXXX
- Sito: https://www.lapa.ch

TUO RUOLO:
- Fornisci informazioni utili e accurate sui prodotti e servizi LAPA
- Sii cortese, professionale e disponibile
- Se non sai la risposta, ammettilo e suggerisci di contattare il supporto
- Non inventare informazioni sui prodotti o prezzi
- Rispondi nella lingua del cliente (italiano, tedesco, francese, inglese)

TIPO CLIENTE: ${context.customerType === 'b2b' ? 'Cliente B2B autenticato' : 'Visitatore del sito'}

Rispondi in modo naturale e conversazionale.`;
  }

  // ============================================================================
  // CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * Recupera il contesto di una sessione
   */
  getContext(sessionId: string): CustomerContext | undefined {
    return this.conversationStore.get(sessionId);
  }

  /**
   * Aggiorna il contesto di una sessione
   */
  updateContext(sessionId: string, updates: Partial<CustomerContext>): void {
    const context = this.conversationStore.get(sessionId);
    if (context) {
      this.conversationStore.set(sessionId, { ...context, ...updates });
    }
  }

  /**
   * Elimina il contesto di una sessione (logout, timeout)
   */
  clearContext(sessionId: string): void {
    this.conversationStore.delete(sessionId);
  }

  /**
   * Pulisce i contesti vecchi (da eseguire periodicamente)
   */
  cleanupOldContexts(maxAgeMinutes: number = 60): void {
    const now = new Date();
    const maxAge = maxAgeMinutes * 60 * 1000;

    const entries = Array.from(this.conversationStore.entries());
    for (const [sessionId, context] of entries) {
      const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
      if (lastMessage) {
        const messageAge = now.getTime() - lastMessage.timestamp.getTime();
        if (messageAge > maxAge) {
          this.conversationStore.delete(sessionId);
          console.log(`🧹 Contesto pulito per sessione: ${sessionId}`);
        }
      }
    }
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

let orchestratorInstance: LapaAiOrchestrator | null = null;

/**
 * Crea o ritorna l'istanza singleton dell'orchestratore
 */
export function getOrchestrator(odooClient: OdooClientInterface): LapaAiOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new LapaAiOrchestrator(odooClient);
    console.log('✅ LAPA AI Orchestrator inizializzato');
  }
  return orchestratorInstance;
}

/**
 * Crea una nuova istanza dell'orchestratore (per testing)
 */
export function createOrchestrator(odooClient: OdooClientInterface): LapaAiOrchestrator {
  return new LapaAiOrchestrator(odooClient);
}
