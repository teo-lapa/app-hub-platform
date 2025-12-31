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
import { HelpdeskAgent, createHelpdeskAgent } from './agents/helpdesk-agent';
import { getOdooClient } from '@/lib/odoo-client';

// URL base per il sito e-commerce
const LAPA_SHOP_URL = process.env.LAPA_SHOP_URL || 'https://lapa.ch';

/**
 * Genera un URL per un prodotto sul sito web
 * Formato Odoo standard: /shop/product-slug-TEMPLATE_ID
 * IMPORTANTE: Odoo usa product_tmpl_id per gli URL, non product.product.id
 */
function generateProductUrl(templateId: number, productName: string): string {
  // Crea uno slug dal nome prodotto (Odoo style)
  const slug = productName
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  return `${LAPA_SHOP_URL}/shop/${slug}-${templateId}`;
}

/**
 * Genera un URL per un ordine/preventivo
 */
function generateOrderUrl(orderId: number, orderName: string): string {
  return `${LAPA_SHOP_URL}/my/orders/${orderId}`;
}

/**
 * Genera un URL per una fattura
 */
function generateInvoiceUrl(invoiceId: number): string {
  return `${LAPA_SHOP_URL}/my/invoices/${invoiceId}`;
}

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
    attachments?: Array<{
      name: string;
      content: string; // base64
      mimetype: string;
    }>;
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
  | 'order_create'         // Creare un nuovo ordine
  | 'order_inquiry'        // Domande su ordini
  | 'order_detail'         // Dettagli di un ordine specifico
  | 'invoice_inquiry'      // Domande su fatture
  | 'invoice_detail'       // Dettagli di una fattura specifica
  | 'invoice_filter'       // Filtrare fatture (da pagare, pagate, etc.)
  | 'shipping_inquiry'     // Domande su spedizioni
  | 'product_inquiry'      // Domande su prodotti/catalogo
  | 'account_management'   // Gestione account
  | 'helpdesk'            // Supporto generico
  | 'pricing_quote'       // Richiesta preventivi
  | 'complaint'           // Reclami
  | 'general_info'        // Informazioni generali
  | 'followup'            // Domanda di follow-up contestuale
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
        model: 'claude-sonnet-4-20250514',
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
      : context.customerType === 'b2c' && context.customerId
      ? `Cliente B2C autenticato: ${context.customerName} (${context.customerEmail})`
      : context.customerType === 'b2c'
      ? 'Cliente B2C visitatore del sito'
      : 'Visitatore anonimo';

    return `Sei l'assistente AI di LAPA, un'azienda svizzera che importa e distribuisce prodotti alimentari italiani di alta qualità.

CONTESTO CLIENTE:
${customerInfo}

COMPITO:
Analizza il messaggio del cliente e determina l'intento principale. Rispondi SOLO con un JSON valido nel seguente formato:

{
  "type": "order_create" | "order_inquiry" | "invoice_inquiry" | "shipping_inquiry" | "product_inquiry" | "account_management" | "helpdesk" | "pricing_quote" | "complaint" | "general_info" | "unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "order_id": "SO123" (se menzionato),
    "product_name": "nome prodotto" (se menzionato),
    "invoice_number": "INV/2024/001" (se menzionato),
    "tracking_number": "123456" (se menzionato)
  },
  "requiresAuth": true/false
}

DEFINIZIONI INTENTI (con parole chiave tipiche):
- order_create: Richiesta di CREARE un nuovo ordine, fare un ordine, ordinare prodotti (Keywords: creare ordine, fare ordine, voglio ordinare, vorrei ordinare, mi puoi creare, crea ordine, nuovo ordine, ordinare, order erstellen, passer commande, place order, bestellen)
- order_inquiry: Domande su ordini esistenti, stato ordini, modifiche, prodotti acquistati, storico acquisti (Keywords: ordine, ordini, ordinato, acquisto, acquistato, comprato, storico, ultimi prodotti, cosa ho comprato, quando ho comprato, SO, order, Bestellung, commande, purchased, gekauft, acheté)
- order_detail: Richiesta DETTAGLI di un ordine specifico (Keywords: dettagli ordine, mostrami l'ordine, più info su ordine)
- invoice_inquiry: Domande su fatture, pagamenti, estratti conto, saldo (Keywords: fattura, fatture, pagamento, saldo, INV, invoice, Rechnung, facture)
- invoice_detail: Richiesta DETTAGLI di una fattura specifica (Keywords: dettagli fattura, mostrami la fattura)
- invoice_filter: Richiesta di FILTRARE le fatture (Keywords: da pagare, non pagate, aperte, pagate, scadute)
- shipping_inquiry: Domande su spedizioni, tracking, consegne, dove si trova la merce (Keywords: spedizione, spedizioni, consegna, tracking, traccia, tracciare, DDT, dove, arriva, delivery, Lieferung, livraison)
- product_inquiry: Domande su prodotti, catalogo, disponibilità, prezzi prodotti (Keywords: prodotto, prodotti, catalogo, disponibile, mozzarella, parmigiano, prosciutto, formaggio)
- account_management: Gestione account, dati personali, password (Keywords: account, password, profilo, dati personali)
- helpdesk: Supporto tecnico, problemi generali, assistenza (Keywords: aiuto, help, problema, supporto, operatore, assistenza)
- pricing_quote: Richiesta preventivi, listini prezzi B2B (Keywords: preventivo, listino, prezzi all'ingrosso)
- complaint: Reclami, problemi con ordini/prodotti ricevuti (Keywords: reclamo, problema, danneggiato, sbagliato)
- general_info: Informazioni generali sull'azienda, orari, contatti (Keywords: orari, dove siete, contatti, chi siete)
- followup: Domanda di follow-up riferita alla risposta precedente (Keywords: quelle, questi, l'ultimo, il primo, più dettagli, dimmi di più)
- unknown: Intento non chiaro

ATTENZIONE CONTESTO CONVERSAZIONALE:
- Se l'utente fa riferimento a elementi discussi prima (es. "quelle da pagare", "l'ultimo ordine", "più dettagli"), guarda la conversazione precedente
- "Quelle da pagare" dopo aver mostrato fatture = invoice_filter con filter: "unpaid"
- "Dettagli dell'ultimo" dopo aver mostrato ordini = order_detail con position: "last"
- "Dimmi di più" = followup che richiede dettagli sull'ultimo argomento discusso

Nella risposta JSON, aggiungi questi campi entities se rilevanti:
- filter: "unpaid" | "paid" | "overdue" per filtrare fatture
- position: "last" | "first" | numero specifico per riferimenti a liste
- reference_type: "order" | "invoice" | "product" se il riferimento è implicito dal contesto

ATTENZIONE: La parola "traccia" o "tracciare" indica SEMPRE shipping_inquiry, NON invoice_inquiry!

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
    // Un utente è autenticato se ha customerType='b2b' O 'b2c' E un customerId valido
    const isAuthenticated = (context.customerType === 'b2b' || context.customerType === 'b2c') && context.customerId;

    // Filter agents che possono gestire questo intento
    const capableAgents = Array.from(this.agents.values())
      .filter(agent => agent.intents.includes(intent.type))
      .filter(agent => {
        // Se l'agente richiede auth, verifica che il cliente sia veramente autenticato
        if (agent.requiresAuth) {
          return isAuthenticated;
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
      console.log('📥 processMessage received:', {
        message: message.substring(0, 50),
        sessionId,
        customerContext: JSON.stringify(customerContext)
      });

      // Recupera o crea il contesto della conversazione
      let context = this.conversationStore.get(sessionId);

      if (!context) {
        context = this.createContext(sessionId, customerContext);
        this.conversationStore.set(sessionId, context);
        console.log('📝 New context created:', { customerId: context.customerId, customerType: context.customerType, historyLength: context.conversationHistory.length });
      } else {
        // Aggiorna context con nuove info se fornite
        // IMPORTANTE: se customerContext ha conversationHistory (da KV), usa quella perché è la più completa
        if (customerContext) {
          const inMemoryHistoryLength = context.conversationHistory.length;
          const kvHistoryLength = customerContext.conversationHistory?.length || 0;

          // Usa la cronologia più lunga (KV dovrebbe essere sempre aggiornato)
          if (kvHistoryLength >= inMemoryHistoryLength) {
            context = { ...context, ...customerContext };
            console.log(`📝 Context updated: usando cronologia da KV (${kvHistoryLength} messaggi) invece di in-memory (${inMemoryHistoryLength})`);
          } else {
            // Mantieni in-memory history ma aggiorna altri campi
            const { conversationHistory, ...otherContext } = customerContext;
            context = { ...context, ...otherContext };
            console.log(`📝 Context updated: mantenendo cronologia in-memory (${inMemoryHistoryLength} messaggi), KV aveva solo ${kvHistoryLength}`);
          }
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
      // Un utente è considerato "loggato" se ha customerType='b2b' O 'b2c' E un customerId valido
      const isAuthenticated = (context.customerType === 'b2b' || context.customerType === 'b2c') && context.customerId;

      if (intent.requiresAuth && !isAuthenticated) {
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
    // Usa la cronologia conversazione passata (da KV) se disponibile, altrimenti array vuoto
    const history = customerContext?.conversationHistory || [];
    console.log(`📝 createContext: usando ${history.length} messaggi da conversationHistory`);

    return {
      sessionId,
      customerType: customerContext?.customerType || 'anonymous',
      customerId: customerContext?.customerId,
      customerName: customerContext?.customerName,
      customerEmail: customerContext?.customerEmail,
      odooSession: customerContext?.odooSession,
      conversationHistory: history,
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
   * Collects all attachments from context metadata and conversation history
   * Returns a combined array of all attachments ready to be attached to a ticket
   */
  private collectAttachments(context: CustomerContext): Array<{
    name: string;
    content: string;
    mimetype: string;
  }> {
    const attachments: Array<{ name: string; content: string; mimetype: string }> = [];

    // Add attachments from context metadata
    if (context.metadata?.attachments) {
      attachments.push(...context.metadata.attachments);
    }

    // Also collect attachments from conversation history messages
    for (const message of context.conversationHistory) {
      if (message.metadata?.attachments && Array.isArray(message.metadata.attachments)) {
        for (const att of message.metadata.attachments) {
          // Ensure attachment has required fields
          if (att.name && att.content && att.mimetype) {
            attachments.push({
              name: att.name,
              content: att.content,
              mimetype: att.mimetype
            });
          }
        }
      }
    }

    console.log(`📎 Collected ${attachments.length} attachments for ticket`);
    return attachments;
  }

  /**
   * Gestisce il caso in cui è richiesta l'autenticazione
   * Comportamento da "venditore": accogliente, proattivo, orientato alla conversione
   * Supporta IT, DE, FR, EN
   */
  private handleAuthRequired(context: CustomerContext, intent: Intent): AgentResponse {
    const lang = context.metadata?.language || 'it';

    // Messaggi multilingua per ogni tipo di richiesta
    const authMessages: Record<string, Record<string, { message: string; actions: string[] }>> = {
      order_inquiry: {
        it: {
          message: '📦 Per visualizzare i tuoi ordini devo sapere chi sei!\n\n' +
                   'Sei già cliente LAPA? Accedi al tuo account per vedere lo storico ordini, ' +
                   'lo stato delle consegne e molto altro.\n\n' +
                   'Se invece sei nuovo, benvenuto! Posso aiutarti a scoprire i nostri prodotti italiani di alta qualità. ' +
                   'Cosa stai cercando?',
          actions: ['Accedi al tuo account', 'Scopri i nostri prodotti', 'Diventa cliente B2B']
        },
        de: {
          message: '📦 Um Ihre Bestellungen anzuzeigen, muss ich wissen, wer Sie sind!\n\n' +
                   'Sind Sie bereits LAPA-Kunde? Melden Sie sich an, um Bestellhistorie, ' +
                   'Lieferstatus und vieles mehr zu sehen.\n\n' +
                   'Sind Sie neu? Willkommen! Ich kann Ihnen unsere hochwertigen italienischen Produkte zeigen. ' +
                   'Was suchen Sie?',
          actions: ['Anmelden', 'Produkte entdecken', 'B2B-Kunde werden']
        },
        fr: {
          message: '📦 Pour voir vos commandes, je dois savoir qui vous êtes!\n\n' +
                   'Êtes-vous déjà client LAPA? Connectez-vous pour voir l\'historique des commandes, ' +
                   'le statut des livraisons et bien plus.\n\n' +
                   'Vous êtes nouveau? Bienvenue! Je peux vous aider à découvrir nos produits italiens de qualité. ' +
                   'Que cherchez-vous?',
          actions: ['Se connecter', 'Découvrir les produits', 'Devenir client B2B']
        },
        en: {
          message: '📦 To view your orders, I need to know who you are!\n\n' +
                   'Already a LAPA customer? Log in to see order history, ' +
                   'delivery status and much more.\n\n' +
                   'New here? Welcome! I can help you discover our high-quality Italian products. ' +
                   'What are you looking for?',
          actions: ['Log in', 'Discover products', 'Become B2B customer']
        }
      },
      invoice_inquiry: {
        it: {
          message: '📄 Le fatture sono riservate ai clienti registrati.\n\n' +
                   'Se sei già cliente LAPA, accedi al tuo account per visualizzare fatture, ' +
                   'scadenze e pagare online.\n\n' +
                   'Non sei ancora cliente? Scopri i vantaggi di diventare un cliente B2B LAPA!',
          actions: ['Accedi al tuo account', 'Vantaggi clienti B2B', 'Contattaci']
        },
        de: {
          message: '📄 Rechnungen sind registrierten Kunden vorbehalten.\n\n' +
                   'Sind Sie bereits LAPA-Kunde? Melden Sie sich an, um Rechnungen, ' +
                   'Fälligkeiten und Online-Zahlung zu sehen.\n\n' +
                   'Noch kein Kunde? Entdecken Sie die Vorteile eines LAPA B2B-Kunden!',
          actions: ['Anmelden', 'B2B-Vorteile', 'Kontakt']
        },
        fr: {
          message: '📄 Les factures sont réservées aux clients enregistrés.\n\n' +
                   'Êtes-vous déjà client LAPA? Connectez-vous pour voir les factures, ' +
                   'les échéances et payer en ligne.\n\n' +
                   'Pas encore client? Découvrez les avantages de devenir client B2B LAPA!',
          actions: ['Se connecter', 'Avantages B2B', 'Contact']
        },
        en: {
          message: '📄 Invoices are reserved for registered customers.\n\n' +
                   'Already a LAPA customer? Log in to view invoices, ' +
                   'due dates and pay online.\n\n' +
                   'Not a customer yet? Discover the benefits of becoming a LAPA B2B customer!',
          actions: ['Log in', 'B2B benefits', 'Contact us']
        }
      },
      shipping_inquiry: {
        it: {
          message: '🚚 Per tracciare le tue spedizioni ho bisogno di identificarti!\n\n' +
                   'Se sei già cliente LAPA, accedi al tuo account per vedere lo stato delle consegne ' +
                   'e l\'orario di arrivo stimato.\n\n' +
                   'Hai un numero d\'ordine? Dimmi di più e vedo come posso aiutarti!',
          actions: ['Accedi al tuo account', 'Ho un numero ordine', 'Scopri i nostri prodotti']
        },
        de: {
          message: '🚚 Um Ihre Sendungen zu verfolgen, muss ich Sie identifizieren!\n\n' +
                   'Sind Sie bereits LAPA-Kunde? Melden Sie sich an, um den Lieferstatus ' +
                   'und die voraussichtliche Ankunftszeit zu sehen.\n\n' +
                   'Haben Sie eine Bestellnummer? Sagen Sie mir mehr und ich helfe Ihnen!',
          actions: ['Anmelden', 'Ich habe eine Bestellnummer', 'Produkte entdecken']
        },
        fr: {
          message: '🚚 Pour suivre vos expéditions, je dois vous identifier!\n\n' +
                   'Êtes-vous déjà client LAPA? Connectez-vous pour voir le statut de livraison ' +
                   'et l\'heure d\'arrivée estimée.\n\n' +
                   'Avez-vous un numéro de commande? Dites-moi plus et je vous aide!',
          actions: ['Se connecter', 'J\'ai un numéro de commande', 'Découvrir les produits']
        },
        en: {
          message: '🚚 To track your shipments, I need to identify you!\n\n' +
                   'Already a LAPA customer? Log in to see delivery status ' +
                   'and estimated arrival time.\n\n' +
                   'Have an order number? Tell me more and I\'ll help you!',
          actions: ['Log in', 'I have an order number', 'Discover products']
        }
      },
      default: {
        it: {
          message: '👋 Ciao! Per accedere a queste informazioni riservate devi effettuare il login.\n\n' +
                   'Sei già cliente LAPA? Accedi al tuo account.\n' +
                   'Sei nuovo? Fantastico! Posso aiutarti a scoprire i nostri prodotti italiani di qualità.\n\n' +
                   'Come posso esserti utile?',
          actions: ['Accedi al tuo account', 'Scopri i prodotti', 'Diventa cliente', 'Parla con un operatore']
        },
        de: {
          message: '👋 Hallo! Um auf diese reservierten Informationen zuzugreifen, müssen Sie sich anmelden.\n\n' +
                   'Sind Sie bereits LAPA-Kunde? Melden Sie sich an.\n' +
                   'Sind Sie neu? Fantastisch! Ich kann Ihnen unsere hochwertigen italienischen Produkte zeigen.\n\n' +
                   'Wie kann ich Ihnen helfen?',
          actions: ['Anmelden', 'Produkte entdecken', 'Kunde werden', 'Mit Mitarbeiter sprechen']
        },
        fr: {
          message: '👋 Bonjour! Pour accéder à ces informations réservées, vous devez vous connecter.\n\n' +
                   'Êtes-vous déjà client LAPA? Connectez-vous.\n' +
                   'Vous êtes nouveau? Fantastique! Je peux vous aider à découvrir nos produits italiens de qualité.\n\n' +
                   'Comment puis-je vous aider?',
          actions: ['Se connecter', 'Découvrir les produits', 'Devenir client', 'Parler à un opérateur']
        },
        en: {
          message: '👋 Hi! To access this reserved information, you need to log in.\n\n' +
                   'Already a LAPA customer? Log in to your account.\n' +
                   'New here? Fantastic! I can help you discover our quality Italian products.\n\n' +
                   'How can I help you?',
          actions: ['Log in', 'Discover products', 'Become a customer', 'Talk to an operator']
        }
      }
    };

    // Seleziona il messaggio corretto
    const intentType = intent.type in authMessages ? intent.type : 'default';
    const langMessages = authMessages[intentType];
    const content = langMessages[lang] || langMessages['it'];

    return {
      success: true, // Non è un errore, è una risposta valida!
      message: content.message,
      suggestedActions: content.actions,
      requiresHumanEscalation: false,
      agentId: 'sales_assistant',
      confidence: 1.0
    };
  }

  /**
   * Gestisce il caso in cui nessun agente può gestire la richiesta
   * Comportamento da venditore: proattivo, orienta verso prodotti e servizi
   */
  private handleNoAgentAvailable(context: CustomerContext, intent: Intent): AgentResponse {
    const lang = context.metadata?.language || 'it';

    const messages: Record<string, { message: string; actions: string[] }> = {
      it: {
        message: '🤔 Non ho capito esattamente cosa ti serve, ma sono qui per aiutarti!\n\n' +
                 'LAPA è il tuo partner per i migliori prodotti alimentari italiani in Svizzera.\n\n' +
                 'Posso aiutarti con:\n' +
                 '🧀 **Prodotti** - Formaggi, salumi, pasta e molto altro\n' +
                 '📦 **Ordini** - Effettua un ordine o verifica lo stato\n' +
                 '🚚 **Consegne** - Informazioni su spedizioni e tempi\n' +
                 '💼 **Diventa cliente B2B** - Vantaggi esclusivi per aziende\n\n' +
                 'Come posso esserti utile?',
        actions: ['Scopri i prodotti', 'Diventa cliente B2B', 'Parla con un operatore', 'Contattaci']
      },
      de: {
        message: '🤔 Ich habe nicht genau verstanden, was Sie brauchen, aber ich bin hier, um zu helfen!\n\n' +
                 'LAPA ist Ihr Partner für die besten italienischen Lebensmittel in der Schweiz.\n\n' +
                 'Ich kann Ihnen helfen mit:\n' +
                 '🧀 **Produkte** - Käse, Wurst, Pasta und vieles mehr\n' +
                 '📦 **Bestellungen** - Bestellen oder Status prüfen\n' +
                 '🚚 **Lieferungen** - Informationen zu Versand und Zeiten\n' +
                 '💼 **B2B-Kunde werden** - Exklusive Vorteile für Unternehmen\n\n' +
                 'Wie kann ich Ihnen helfen?',
        actions: ['Produkte entdecken', 'B2B-Kunde werden', 'Mit Mitarbeiter sprechen', 'Kontakt']
      },
      fr: {
        message: '🤔 Je n\'ai pas bien compris votre demande, mais je suis là pour vous aider!\n\n' +
                 'LAPA est votre partenaire pour les meilleurs produits alimentaires italiens en Suisse.\n\n' +
                 'Je peux vous aider avec:\n' +
                 '🧀 **Produits** - Fromages, charcuterie, pâtes et bien plus\n' +
                 '📦 **Commandes** - Passer une commande ou vérifier le statut\n' +
                 '🚚 **Livraisons** - Informations sur les expéditions et délais\n' +
                 '💼 **Devenir client B2B** - Avantages exclusifs pour entreprises\n\n' +
                 'Comment puis-je vous aider?',
        actions: ['Découvrir les produits', 'Devenir client B2B', 'Parler à un opérateur', 'Contact']
      },
      en: {
        message: '🤔 I didn\'t quite understand what you need, but I\'m here to help!\n\n' +
                 'LAPA is your partner for the finest Italian food products in Switzerland.\n\n' +
                 'I can help you with:\n' +
                 '🧀 **Products** - Cheese, cured meats, pasta and much more\n' +
                 '📦 **Orders** - Place an order or check status\n' +
                 '🚚 **Deliveries** - Shipping and delivery info\n' +
                 '💼 **Become a B2B customer** - Exclusive benefits for businesses\n\n' +
                 'How can I help you?',
        actions: ['Discover products', 'Become B2B customer', 'Talk to an operator', 'Contact us']
      }
    };

    const content = messages[lang] || messages['it'];

    return {
      success: true, // Non è un errore, è un'opportunità di vendita!
      message: content.message,
      suggestedActions: content.actions,
      requiresHumanEscalation: false,
      agentId: 'sales_assistant',
      confidence: 0.8
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

    // ORDER CREATE AGENT - Crea nuovi ordini (richiede auth)
    this.registerAgent({
      id: 'order_create',
      name: 'Order Create Agent',
      description: 'Crea nuovi ordini per clienti',
      intents: ['order_create'],
      requiresAuth: true,
      priority: 9,
      handler: async (context, intent) => {
        return await this.orderCreateAgentHandler(context, intent);
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

    // ORDER DETAIL AGENT - Dettagli ordine specifico
    this.registerAgent({
      id: 'order_detail',
      name: 'Order Detail Agent',
      description: 'Mostra dettagli di un ordine specifico (dall\'ultimo menzionato o posizione)',
      intents: ['order_detail'],
      requiresAuth: true,
      priority: 9,
      handler: async (context, intent) => {
        return await this.orderDetailAgentHandler(context, intent);
      }
    });

    // INVOICE FILTER AGENT - Filtra fatture
    this.registerAgent({
      id: 'invoice_filter',
      name: 'Invoice Filter Agent',
      description: 'Filtra fatture per stato pagamento',
      intents: ['invoice_filter'],
      requiresAuth: true,
      priority: 9,
      handler: async (context, intent) => {
        return await this.invoiceFilterAgentHandler(context, intent);
      }
    });

    // INVOICE DETAIL AGENT - Dettagli fattura specifica
    this.registerAgent({
      id: 'invoice_detail',
      name: 'Invoice Detail Agent',
      description: 'Mostra dettagli di una fattura specifica',
      intents: ['invoice_detail'],
      requiresAuth: true,
      priority: 9,
      handler: async (context, intent) => {
        return await this.invoiceDetailAgentHandler(context, intent);
      }
    });

    // FOLLOWUP AGENT - Gestisce domande di contesto
    this.registerAgent({
      id: 'followup',
      name: 'Followup Agent',
      description: 'Gestisce domande di follow-up riferite a risposte precedenti',
      intents: ['followup'],
      requiresAuth: false,
      priority: 10,
      handler: async (context, intent) => {
        return await this.followupAgentHandler(context, intent);
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
      // Prendi l'ultimo messaggio dell'utente dalla history
      const userMessages = context.conversationHistory.filter(m => m.role === 'user');
      const lastUserMessage = userMessages[userMessages.length - 1];
      const userMessage = lastUserMessage?.content?.toLowerCase() || '';

      console.log('🔍 helpdeskAgentHandler:', {
        customerId: context.customerId,
        customerType: context.customerType,
        userMessage: userMessage.substring(0, 100),
        historyLength: context.conversationHistory.length,
        userMessagesCount: userMessages.length
      });

      // Verifica se l'utente chiede ESPLICITAMENTE di parlare con un operatore o creare un ticket
      // NON creare ticket automaticamente - solo su richiesta esplicita
      const wantsHumanOperator = /operatore|umano|persona reale|parlare con qualcuno|ticket|contatt.*umano|voglio.*assistenza|passami.*operatore/i.test(userMessage);
      const hasExplicitProblem = /reclamo|non funziona|errore grave|urgente|emergenza/i.test(userMessage);

      // Keyword generiche che NON devono creare ticket automatico
      // "aiuto", "help", "problema", "assistenza" sono troppo generiche
      const hasKeywords = wantsHumanOperator || hasExplicitProblem;

      const ticketCheck = {
        hasKeywords,
        wantsHumanOperator,
        hasExplicitProblem,
        customerId: context.customerId,
        customerIdType: typeof context.customerId,
        customerType: context.customerType,
        historyLength: context.conversationHistory.length
      };
      console.log('🎫 Ticket check:', ticketCheck);

      // Crea ticket SOLO se l'utente lo chiede esplicitamente
      const shouldCreateTicket = context.customerId && hasKeywords;
      console.log('🎟️ shouldCreateTicket:', shouldCreateTicket, 'hasKeywords:', hasKeywords);

      if (shouldCreateTicket) {
        console.log('✅ Condizioni soddisfatte - creazione ticket in corso...');
        console.log('📝 Cliente B2B richiede assistenza - recupero dati completi e creazione ticket');

        // 1. Recupera TUTTI i dati del cliente da Odoo
        let customerData: any = null;
        try {
          const odooClient = await getOdooClient();
          const partners = await odooClient.searchRead(
            'res.partner',
            [['id', '=', context.customerId]],
            ['name', 'email', 'phone', 'mobile', 'street', 'street2', 'city', 'zip', 'country_id', 'vat', 'ref', 'company_id', 'parent_id', 'category_id', 'property_payment_term_id', 'sale_order_count', 'total_invoiced', 'comment'],
            1
          );
          if (partners && partners.length > 0) {
            customerData = partners[0];
          }
        } catch (odooError) {
          console.warn('⚠️ Impossibile recuperare dati cliente:', odooError);
        }

        const helpdeskAgent = createHelpdeskAgent(context.sessionId, (context.metadata?.language as 'it' | 'en' | 'de') || 'it');

        // 2. Costruisci conversazione completa con timestamp
        const conversationSummary = context.conversationHistory
          .map(m => `[${m.timestamp.toLocaleString('it-CH')}] ${m.role === 'user' ? 'CLIENTE' : 'AI'}: ${m.content}`)
          .join('\n\n');

        // 3. Determina priorità automaticamente
        let priority: '0' | '1' | '2' | '3' = '1';
        if (/urgente|subito|emergenza|grave/i.test(userMessage)) priority = '3';
        else if (/problema|errore|sbagliato|reclamo/i.test(userMessage)) priority = '2';

        // 4. Costruisci descrizione COMPLETA del ticket
        const nome = customerData?.name || context.customerName || 'N/D';
        const email = customerData?.email || context.customerEmail || 'N/D';
        const telefono = customerData?.phone || customerData?.mobile || 'N/D';
        const indirizzo = customerData ? `${customerData.street || ''} ${customerData.street2 || ''}, ${customerData.zip || ''} ${customerData.city || ''}`.trim() : 'N/D';
        const paese = customerData?.country_id?.[1] || 'N/D';

        const ticketDescription = `
