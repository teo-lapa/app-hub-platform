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

DEFINIZIONI INTENTI (con parole chiave tipiche):
- order_inquiry: Domande su ordini esistenti, stato ordini, modifiche (Keywords: ordine, ordini, ordinato, acquisto, SO, order, Bestellung, commande)
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
    // Un utente è veramente autenticato solo se ha customerType='b2b' E un customerId valido
    const isAuthenticated = context.customerType === 'b2b' && context.customerId;

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
      // Un utente è considerato "loggato" solo se ha customerType='b2b' E un customerId valido
      const isAuthenticated = context.customerType === 'b2b' && context.customerId;

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
      // Usa Claude per generare una risposta contestuale
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Errore helpdesk agent:', errorMsg, error);

      return {
        success: false,
        message: `Errore helpdesk: ${errorMsg}`,
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
              const name = product.name;
              const price = product.list_price?.toFixed(2) || '0.00';
              const qty = product.qty_available !== undefined ? product.qty_available : 'N/D';
              const unit = product.uom_id ? product.uom_id[1] : 'pz';
              return `${index + 1}. **${name}**\n   💰 ${price} CHF | 📦 Disponibili: ${qty} ${unit}`;
            })
            .join('\n\n');

          return {
            success: true,
            message: `Ho trovato ${searchResult.data.length} prodotti:\n\n${productsList}`,
            data: searchResult.data,
            agentId: 'product',
            confidence: 0.9,
            suggestedActions: [
              'Ordina prodotto',
              'Vedi altri prodotti',
              'Richiedi preventivo'
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
      // Estrai anche ordini dal messaggio (pattern S12345, SO12345, etc.)
      let trackingId = entities.tracking_number || entities.order_id;

      // Se non trovato nelle entities, cerca pattern nel messaggio dell'ultimo user
      if (!trackingId && context.conversationHistory.length > 0) {
        const lastMsg = context.conversationHistory[context.conversationHistory.length - 1];
        if (lastMsg.role === 'user') {
          const orderMatch = lastMsg.content.match(/\b(S\d{5,}|SO\d{5,})\b/i);
          if (orderMatch) {
            trackingId = orderMatch[1].toUpperCase();
          }
        }
      }

      if (trackingId) {
        // Assicurati che sia una stringa
        const trackingIdStr = String(trackingId);

        const trackingResult = await this.shippingAgent.trackShipment(trackingIdStr);

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
          message: `Non ho trovato spedizioni per l'ordine ${trackingIdStr}. Verifica che il numero sia corretto.`,
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
        'Scrivici a info@lapa.ch'
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

      const message = `📦 **Dettagli Ordine ${orderToShow.name}**\n\n` +
        `👤 Cliente: ${orderToShow.partner_id[1]}\n` +
        `📅 Data: ${orderToShow.date_order}\n` +
        `📊 Stato: ${stateLabels[orderToShow.state] || orderToShow.state}\n` +
        `💰 Totale: ${orderToShow.currency_id[1]} ${orderToShow.amount_total.toFixed(2)}\n\n` +
        `📋 **Prodotti (${orderLines.length}):**\n${productLines}\n\n` +
        `Vuoi altre informazioni su questo ordine?`;

      return {
        success: true,
        message,
        data: { order: orderToShow, lines: orderLines },
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

      const message = `📄 **Dettagli Fattura ${inv.name}**\n\n` +
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
        data: inv,
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

CLIENTE: ${context.customerType === 'b2b' ? `B2B - ${context.customerName}` : 'Visitatore'}

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
- Sito: https://www.lapa.ch
- Indirizzo: Industriestrasse 18, 8424 Embrach, Svizzera

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