══════════════════════════════════════════════════════
📋 RICHIESTA ASSISTENZA - CHAT AI LAPA
══════════════════════════════════════════════════════

👤 DATI CLIENTE (per contattarlo):
──────────────────────────────────────────────────────
• ID Odoo: ${context.customerId}
• Nome: ${nome}
• Email: ${email}
• Telefono: ${telefono}
• Indirizzo: ${indirizzo}
• Paese: ${paese}
• P.IVA: ${customerData?.vat || 'N/D'}
• Codice Cliente: ${customerData?.ref || 'N/D'}
• Tipo: ${context.customerType.toUpperCase()}

📊 INFO COMMERCIALI:
──────────────────────────────────────────────────────
• Totale Ordini: ${customerData?.sale_order_count || 'N/D'}
• Fatturato Totale: CHF ${customerData?.total_invoiced?.toFixed(2) || 'N/D'}
• Termini Pagamento: ${customerData?.property_payment_term_id?.[1] || 'Standard'}
• Note Cliente: ${customerData?.comment || 'Nessuna'}

💬 CONVERSAZIONE CHAT:
──────────────────────────────────────────────────────
${conversationSummary}

──────────────────────────────────────────────────────
📅 Creato: ${new Date().toLocaleString('it-CH')}
🔗 Sessione: ${context.sessionId}
══════════════════════════════════════════════════════`.trim();

        // Collect all attachments from context and conversation history
        const attachments = this.collectAttachments(context);
        console.log('🎫 Chiamando createTicket con:', { customerId: context.customerId, subject: `[Chat AI] ${nome}`, priority, attachmentsCount: attachments.length });

        let ticketResult;
        try {
          ticketResult = await helpdeskAgent.createTicket({
            customerId: context.customerId!,  // Non-null assertion - già verificato nell'if
            subject: `[Chat AI] ${nome} - Richiesta assistenza`,
            description: ticketDescription,
            priority,
            attachments: attachments.length > 0 ? attachments : undefined
          });
          console.log('🎫 Risultato createTicket:', JSON.stringify(ticketResult));
        } catch (ticketError) {
          console.error('🎫 Eccezione in createTicket:', ticketError);
          ticketResult = {
            success: false,
            message: ticketError instanceof Error ? ticketError.message : String(ticketError)
          };
        }

        if (ticketResult.success) {
          return {
            success: true,
            message: `✅ Ho creato il ticket **#${ticketResult.ticketId}** con tutti i tuoi dati.\n\n` +
                     `Il nostro team ti contatterà presto a:\n` +
                     `• 📧 ${email}\n` +
                     `• 📞 ${telefono}\n\n` +
                     `Per urgenze: lapa@lapa.ch | +41 76 361 70 21`,
            agentId: 'helpdesk',
            confidence: 1.0,
            requiresHumanEscalation: true,
            data: { ticketId: ticketResult.ticketId, customerId: context.customerId, customerName: nome, customerEmail: email },
            suggestedActions: ['Ho altre domande', 'Torna al menu principale']
          };
        } else {
          // Ticket creation failed
          console.error('❌ Creazione ticket fallita:', ticketResult);
          return {
            success: false,
            message: `⚠️ Non sono riuscito a creare il ticket automaticamente.\n\n` +
                     `Per favore contattaci direttamente:\n` +
                     `📧 lapa@lapa.ch\n` +
                     `📞 +41 76 361 70 21\n\n` +
                     `Errore: ${ticketResult.message || ticketResult.error || 'Errore sconosciuto'}`,
            agentId: 'helpdesk',
            confidence: 0.5,
            requiresHumanEscalation: true,
            data: {
              ticketError: ticketResult.message || ticketResult.error,
              ticketResult: JSON.stringify(ticketResult),
              debug: ticketCheck
            }
          };
        }
      }

      // Se non è loggato o non vuole operatore, usa Claude per risposta generale
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.7,
        system: this.buildHelpdeskPrompt(context),
        messages: this.buildConversationHistory(context)
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Se il cliente NON è loggato - controlla se ha fornito i dati di contatto
      if (!context.customerId) {
        // Cerca di estrarre dati di contatto dal messaggio dell'utente
        const fullUserMessage = lastUserMessage?.content || '';

        // Pattern per email
        const emailMatch = fullUserMessage.match(/[\w.-]+@[\w.-]+\.\w+/i);
        const extractedEmail = emailMatch ? emailMatch[0] : null;

        // Pattern per nome (parole con maiuscola iniziale)
        const nameMatch = fullUserMessage.match(/(?:nome|mi chiamo|sono)\s*[:\-]?\s*([A-Z][a-zA-ZàèéìòùÀÈÉÌÒÙ]+(?:\s+[A-Z][a-zA-ZàèéìòùÀÈÉÌÒÙ]+)*)/i);
        let extractedName = nameMatch ? nameMatch[1].trim() : null;

        // Se non trovato con pattern, cerca nomi propri all'inizio
        if (!extractedName) {
          const words = fullUserMessage.split(/\s+/);
          const potentialNames = words.filter(w => /^[A-Z][a-zA-ZàèéìòùÀÈÉÌÒÙ]+$/.test(w) && w.length > 2);
          if (potentialNames.length >= 2) {
            extractedName = potentialNames.slice(0, 2).join(' ');
          }
        }

        // Estrai descrizione problema (tutto ciò che non è nome/email/telefono)
        let problemDescription = fullUserMessage
          .replace(/[\w.-]+@[\w.-]+\.\w+/gi, '')  // rimuovi email
          .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{2,4}/g, '') // rimuovi telefono
          .replace(/(?:nome|mi chiamo|sono|email|telefono|indirizzo)[:\-]?\s*/gi, '')
          .trim();

        // Se non c'è descrizione, usa l'intero messaggio
        if (!problemDescription || problemDescription.length < 5) {
          problemDescription = fullUserMessage;
        }

        console.log('🔍 Dati estratti utente anonimo:', { extractedName, extractedEmail, problemDescription: problemDescription.substring(0, 100) });

        // Se abbiamo l'email, crea il ticket - l'email è sufficiente per contattare il cliente
        if (extractedEmail) {
          console.log('✅ Utente anonimo ha fornito dati sufficienti - creazione ticket');

          const helpdeskAgent = createHelpdeskAgent(context.sessionId, (context.metadata?.language as 'it' | 'en' | 'de') || 'it');

          // Costruisci descrizione ticket
          const ticketDescription = `
══════════════════════════════════════════════════════
📋 RICHIESTA ASSISTENZA - CHAT AI LAPA (UTENTE NON REGISTRATO)
══════════════════════════════════════════════════════

👤 DATI FORNITI:
• Nome: ${extractedName || 'Non fornito'}
• Email: ${extractedEmail}

📝 RICHIESTA:
${problemDescription}

══════════════════════════════════════════════════════
💬 CONVERSAZIONE CHAT (${context.conversationHistory.length} messaggi):
══════════════════════════════════════════════════════
${context.conversationHistory.map(m => `[${m.role === 'user' ? 'CLIENTE' : 'AI'}]: ${m.content}`).join('\n\n')}
          `.trim();

          // Prima cerca o crea il partner in Odoo con l'email fornita
          let partnerId: number | null = null;
          try {
            const odooClient = await getOdooClient();

            // Cerca partner esistente con questa email
            const existingPartners = await odooClient.searchRead(
              'res.partner',
              [['email', '=ilike', extractedEmail]],
              ['id', 'name'],
              1
            );

            if (existingPartners && existingPartners.length > 0) {
              partnerId = existingPartners[0].id;
              console.log('🔍 Partner esistente trovato:', partnerId);
            } else {
              // Crea nuovo partner
              const newPartnerId = await odooClient.call('res.partner', 'create', [{
                name: extractedName || extractedEmail,
                email: extractedEmail,
                customer_rank: 1,
                comment: 'Creato automaticamente da Chat AI LAPA'
              }]);
              partnerId = newPartnerId as number;
              console.log('✅ Nuovo partner creato:', partnerId);
            }
          } catch (partnerError) {
            console.warn('⚠️ Errore gestione partner:', partnerError);
          }

          // Crea il ticket with attachments collected from context and conversation
          try {
            const anonAttachments = this.collectAttachments(context);
            const ticketResult = await helpdeskAgent.createTicket({
              customerId: partnerId || 1, // Usa partner trovato/creato o fallback a 1
              subject: `[Chat AI] ${extractedName || extractedEmail}`,
              description: ticketDescription,
              priority: '1',
              attachments: anonAttachments.length > 0 ? anonAttachments : undefined
            });

            console.log('🎫 Risultato ticket anonimo:', ticketResult, 'allegati:', anonAttachments.length);

            if (ticketResult.success) {
              return {
                success: true,
                message: `✅ Ho creato il ticket **#${ticketResult.ticketId}**!\n\n` +
                         `Il nostro team ti contatterà presto all'indirizzo **${extractedEmail}**.\n\n` +
                         `Per qualsiasi urgenza:\n📧 lapa@lapa.ch\n📞 +41 76 361 70 21`,
                agentId: 'helpdesk',
                confidence: 0.95,
                data: { ticketId: ticketResult.ticketId, email: extractedEmail }
              };
            }
          } catch (ticketError) {
            console.error('❌ Errore creazione ticket anonimo:', ticketError);
          }
        }

        // Utente anonimo senza email - chiedi l'email per creare il ticket
        return {
          success: true,
          message: `Per aprire subito un ticket e farti aiutare da un nostro operatore, ho bisogno della tua **email**.\n\n` +
                   `📧 Scrivi la tua email e descrivi brevemente il problema.\n\n` +
                   `Esempio: "mario.rossi@email.com - non riesco a trovare il mio ordine"\n\n` +
                   `Oppure contattaci direttamente:\n📧 lapa@lapa.ch\n📞 +41 76 361 70 21`,
          agentId: 'helpdesk',
          confidence: 0.9,
          suggestedActions: [
            'Fornisci la tua email',
            'Contatta via email',
            'Accedi al tuo account'
          ]
        };
      }

      return {
        success: true,
        message: content.text,
        agentId: 'helpdesk',
        confidence: 0.8,
        suggestedActions: [
          'Apri un ticket di assistenza',
          'Hai altre domande?'
        ],
        data: { debug: { ...ticketCheck, shouldCreateTicket } }  // DEBUG - rimuovere dopo
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Errore helpdesk agent:', errorMsg, error);

      return {
        success: false,
        message: `Mi dispiace, c'è stato un problema. Per assistenza immediata contattaci:\n\n📧 lapa@lapa.ch\n📞 +41 76 361 70 21`,
        requiresHumanEscalation: true,
        agentId: 'helpdesk',
        data: { error: errorMsg }
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

      // Ottieni l'ultimo messaggio dell'utente per contesto
      const lastUserMsg = context.conversationHistory
        .filter(m => m.role === 'user')
        .pop()?.content || 'Cerca prodotto';

      // Se c'è un nome prodotto o query, cerca prodotti
      if (entities.product_name) {
        const searchResult = await this.productsAgent.searchProducts(
          { query: entities.product_name, active_only: true },
          10
        );

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const products = searchResult.data.slice(0, 5);

          // Prepara dati per la risposta conversazionale
          const productsData = products.map((product: any) => {
            const templateId = product.product_tmpl_id ? product.product_tmpl_id[0] : product.id;
            return {
              name: product.name,
              price: `${product.list_price?.toFixed(2) || '0.00'} CHF`,
              qty_available: product.qty_available !== undefined ? product.qty_available : 'N/D',
              unit: product.uom_id ? product.uom_id[1] : 'pz',
              url: generateProductUrl(templateId, product.name)
            };
          });

          // Genera risposta conversazionale
          const conversationalMessage = await this.generateConversationalResponse(
            context,
            'ricerca prodotti',
            {
              search_query: entities.product_name,
              products: productsData,
              total_found: searchResult.data.length,
              customer_name: context.customerName
            },
            lastUserMsg
          );

          // Crea suggested actions dinamici per i primi 3 prodotti
          const orderActions = products.slice(0, 3).map((p: any) => {
            const shortName = p.name.split(' ').slice(0, 3).join(' ');
            return `Ordina ${shortName}`;
          });

          return {
            success: true,
            message: conversationalMessage,
            data: searchResult.data,
            agentId: 'product',
            confidence: 0.9,
            suggestedActions: [
              ...orderActions,
              'Cerca altro'
            ]
          };
        }

        // Nessun risultato - risposta conversazionale
        const noResultsMessage = await this.generateConversationalResponse(
          context,
          'ricerca prodotti',
          {
            search_query: entities.product_name,
            products: [],
            total_found: 0,
            customer_name: context.customerName
          },
          lastUserMsg
        );

        return {
          success: false,
          message: noResultsMessage,
          agentId: 'product',
          confidence: 0.7,
          suggestedActions: [
            'Visualizza catalogo',
            'Cerca per categoria',
            'Richiedi assistenza'
          ]
        };
      }

      // Risposta generica conversazionale
      const genericMessage = await this.generateConversationalResponse(
        context,
        'catalogo prodotti',
        {
          products: [],
          customer_name: context.customerName,
          action_needed: 'ricerca prodotto'
        },
        lastUserMsg
      );

      return {
        success: true,
        message: genericMessage,
        agentId: 'product',
        confidence: 0.7,
        suggestedActions: [
          'Visualizza catalogo',
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
    // Verifica solo customerId - la sessione Odoo viene gestita automaticamente dal client
    if (!context.customerId) {
      return {
        success: false,
        message: 'Cliente non identificato. Effettua il login per vedere i tuoi ordini.',
        requiresHumanEscalation: false,
        agentId: 'order'
      };
    }

    try {
      // Verifica il tipo di richiesta dall'intento
      const entities = intent.entities || {};
      const lowerMessage = context.conversationHistory
        .filter(m => m.role === 'user')
        .slice(-1)[0]?.content?.toLowerCase() || '';

      // Usa Odoo direttamente per recuperare gli ordini
      const odoo = await getOdooClient();

      // Rileva richiesta "prodotti acquistati"
      const isProductsQuery = lowerMessage.match(
        /prodott[io].*comprat|cosa.*comprat|ultim[io].*prodott|quando.*comprat|storico.*acquist|purchased|gekauft|acheté/i
      );

      if (isProductsQuery) {
        return await this.handlePurchasedProductsQuery(context, odoo, lowerMessage);
      }

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
        ['id', 'name', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
        10
      );

      // Ottieni l'ultimo messaggio dell'utente per contesto
      const lastUserMsg = lowerMessage || 'I miei ordini';

      if (orders && orders.length > 0) {
        const stateLabels: Record<string, string> = {
          draft: 'Bozza', sent: 'Inviato', sale: 'Confermato',
          done: 'Completato', cancel: 'Annullato'
        };

        // Prepara dati per la risposta conversazionale
        const ordersData = orders.map((order: any) => ({
          name: order.name,
          date: order.date_order,
          state: stateLabels[order.state] || order.state,
          total: `${order.currency_id[1]} ${order.amount_total.toFixed(2)}`,
          products_count: Array.isArray(order.order_line) ? order.order_line.length : 0,
          url: generateOrderUrl(order.id, order.name)
        }));

        // Genera risposta conversazionale
        const conversationalMessage = await this.generateConversationalResponse(
          context,
          'ordini e acquisti',
          {
            orders: ordersData,
            total_count: orders.length,
            customer_name: context.customerName
          },
          lastUserMsg
        );

        return {
          success: true,
          message: conversationalMessage,
          data: orders,
          agentId: 'order',
          confidence: 0.9,
          suggestedActions: [
            'Dettagli ordine',
            'Crea nuovo ordine',
            'Cerca prodotti'
          ]
        };
      }

      // Genera risposta conversazionale anche per caso "nessun ordine"
      const noOrdersMessage = await this.generateConversationalResponse(
        context,
        'ordini e acquisti',
        {
          orders: [],
          total_count: 0,
          customer_name: context.customerName
        },
        lastUserMsg
      );

      return {
        success: true,
        message: noOrdersMessage,
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
   * Handler per la creazione ordini
   * B2B: Usa l'orders agent con Claude per gestire il flusso completo
   * B2C: Reindirizza al sito web per acquisti
   */
  private async orderCreateAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    // Verifica autenticazione
    if (!context.customerId) {
      return {
        success: false,
        message: 'Per creare un ordine devi prima identificarti. Sei un cliente B2B o preferisci acquistare sul nostro sito?',
        requiresHumanEscalation: false,
        agentId: 'order_create',
        suggestedActions: ['Sono un cliente B2B', 'Vai al sito web']
      };
    }

    // B2C: Reindirizza al sito web
    if (context.customerType === 'b2c') {
      return {
        success: true,
        message: `Ciao ${context.customerName || ''}! Per acquistare i nostri prodotti, ti invito a visitare il nostro shop online:\n\n🛒 **https://lapa.ch**\n\nTroverai:\n- Catalogo completo dei prodotti\n- Pagamento sicuro (carta, bonifico)\n- Consegna a domicilio in tutta la Svizzera\n- Tracciamento della spedizione\n\nHai domande su un prodotto specifico? Posso aiutarti!`,
        agentId: 'order_create',
        confidence: 0.9,
        suggestedActions: ['Cerca un prodotto', 'Info spedizioni', 'Contatta supporto']
      };
    }

    // B2B: Usa l'orders agent con Claude per gestire il flusso
    try {
      // Prendi il messaggio originale dell'utente
      const userMessages = context.conversationHistory.filter(m => m.role === 'user');
      const userQuery = userMessages[userMessages.length - 1]?.content || 'Voglio creare un ordine';

      // Costruisci il task per l'orders agent
      const task = {
        id: `order_create_${Date.now()}`,
        user_query: userQuery,
        salesperson_id: 0, // Non usato per clienti
        context: {
          customer_id: context.customerId,
          customer_name: context.customerName,
          customer_type: context.customerType,
          conversation_id: context.sessionId,
        },
        created_at: new Date()
      };

      console.log('🛒 Calling ordersAgent for order creation:', task);

      // Esegui l'orders agent
      const result = await this.ordersAgent.execute(task);

      if (result.success) {
        return {
          success: true,
          message: result.data || 'Come posso aiutarti con il tuo ordine?',
          agentId: 'order_create',
          confidence: 0.95,
          data: result,
          suggestedActions: ['Cerca un prodotto', 'Mostra prodotti acquistati', 'Annulla']
        };
      } else {
        return {
          success: false,
          message: result.error || 'Si è verificato un errore nella creazione dell\'ordine.',
          agentId: 'order_create',
          requiresHumanEscalation: true
        };
      }
    } catch (error) {
      console.error('❌ Errore orderCreateAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore. Riprova o contatta il supporto.',
        requiresHumanEscalation: true,
        agentId: 'order_create'
      };
    }
  }

  /**
   * Handler per query sui prodotti acquistati
   */
  private async handlePurchasedProductsQuery(
    context: CustomerContext,
    odoo: any,
    lowerMessage: string
  ): Promise<AgentResponse> {
    try {
      const customerId = context.customerId!;

      // Controlla se cerca un prodotto specifico
      const specificProductMatch = lowerMessage.match(
        /quando.*(?:comprat|acquist).*(?:l[ao]|il|i|gli)\s+(.+)|(?:storico|ultim).*(?:acquist|comprat).*(?:di|del|della)\s+(.+)/i
      );

      if (specificProductMatch) {
        // Ricerca storico di un prodotto specifico
        const productSearch = (specificProductMatch[1] || specificProductMatch[2] || '').trim();

        if (productSearch && productSearch.length > 2) {
          // Trova ordini del cliente
          const orders = await odoo.searchRead(
            'sale.order',
            [
              ['partner_id', '=', customerId],
              ['state', 'in', ['sale', 'done']]
            ],
            ['id', 'name', 'date_order'],
            100
          );

          if (orders.length === 0) {
            return {
              success: true,
              message: 'Non hai ancora ordini nel tuo storico.',
              agentId: 'order_products'
            };
          }

          const orderIds = orders.map((o: any) => o.id);
          const orderMap = new Map<number, { id: number; name: string; date_order: string }>(
            orders.map((o: any) => [o.id, { id: o.id, name: o.name, date_order: o.date_order }])
          );

          // Recupera le righe d'ordine
          const orderLines = await odoo.searchRead(
            'sale.order.line',
            [['order_id', 'in', orderIds]],
            ['product_id', 'order_id', 'product_uom_qty', 'price_unit', 'price_subtotal'],
            1000
          );

          // Filtra per nome prodotto (ricerca multi-parola)
          const searchTerms = productSearch.toLowerCase().split(/\s+/);
          const matchingLines = orderLines.filter((line: any) => {
            if (!line.product_id) return false;
            const productName = line.product_id[1].toLowerCase();
            return searchTerms.every((term: string) => productName.includes(term));
          });

          if (matchingLines.length === 0) {
            return {
              success: true,
              message: `Non ho trovato "${productSearch}" nei tuoi ordini precedenti.\n\n` +
                       'Vuoi che ti mostri tutti i prodotti che hai acquistato?',
              agentId: 'order_products',
              suggestedActions: ['Mostra tutti i prodotti acquistati', 'Cerca un altro prodotto']
            };
          }

          // Raggruppa e ordina per data
          const purchases = matchingLines.map((line: any) => {
            const order = orderMap.get(line.order_id[0]);
            return {
              orderName: order?.name || '',
              date: order?.date_order || '',
              productId: line.product_id[0],
              productName: line.product_id[1],
              quantity: line.product_uom_qty,
              price: line.price_unit,
              total: line.price_subtotal
            };
          }).sort((a: any, b: any) => b.date.localeCompare(a.date));

          const productName = purchases[0].productName;
          const productId = purchases[0].productId;

          // Recupera product_tmpl_id per l'URL corretto del sito web
          let templateId = productId; // Fallback al product ID
          try {
            const productData = await odoo.searchRead(
              'product.product',
              [['id', '=', productId]],
              ['product_tmpl_id'],
              1
            );
            if (productData.length > 0 && productData[0].product_tmpl_id) {
              templateId = productData[0].product_tmpl_id[0];
            }
          } catch (e) {
            console.warn('Impossibile recuperare product_tmpl_id, uso product_id');
          }
          const productUrl = generateProductUrl(templateId, productName);
          const totalQty = purchases.reduce((sum: number, p: any) => sum + p.quantity, 0);
          const totalSpent = purchases.reduce((sum: number, p: any) => sum + p.total, 0);

          const purchaseList = purchases.slice(0, 5).map((p: any, idx: number) =>
            `   ${idx + 1}. ${p.date.split(' ')[0]} - Ordine ${p.orderName}\n` +
            `      Qtà: ${p.quantity} × CHF ${p.price.toFixed(2)} = CHF ${p.total.toFixed(2)}`
          ).join('\n');

          return {
            success: true,
            message: `📦 **Storico acquisti: ${productName}**\n\n` +
                     `🔗 [Vedi prodotto](${productUrl})\n\n` +
                     `🔢 Totale acquistato: ${totalQty} unità\n` +
                     `💰 Totale speso: CHF ${totalSpent.toFixed(2)}\n` +
                     `📅 Primo acquisto: ${purchases[purchases.length - 1].date.split(' ')[0]}\n` +
                     `📅 Ultimo acquisto: ${purchases[0].date.split(' ')[0]}\n\n` +
                     `**Ultimi ${Math.min(5, purchases.length)} acquisti:**\n${purchaseList}\n\n` +
                     (purchases.length > 5 ? `E altri ${purchases.length - 5} acquisti precedenti.\n\n` : '') +
                     'Vuoi ordinare di nuovo questo prodotto?',
            data: { productName, productId, purchases, summary: { totalQty, totalSpent } },
            agentId: 'order_products',
            suggestedActions: ['Ordina di nuovo', 'Altri prodotti acquistati', 'Dettagli ordine']
          };
        }
      }

      // Mostra lista prodotti acquistati (query generica)
      const orders = await odoo.searchRead(
        'sale.order',
        [
          ['partner_id', '=', customerId],
          ['state', 'in', ['sale', 'done']]
        ],
        ['id', 'name', 'date_order'],
        100
      );

      if (orders.length === 0) {
        return {
          success: true,
          message: 'Non hai ancora ordini nel tuo storico.',
          agentId: 'order_products',
          suggestedActions: ['Cerca prodotti', 'Contatta supporto']
        };
      }

      const orderIds = orders.map((o: any) => o.id);
      const orderMap = new Map<number, { id: number; name: string; date_order: string }>(
        orders.map((o: any) => [o.id, { id: o.id, name: o.name, date_order: o.date_order }])
      );

      // Recupera tutte le righe d'ordine
      const orderLines = await odoo.searchRead(
        'sale.order.line',
        [['order_id', 'in', orderIds]],
        ['product_id', 'order_id', 'product_uom_qty'],
        1000
      );

      // Aggrega per prodotto
      const productMap = new Map<number, {
        id: number;
        name: string;
        totalQty: number;
        lastDate: string;
        lastOrder: string;
        orderCount: number;
        orderSet: Set<number>;
      }>();

      for (const line of orderLines) {
        if (!line.product_id) continue;

        const productId = line.product_id[0];
        const productName = line.product_id[1];
        const order = orderMap.get(line.order_id[0]);

        if (!order) continue;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            id: productId,
            name: productName,
            totalQty: 0,
            lastDate: order.date_order,
            lastOrder: order.name,
            orderCount: 0,
            orderSet: new Set()
          });
        }

        const prod = productMap.get(productId)!;
        prod.totalQty += line.product_uom_qty;
        prod.orderSet.add(line.order_id[0]);

        if (order.date_order > prod.lastDate) {
          prod.lastDate = order.date_order;
          prod.lastOrder = order.name;
        }
      }

      // Ordina per ultimo acquisto e prendi i primi 10
      const products = Array.from(productMap.values())
        .map(p => ({ ...p, orderCount: p.orderSet.size }))
        .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
        .slice(0, 10);

      // Recupera product_tmpl_id per tutti i prodotti in una singola query
      const productIds = products.map(p => p.id);
      const templateIdMap = new Map<number, number>();
      try {
        const productData = await odoo.searchRead(
          'product.product',
          [['id', 'in', productIds]],
          ['id', 'product_tmpl_id'],
          productIds.length
        );
        for (const p of productData) {
          if (p.product_tmpl_id) {
            templateIdMap.set(p.id, p.product_tmpl_id[0]);
          }
        }
      } catch (e) {
        console.warn('Impossibile recuperare product_tmpl_id per prodotti acquistati');
      }

      const productList = products.map((p, idx) => {
        // Usa template ID se disponibile, altrimenti fallback al product ID
        const templateId = templateIdMap.get(p.id) || p.id;
        const url = generateProductUrl(templateId, p.name);
        return `${idx + 1}. **${p.name}**\n` +
          `   Ultimo acquisto: ${p.lastDate.split(' ')[0]} (${p.lastOrder})\n` +
          `   Totale acquistato: ${p.totalQty} unità in ${p.orderCount} ordini\n` +
          `   🔗 [Vedi prodotto](${url})`;
      }).join('\n\n');

      return {
        success: true,
        message: `📦 **I tuoi prodotti acquistati**\n\n` +
                 `Totale ordini: ${orders.length} | Prodotti diversi: ${productMap.size}\n\n` +
                 `**Ultimi 10 prodotti acquistati:**\n\n${productList}\n\n` +
                 'Vuoi vedere lo storico dettagliato di un prodotto specifico?',
        data: { products, totalOrders: orders.length, totalProducts: productMap.size },
        agentId: 'order_products',
        suggestedActions: ['Storico prodotto specifico', 'Vedi tutti gli ordini', 'Ordina di nuovo']
      };

    } catch (error) {
      console.error('❌ Errore handlePurchasedProductsQuery:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando i prodotti acquistati. Riprova più tardi.',
        agentId: 'order_products'
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
    // Verifica solo customerId - la sessione Odoo viene gestita automaticamente dal client
    if (!context.customerId) {
      return {
        success: false,
        message: 'Cliente non identificato. Effettua il login per vedere le tue fatture.',
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

      // Analizza se l'utente chiede fatture da pagare
      const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];
      const messageLC = (lastMessage?.content || '').toLowerCase();
      const wantsUnpaid = messageLC.includes('da pagare') || messageLC.includes('pagare') ||
                          messageLC.includes('aperte') || messageLC.includes('non pagate') ||
                          messageLC.includes('scadute') || messageLC.includes('saldo');

      // Se chiede fatture da pagare, filtra solo quelle non pagate
      const invoicesResult = await this.invoicesAgent.getInvoices(
        context.customerId,
        wantsUnpaid ? 'open' : 'all',
        20
      );

      if (invoicesResult.success && invoicesResult.data && invoicesResult.data.length > 0) {
        const paymentStateLabels: Record<string, string> = {
          not_paid: 'Non pagata', in_payment: 'In pagamento',
          paid: 'Pagata', partial: 'Parzialmente pagata',
          reversed: 'Stornata', invoicing_legacy: 'Legacy'
        };

        // Calcola il saldo aperto
        const balanceResult = await this.invoicesAgent.getOpenBalance(context.customerId);

        // Prepara dati per la risposta conversazionale
        const invoicesData = invoicesResult.data.map((inv: any) => ({
          name: inv.name,
          date: inv.invoice_date,
          due_date: inv.invoice_date_due,
          state: paymentStateLabels[inv.payment_state] || inv.payment_state,
          total: `${inv.currency_id[1]} ${inv.amount_total.toFixed(2)}`,
          residual: `${inv.currency_id[1]} ${inv.amount_residual.toFixed(2)}`,
          url: generateInvoiceUrl(inv.id)
        }));

        // Genera risposta conversazionale
        const conversationalMessage = await this.generateConversationalResponse(
          context,
          wantsUnpaid ? 'fatture da pagare' : 'fatture',
          {
            invoices: invoicesData,
            total_count: invoicesResult.data.length,
            open_balance: balanceResult.success && balanceResult.data
              ? `${balanceResult.data.currency} ${balanceResult.data.total_due.toFixed(2)}`
              : null,
            filter: wantsUnpaid ? 'non pagate' : 'tutte',
            customer_name: context.customerName
          },
          messageLC
        );

        return {
          success: true,
          message: conversationalMessage,
          data: {
            invoices: invoicesResult.data,
            balance: balanceResult.data
          },
          agentId: 'invoice',
          confidence: 0.9,
          suggestedActions: wantsUnpaid
            ? ['Dettagli fattura', 'Link pagamento', 'Scarica fattura']
            : ['Dettagli fattura', 'Fatture da pagare', 'Scarica fattura']
        };
      }

      // Genera risposta conversazionale anche per caso "nessuna fattura"
      const noInvoicesMessage = await this.generateConversationalResponse(
        context,
        wantsUnpaid ? 'fatture da pagare' : 'fatture',
        {
          invoices: [],
          total_count: 0,
          filter: wantsUnpaid ? 'non pagate' : 'tutte',
          customer_name: context.customerName
        },
        messageLC
      );

      return {
        success: true,
        message: noInvoicesMessage,
        agentId: 'invoice',
        confidence: 0.8,
        suggestedActions: wantsUnpaid
          ? ['Vedi tutte le fatture', 'I miei ordini']
          : ['Verifica storico ordini', 'Contatta amministrazione']
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
      // Estrai anche ordini dal messaggio (pattern S12345, SO12345, etc.)
      let trackingId = entities.tracking_number || entities.order_id;

      // Se non trovato nelle entities, cerca pattern nel messaggio dell'ultimo user
      if (!trackingId && context.conversationHistory.length > 0) {
        const lastMsg = context.conversationHistory[context.conversationHistory.length - 1];
        if (lastMsg.role === 'user') {
          // Pattern per ordini (S12345, SO12345)
          const orderMatch = lastMsg.content.match(/\b(S\d{5,}|SO\d{5,})\b/i);
          if (orderMatch) {
            trackingId = orderMatch[1].toUpperCase();
          }
          // Pattern per picking names (WH/OUT/12345, WH/PICK/12345)
          if (!trackingId) {
            const pickingMatch = lastMsg.content.match(/\b(WH\/(?:OUT|PICK|IN)\/\d+)\b/i);
            if (pickingMatch) {
              trackingId = pickingMatch[1].toUpperCase();
            }
          }
          // Pattern per ID numerico puro (5+ cifre per essere un ID picking)
          if (!trackingId) {
            const numericMatch = lastMsg.content.match(/\b(\d{5,})\b/);
            if (numericMatch) {
              // Converti in numero intero per usare la logica ID numerico
              trackingId = parseInt(numericMatch[1], 10);
            }
          }
        }
      }

      if (trackingId) {
        // Passa il trackingId così com'è (numero o stringa)
        // trackShipment gestisce entrambi i tipi
        const trackingResult = await this.shippingAgent.trackShipment(trackingId);

        if (trackingResult.success && trackingResult.data) {
          const shipment = trackingResult.data;

          return {
            success: true,
            message: `📦 **Spedizione ${shipment.name}**\n\n` +
                     `👤 Cliente: ${shipment.customer_name}\n` +
                     `📍 Stato: ${shipment.state_label}\n` +
                     `📅 Data prevista: ${shipment.scheduled_date || 'N/A'}\n` +
                     `✅ Data consegna: ${shipment.date_done || 'In corso'}\n` +
                     `🚚 Autista: ${shipment.driver_name || 'Non assegnato'}\n` +
                     `📋 Prodotti: ${shipment.products_count}`,
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
          message: `Non ho trovato spedizioni per l'ordine ${trackingId}. Verifica che il numero sia corretto.`,
          agentId: 'shipping',
          confidence: 0.7
        };
      }

      // Se c'è un customerId, mostra prima le consegne di OGGI
      if (context.customerId) {
        const activeResult = await this.shippingAgent.getActiveDeliveries(context.customerId);

        if (activeResult.success && activeResult.data) {
          const activeData = activeResult.data;

          // Ottieni l'ultimo messaggio dell'utente per contesto
          const lastUserMsg = context.conversationHistory
            .filter(m => m.role === 'user')
            .pop()?.content || 'Dove sono le mie consegne?';

          // Genera risposta conversazionale con Claude
          const conversationalMessage = await this.generateConversationalResponse(
            context,
            'consegne e spedizioni',
            {
              has_delivery_today: activeData.has_delivery_today,
              today_deliveries: activeData.today_deliveries,
              future_count: activeData.future_deliveries_count,
              past_count: activeData.past_deliveries_count,
              customer_name: context.customerName
            },
            lastUserMsg
          );

          // Prepara azioni suggerite
          const suggestedActions = [];
          if (activeData.future_deliveries_count > 0) {
            suggestedActions.push(`Ordini futuri (${activeData.future_deliveries_count})`);
          }
          if (activeData.past_deliveries_count > 0) {
            suggestedActions.push(`Storico passato (${activeData.past_deliveries_count})`);
          }
          if (suggestedActions.length === 0) {
            suggestedActions.push('Traccia ordine');
          }

          return {
            success: true,
            message: conversationalMessage,
            data: activeData,
            agentId: 'shipping',
            confidence: 0.9,
            suggestedActions
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
        'Scrivici a lapa@lapa.ch'
      ]
    };
  }

  /**
   * Handler per dettagli ordine specifico
   * Gestisce richieste come "dettagli dell'ultimo ordine" o "mostrami l'ordine S36399"
   */
  private async orderDetailAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    if (!context.customerId) {
      return {
        success: false,
        message: 'Cliente non identificato. Effettua il login per vedere i dettagli degli ordini.',
        agentId: 'order_detail'
      };
    }

    try {
      const entities = intent.entities || {};
      const odoo = await getOdooClient();

      // Determina quale ordine mostrare
      let orderToShow: any = null;

      // 1. Se c'è un order_id specifico nelle entities
      if (entities.order_id) {
        const orders = await odoo.searchRead(
          'sale.order',
          [
            ['partner_id', '=', context.customerId],
            ['name', 'ilike', entities.order_id]
          ],
          ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
          1
        );
        if (orders.length > 0) orderToShow = orders[0];
      }

      // 2. Se c'è position (last, first, o numero)
      if (!orderToShow && entities.position) {
        const orders = await odoo.searchRead(
          'sale.order',
          [['partner_id', '=', context.customerId]],
          ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
          20
        );

        if (orders.length > 0) {
          if (entities.position === 'last') {
            orderToShow = orders[0]; // Già ordinati per data DESC
          } else if (entities.position === 'first') {
            orderToShow = orders[orders.length - 1];
          } else if (typeof entities.position === 'number') {
            const idx = entities.position - 1;
            if (idx >= 0 && idx < orders.length) {
              orderToShow = orders[idx];
            }
          }
        }
      }

      // 3. Cerca nell'ultimo messaggio/risposta per riferimento a ordini
      if (!orderToShow) {
        const lastAssistantMsg = context.conversationHistory
          .filter(m => m.role === 'assistant')
          .pop();

        if (lastAssistantMsg?.metadata?.orders) {
          // Se l'ultimo messaggio conteneva una lista di ordini
          const lastOrders = lastAssistantMsg.metadata.orders;
          if (lastOrders.length > 0) {
            orderToShow = lastOrders[0]; // Prendi il primo (più recente)
          }
        }
      }

      // 4. Fallback: prendi l'ultimo ordine
      if (!orderToShow) {
        const orders = await odoo.searchRead(
          'sale.order',
          [['partner_id', '=', context.customerId]],
          ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'],
          1
        );
        if (orders.length > 0) orderToShow = orders[0];
      }

      if (!orderToShow) {
        return {
          success: false,
          message: 'Non ho trovato ordini nel tuo storico. Vuoi creare un nuovo ordine?',
          agentId: 'order_detail',
          suggestedActions: ['Crea nuovo ordine', 'Cerca prodotti']
        };
      }

      // Recupera le righe dell'ordine
      const orderLines = await odoo.searchRead(
        'sale.order.line',
        [['order_id', '=', orderToShow.id]],
        ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal'],
        50
      );

      const stateLabels: Record<string, string> = {
        draft: 'Bozza', sent: 'Inviato', sale: 'Confermato',
        done: 'Completato', cancel: 'Annullato'
      };

      // Formatta le righe prodotto
      const productLines = orderLines
        .map((line: any, idx: number) => {
          const productName = line.product_id ? line.product_id[1] : line.name;
          return `   ${idx + 1}. ${productName}\n      Qtà: ${line.product_uom_qty} × ${line.price_unit.toFixed(2)} CHF = ${line.price_subtotal.toFixed(2)} CHF`;
        })
        .join('\n');

      const orderUrl = generateOrderUrl(orderToShow.id, orderToShow.name);
      const message = `📦 **Dettagli Ordine ${orderToShow.name}**\n\n` +
        `🔗 [Vedi ordine sul portale](${orderUrl})\n\n` +
        `👤 Cliente: ${orderToShow.partner_id[1]}\n` +
        `📅 Data: ${orderToShow.date_order}\n` +
        `📊 Stato: ${stateLabels[orderToShow.state] || orderToShow.state}\n` +
        `💰 Totale: ${orderToShow.currency_id[1]} ${orderToShow.amount_total.toFixed(2)}\n\n` +
        `📋 **Prodotti (${orderLines.length}):**\n${productLines}\n\n` +
        `Vuoi altre informazioni su questo ordine?`;

      return {
        success: true,
        message,
        data: { order: orderToShow, lines: orderLines, orderUrl },
        agentId: 'order_detail',
        confidence: 0.95,
        suggestedActions: [
          'Traccia la spedizione',
          'Vedi la fattura',
          'Altri ordini'
        ]
      };

    } catch (error) {
      console.error('❌ Errore orderDetailAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando i dettagli dell\'ordine. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'order_detail'
      };
    }
  }

  /**
   * Handler per filtrare fatture per stato pagamento
   * Gestisce richieste come "quelle da pagare" o "mostrami le fatture pagate"
   */
  private async invoiceFilterAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    if (!context.customerId) {
      return {
        success: false,
        message: 'Cliente non identificato. Effettua il login per vedere le tue fatture.',
        agentId: 'invoice_filter'
      };
    }

    try {
      const entities = intent.entities || {};
      const filter = entities.filter || 'unpaid'; // Default: da pagare

      // Determina quale filtro applicare
      // Nota: getInvoices supporta solo 'open' | 'paid' | 'all'
      // Per 'overdue' usiamo 'open' e poi filtriamo manualmente
      let status: 'open' | 'paid' | 'all' = 'all';
      const isOverdueFilter = filter === 'overdue';
      let displayStatus = filter; // Per mostrare all'utente

      if (filter === 'unpaid' || filter === 'open' || filter === 'not_paid' || filter === 'overdue') {
        status = 'open';
      } else if (filter === 'paid') {
        status = 'paid';
      }

      let invoicesResult = await this.invoicesAgent.getInvoices(context.customerId, status, 20);

      // Se è richiesto solo scadute, filtra per data scadenza < oggi
      if (isOverdueFilter && invoicesResult.success && invoicesResult.data) {
        const today = new Date().toISOString().split('T')[0];
        invoicesResult = {
          ...invoicesResult,
          data: invoicesResult.data.filter((inv: any) =>
            inv.invoice_date_due && inv.invoice_date_due < today
          )
        };
      }

      if (!invoicesResult.success || !invoicesResult.data || invoicesResult.data.length === 0) {
        const filterLabels: Record<string, string> = {
          open: 'da pagare',
          paid: 'pagate',
          overdue: 'scadute',
          unpaid: 'da pagare',
          all: ''
        };

        // Usa isOverdueFilter per determinare la label corretta
        const displayLabel = isOverdueFilter ? 'scadute' : filterLabels[status] || filterLabels[filter] || '';

        return {
          success: true,
          message: `Non hai fatture ${displayLabel} al momento. Ottimo!`,
          agentId: 'invoice_filter',
          confidence: 0.9,
          suggestedActions: [
            'Vedi tutte le fatture',
            'Storico ordini',
            'Nuovi prodotti'
          ]
        };
      }

      const paymentStateLabels: Record<string, string> = {
        not_paid: 'Non pagata', in_payment: 'In pagamento',
        paid: 'Pagata', partial: 'Parzialmente pagata',
        reversed: 'Stornata', invoicing_legacy: 'Legacy'
      };

      const invoicesList = invoicesResult.data
        .map((inv: any, index: number) =>
          `${index + 1}. **${inv.name}** - ${paymentStateLabels[inv.payment_state] || inv.payment_state}\n` +
          `   📅 Scadenza: ${inv.invoice_date_due || 'N/A'} | 💰 ${inv.currency_id[1]} ${inv.amount_total.toFixed(2)} | ` +
          `Residuo: ${inv.amount_residual.toFixed(2)}`
        )
        .join('\n');

      // Calcola totale residuo
      const totalResidual = invoicesResult.data.reduce((sum: number, inv: any) => sum + (inv.amount_residual || 0), 0);

      // Label per il tipo di filtro
      const displayLabel = isOverdueFilter ? 'scadute' : (status === 'open' ? 'da pagare' : status === 'paid' ? 'pagate' : 'totali');

      const message = `📄 **Fatture ${displayLabel}:** ${invoicesResult.data.length}\n\n` +
        invoicesList +
        (status === 'open' ? `\n\n💰 **Totale da pagare:** CHF ${totalResidual.toFixed(2)}` : '') +
        `\n\nVuoi vedere i dettagli di una fattura specifica?`;

      return {
        success: true,
        message,
        data: invoicesResult.data,
        agentId: 'invoice_filter',
        confidence: 0.95,
        suggestedActions: [
          'Dettagli fattura',
          'Paga online',
          'Scarica PDF'
        ]
      };

    } catch (error) {
      console.error('❌ Errore invoiceFilterAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore filtrando le fatture. Riprova più tardi.',
        requiresHumanEscalation: true,
        agentId: 'invoice_filter'
      };
    }
  }

  /**
   * Handler per dettagli fattura specifica
   */
  private async invoiceDetailAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    if (!context.customerId) {
      return {
        success: false,
        message: 'Cliente non identificato. Effettua il login per vedere le tue fatture.',
        agentId: 'invoice_detail'
      };
    }

    try {
      const entities = intent.entities || {};
      const odoo = await getOdooClient();

      let invoiceToShow: any = null;

      // 1. Se c'è un invoice_number specifico
      if (entities.invoice_number) {
        const invoices = await odoo.searchRead(
          'account.move',
          [
            ['partner_id', '=', context.customerId],
            ['move_type', '=', 'out_invoice'],
            ['name', 'ilike', entities.invoice_number]
          ],
          ['id', 'name', 'partner_id', 'invoice_date', 'invoice_date_due', 'state', 'payment_state', 'amount_total', 'amount_residual', 'currency_id'],
          1
        );
        if (invoices.length > 0) invoiceToShow = invoices[0];
      }

      // 2. Se c'è position
      if (!invoiceToShow && entities.position) {
        const invoices = await odoo.searchRead(
          'account.move',
          [
            ['partner_id', '=', context.customerId],
            ['move_type', '=', 'out_invoice']
          ],
          ['id', 'name', 'partner_id', 'invoice_date', 'invoice_date_due', 'state', 'payment_state', 'amount_total', 'amount_residual', 'currency_id'],
          20
        );

        if (invoices.length > 0) {
          if (entities.position === 'last') {
            invoiceToShow = invoices[0];
          } else if (entities.position === 'first') {
            invoiceToShow = invoices[invoices.length - 1];
          } else if (typeof entities.position === 'number') {
            const idx = entities.position - 1;
            if (idx >= 0 && idx < invoices.length) {
              invoiceToShow = invoices[idx];
            }
          }
        }
      }

      // 3. Fallback: ultima fattura
      if (!invoiceToShow) {
        const invoices = await odoo.searchRead(
          'account.move',
          [
            ['partner_id', '=', context.customerId],
            ['move_type', '=', 'out_invoice']
          ],
          ['id', 'name', 'partner_id', 'invoice_date', 'invoice_date_due', 'state', 'payment_state', 'amount_total', 'amount_residual', 'currency_id'],
          1
        );
        if (invoices.length > 0) invoiceToShow = invoices[0];
      }

      if (!invoiceToShow) {
        return {
          success: false,
          message: 'Non ho trovato fatture nel tuo storico.',
          agentId: 'invoice_detail'
        };
      }

      // Recupera dettagli completi
      const invoiceDetails = await this.invoicesAgent.getInvoiceDetails(invoiceToShow.id);

      if (!invoiceDetails.success || !invoiceDetails.data) {
        return {
          success: false,
          message: 'Errore recuperando i dettagli della fattura.',
          agentId: 'invoice_detail'
        };
      }

      const inv = invoiceDetails.data;
      const paymentStateLabels: Record<string, string> = {
        not_paid: 'Non pagata', in_payment: 'In pagamento',
        paid: 'Pagata', partial: 'Parzialmente pagata'
      };

      // Formatta le righe
      const lines = inv.lines
        .slice(0, 10)
        .map((line: any, idx: number) =>
          `   ${idx + 1}. ${line.name || line.product_id?.[1] || 'Prodotto'}\n      ${line.quantity} × ${line.price_unit.toFixed(2)} = ${line.price_subtotal.toFixed(2)} CHF`
        )
        .join('\n');

      const invoiceUrl = generateInvoiceUrl(inv.id);
      const message = `📄 **Dettagli Fattura ${inv.name}**\n\n` +
        `🔗 [Vedi/Scarica fattura sul portale](${invoiceUrl})\n\n` +
        `👤 Cliente: ${inv.partner_name}\n` +
        `📅 Data: ${inv.invoice_date || 'N/A'}\n` +
        `⏰ Scadenza: ${inv.invoice_date_due || 'N/A'}\n` +
        `📊 Stato: ${paymentStateLabels[inv.payment_state] || inv.payment_state}\n` +
        `💰 Totale: ${inv.currency_id[1]} ${inv.amount_total.toFixed(2)}\n` +
        `💳 Residuo: ${inv.currency_id[1]} ${inv.amount_residual.toFixed(2)}\n\n` +
        `📋 **Righe (${inv.lines.length}):**\n${lines}` +
        (inv.lines.length > 10 ? `\n   ... e altre ${inv.lines.length - 10} righe` : '') +
        `\n\nCosa vuoi fare con questa fattura?`;

      return {
        success: true,
        message,
        data: { ...inv, invoiceUrl },
        agentId: 'invoice_detail',
        confidence: 0.95,
        suggestedActions: [
          'Paga online',
          'Scarica PDF',
          'Altre fatture'
        ]
      };

    } catch (error) {
      console.error('❌ Errore invoiceDetailAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore recuperando i dettagli della fattura.',
        requiresHumanEscalation: true,
        agentId: 'invoice_detail'
      };
    }
  }

  /**
   * Handler per domande di follow-up contestuali
   * Usa Claude per capire a cosa si riferisce il cliente e risponde appropriatamente
   */
  private async followupAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    try {
      // Usa Claude per generare una risposta contestuale basata sulla conversazione
      const systemPrompt = `Sei l'assistente AI di LAPA, distributore di prodotti alimentari italiani in Svizzera.

CONTESTO CONVERSAZIONE:
Il cliente ha fatto una domanda di follow-up che si riferisce a qualcosa discusso prima.
Devi capire a cosa si riferisce e rispondere in modo utile.

REGOLE:
1. Analizza la cronologia per capire il contesto
2. Se il cliente chiede "dettagli" su qualcosa, fornisci più informazioni
3. Se chiede "l'ultimo" o "il primo", riferisciti all'ultima lista mostrata
4. Se chiede di filtrare (es. "quelle da pagare"), applica il filtro
5. Se non sei sicuro, chiedi chiarimenti in modo gentile
6. Rispondi in italiano a meno che il cliente non usi un'altra lingua

CLIENTE: ${(context.customerType === 'b2b' || (context.customerType === 'b2c' && context.customerId)) ? `${context.customerType.toUpperCase()} - ${context.customerName}` : 'Visitatore'}

Rispondi in modo naturale e conversazionale.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: this.buildConversationHistory(context)
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return {
        success: true,
        message: content.text,
        agentId: 'followup',
        confidence: 0.8,
        suggestedActions: [
          'Ordini',
          'Fatture',
          'Spedizioni',
          'Parla con operatore'
        ]
      };

    } catch (error) {
      console.error('❌ Errore followupAgentHandler:', error);

      return {
        success: true,
        message: 'Non ho capito bene a cosa ti riferisci. Puoi essere più specifico? ' +
                 'Posso aiutarti con ordini, fatture, spedizioni o prodotti.',
        agentId: 'followup',
        suggestedActions: [
          'I miei ordini',
          'Le mie fatture',
          'Le mie spedizioni',
          'Cerca prodotti'
        ]
      };
    }
  }

  /**
   * Genera una risposta conversazionale usando Claude basata sui dati forniti
   */
  private async generateConversationalResponse(
    context: CustomerContext,
    topic: string,
    data: any,
    userMessage: string
  ): Promise<string> {
    try {
      const systemPrompt = `Sei l'assistente AI di LAPA, distributore di prodotti alimentari italiani in Svizzera.
Hai appena recuperato dei dati per il cliente e devi comunicarglieli in modo NATURALE e CONVERSAZIONALE.

CLIENTE: ${context.customerName || 'Cliente'}
TIPO: ${context.customerType === 'b2b' ? 'B2B (ristorante/negozio)' : 'B2C (consumatore)'}

ARGOMENTO: ${topic}

DATI RECUPERATI:
${JSON.stringify(data, null, 2)}

REGOLE IMPORTANTI:
1. NON essere robotico o troppo formale
2. Usa un tono amichevole ma professionale
3. Personalizza la risposta usando il nome del cliente se disponibile
4. Se ci sono numeri di telefono, presentali come contatti utili
5. Se ci sono azioni suggerite, menzionale naturalmente nella conversazione
6. NON dire "I dati mostrano..." o "Secondo i dati..." - parla come una persona
7. Usa emoji con moderazione (1-2 max)
8. Se non ci sono dati oggi, sii empatico e offri alternative
9. Fai domande di follow-up per continuare la conversazione
10. Rispondi in italiano a meno che il cliente non usi un'altra lingua

MESSAGGIO ORIGINALE DEL CLIENTE:
"${userMessage}"

Rispondi in modo naturale come se stessi parlando con un amico/cliente.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        temperature: 0.8,
        system: systemPrompt,
        messages: [
          ...this.buildConversationHistory(context).slice(-4), // Ultimi 4 messaggi per contesto
          { role: 'user', content: userMessage }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      return content.text;
    } catch (error) {
      console.error('❌ Errore generazione risposta conversazionale:', error);
      // Fallback: ritorna un messaggio generico
      return `Ho trovato le informazioni che cercavi su ${topic}. Come posso aiutarti ulteriormente?`;
    }
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
- Email: lapa@lapa.ch
- Sito: https://www.lapa.ch
- Indirizzo: Industriestrasse 18, 8424 Embrach, Svizzera

TUO RUOLO:
- Fornisci informazioni utili e accurate sui prodotti e servizi LAPA
- Sii cortese, professionale e disponibile
- Se non sai la risposta, ammettilo e suggerisci di contattare il supporto
- Non inventare informazioni sui prodotti o prezzi
- Rispondi nella lingua del cliente (italiano, tedesco, francese, inglese)

TIPO CLIENTE: ${(context.customerType === 'b2b' || (context.customerType === 'b2c' && context.customerId)) ? `Cliente ${context.customerType.toUpperCase()} autenticato` : 'Visitatore del sito'}

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
