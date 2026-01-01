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
import { getMemoryService, ConversationMemoryService, CustomerMemory } from './memory/conversation-memory';

// URL base per il sito e-commerce
const LAPA_SHOP_URL = process.env.LAPA_SHOP_URL || 'https://lapa.ch';

// ============================================================================
// RECIPE DETECTION - Mappa ricette -> ingredienti chiave
// ============================================================================

interface RecipeInfo {
  name: string;
  ingredients: string[];  // Ingredienti da cercare nel catalogo
  description: string;
}

const RECIPE_MAP: Record<string, RecipeInfo> = {
  // Paste classiche
  'amatriciana': {
    name: 'Amatriciana',
    ingredients: ['guanciale', 'pecorino romano', 'pomodoro', 'peperoncino'],
    description: 'La vera amatriciana con guanciale e pecorino romano'
  },
  'matriciana': {
    name: 'Amatriciana',
    ingredients: ['guanciale', 'pecorino romano', 'pomodoro', 'peperoncino'],
    description: 'La vera amatriciana con guanciale e pecorino romano'
  },
  'alla matriciana': {
    name: 'Amatriciana',
    ingredients: ['guanciale', 'pecorino romano', 'pomodoro', 'peperoncino'],
    description: 'La vera amatriciana con guanciale e pecorino romano'
  },
  "all'amatriciana": {
    name: 'Amatriciana',
    ingredients: ['guanciale', 'pecorino romano', 'pomodoro', 'peperoncino'],
    description: 'La vera amatriciana con guanciale e pecorino romano'
  },
  'carbonara': {
    name: 'Carbonara',
    ingredients: ['guanciale', 'pecorino romano', 'uova', 'pepe nero'],
    description: 'Carbonara autentica con guanciale e pecorino'
  },
  'cacio e pepe': {
    name: 'Cacio e Pepe',
    ingredients: ['pecorino romano', 'pepe nero', 'spaghetto', 'tonnarello'],
    description: 'Cacio e pepe con pecorino romano stagionato'
  },
  'gricia': {
    name: 'Gricia',
    ingredients: ['guanciale', 'pecorino romano', 'pepe nero'],
    description: 'Gricia - la madre della carbonara e amatriciana'
  },
  'arrabbiata': {
    name: 'Arrabbiata',
    ingredients: ['pomodoro', 'aglio', 'peperoncino', 'prezzemolo'],
    description: 'Penne all\'arrabbiata piccanti'
  },
  'puttanesca': {
    name: 'Puttanesca',
    ingredients: ['pomodoro', 'olive', 'capperi', 'acciuga', 'aglio'],
    description: 'Spaghetti alla puttanesca con olive e capperi'
  },
  'norma': {
    name: 'Pasta alla Norma',
    ingredients: ['melanzana', 'pomodoro', 'ricotta salata', 'basilico'],
    description: 'Pasta alla norma siciliana con ricotta salata'
  },
  'pesto': {
    name: 'Pesto alla Genovese',
    ingredients: ['pesto', 'basilico', 'parmigiano', 'pecorino', 'pinoli'],
    description: 'Trofie o trenette al pesto genovese'
  },
  'bolognese': {
    name: 'Ragù alla Bolognese',
    ingredients: ['ragù', 'parmigiano', 'tagliatelle'],
    description: 'Tagliatelle al ragù bolognese'
  },
  'lasagna': {
    name: 'Lasagna',
    ingredients: ['ragù', 'besciamella', 'parmigiano', 'lasagna', 'mozzarella'],
    description: 'Lasagne alla bolognese'
  },
  // Piatti speciali
  'caprese': {
    name: 'Insalata Caprese',
    ingredients: ['mozzarella', 'pomodoro', 'basilico', 'olio extravergine'],
    description: 'Caprese con mozzarella di bufala'
  },
  'tiramisù': {
    name: 'Tiramisù',
    ingredients: ['mascarpone', 'savoiardi', 'caffè', 'cacao'],
    description: 'Tiramisù con mascarpone fresco'
  },
  'tiramisu': {
    name: 'Tiramisù',
    ingredients: ['mascarpone', 'savoiardi', 'caffè', 'cacao'],
    description: 'Tiramisù con mascarpone fresco'
  },
  'risotto milanese': {
    name: 'Risotto alla Milanese',
    ingredients: ['riso', 'zafferano', 'parmigiano', 'burro', 'brodo'],
    description: 'Risotto giallo con zafferano'
  },
  'pizza margherita': {
    name: 'Pizza Margherita',
    ingredients: ['mozzarella', 'pomodoro', 'basilico', 'farina'],
    description: 'Pizza margherita classica'
  },
  'bruschetta': {
    name: 'Bruschetta',
    ingredients: ['pomodoro', 'basilico', 'aglio', 'olio extravergine', 'pane'],
    description: 'Bruschetta al pomodoro fresco'
  },
  // ======== PIATTI DI PESCE E FRUTTI DI MARE ========
  'astice': {
    name: 'Pasta all\'Astice',
    ingredients: ['astice', 'spaghetti alla chitarra', 'pomodoro', 'aglio', 'prezzemolo', 'vino bianco'],
    description: 'Spaghetti alla chitarra con astice fresco'
  },
  'aragosta': {
    name: 'Linguine all\'Aragosta',
    ingredients: ['aragosta', 'linguine', 'pomodorini', 'aglio', 'prezzemolo'],
    description: 'Linguine all\'aragosta catalana'
  },
  'scoglio': {
    name: 'Spaghetti allo Scoglio',
    ingredients: ['cozze', 'vongole', 'gamberi', 'calamari', 'spaghetti', 'pomodoro'],
    description: 'Spaghetti ai frutti di mare misti'
  },
  'frutti di mare': {
    name: 'Pasta ai Frutti di Mare',
    ingredients: ['cozze', 'vongole', 'gamberi', 'calamari', 'spaghetti'],
    description: 'Pasta con mix di frutti di mare'
  },
  'vongole': {
    name: 'Spaghetti alle Vongole',
    ingredients: ['vongole', 'spaghetti', 'aglio', 'prezzemolo', 'vino bianco'],
    description: 'Spaghetti alle vongole veraci'
  },
  'gamberi': {
    name: 'Linguine ai Gamberi',
    ingredients: ['gamberi', 'linguine', 'aglio', 'pomodorini', 'prezzemolo'],
    description: 'Linguine ai gamberi freschi'
  },
  'scampi': {
    name: 'Risotto agli Scampi',
    ingredients: ['scampi', 'riso', 'prosecco', 'scalogno', 'brodo pesce'],
    description: 'Risotto cremoso agli scampi'
  },
  'cozze': {
    name: 'Cozze alla Marinara',
    ingredients: ['cozze', 'pomodoro', 'aglio', 'prezzemolo', 'vino bianco'],
    description: 'Cozze alla marinara con crostini'
  },
  'salmone': {
    name: 'Pasta al Salmone',
    ingredients: ['salmone', 'penne', 'panna', 'aneto', 'limone'],
    description: 'Penne al salmone affumicato'
  },
  'tonno': {
    name: 'Pasta al Tonno',
    ingredients: ['tonno', 'spaghetti', 'pomodoro', 'olive', 'capperi'],
    description: 'Spaghetti al tonno fresco'
  },
  'polpo': {
    name: 'Insalata di Polpo',
    ingredients: ['polpo', 'patate', 'sedano', 'limone', 'prezzemolo'],
    description: 'Insalata tiepida di polpo e patate'
  },
  'calamari': {
    name: 'Calamari Ripieni',
    ingredients: ['calamari', 'pangrattato', 'prezzemolo', 'aglio', 'pomodoro'],
    description: 'Calamari ripieni al forno'
  },
  'baccalà': {
    name: 'Baccalà alla Vicentina',
    ingredients: ['baccalà', 'latte', 'cipolla', 'parmigiano', 'polenta'],
    description: 'Baccalà mantecato con polenta'
  },
  'orata': {
    name: 'Orata al Forno',
    ingredients: ['orata', 'patate', 'pomodorini', 'olive', 'capperi'],
    description: 'Orata al forno con patate'
  },
  'branzino': {
    name: 'Branzino al Sale',
    ingredients: ['branzino', 'sale grosso', 'limone', 'erbe aromatiche'],
    description: 'Branzino in crosta di sale'
  },
  // ======== PIATTI DI CARNE ========
  'ossobuco': {
    name: 'Ossobuco alla Milanese',
    ingredients: ['ossobuco', 'risotto', 'zafferano', 'gremolada'],
    description: 'Ossobuco con risotto giallo'
  },
  'saltimbocca': {
    name: 'Saltimbocca alla Romana',
    ingredients: ['vitello', 'prosciutto crudo', 'salvia', 'vino bianco'],
    description: 'Scaloppine di vitello con prosciutto e salvia'
  },
  'bistecca fiorentina': {
    name: 'Bistecca alla Fiorentina',
    ingredients: ['bistecca', 'olio extravergine', 'rosmarino', 'sale grosso'],
    description: 'Bistecca di manzo alla brace'
  },
  'cotoletta': {
    name: 'Cotoletta alla Milanese',
    ingredients: ['vitello', 'uova', 'pangrattato', 'burro'],
    description: 'Cotoletta impanata e fritta'
  },
  // NOTA: 'porchetta' rimossa perché è un PRODOTTO venduto da LAPA, non solo una ricetta
  // Quando l'utente cerca "porchetta", deve trovare i prodotti PORCHETTA DI ARICCIA, etc.
  'brasato': {
    name: 'Brasato al Barolo',
    ingredients: ['manzo', 'barolo', 'carote', 'sedano', 'cipolla'],
    description: 'Brasato di manzo al vino rosso'
  },
  // ======== PRIMI PIATTI AGGIUNTIVI ========
  'gnocchi': {
    name: 'Gnocchi al Pomodoro',
    ingredients: ['gnocchi', 'pomodoro', 'basilico', 'parmigiano'],
    description: 'Gnocchi di patate al sugo'
  },
  'ravioli': {
    name: 'Ravioli Ricotta e Spinaci',
    ingredients: ['ravioli', 'ricotta', 'spinaci', 'burro', 'salvia'],
    description: 'Ravioli ripieni burro e salvia'
  },
  'tortellini': {
    name: 'Tortellini in Brodo',
    ingredients: ['tortellini', 'brodo', 'parmigiano'],
    description: 'Tortellini bolognesi in brodo di cappone'
  },
  'tagliatelle': {
    name: 'Tagliatelle ai Funghi',
    ingredients: ['tagliatelle', 'funghi porcini', 'panna', 'parmigiano'],
    description: 'Tagliatelle ai porcini freschi'
  },
  'risotto funghi': {
    name: 'Risotto ai Funghi',
    ingredients: ['riso', 'funghi porcini', 'parmigiano', 'burro', 'brodo'],
    description: 'Risotto cremoso ai porcini'
  }
};

/**
 * Rileva se il messaggio contiene una ricetta e restituisce gli ingredienti da cercare
 */
function detectRecipe(message: string): RecipeInfo | null {
  const lowerMessage = message.toLowerCase();

  // Cerca corrispondenze nelle ricette
  for (const [keyword, recipe] of Object.entries(RECIPE_MAP)) {
    if (lowerMessage.includes(keyword)) {
      return recipe;
    }
  }

  return null;
}

/**
 * FOOD KEYWORDS - Lista di termini alimentari comuni per rilevamento veloce
 * Usato per determinare se un messaggio riguarda cibo/prodotti senza chiamare Claude
 */
const FOOD_KEYWORDS = new Set([
  // Pasta e carboidrati
  'pasta', 'spaghetti', 'penne', 'rigatoni', 'tagliatelle', 'linguine', 'fusilli',
  'lasagna', 'gnocchi', 'riso', 'risotto', 'ravioli', 'tortellini', 'fettuccine',
  'paccheri', 'orecchiette', 'pappardelle', 'chitarra',
  // Pesce e frutti di mare
  'pesce', 'astice', 'aragosta', 'gamberi', 'scampi', 'vongole', 'cozze',
  'calamari', 'polpo', 'salmone', 'tonno', 'baccalà', 'orata', 'branzino',
  'merluzzo', 'sogliola', 'spigola', 'seppia', 'frutti di mare',
  // Carne
  'carne', 'manzo', 'vitello', 'maiale', 'pollo', 'tacchino', 'agnello',
  'prosciutto', 'guanciale', 'pancetta', 'salame', 'bresaola', 'speck',
  'bistecca', 'cotoletta', 'ossobuco',  // 'porchetta' rimossa - è un prodotto LAPA
  // Formaggi
  'formaggio', 'mozzarella', 'parmigiano', 'pecorino', 'gorgonzola', 'ricotta',
  'mascarpone', 'burrata', 'grana', 'taleggio', 'fontina', 'provolone',
  // Verdure
  'pomodoro', 'pomodorini', 'basilico', 'aglio', 'cipolla', 'melanzana',
  'zucchine', 'peperoni', 'funghi', 'porcini', 'spinaci', 'carciofi',
  'patate', 'carote', 'sedano', 'rucola', 'insalata',
  // Altri ingredienti
  'olio', 'extravergine', 'aceto', 'balsamico', 'burro', 'panna',
  'uova', 'farina', 'lievito', 'olive', 'capperi', 'peperoncino',
  // Termini generici
  'cucinare', 'preparare', 'ricetta', 'piatto', 'cena', 'pranzo',
  'ingredienti', 'fare', 'voglio fare', 'mi serve', 'ho bisogno'
]);

/**
 * Rileva se un messaggio riguarda cibo/prodotti alimentari
 * Controllo veloce senza chiamare Claude
 */
function isFoodRelatedMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const keywordsArray = Array.from(FOOD_KEYWORDS);
  for (let i = 0; i < keywordsArray.length; i++) {
    if (lowerMessage.includes(keywordsArray[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Estrae keywords di prodotti/ingredienti da un messaggio usando pattern matching
 * Fallback veloce quando Claude non è disponibile o per ottimizzazione
 */
function extractFoodKeywordsLocal(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const foundKeywords: string[] = [];

  // Pattern per estrarre termini alimentari specifici
  const foodPatterns = [
    // Frutti di mare specifici
    /\b(astice|aragosta|gamberi?|scampi?|vongole?|cozze?|calamari?|polpo|salmone|tonno|baccalà|orata|branzino|merluzzo)\b/gi,
    // Tipi di pasta
    /\b(spaghetti?|penne|rigatoni|tagliatelle|linguine|fusilli|lasagne?|gnocchi|ravioli|tortellini|fettuccine|paccheri|orecchiette|pappardelle)\b/gi,
    // Spaghetti alla chitarra - pattern specifico
    /\b(spaghetti?\s+alla\s+chitarra|chitarra)\b/gi,
    // Formaggi
    /\b(mozzarella|parmigiano|pecorino|gorgonzola|ricotta|mascarpone|burrata|grana)\b/gi,
    // Carni e salumi
    /\b(guanciale|pancetta|prosciutto|bresaola|speck|vitello|manzo|maiale|pollo|agnello)\b/gi,
    // Verdure comuni
    /\b(pomodor[oi]|pomodorini|funghi|porcini|melanzane?|zucchine?|carciofi?|spinaci)\b/gi,
  ];

  for (const pattern of foodPatterns) {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.toLowerCase().trim();
        if (!foundKeywords.includes(normalized)) {
          foundKeywords.push(normalized);
        }
      }
    }
  }

  return foundKeywords;
}

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

/**
 * Formatta una data ISO (YYYY-MM-DD) in formato italiano leggibile (es. "31 dic 2025")
 * IMPORTANTE: Questa funzione pre-formatta le date per evitare errori di interpretazione da parte di Claude
 */
function formatDateIT(isoDate: string | false | null | undefined): string {
  if (!isoDate) return 'N/A';

  try {
    // Parse della data ISO (es. "2025-12-31")
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(parts[2], 10);

    // Mesi in italiano abbreviati
    const mesiIT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

    // Formato: "31 dic 2025"
    return `${day} ${mesiIT[month]} ${year}`;
  } catch (error) {
    console.error('Errore formattazione data:', error);
    return isoDate;
  }
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
    originalMessage?: string; // Messaggio originale dell'utente
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
  metadata?: Record<string, any>;
  data?: any;  // Per salvare dati come pending_products per selezioni successive
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
  | 'cart_add'             // Aggiungere prodotto al carrello (preventivo draft)
  | 'cart_view'            // Vedere il carrello
  | 'cart_remove'          // Rimuovere prodotto dal carrello
  | 'cart_confirm'         // Confermare il carrello/ordine
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

  // Memoria persistente
  private memoryService: ConversationMemoryService | null = null;
  private memoryEnabled: boolean = false;

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

    // Inizializza memoria persistente (se configurata)
    this.initializeMemory();

    // Register default agents
    this.registerDefaultAgents();
  }

  // ============================================================================
  // MEMORY MANAGEMENT
  // ============================================================================

  /**
   * Inizializza il servizio di memoria persistente (Vercel KV / Upstash Redis)
   */
  private initializeMemory(): void {
    try {
      // Check if any Redis/KV is configured:
      // - Vercel KV: KV_REST_API_URL, KV_URL
      // - Upstash: UPSTASH_REDIS_REST_URL, KV_REST_API_URL
      const hasKV = process.env.KV_REST_API_URL ||
                    process.env.KV_URL ||
                    process.env.UPSTASH_REDIS_REST_URL ||
                    process.env.REDIS_URL;

      if (hasKV) {
        this.memoryService = getMemoryService();
        this.memoryEnabled = true;
        console.log('🧠 Memoria persistente ATTIVATA (Redis/KV)');
      } else {
        console.log('⚠️ Memoria persistente DISATTIVATA (Redis/KV non configurato)');
        this.memoryEnabled = false;
      }
    } catch (error) {
      console.error('❌ Errore inizializzazione memoria:', error);
      this.memoryEnabled = false;
    }
  }

  /**
   * Carica la memoria del cliente e arricchisce il contesto
   */
  private async loadCustomerMemory(context: CustomerContext): Promise<string> {
    if (!this.memoryEnabled || !this.memoryService || !context.customerId) {
      return '';
    }

    try {
      const memory = await this.memoryService.loadMemory(context.customerId);
      if (memory) {
        return this.memoryService.getContextForAI(memory);
      }
    } catch (error) {
      console.error('❌ Errore caricamento memoria:', error);
    }
    return '';
  }

  /**
   * Salva un messaggio nella memoria persistente
   */
  private async saveToMemory(
    context: CustomerContext,
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      agentId?: string;
      intent?: string;
      products_shown?: string[];
      recipe_detected?: string;
    }
  ): Promise<void> {
    if (!this.memoryEnabled || !this.memoryService || !context.customerId) {
      return;
    }

    try {
      await this.memoryService.addMessage(
        context.customerId,
        context.customerName || 'Cliente',
        context.customerType,
        context.sessionId,
        {
          role,
          content,
          timestamp: new Date().toISOString(),
          metadata
        }
      );
    } catch (error) {
      console.error('❌ Errore salvataggio memoria:', error);
    }
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
   * ESTRAZIONE DINAMICA KEYWORDS ALIMENTARI
   * Usa Claude (modello veloce) per estrarre termini di prodotti da cercare in Odoo
   *
   * Esempio: "voglio fare astice con spaghetti alla chitarra per domani"
   * Output: ["astice", "spaghetti alla chitarra"]
   */
  async extractFoodKeywordsWithAI(message: string): Promise<string[]> {
    // Prima prova con estrazione locale veloce
    const localKeywords = extractFoodKeywordsLocal(message);

    // Se troviamo keywords locali, usiamole (più veloce)
    if (localKeywords.length > 0) {
      console.log(`🔍 Keywords estratte localmente: ${localKeywords.join(', ')}`);
      return localKeywords;
    }

    // Se nessun match locale e il messaggio sembra food-related, usa Claude
    if (!isFoodRelatedMessage(message)) {
      return [];
    }

    try {
      console.log('🤖 Estrazione keywords con Claude...');

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022', // Modello veloce e economico
        max_tokens: 256,
        temperature: 0,
        system: `Sei un assistente per un negozio di prodotti alimentari italiani.
Estrai i nomi di prodotti alimentari, ingredienti o tipi di cibo dal messaggio dell'utente.

REGOLE:
- Estrai SOLO termini di cibo/prodotti che l'utente vuole acquistare o cercare
- Mantieni i termini nella forma che useresti per cercare in un catalogo (es. "spaghetti alla chitarra", non "spaghetti")
- NON includere quantità, date, o azioni (es. "domani", "fare", "preparare")
- Se non ci sono prodotti alimentari, rispondi con array vuoto

Rispondi SOLO con un JSON array di stringhe, esempio: ["astice", "spaghetti alla chitarra"]`,
        messages: [{
          role: 'user',
          content: message
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      // Parse JSON response
      const text = content.text.trim();
      const jsonMatch = text.match(/\[.*\]/s);
      if (jsonMatch) {
        const keywords = JSON.parse(jsonMatch[0]) as string[];
        console.log(`🤖 Keywords estratte con Claude: ${keywords.join(', ')}`);
        return keywords.filter(k => k && k.length > 1);
      }

      return [];
    } catch (error) {
      console.error('⚠️ Errore estrazione keywords AI:', error);
      return [];
    }
  }

  /**
   * Recupera i prodotti acquistati dal cliente che matchano una keyword
   * Usato per prioritizzare prodotti già acquistati nella ricerca
   */
  private async getCustomerPurchasedProductsMatching(
    context: CustomerContext,
    keyword: string
  ): Promise<Array<{
    id: number;
    name: string;
    totalQty: number;
    orderCount: number;
    lastDate: string;
  }>> {
    if (!context.customerId) {
      return [];
    }

    try {
      const odooClient = this.odooClient;
      if (!odooClient || !odooClient.searchRead) {
        console.warn('⚠️ Odoo client non disponibile per storico acquisti');
        return [];
      }

      // Trova ordini del cliente
      const orders = await odooClient.searchRead(
        'sale.order',
        [
          ['partner_id', '=', context.customerId],
          ['state', 'in', ['sale', 'done']]
        ],
        ['id', 'name', 'date_order'],
        100
      );

      if (orders.length === 0) {
        return [];
      }

      const orderIds = orders.map((o: any) => o.id);
      const orderMap = new Map<number, { date_order: string }>(
        orders.map((o: any) => [o.id, { date_order: o.date_order }])
      );

      // Recupera le righe d'ordine
      const orderLines = await odooClient.searchRead(
        'sale.order.line',
        [['order_id', 'in', orderIds]],
        ['product_id', 'order_id', 'product_uom_qty'],
        1000
      );

      // Filtra per keyword nel nome prodotto
      const lowerKeyword = keyword.toLowerCase();
      const matchingLines = orderLines.filter((line: any) => {
        if (!line.product_id) return false;
        const productName = line.product_id[1].toLowerCase();
        return productName.includes(lowerKeyword);
      });

      if (matchingLines.length === 0) {
        return [];
      }

      // Aggrega per prodotto
      const productMap = new Map<number, {
        id: number;
        name: string;
        totalQty: number;
        lastDate: string;
        orderSet: Set<number>;
      }>();

      for (const line of matchingLines) {
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
            orderSet: new Set()
          });
        }

        const prod = productMap.get(productId)!;
        prod.totalQty += line.product_uom_qty;
        prod.orderSet.add(line.order_id[0]);

        if (order.date_order > prod.lastDate) {
          prod.lastDate = order.date_order;
        }
      }

      // Ordina per frequenza acquisti (più ordinati prima)
      const results = Array.from(productMap.values())
        .map(p => ({
          id: p.id,
          name: p.name,
          totalQty: p.totalQty,
          orderCount: p.orderSet.size,
          lastDate: p.lastDate
        }))
        .sort((a, b) => b.orderCount - a.orderCount);

      console.log(`📦 Trovati ${results.length} prodotti acquistati per "${keyword}": ${results.map(p => p.name).join(', ')}`);
      return results;

    } catch (error) {
      console.error('⚠️ Errore recupero storico acquisti:', error);
      return [];
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
  "type": "cart_add" | "cart_view" | "cart_remove" | "cart_confirm" | "order_create" | "order_inquiry" | "invoice_inquiry" | "shipping_inquiry" | "product_inquiry" | "account_management" | "helpdesk" | "pricing_quote" | "complaint" | "general_info" | "unknown",
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
- cart_add: AGGIUNGERE prodotto al carrello, mettere prodotto nel carrello. PRIORITÀ MASSIMA quando l'utente dice "aggiungimi", "mettimi", "aggiungi al carrello", O quando seleziona un prodotto con "il primo", "1", "secondo", etc. (Keywords: aggiungimi, mettimi, aggiungi, aggiungi al carrello, metti nel carrello, lo voglio, lo prendo, me lo metti, aggiungi questo, add to cart, in den Warenkorb, ajouter au panier, il primo, primo, secondo, terzo, 1, 2, 3)
- cart_view: VEDERE il carrello, cosa c'è nel carrello (Keywords: carrello, vedi carrello, mostra carrello, cosa ho nel carrello, cosa c'è nel carrello, my cart, Warenkorb anzeigen, voir panier)
- cart_remove: RIMUOVERE prodotto dal carrello (Keywords: togli, rimuovi, elimina dal carrello, remove from cart, aus dem Warenkorb entfernen, retirer du panier)
- cart_confirm: CONFERMARE l'ordine/carrello, procedere all'acquisto (Keywords: conferma ordine, conferma carrello, procedi, checkout, finalizza, conferma, bestätigen, confirmer)
- order_create: Richiesta generica di CREARE un ordine senza specificare prodotti (Keywords: creare ordine, fare ordine, voglio ordinare genericamente, order erstellen, passer commande)
- order_inquiry: Domande su ordini esistenti, stato ordini, modifiche, prodotti acquistati, storico acquisti (Keywords: ordine, ordini, ordinato, acquisto, acquistato, comprato, storico, ultimi prodotti, cosa ho comprato, quando ho comprato, SO, order, Bestellung, commande, purchased, gekauft, acheté)
- order_detail: Richiesta DETTAGLI di un ordine specifico (Keywords: dettagli ordine, mostrami l'ordine, più info su ordine)
- invoice_inquiry: Domande su fatture, pagamenti, estratti conto, saldo (Keywords: fattura, fatture, pagamento, saldo, INV, invoice, Rechnung, facture)
- invoice_detail: Richiesta DETTAGLI di una fattura specifica (Keywords: dettagli fattura, mostrami la fattura)
- invoice_filter: Richiesta di FILTRARE le fatture (Keywords: da pagare, non pagate, aperte, pagate, scadute)
- shipping_inquiry: Domande su spedizioni, tracking, consegne, dove si trova la merce (Keywords: spedizione, spedizioni, consegna, tracking, traccia, tracciare, DDT, dove, arriva, delivery, Lieferung, livraison)
- product_inquiry: Domande su prodotti, catalogo, disponibilità, prezzi prodotti, QUALSIASI richiesta di cibo/ingredienti per cucinare, ricette, preparazione piatti. USA QUESTO INTENTO quando l'utente chiede ingredienti o vuole preparare un piatto! (Keywords: prodotto, prodotti, catalogo, disponibile, cerco, mi serve, ho bisogno, voglio fare, preparare, cucinare, ricetta, ingredienti, pasta, spaghetti, penne, lasagna, risotto, mozzarella, parmigiano, prosciutto, formaggio, astice, aragosta, gamberi, scampi, pesce, carne, verdure, pomodoro, olio)
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

    // Ordinal selection (for cart product selection: "il primo", "1", "secondo", etc.)
    // HIGHEST PRIORITY - users selecting from a product list
    if (lowerMessage.match(/^(il |la )?(primo|prima|secondo|seconda|terzo|terza|quarto|quarta|quinto|quinta|1|2|3|4|5|uno|due|tre|quattro|cinque)\.?$/i)) {
      return {
        type: 'cart_add',
        confidence: 0.95,
        requiresAuth: true
      };
    }

    // Cart add keywords (HIGHEST PRIORITY - must come first)
    if (lowerMessage.match(/aggiungimi|mettimi|aggiungi.*carrell|metti.*carrell|lo voglio|lo prendo|me lo metti|add to cart|in den warenkorb|ajouter au panier/i)) {
      return {
        type: 'cart_add',
        confidence: 0.9,
        requiresAuth: true
      };
    }

    // Cart view keywords
    if (lowerMessage.match(/vedi.*carrell|mostra.*carrell|cosa.*carrell|nel carrello|my cart|warenkorb anzeigen|voir panier/i)) {
      return {
        type: 'cart_view',
        confidence: 0.9,
        requiresAuth: true
      };
    }

    // Cart remove keywords
    if (lowerMessage.match(/togli.*carrell|rimuovi.*carrell|elimina.*carrell|remove from cart/i)) {
      return {
        type: 'cart_remove',
        confidence: 0.9,
        requiresAuth: true
      };
    }

    // Cart confirm keywords
    if (lowerMessage.match(/conferma.*ordine|conferma.*carrell|procedi|checkout|finalizza|bestätigen|confirmer/i)) {
      return {
        type: 'cart_confirm',
        confidence: 0.9,
        requiresAuth: true
      };
    }

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

    // Product keywords - include food/ingredient terms
    if (lowerMessage.match(/prodotto|catalogo|disponibil|prezzo|product|price/i)) {
      return {
        type: 'product_inquiry',
        confidence: 0.7,
        requiresAuth: false
      };
    }

    // Food/cooking related - should trigger product search
    if (isFoodRelatedMessage(message)) {
      return {
        type: 'product_inquiry',
        confidence: 0.75,
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

      // 🧠 Salva messaggio utente nella memoria persistente
      await this.saveToMemory(context, 'user', message);

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

      // 5. Aggiungi la risposta alla cronologia (includi data per pending_products, ecc.)
      this.addMessage(context, {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        agentId: response.agentId,
        data: response.data  // Salva anche data per selezioni successive (pending_products)
      } as Message);

      // 🧠 Salva risposta AI nella memoria persistente
      await this.saveToMemory(context, 'assistant', response.message, {
        agentId: response.agentId,
        intent: intent.type,
        products_shown: response.data?.map?.((p: any) => p.name)?.slice?.(0, 5)
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

    // CART AGENT - Gestisce il carrello conversazionale (preventivo draft Odoo)
    this.registerAgent({
      id: 'cart',
      name: 'Cart Agent',
      description: 'Gestisce il carrello conversazionale - aggiunge, rimuove, mostra e conferma prodotti',
      intents: ['cart_add', 'cart_view', 'cart_remove', 'cart_confirm'],
      requiresAuth: true,
      priority: 10, // Alta priorità per gestione carrello
      handler: async (context, intent) => {
        return await this.cartAgentHandler(context, intent);
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
      // IMPORTANTE: Controlla anche gli ultimi 5 messaggi per gestire il caso in cui l'utente
      // chiede un ticket e poi fornisce l'email in un messaggio successivo
      const ticketKeywordRegex = /operatore|umano|persona reale|parlare con qualcuno|ticket|contatt.*umano|voglio.*assistenza|passami.*operatore|aprimi|aprire|crea.*ticket|open.*ticket/i;
      const problemKeywordRegex = /reclamo|non funziona|errore grave|urgente|emergenza/i;

      const wantsHumanOperator = ticketKeywordRegex.test(userMessage);
      const hasExplicitProblem = problemKeywordRegex.test(userMessage);

      // Controlla anche i messaggi recenti (ultimi 5) per capire se l'utente aveva già chiesto un ticket
      const recentUserMessages = userMessages.slice(-5);
      const recentMessagesText = recentUserMessages.map(m => m.content?.toLowerCase() || '').join(' ');
      const recentlyRequestedTicket = ticketKeywordRegex.test(recentMessagesText) || problemKeywordRegex.test(recentMessagesText);

      // Keyword generiche che NON devono creare ticket automatico
      // "aiuto", "help", "problema", "assistenza" sono troppo generiche
      // Usa hasKeywords per il messaggio corrente, recentlyRequestedTicket per la conversazione
      const hasKeywords = wantsHumanOperator || hasExplicitProblem || recentlyRequestedTicket;

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

        // 1. Recupera TUTTI i dati del cliente da Odoo (incluso venditore)
        let customerData: any = null;
        let salespersonName: string | null = null;
        let salespersonPhone: string | null = null;
        try {
          const odooClient = await getOdooClient();
          const partners = await odooClient.searchRead(
            'res.partner',
            [['id', '=', context.customerId]],
            ['name', 'email', 'phone', 'mobile', 'street', 'street2', 'city', 'zip', 'country_id', 'vat', 'ref', 'company_id', 'parent_id', 'category_id', 'property_payment_term_id', 'sale_order_count', 'total_invoiced', 'comment', 'user_id'],
            1
          );
          if (partners && partners.length > 0) {
            customerData = partners[0];
            // Recupera nome e telefono del venditore
            if (customerData.user_id) {
              salespersonName = customerData.user_id[1];
              const salespersonId = customerData.user_id[0];
              try {
                const users = await odooClient.read('res.users', [salespersonId], ['partner_id']);
                if (users && users.length > 0 && users[0].partner_id) {
                  const salesPartners = await odooClient.read('res.partner', [users[0].partner_id[0]], ['phone', 'mobile']);
                  if (salesPartners && salesPartners.length > 0) {
                    salespersonPhone = salesPartners[0].mobile || salesPartners[0].phone;
                  }
                }
              } catch (e) {
                console.warn('⚠️ Impossibile recuperare telefono venditore:', e);
              }
            }
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
          // Messaggio personalizzato con nome venditore
          const salespersonInfo = salespersonName
            ? `${salespersonName}, il tuo referente commerciale,`
            : 'Il nostro team';
          const salespersonContact = salespersonPhone
            ? `\n• 📞 ${salespersonName}: ${salespersonPhone}`
            : '';

          return {
            success: true,
            message: `✅ Ho creato il ticket **#${ticketResult.ticketId}** con tutti i tuoi dati.\n\n` +
                     `${salespersonInfo} ti contatterà presto a:\n` +
                     `• 📧 ${email}\n` +
                     `• 📞 ${telefono}${salespersonContact}\n\n` +
                     `Per urgenze: lapa@lapa.ch | +41 76 361 70 21`,
            agentId: 'helpdesk',
            confidence: 1.0,
            requiresHumanEscalation: true,
            data: { ticketId: ticketResult.ticketId, customerId: context.customerId, customerName: nome, customerEmail: email, salesperson: salespersonName },
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

      // Se il cliente NON è loggato E vuole ESPLICITAMENTE supporto/ticket - controlla se ha fornito i dati di contatto
      // Se non vuole supporto, lascia passare e restituisci la risposta di Claude
      if (!context.customerId && hasKeywords) {
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

      // ========================================
      // RECIPE DETECTION - Cerca ingredienti per ricette
      // MA PRIMA: cerca il termine stesso come prodotto!
      // ========================================
      console.log(`🔍 Recipe detection check - Message: "${lastUserMsg}"`);
      const recipe = detectRecipe(lastUserMsg);
      console.log(`🔍 Recipe detection result: ${recipe ? recipe.name : 'null'}`);

      if (recipe) {
        console.log(`🍝 Ricetta rilevata: ${recipe.name} - Ingredienti: ${recipe.ingredients.join(', ')}`);

        // ========================================
        // IMPORTANTE: Prima cerca il nome della ricetta come PRODOTTO DIRETTO
        // Es: "porchetta" potrebbe essere un prodotto in vendita, non solo una ricetta
        // ========================================
        const recipeNameLower = Object.keys(RECIPE_MAP).find(key =>
          lastUserMsg.toLowerCase().includes(key)
        );

        if (recipeNameLower) {
          console.log(`🔍 Ricerca diretta prodotto per: ${recipeNameLower}`);
          // NOTA: active_only: false per trovare TUTTI i prodotti con questo nome,
          // anche quelli temporaneamente non attivi/vendibili
          const directProductSearch = await this.productsAgent.searchProducts(
            { query: recipeNameLower, active_only: false },
            10
          );

          if (directProductSearch.success && directProductSearch.data && directProductSearch.data.length > 0) {
            // Trovati prodotti diretti! (es: "Porchetta di Ariccia" invece di ingredienti)
            console.log(`✅ Trovati ${directProductSearch.data.length} prodotti diretti per "${recipeNameLower}"`);

            // Prepara dati prodotti trovati
            const productsData = directProductSearch.data.map((product: any) => {
              const templateId = product.product_tmpl_id ? product.product_tmpl_id[0] : product.id;
              const qty = product.qty_available || 0;
              const isAvailable = qty > 0;
              return {
                name: product.name,
                price: `${product.list_price?.toFixed(2) || '0.00'} CHF`,
                qty_available: qty,
                unit: product.uom_id ? product.uom_id[1] : 'pz',
                url: generateProductUrl(templateId, product.name),
                disponibile_subito: isAvailable,
                disponibilita_testo: isAvailable
                  ? `✅ Disponibile (${qty} ${product.uom_id ? product.uom_id[1] : 'pz'})`
                  : `⏳ Ordinabile su richiesta`
              };
            });

            const directMessage = await this.generateConversationalResponse(
              context,
              'prodotto ricercato',
              {
                search_term: recipeNameLower,
                products: productsData,
                total_found: productsData.length,
                customer_name: context.customerName
              },
              lastUserMsg
            );

            return {
              success: true,
              message: directMessage,
              data: directProductSearch.data,
              agentId: 'product',
              confidence: 0.95,
              suggestedActions: ['Aggiungi al carrello', 'Cerca altro', 'Chiedi un preventivo']
            };
          }
        }

        // Se non trovati prodotti diretti, cerca gli ingredienti della ricetta
        console.log(`📝 Nessun prodotto diretto trovato, cerco ingredienti per: ${recipe.name}`);

        // Cerca TUTTI gli ingredienti della ricetta
        const allProducts: any[] = [];
        const ingredientResults: Record<string, any[]> = {};

        for (const ingredient of recipe.ingredients) {
          const searchResult = await this.productsAgent.searchProducts(
            { query: ingredient, active_only: true },
            5  // Max 5 prodotti per ingrediente
          );

          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            ingredientResults[ingredient] = searchResult.data;
            allProducts.push(...searchResult.data);
          } else {
            ingredientResults[ingredient] = [];
          }
        }

        // Prepara dati per la risposta - raggruppa per ingrediente
        const recipeProductsData: any[] = [];
        const foundIngredients: string[] = [];
        const missingIngredients: string[] = [];

        for (const [ingredient, products] of Object.entries(ingredientResults)) {
          if (products.length > 0) {
            foundIngredients.push(ingredient);
            // Aggiungi i primi 2 prodotti per ogni ingrediente
            products.slice(0, 2).forEach((product: any) => {
              const templateId = product.product_tmpl_id ? product.product_tmpl_id[0] : product.id;
              const qty = product.qty_available || 0;
              const isAvailable = qty > 0;
              recipeProductsData.push({
                name: product.name,
                ingredient: ingredient,
                price: `${product.list_price?.toFixed(2) || '0.00'} CHF`,
                qty_available: qty,
                unit: product.uom_id ? product.uom_id[1] : 'pz',
                url: generateProductUrl(templateId, product.name),
                disponibile_subito: isAvailable,
                disponibilita_testo: isAvailable
                  ? `✅ Disponibile (${qty} ${product.uom_id ? product.uom_id[1] : 'pz'})`
                  : `⏳ Ordinabile su richiesta`
              });
            });
          } else {
            missingIngredients.push(ingredient);
          }
        }

        // Genera risposta conversazionale per la ricetta
        const recipeMessage = await this.generateConversationalResponse(
          context,
          'ricetta ingredienti',
          {
            recipe_name: recipe.name,
            recipe_description: recipe.description,
            products: recipeProductsData,
            found_ingredients: foundIngredients,
            missing_ingredients: missingIngredients,
            total_products: recipeProductsData.length,
            customer_name: context.customerName
          },
          lastUserMsg
        );

        return {
          success: true,
          message: recipeMessage,
          data: allProducts,
          agentId: 'product',
          confidence: 0.95,
          suggestedActions: [
            `Ordina tutto per ${recipe.name}`,
            'Cerca altro',
            'Chiedi un preventivo'
          ]
        };
      }

      // ========================================
      // DYNAMIC KEYWORD EXTRACTION - Estrae keywords quando non c'è ricetta specifica
      // ========================================
      console.log('🔍 Tentativo estrazione dinamica keywords...');
      const extractedKeywords = await this.extractFoodKeywordsWithAI(lastUserMsg);

      if (extractedKeywords.length > 0) {
        console.log(`✅ Keywords estratte: ${extractedKeywords.join(', ')}`);

        // Cerca prodotti per ogni keyword - PRIORITA' STORICO ACQUISTI
        const allProducts: any[] = [];
        const keywordResults: Record<string, any[]> = {};
        const purchasedProductIds = new Set<number>(); // Per evitare duplicati

        for (const keyword of extractedKeywords) {
          // 1️⃣ PRIMA: Cerca nello storico acquisti del cliente
          const purchasedProducts = await this.getCustomerPurchasedProductsMatching(context, keyword);
          const prioritizedProducts: any[] = [];

          if (purchasedProducts.length > 0) {
            console.log(`📦 Priorità storico: trovati ${purchasedProducts.length} prodotti già acquistati per "${keyword}"`);

            // Recupera dettagli completi (prezzo, disponibilità) per prodotti già acquistati
            for (const purchased of purchasedProducts) {
              if (purchasedProductIds.has(purchased.id)) continue; // Skip duplicati

              // Cerca dettagli prodotto nel catalogo
              const detailResult = await this.productsAgent.searchProducts(
                { query: purchased.name, active_only: true },
                5
              );

              if (detailResult.success && detailResult.data) {
                // Trova il prodotto esatto per ID o nome
                const exactMatch = detailResult.data.find((p: any) =>
                  p.id === purchased.id || p.name === purchased.name
                );

                if (exactMatch) {
                  // Aggiungi info storico acquisti (cast a any per proprietà custom)
                  const enrichedProduct = exactMatch as any;
                  enrichedProduct._fromPurchaseHistory = true;
                  enrichedProduct._purchaseCount = purchased.orderCount;
                  enrichedProduct._totalPurchased = purchased.totalQty;
                  prioritizedProducts.push(enrichedProduct);
                  purchasedProductIds.add(enrichedProduct.id);
                }
              }
            }
          }

          // 2️⃣ POI: Cerca nel catalogo generale
          const searchResult = await this.productsAgent.searchProducts(
            { query: keyword, active_only: true },
            20
          );

          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            // Filtra prodotti non già inclusi dallo storico
            const catalogProducts = searchResult.data.filter((p: any) =>
              !purchasedProductIds.has(p.id) && p.qty_available > 0
            );

            // Combina: prima prodotti acquistati, poi catalogo
            const combinedProducts = [...prioritizedProducts, ...catalogProducts];

            if (combinedProducts.length > 0) {
              keywordResults[keyword] = combinedProducts;
              allProducts.push(...combinedProducts);
            } else if (searchResult.data.length > 0) {
              // Se nessun prodotto disponibile, mostra comunque i primi ma come "ordinabili"
              keywordResults[keyword] = searchResult.data.slice(0, 3);
              allProducts.push(...searchResult.data.slice(0, 3));
            }
          } else if (prioritizedProducts.length > 0) {
            // Solo prodotti dallo storico
            keywordResults[keyword] = prioritizedProducts;
            allProducts.push(...prioritizedProducts);
          } else {
            keywordResults[keyword] = [];
          }
        }

        // Prepara dati per la risposta - raggruppa per keyword
        const productsData: any[] = [];
        const foundKeywords: string[] = [];
        const missingKeywords: string[] = [];

        for (const [keyword, products] of Object.entries(keywordResults)) {
          if (products.length > 0) {
            foundKeywords.push(keyword);
            // Aggiungi TUTTI i prodotti per ogni keyword (max 8 per non sovraccaricare)
            products.slice(0, 8).forEach((product: any) => {
              const templateId = product.product_tmpl_id ? product.product_tmpl_id[0] : product.id;
              const qty = product.qty_available || 0;
              const isAvailable = qty > 0;
              const fromHistory = product._fromPurchaseHistory === true;
              const purchaseCount = product._purchaseCount || 0;

              // Costruisci testo disponibilità con info storico acquisti
              let disponibilita = isAvailable
                ? `✅ Disponibile (${qty} ${product.uom_id ? product.uom_id[1] : 'pz'})`
                : `⏳ Ordinabile su richiesta`;

              // Aggiungi badge se già acquistato
              if (fromHistory && purchaseCount > 0) {
                disponibilita = `⭐ GIÀ ACQUISTATO (${purchaseCount} volte) - ${disponibilita}`;
              }

              productsData.push({
                name: product.name,
                keyword: keyword,
                price: `${product.list_price?.toFixed(2) || '0.00'} CHF`,
                qty_available: qty,
                unit: product.uom_id ? product.uom_id[1] : 'pz',
                url: generateProductUrl(templateId, product.name),
                disponibile_subito: isAvailable,
                gia_acquistato: fromHistory,
                volte_acquistato: purchaseCount,
                disponibilita_testo: disponibilita
              });
            });
          } else {
            missingKeywords.push(keyword);
          }
        }

        // Genera risposta conversazionale
        const keywordsMessage = await this.generateConversationalResponse(
          context,
          'ricerca prodotti multipla',
          {
            search_keywords: extractedKeywords,
            products: productsData,
            found_keywords: foundKeywords,
            missing_keywords: missingKeywords,
            total_products: productsData.length,
            customer_name: context.customerName
          },
          lastUserMsg
        );

        // Crea suggested actions per i prodotti disponibili
        const availableForOrder = productsData.filter(p => p.disponibile_subito);
        const orderActions = availableForOrder.slice(0, 2).map((p: any) => {
          const shortName = p.name.split(' ').slice(0, 3).join(' ');
          return `Aggiungi ${shortName}`;
        });

        return {
          success: true,
          message: keywordsMessage,
          data: allProducts,
          agentId: 'product',
          confidence: 0.9,
          suggestedActions: [
            ...orderActions,
            'Aggiungi tutto al carrello',
            'Cerca altro'
          ]
        };
      }

      // ========================================
      // STANDARD PRODUCT SEARCH (no recipe, no dynamic keywords)
      // ========================================

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
            const qty = product.qty_available || 0;
            const isAvailable = qty > 0;
            return {
              name: product.name,
              price: `${product.list_price?.toFixed(2) || '0.00'} CHF`,
              qty_available: qty,
              unit: product.uom_id ? product.uom_id[1] : 'pz',
              url: generateProductUrl(templateId, product.name),
              // Info disponibilità
              disponibile_subito: isAvailable,
              disponibilita_testo: isAvailable
                ? `✅ Disponibile subito (${qty} ${product.uom_id ? product.uom_id[1] : 'pz'} in stock) - consegna domani`
                : `⏳ Ordinabile su richiesta - consegna in 2-7 giorni`
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
   * Handler per il carrello conversazionale
   * Gestisce aggiunta, rimozione, visualizzazione e conferma del carrello (preventivo draft Odoo)
   */
  private async cartAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    // Verifica autenticazione
    if (!context.customerId) {
      return {
        success: false,
        message: 'Per gestire il carrello devi prima effettuare il login.',
        requiresHumanEscalation: false,
        agentId: 'cart',
        suggestedActions: ['Effettua il login', 'Vai al sito web']
      };
    }

    try {
      const odoo = await getOdooClient();
      const customerId = context.customerId;

      // Prendi il messaggio originale dell'utente
      const userMessages = context.conversationHistory.filter(m => m.role === 'user');
      const userMessage = userMessages[userMessages.length - 1]?.content || '';
      const lowerMessage = userMessage.toLowerCase();

      console.log('🛒 cartAgentHandler:', { intent: intent.type, userMessage: userMessage.substring(0, 100) });

      // Gestisci i diversi tipi di intent
      switch (intent.type) {
        case 'cart_add':
          return await this.handleCartAdd(context, odoo, userMessage, intent);

        case 'cart_view':
          return await this.handleCartView(context, odoo);

        case 'cart_remove':
          return await this.handleCartRemove(context, odoo, userMessage, intent);

        case 'cart_confirm':
          return await this.handleCartConfirm(context, odoo);

        default:
          return await this.handleCartView(context, odoo);
      }
    } catch (error) {
      console.error('❌ Errore cartAgentHandler:', error);
      return {
        success: false,
        message: 'Si è verificato un errore con il carrello. Riprova o contatta il supporto.',
        requiresHumanEscalation: true,
        agentId: 'cart'
      };
    }
  }

  /**
   * Gestisce l'aggiunta di prodotti al carrello
   * Supporta richieste come: "aggiungimi un guanciale, 1 kg di pecorino romano e un litro di uovo"
   */
  private async handleCartAdd(
    context: CustomerContext,
    odoo: any,
    userMessage: string,
    intent: Intent
  ): Promise<AgentResponse> {
    const customerId = context.customerId!;

    console.log('🛒 handleCartAdd - userMessage:', userMessage);

    // PRIMA: Controlla se l'utente sta selezionando da pending_products (es: "il primo", "1", "2")
    const ordinalSelection = this.parseOrdinalSelection(userMessage);
    console.log('🛒 parseOrdinalSelection result:', ordinalSelection, 'for message:', userMessage);

    if (ordinalSelection >= 0) {
      const pendingProducts = this.extractPendingProductsFromConversation(context);
      console.log('🛒 Ordinal selection:', ordinalSelection, 'pendingProducts:', pendingProducts.length);
      console.log('🛒 Context history length:', context.conversationHistory.length);
      console.log('🛒 Last messages data:', context.conversationHistory.slice(-3).map(m => ({ role: m.role, hasData: !!m.data, dataKeys: m.data ? Object.keys(m.data) : [] })));

      if (pendingProducts.length > 0 && ordinalSelection < pendingProducts.length) {
        const selectedProduct = pendingProducts[ordinalSelection];
        console.log('🛒 Selected product from pending:', selectedProduct.name);

        try {
          const result = await this.addProductToCart(odoo, customerId, selectedProduct, 1, context.customerName);
          const cartUrl = generateOrderUrl(result.data.cart_id, result.data.cart_name);

          return {
            success: true,
            message: `✅ **${selectedProduct.name}** aggiunto al carrello!\n\n🛒 **Carrello (${result.data.cart_name}):**\n- ${result.data.item_count} articoli\n- Totale: CHF ${result.data.total.toFixed(2)}\n\n[Vedi carrello](${cartUrl})`,
            agentId: 'cart',
            data: result.data,
            suggestedActions: ['Aggiungi altro', 'Vedi carrello', 'Conferma ordine']
          };
        } catch (err) {
          console.error('❌ Errore aggiunta prodotto selezionato:', err);
          return {
            success: false,
            message: `Non sono riuscito ad aggiungere ${selectedProduct.name} al carrello. Riprova.`,
            agentId: 'cart',
            suggestedActions: ['Riprova', 'Cerca altro prodotto']
          };
        }
      }
    }

    // Estrai i prodotti menzionati dal messaggio usando parsing intelligente
    const extractedProducts = this.extractProductsFromMessage(userMessage);

    console.log('🛒 Extracted products:', extractedProducts);

    // Se abbiamo estratto prodotti dal messaggio, cercali in Odoo
    if (extractedProducts.length > 0) {
      const addedProducts: string[] = [];
      const notFoundProducts: string[] = [];
      let lastCartInfo: any = null;

      for (const extracted of extractedProducts) {
        // Cerca il prodotto in Odoo
        const products = await odoo.searchRead(
          'product.product',
          [
            '|',
            ['name', 'ilike', extracted.name],
            ['default_code', 'ilike', extracted.name],
            ['sale_ok', '=', true]
          ],
          ['id', 'name', 'list_price', 'uom_id', 'product_tmpl_id'],
          3
        );

        if (products.length > 0) {
          // Prendi il prodotto più rilevante (primo risultato)
          const product = products[0];
          const qty = extracted.quantity || 1;

          try {
            const result = await this.addProductToCart(odoo, customerId, product, qty, context.customerName);
            addedProducts.push(`${qty}x ${product.name}`);
            lastCartInfo = result.data;
          } catch (err) {
            console.error('Errore aggiunta prodotto:', err);
            notFoundProducts.push(extracted.name);
          }
        } else {
          notFoundProducts.push(extracted.name);
        }
      }

      // Costruisci il messaggio di risposta
      if (addedProducts.length > 0) {
        let message = `✅ **Prodotti aggiunti al carrello:**\n\n`;
        addedProducts.forEach(p => {
          message += `• ${p}\n`;
        });

        if (notFoundProducts.length > 0) {
          message += `\n⚠️ **Non trovati:** ${notFoundProducts.join(', ')}\n`;
        }

        if (lastCartInfo) {
          const cartUrl = generateOrderUrl(lastCartInfo.cart_id, lastCartInfo.cart_name);
          message += `\n🛒 **Carrello (${lastCartInfo.cart_name}):**\n`;
          message += `- ${lastCartInfo.item_count} articoli\n`;
          message += `- Totale: CHF ${lastCartInfo.total.toFixed(2)}\n\n`;
          message += `[Vedi carrello](${cartUrl})`;
        }

        return {
          success: true,
          message,
          agentId: 'cart',
          data: lastCartInfo,
          suggestedActions: notFoundProducts.length > 0
            ? ['Cerca ' + notFoundProducts[0], 'Vedi carrello', 'Conferma ordine']
            : ['Aggiungi altro', 'Vedi carrello', 'Conferma ordine']
        };
      }
    }

    // Se non abbiamo estratto prodotti, prova con l'entity dall'intent o cerca prodotti recenti
    const productName = intent.entities?.product_name;

    if (!productName) {
      // Cerca nei prodotti mostrati recentemente nella conversazione
      const recentProducts = this.extractRecentProductsFromConversation(context);

      if (recentProducts.length === 0) {
        return {
          success: false,
          message: 'Quale prodotto vuoi aggiungere al carrello? Dimmi il nome del prodotto.',
          agentId: 'cart',
          suggestedActions: ['Cerca un prodotto', 'Mostra catalogo']
        };
      }

      // Se c'è un solo prodotto recente, chiedi conferma
      if (recentProducts.length === 1) {
        return {
          success: true,
          message: `Vuoi aggiungere **${recentProducts[0].name}** al carrello? Quanti ne vuoi?`,
          agentId: 'cart',
          data: { pending_product: recentProducts[0] },
          suggestedActions: ['1', '2', '5', 'Altro prodotto']
        };
      }
    }

    // Cerca il prodotto in Odoo
    const searchTerms = (productName || userMessage).toLowerCase();
    const products = await odoo.searchRead(
      'product.product',
      [
        '|',
        ['name', 'ilike', searchTerms],
        ['default_code', 'ilike', searchTerms],
        ['sale_ok', '=', true]
      ],
      ['id', 'name', 'list_price', 'uom_id', 'product_tmpl_id'],
      5
    );

    if (products.length === 0) {
      return {
        success: false,
        message: `Non ho trovato prodotti corrispondenti a "${searchTerms}". Prova con un altro nome.`,
        agentId: 'cart',
        suggestedActions: ['Cerca un altro prodotto', 'Mostra catalogo']
      };
    }

    if (products.length === 1) {
      // Un solo prodotto trovato - aggiungi direttamente con quantità 1
      return await this.addProductToCart(odoo, customerId, products[0], 1, context.customerName);
    }

    // Più prodotti trovati - chiedi quale
    let message = 'Ho trovato questi prodotti:\n\n';
    products.forEach((p: any, idx: number) => {
      const url = generateProductUrl(p.product_tmpl_id?.[0] || p.id, p.name);
      message += `${idx + 1}. **${p.name}** - CHF ${p.list_price.toFixed(2)} - [Vedi](${url})\n`;
    });
    message += '\nQuale vuoi aggiungere al carrello?';

    return {
      success: true,
      message,
      agentId: 'cart',
      data: { pending_products: products },
      suggestedActions: products.slice(0, 3).map((p: any) => p.name.substring(0, 20))
    };
  }

  /**
   * Estrae prodotti e quantità da un messaggio in linguaggio naturale
   * Es: "aggiungimi un guanciale, 1 kg di pecorino romano e un litro di uovo"
   */
  private extractProductsFromMessage(message: string): Array<{name: string, quantity: number, unit?: string}> {
    const products: Array<{name: string, quantity: number, unit?: string}> = [];

    // Rimuovi le parole chiave di aggiunta
    let cleanMessage = message.toLowerCase()
      .replace(/aggiungimi|mettimi|aggiungi|metti|lo voglio|lo prendo|me lo metti|al carrello|nel carrello/gi, '')
      .trim();

    // Se il messaggio è vuoto dopo la pulizia, non c'è nulla da estrarre
    if (!cleanMessage) return products;

    // Dividi per virgole, "e", "poi"
    const parts = cleanMessage.split(/\s*[,e]\s*|\s+poi\s+/i).filter(p => p.trim());

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Pattern per estrarre quantità e prodotto
      // Es: "1 kg di pecorino romano", "un guanciale", "2 mozzarelle", "un litro di uovo"
      const patterns = [
        // "1 kg di prodotto" o "1kg di prodotto"
        /^(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|litro|litri|ml|pz|pezzi|conf|confezioni?)\s+(?:di\s+)?(.+)$/i,
        // "un/una prodotto" o "un chilo di prodotto"
        /^(?:un|una|uno)\s+(kg|chilo|kilo|litro|litri?|l)\s+(?:di\s+)?(.+)$/i,
        // "un/una prodotto"
        /^(?:un|una|uno|il|la|lo|i|gli|le)\s+(.+)$/i,
        // "2 prodotti" (numero + prodotto)
        /^(\d+)\s+(.+)$/i,
        // Solo nome prodotto
        /^(.+)$/i
      ];

      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          if (pattern === patterns[0]) {
            // Pattern con quantità e unità
            const qty = parseFloat(match[1].replace(',', '.'));
            const unit = match[2];
            const name = match[3].trim();
            if (name.length > 1) {
              products.push({ name, quantity: qty, unit });
              break;
            }
          } else if (pattern === patterns[1]) {
            // Pattern "un chilo di..."
            const unit = match[1];
            const name = match[2].trim();
            if (name.length > 1) {
              products.push({ name, quantity: 1, unit });
              break;
            }
          } else if (pattern === patterns[2]) {
            // Pattern "un prodotto"
            const name = match[1].trim();
            if (name.length > 1) {
              products.push({ name, quantity: 1 });
              break;
            }
          } else if (pattern === patterns[3]) {
            // Pattern "2 prodotti"
            const qty = parseInt(match[1]);
            const name = match[2].trim();
            if (name.length > 1) {
              products.push({ name, quantity: qty });
              break;
            }
          } else {
            // Solo nome
            const name = match[1].trim();
            if (name.length > 1) {
              products.push({ name, quantity: 1 });
              break;
            }
          }
        }
      }
    }

    return products;
  }

  /**
   * Aggiunge un prodotto al carrello (crea o aggiorna preventivo draft)
   */
  private async addProductToCart(
    odoo: any,
    customerId: number,
    product: any,
    quantity: number,
    customerName?: string
  ): Promise<AgentResponse> {
    try {
      // Cerca un preventivo draft esistente per questo cliente
      let carts = await odoo.searchRead(
        'sale.order',
        [
          ['partner_id', '=', customerId],
          ['state', '=', 'draft']
        ],
        ['id', 'name', 'order_line', 'amount_total'],
        1
      );

      let cartId: number;
      let cartName: string;
      let isNewCart = false;

      if (carts.length === 0) {
        // Crea un nuovo preventivo
        const newCartIds = await odoo.create('sale.order', [{
          partner_id: customerId,
          state: 'draft'
        }]);
        cartId = newCartIds[0];
        isNewCart = true;

        const newCart = await odoo.searchRead(
          'sale.order',
          [['id', '=', cartId]],
          ['name']
        );
        cartName = newCart[0]?.name || `S${cartId}`;
      } else {
        cartId = carts[0].id;
        cartName = carts[0].name;
      }

      // Controlla se il prodotto è già nel carrello
      const existingLines = await odoo.searchRead(
        'sale.order.line',
        [
          ['order_id', '=', cartId],
          ['product_id', '=', product.id]
        ],
        ['id', 'product_uom_qty']
      );

      if (existingLines.length > 0) {
        // Aggiorna la quantità
        const newQty = existingLines[0].product_uom_qty + quantity;
        await odoo.write('sale.order.line', [existingLines[0].id], {
          product_uom_qty: newQty
        });
      } else {
        // Aggiungi nuova riga
        await odoo.create('sale.order.line', [{
          order_id: cartId,
          product_id: product.id,
          product_uom_qty: quantity
        }]);
      }

      // Recupera il carrello aggiornato
      const updatedCart = await odoo.searchRead(
        'sale.order',
        [['id', '=', cartId]],
        ['order_line', 'amount_total']
      );

      // Conta gli articoli
      const itemCount = updatedCart[0]?.order_line?.length || 0;
      const total = updatedCart[0]?.amount_total || 0;

      const productUrl = generateProductUrl(product.product_tmpl_id?.[0] || product.id, product.name);
      const cartUrl = generateOrderUrl(cartId, cartName);

      let message = `✅ **${product.name}** aggiunto al carrello!\n\n`;
      message += `📦 Quantità: ${quantity}\n`;
      message += `💰 Prezzo: CHF ${product.list_price.toFixed(2)}\n\n`;
      message += `🛒 **Carrello (${cartName}):**\n`;
      message += `- ${itemCount} articoli\n`;
      message += `- Totale: CHF ${total.toFixed(2)}\n\n`;
      message += `[Vedi carrello](${cartUrl})`;

      return {
        success: true,
        message,
        agentId: 'cart',
        data: {
          cart_id: cartId,
          cart_name: cartName,
          product_added: product.name,
          quantity,
          total,
          item_count: itemCount
        },
        suggestedActions: ['Aggiungi altro', 'Vedi carrello', 'Conferma ordine']
      };
    } catch (error) {
      console.error('❌ Errore addProductToCart:', error);
      throw error;
    }
  }

  /**
   * Mostra il contenuto del carrello
   */
  private async handleCartView(
    context: CustomerContext,
    odoo: any
  ): Promise<AgentResponse> {
    const customerId = context.customerId!;

    const carts = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', customerId],
        ['state', '=', 'draft']
      ],
      ['id', 'name', 'order_line', 'amount_total', 'amount_untaxed'],
      1
    );

    if (carts.length === 0) {
      return {
        success: true,
        message: '🛒 Il tuo carrello è vuoto.\n\nVuoi cercare qualche prodotto?',
        agentId: 'cart',
        suggestedActions: ['Cerca un prodotto', 'Mostra catalogo']
      };
    }

    const cart = carts[0];
    const cartUrl = generateOrderUrl(cart.id, cart.name);

    if (!cart.order_line || cart.order_line.length === 0) {
      return {
        success: true,
        message: `🛒 Il tuo carrello (${cart.name}) è vuoto.\n\n[Vedi carrello](${cartUrl})`,
        agentId: 'cart',
        suggestedActions: ['Cerca un prodotto', 'Mostra catalogo']
      };
    }

    // Recupera i dettagli delle righe
    const lines = await odoo.searchRead(
      'sale.order.line',
      [['id', 'in', cart.order_line]],
      ['product_id', 'product_uom_qty', 'price_unit', 'price_subtotal', 'product_uom']
    );

    let message = `🛒 **Il tuo carrello (${cart.name}):**\n\n`;

    for (const line of lines) {
      const productName = line.product_id?.[1] || 'Prodotto';
      const qty = line.product_uom_qty;
      const uom = line.product_uom?.[1] || 'pz';
      const subtotal = line.price_subtotal;

      message += `• **${productName}**\n`;
      message += `  ${qty} ${uom} × CHF ${line.price_unit.toFixed(2)} = CHF ${subtotal.toFixed(2)}\n\n`;
    }

    message += `---\n`;
    message += `**Totale: CHF ${cart.amount_total.toFixed(2)}**\n\n`;
    message += `[Vedi carrello completo](${cartUrl})`;

    return {
      success: true,
      message,
      agentId: 'cart',
      data: {
        cart_id: cart.id,
        cart_name: cart.name,
        items: lines.map((l: any) => ({
          product_name: l.product_id?.[1],
          quantity: l.product_uom_qty,
          subtotal: l.price_subtotal
        })),
        total: cart.amount_total
      },
      suggestedActions: ['Aggiungi altro', 'Rimuovi prodotto', 'Conferma ordine']
    };
  }

  /**
   * Rimuove un prodotto dal carrello
   */
  private async handleCartRemove(
    context: CustomerContext,
    odoo: any,
    userMessage: string,
    intent: Intent
  ): Promise<AgentResponse> {
    const customerId = context.customerId!;
    const productName = intent.entities?.product_name;

    // Trova il carrello
    const carts = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', customerId],
        ['state', '=', 'draft']
      ],
      ['id', 'name', 'order_line'],
      1
    );

    if (carts.length === 0 || !carts[0].order_line?.length) {
      return {
        success: true,
        message: '🛒 Il tuo carrello è già vuoto.',
        agentId: 'cart'
      };
    }

    const cart = carts[0];

    // Recupera le righe per trovare il prodotto
    const lines = await odoo.searchRead(
      'sale.order.line',
      [['id', 'in', cart.order_line]],
      ['id', 'product_id', 'product_uom_qty']
    );

    if (!productName) {
      // Chiedi quale prodotto rimuovere
      let message = 'Quale prodotto vuoi rimuovere dal carrello?\n\n';
      lines.forEach((line: any, idx: number) => {
        message += `${idx + 1}. ${line.product_id?.[1]} (${line.product_uom_qty} pz)\n`;
      });

      return {
        success: true,
        message,
        agentId: 'cart',
        data: { cart_lines: lines },
        suggestedActions: lines.slice(0, 3).map((l: any) => l.product_id?.[1]?.substring(0, 15))
      };
    }

    // Trova la riga corrispondente
    const matchingLine = lines.find((l: any) =>
      l.product_id?.[1]?.toLowerCase().includes(productName.toLowerCase())
    );

    if (!matchingLine) {
      return {
        success: false,
        message: `Non ho trovato "${productName}" nel tuo carrello.`,
        agentId: 'cart'
      };
    }

    // Rimuovi la riga
    await odoo.unlink('sale.order.line', [matchingLine.id]);

    return {
      success: true,
      message: `✅ **${matchingLine.product_id?.[1]}** rimosso dal carrello.`,
      agentId: 'cart',
      suggestedActions: ['Vedi carrello', 'Aggiungi altro', 'Conferma ordine']
    };
  }

  /**
   * Conferma il carrello e lo trasforma in ordine
   */
  private async handleCartConfirm(
    context: CustomerContext,
    odoo: any
  ): Promise<AgentResponse> {
    const customerId = context.customerId!;

    const carts = await odoo.searchRead(
      'sale.order',
      [
        ['partner_id', '=', customerId],
        ['state', '=', 'draft']
      ],
      ['id', 'name', 'order_line', 'amount_total'],
      1
    );

    if (carts.length === 0) {
      return {
        success: false,
        message: '🛒 Non hai un carrello da confermare. Aggiungi prima dei prodotti!',
        agentId: 'cart',
        suggestedActions: ['Cerca un prodotto', 'Mostra catalogo']
      };
    }

    const cart = carts[0];

    if (!cart.order_line || cart.order_line.length === 0) {
      return {
        success: false,
        message: '🛒 Il tuo carrello è vuoto. Aggiungi prima dei prodotti!',
        agentId: 'cart',
        suggestedActions: ['Cerca un prodotto', 'Mostra catalogo']
      };
    }

    // Conferma l'ordine
    await odoo.call('sale.order', 'action_confirm', [[cart.id]]);

    const orderUrl = generateOrderUrl(cart.id, cart.name);

    return {
      success: true,
      message: `✅ **Ordine ${cart.name} confermato!**\n\n` +
        `💰 Totale: CHF ${cart.amount_total.toFixed(2)}\n` +
        `📦 Riceverai una conferma via email\n\n` +
        `[Vedi dettagli ordine](${orderUrl})\n\n` +
        `Grazie per il tuo ordine! 🙏`,
      agentId: 'cart',
      data: {
        order_id: cart.id,
        order_name: cart.name,
        total: cart.amount_total
      },
      suggestedActions: ['Traccia spedizione', 'Nuovo ordine', 'Contatta supporto']
    };
  }

  /**
   * Estrae prodotti menzionati recentemente dalla conversazione
   */
  private extractRecentProductsFromConversation(context: CustomerContext): Array<{id: number, name: string}> {
    const products: Array<{id: number, name: string}> = [];

    // Cerca nei metadata dei messaggi recenti
    const recentMessages = context.conversationHistory.slice(-5);
    for (const msg of recentMessages) {
      if (msg.role === 'assistant' && (msg as any).metadata?.products_shown) {
        // I prodotti sono già stati mostrati - possiamo estrarli
        const shown = (msg as any).metadata.products_shown;
        if (Array.isArray(shown)) {
          products.push(...shown);
        }
      }
    }

    return products;
  }

  /**
   * Estrae pending_products dalla risposta precedente (per selezione con "il primo", "1", ecc.)
   */
  private extractPendingProductsFromConversation(context: CustomerContext): any[] {
    // Cerca l'ultimo messaggio assistant che ha pending_products nei data
    const recentMessages = context.conversationHistory.slice(-5).reverse();

    for (const msg of recentMessages) {
      if (msg.role === 'assistant' && msg.data) {
        // Cerca pending_products nei data del messaggio
        if (msg.data.pending_products && Array.isArray(msg.data.pending_products)) {
          console.log('🛒 Found pending_products in conversation:', msg.data.pending_products.length);
          return msg.data.pending_products;
        }
      }
    }

    console.log('🛒 No pending_products found in conversation');
    return [];
  }

  /**
   * Interpreta una selezione ordinale o numerica
   * "il primo" -> 0, "il secondo" -> 1, "1" -> 0, "2" -> 1, etc.
   * Returns -1 if no ordinal found
   */
  private parseOrdinalSelection(message: string): number {
    const lower = message.toLowerCase().trim();

    // Direct numbers
    if (/^[1-9]$/.test(lower)) {
      return parseInt(lower) - 1;
    }

    // Italian ordinals
    const ordinalMap: Record<string, number> = {
      'primo': 0, 'il primo': 0, 'la prima': 0, '1°': 0, 'uno': 0,
      'secondo': 1, 'il secondo': 1, 'la seconda': 1, '2°': 1, 'due': 1,
      'terzo': 2, 'il terzo': 2, 'la terza': 2, '3°': 2, 'tre': 2,
      'quarto': 3, 'il quarto': 3, 'la quarta': 3, '4°': 3, 'quattro': 3,
      'quinto': 4, 'il quinto': 4, 'la quinta': 4, '5°': 4, 'cinque': 4,
    };

    for (const [key, value] of Object.entries(ordinalMap)) {
      if (lower === key || lower.includes(key)) {
        return value;
      }
    }

    return -1;
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
                       `Data: ${formatDateIT(inv.invoice_date)}\n` +
                       `Scadenza: ${formatDateIT(inv.invoice_date_due)}\n` +
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
          date: formatDateIT(inv.invoice_date),           // Pre-formattato per evitare errori Claude
          due_date: formatDateIT(inv.invoice_date_due),   // Pre-formattato per evitare errori Claude
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

      // Se c'è un customerId, controlla se chiede consegne passate/recenti o di oggi
      if (context.customerId) {
        // Ottieni l'ultimo messaggio dell'utente per contesto
        const lastUserMsg = context.conversationHistory
          .filter(m => m.role === 'user')
          .pop()?.content || '';

        // Verifica se chiede consegne passate/recenti (ieri, ultimo ordine, storico, etc.)
        const asksPastDeliveries = /\b(ieri|ultimo|ultim[oa]|passato|passata|storico|recente|recent[ei]|settimana|giorni fa|non.*consegnato|non.*arrivato)\b/i.test(lastUserMsg);

        if (asksPastDeliveries) {
          // Utente chiede di consegne passate - usa getRecentDeliveries
          const recentResult = await this.shippingAgent.getRecentDeliveries(context.customerId, 14);

          if (recentResult.success && recentResult.data) {
            const recentData = recentResult.data;

            // Genera risposta conversazionale con Claude
            const conversationalMessage = await this.generateConversationalResponse(
              context,
              'consegne recenti/passate',
              {
                deliveries: recentData.deliveries,
                total: recentData.total,
                customer_name: context.customerName,
                period: 'ultimi 14 giorni'
              },
              lastUserMsg
            );

            return {
              success: true,
              message: conversationalMessage,
              data: recentData,
              agentId: 'shipping',
              confidence: 0.9,
              suggestedActions: [
                'Consegne di oggi',
                'Ordini futuri',
                'Traccia ordine specifico'
              ]
            };
          }
        }

        // Default: mostra le consegne di OGGI
        const activeResult = await this.shippingAgent.getActiveDeliveries(context.customerId);

        if (activeResult.success && activeResult.data) {
          const activeData = activeResult.data;

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
            lastUserMsg || 'Dove sono le mie consegne?'
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
   * LOGICA: Prima cerca di risolvere, poi escalation al venditore se necessario
   */
  private async complaintAgentHandler(
    context: CustomerContext,
    intent: Intent
  ): Promise<AgentResponse> {
    const lastUserMsg = context.conversationHistory
      .filter(m => m.role === 'user')
      .pop()?.content || '';

    // Verifica se il cliente vuole ESPLICITAMENTE parlare con qualcuno
    const wantsHuman = /\b(parlare con|operatore|umano|persona|chiama|ticket|assistenza)\b/i.test(lastUserMsg);

    // Se il cliente è identificato e NON chiede esplicitamente un umano,
    // proviamo prima a risolvere mostrando le consegne recenti
    if (context.customerId && !wantsHuman) {
      // Problema con prodotto/consegna? Mostra le consegne recenti
      const isProdottoIssue = /\b(prodotto|arrivato|consegna|manca|mancante|non.*ricevuto|ordine)\b/i.test(lastUserMsg);

      if (isProdottoIssue) {
        // Recupera consegne recenti per aiutare
        const recentResult = await this.shippingAgent.getRecentDeliveries(context.customerId, 14);

        if (recentResult.success && recentResult.data && recentResult.data.deliveries?.length > 0) {
          const deliveries = recentResult.data.deliveries;

          // Genera risposta conversazionale
          const conversationalMessage = await this.generateConversationalResponse(
            context,
            'problema con prodotto/consegna',
            {
              issue_type: 'prodotto non arrivato',
              deliveries: deliveries,
              total: deliveries.length,
              customer_name: context.customerName
            },
            lastUserMsg
          );

          return {
            success: true,
            message: conversationalMessage,
            data: { deliveries, attempted_resolution: true },
            agentId: 'complaint',
            confidence: 0.85,
            suggestedActions: [
              'Quale ordine ha il problema?',
              'Voglio parlare con qualcuno',
              'Apri un ticket'
            ]
          };
        }
      }
    }

    // Se il cliente vuole parlare con qualcuno O non siamo riusciti a risolvere
    // Recupera il venditore del cliente e crea ticket
    if (context.customerId) {
      try {
        const odoo = await getOdooClient();

        // Recupera il venditore assegnato al cliente
        const customers = await odoo.read(
          'res.partner',
          [context.customerId],
          ['user_id', 'name']
        );

        if (customers && customers.length > 0 && customers[0].user_id) {
          const salespersonId = customers[0].user_id[0];
          const salespersonName = customers[0].user_id[1];

          // Recupera telefono del venditore
          let salespersonPhone = null;
          try {
            const users = await odoo.read('res.users', [salespersonId], ['partner_id']);
            if (users && users.length > 0 && users[0].partner_id) {
              const partners = await odoo.read('res.partner', [users[0].partner_id[0]], ['phone', 'mobile']);
              if (partners && partners.length > 0) {
                salespersonPhone = partners[0].mobile || partners[0].phone;
              }
            }
          } catch (e) {
            console.warn('[Complaint] Errore recupero telefono venditore:', e);
          }

          // Crea ticket assegnato al venditore
          try {
            const ticketData = {
              name: `[Chat AI] ${context.customerName || 'Cliente'} - Problema prodotto`,
              partner_id: context.customerId,
              user_id: salespersonId,
              description: `Problema segnalato via chat:\n${lastUserMsg}\n\nConversazione:\n${context.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`,
              priority: '2'
            };

            // Cerca il modello helpdesk.ticket
            const ticketId = await odoo.create('helpdesk.ticket', [ticketData]);
            console.log(`[Complaint] Ticket #${ticketId} creato e assegnato a ${salespersonName}`);
          } catch (ticketError) {
            console.warn('[Complaint] Non è stato possibile creare il ticket:', ticketError);
          }

          // Risposta personalizzata con nome venditore
          const phoneInfo = salespersonPhone ? ` al ${salespersonPhone}` : '';

          return {
            success: true,
            message: `Mi dispiace per il problema. Ho inoltrato la tua segnalazione a ${salespersonName}, il tuo referente commerciale. Ti contatterà a breve${phoneInfo} per risolvere la situazione.`,
            requiresHumanEscalation: true,
            agentId: 'complaint',
            confidence: 1.0,
            data: { salesperson: salespersonName, salesperson_phone: salespersonPhone },
            suggestedActions: [
              `Chiama ${salespersonName}${phoneInfo}`,
              'Scrivi a lapa@lapa.ch'
            ]
          };
        }
      } catch (error) {
        console.error('[Complaint] Errore recupero venditore:', error);
      }
    }

    // Fallback se non c'è cliente o venditore
    return {
      success: true,
      message: 'Mi dispiace per il problema riscontrato. ' +
               'Puoi contattarci direttamente a lapa@lapa.ch o chiamare il nostro servizio clienti.',
      requiresHumanEscalation: true,
      agentId: 'complaint',
      confidence: 1.0,
      suggestedActions: [
        'Scrivi a lapa@lapa.ch',
        'Chiama +41 91 123 45 67'
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
          `   📅 Scadenza: ${formatDateIT(inv.invoice_date_due)} | 💰 ${inv.currency_id[1]} ${inv.amount_total.toFixed(2)} | ` +
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

      // Formatta le righe - usa solo il nome prodotto, senza descrizione lunga
      const lines = inv.lines
        .slice(0, 10)
        .map((line: any, idx: number) => {
          // Usa il nome prodotto dal campo product_id, oppure solo la prima riga di line.name
          const productName = line.product_id?.[1] || line.name?.split('\n')[0] || 'Prodotto';
          return `   ${idx + 1}. ${productName}\n      ${line.quantity} × ${line.price_unit.toFixed(2)} = ${line.price_subtotal.toFixed(2)} CHF`;
        })
        .join('\n');

      const invoiceUrl = generateInvoiceUrl(inv.id);
      const message = `📄 **Dettagli Fattura ${inv.name}**\n\n` +
        `🔗 [Vedi/Scarica fattura sul portale](${invoiceUrl})\n\n` +
        `👤 Cliente: ${inv.partner_name}\n` +
        `📅 Data: ${formatDateIT(inv.invoice_date)}\n` +
        `⏰ Scadenza: ${formatDateIT(inv.invoice_date_due)}\n` +
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
      // 🧠 Carica memoria persistente del cliente
      const customerMemory = await this.loadCustomerMemory(context);

      const systemPrompt = `Sei l'assistente AI di LAPA - finest italian food GmbH, il principale distributore di prodotti alimentari italiani in Svizzera.
Hai appena recuperato dei dati per il cliente e devi comunicarglieli in modo NATURALE e CONVERSAZIONALE.

INFORMAZIONI LAPA (usa quando rilevante):
- Sede: Embrach (Canton Zurigo) + hub a Losanna e Lugano
- Oltre 3.000 prodotti italiani sempre disponibili
- Consegna 6 giorni su 7, stessa giornata per ordini entro le 7:00
- NESSUN ORDINE MINIMO - ordina anche 1 solo prodotto
- Spedizione GRATIS sopra 200 CHF

VANTAGGI B2B (per ristoratori/pizzerie):
- Food cost ottimizzato 28-32% anche con ingredienti DOP/IGP
- Guanciale Amatriciano IGP: 28-32 CHF/kg (vs 38-45 altrove = risparmio 25%)
- Farine: Caputo, Dallagiovanna - professionali per vera pizza napoletana
- Pomodori San Marzano DOP, Mozzarella di Bufala, Burrata freschissima
- Consegne giornaliere = prodotti SEMPRE freschi, zero sprechi
- Account manager dedicato per clienti B2B

CLIENTE: ${context.customerName || 'Cliente'}
TIPO: ${context.customerType === 'b2b' ? 'B2B (ristorante/negozio)' : 'B2C (consumatore)'}
${customerMemory ? `\n🧠 MEMORIA CLIENTE (conversazioni precedenti):\n${customerMemory}\n` : ''}
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
11. ⚠️ NON MANDARE MAI il cliente al supermercato! LAPA vende di tutto - proponi SEMPRE alternative dai prodotti LAPA
12. Se un prodotto è esaurito, proponi SEMPRE alternative simili dal catalogo LAPA (es. pasta secca invece di fresca)
13. Se nei dati ci sono più prodotti, mostrarli TUTTI - il cliente vuole vedere le opzioni disponibili
14. 🔗 Per i PRODOTTI: usa SEMPRE link markdown cliccabili! Formato: [👉 Vedi NOME_PRODOTTO](URL_PRODOTTO) - il cliente deve poter cliccare!
15. 📦 DISPONIBILITÀ: usa sempre il campo "disponibilita_testo" per indicare se è disponibile subito (consegna domani) o ordinabile (2-7 giorni)
16. 🍝 RICETTE: Se l'argomento è "ricetta ingredienti", mostra TUTTI i prodotti raggruppati per ingrediente. Esempio: "Per la **Amatriciana** ti servono: **Guanciale**: [prodotto1], [prodotto2]... **Pecorino**: [prodotto1]..." etc. Mostra TUTTO quello che abbiamo!
17. 🧠 MEMORIA: Se c'è la sezione "MEMORIA CLIENTE", USALA! Ricorda quello che il cliente ha cercato/comprato prima. Se ha già visto un prodotto prima, menzionalo ("Come ti avevo mostrato prima...", "Hai già visto il nostro guanciale..."). Questo rende la conversazione FLUIDA come con un umano che si ricorda di te!

MESSAGGIO ORIGINALE DEL CLIENTE:
"${userMessage}"

Rispondi in modo naturale come se stessi parlando con un amico/cliente.`;

      // Retry logic - fino a 2 tentativi
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🔄 Tentativo ${attempt}/2 per generazione risposta...`);

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

          console.log(`✅ Risposta generata con successo al tentativo ${attempt}`);
          return content.text;
        } catch (attemptError) {
          lastError = attemptError as Error;
          console.error(`⚠️ Tentativo ${attempt} fallito:`, attemptError);

          // Aspetta 500ms prima del retry
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // Se tutti i tentativi falliscono, usa fallback con dati formattati
      console.error('❌ Tutti i tentativi di generazione risposta falliti:', lastError);

      // Genera una risposta strutturata dai dati invece del messaggio generico
      if (data && data.products && data.products.length > 0) {
        return this.formatProductsAsFallback(data.products, topic);
      }

      return `Ho trovato le informazioni che cercavi su ${topic}. Come posso aiutarti ulteriormente?`;
    } catch (error) {
      console.error('❌ Errore critico in generateConversationalResponse:', error);
      return `Ho trovato le informazioni che cercavi su ${topic}. Come posso aiutarti ulteriormente?`;
    }
  }

  /**
   * Formatta i prodotti come fallback quando la generazione AI fallisce
   */
  private formatProductsAsFallback(products: any[], topic: string): string {
    const lines: string[] = [];
    lines.push(`Ecco i prodotti disponibili per "${topic}":\n`);

    for (const product of products) {
      const name = product.name || 'Prodotto';
      const price = product.price || 'N/A';
      const disponibilita = product.disponibilita_testo || '';
      const url = product.url || '';

      lines.push(`• **${name}** - ${price}`);
      if (disponibilita) {
        lines.push(`  ${disponibilita}`);
      }
      if (url) {
        lines.push(`  [👉 Vedi prodotto](${url})`);
      }
      lines.push('');
    }

    lines.push('Posso aiutarti con altro?');
    return lines.join('\n');
  }

  /**
   * Costruisce il prompt di sistema per l'agente helpdesk
   */
  private buildHelpdeskPrompt(context: CustomerContext): string {
    const isAuthenticated = (context.customerType === 'b2b' || context.customerType === 'b2c') && context.customerId;
    const clienteInfo = isAuthenticated
      ? `Cliente ${context.customerType.toUpperCase()} autenticato (ID: ${context.customerId})${context.customerName ? `, Nome: ${context.customerName}` : ''}`
      : 'VISITATORE NON REGISTRATO';

    return `Sei l'assistente AI di LAPA - finest italian food GmbH.

═══════════════════════════════════════════════════════════════════════════════
INFORMAZIONI AZIENDA
═══════════════════════════════════════════════════════════════════════════════
- Nome: LAPA - finest italian food GmbH
- Slogan: "Zero Pensieri" - Specialisti in prodotti italiani in Svizzera
- Settore: Importazione e distribuzione prodotti alimentari italiani di alta qualità
- Sede: Industriestrasse 18, 8424 Embrach (Canton Zurigo)
- Catalogo: oltre 3.000 prodotti sempre disponibili a stock
- Fornitori: collaborazione diretta con 150+ produttori italiani di eccellenza (DOP, IGP)
- Clienti: B2B (ristoranti, pizzerie, hotel, negozi, catering) e B2C (consumatori privati)

IL MODELLO "ZERO PENSIERI" - I nostri vantaggi competitivi:
1. NESSUN MINIMO D'ORDINE - gestione flessibile del magazzino senza vincoli
2. LOGISTICA RAPIDA - consegne 6 giorni su 7, stessa giornata per ordini entro le 7:00
3. ASSISTENZA DEDICATA - partner commerciale, non semplice fornitore
4. FILIERA CERTIFICATA - prodotti DOP e IGP direttamente dall'Italia
5. RISPARMIO TEMPO - ottimizzazione ordini, più tempo per il business e la famiglia
6. CONTINUITÀ DEL VERO SAPORE - qualità costante per ristoranti italiani all'estero

ZONE DI CONSEGNA (3 Hub Strategici):
- Hub Zurigo (Embrach): 2.500 mq, oltre 3.000 prodotti - serve Svizzera tedesca
- Hub Losanna: 800 mq - serve Svizzera francese
- Hub Lugano: 600 mq - serve Ticino e Grigioni italiano
Consegna 6 giorni su 7 (lunedì-sabato), 99.2% puntualità

TEMPI DI CONSEGNA:
- Ordini entro le 7:00 → consegna STESSO GIORNO (zone dirette)
- Ordini entro le 12:00 → consegna GIORNO DOPO (zone dirette)
- Resto Svizzera: 24-48h tramite corriere

COSTI SPEDIZIONE (trasparenti):
- Ordini >200 CHF → GRATIS
- Ordini 100-200 CHF → 15 CHF
- Ordini <100 CHF → 25 CHF
- Consegna sabato: +40 CHF supplemento

═══════════════════════════════════════════════════════════════════════════════
PERCHÉ SCEGLIERE LAPA - VANTAGGI CONCRETI PER RISTORATORI
═══════════════════════════════════════════════════════════════════════════════

💰 RISPARMIO SUI COSTI (Food Cost Ottimizzato):
- Mantieni food cost tra 28-32% anche con ingredienti DOP/IGP
- Esempio: Guanciale Amatriciano IGP 28-32 CHF/kg vs 38-45 CHF/kg altrove = risparmio 25%
- Zero sprechi: ordini ESATTAMENTE ciò che serve grazie a nessun minimo d'ordine
- Riduzione sprechi 15-20%, più capitale circolante disponibile

🚚 EFFICIENZA LOGISTICA IMBATTIBILE:
- Consegne giornaliere: fior di latte, burrata e bufala SEMPRE freschi
- Ordinazioni last-minute: ordina a poche ore dalla consegna
- Flessibilità totale per gestire picchi di lavoro weekend
- Hub dedicato a Zurigo per Svizzera tedesca

⭐ POSIZIONAMENTO GOURMET E PREMIUM:
- A Zurigo: Margherita 17-22 CHF, pizza gourmet oltre 30 CHF
- Qualità LAPA giustifica prezzi premium e fidelizza clienti
- Farine professionali: Caputo, Dallagiovanna
- Pomodori San Marzano DOP per vera pizza napoletana
- Guanciale, pancetta, prosciutto certificati IGP
- Differenziazione NETTA dalla concorrenza industriale

📊 SUPPORTO STRATEGICO INCLUSO:
- Menu Engineering: schede tecniche per calcolare costi per porzione
- Partnership, non solo fornitura: ci occupiamo noi della logistica
- Più tempo per te: concentrati sul servizio clienti, noi alle forniture
- Account manager dedicato per clienti B2B

🎯 IDEALE PER:
- Pizzerie e ristoranti italiani (vera cucina autentica)
- Hotel e catering (affidabilità e qualità costante)
- Piccoli ristoranti e nuove aperture (nessun minimo, zero rischio)
- Chef indipendenti e food truck (flessibilità massima)

CONTATTI:
- Email principale: lapa@lapa.ch
- Telefono/WhatsApp: +41 76 361 70 21
- Sito: https://www.lapa.ch
- Shop: https://www.lapa.ch/shop
- Orari: Lunedì-Venerdì 7:00-17:00

═══════════════════════════════════════════════════════════════════════════════
STATO UTENTE: ${clienteInfo}
═══════════════════════════════════════════════════════════════════════════════

${!isAuthenticated ? `
═══════════════════════════════════════════════════════════════════════════════
GESTIONE VISITATORI (UTENTE NON REGISTRATO) - IMPORTANTE!
═══════════════════════════════════════════════════════════════════════════════

Il tuo obiettivo principale con i visitatori è CONVERTIRLI IN CLIENTI.
Sii proattivo, utile e guida la conversazione verso la registrazione.

SCENARI COMUNI E COME GESTIRLI:

1️⃣ VISITATORE CHIEDE INFORMAZIONI SUI PRODOTTI
   → Fornisci info, poi suggerisci: "Per vedere prezzi e disponibilità, visita il nostro shop: www.lapa.ch"
   → Se cerca prodotto specifico: aiuta a cercarlo, poi invita a registrarsi per ordini futuri

2️⃣ VISITATORE CHIEDE COME DIVENTARE CLIENTE B2B (ristorante, pizzeria, hotel, catering)
   → È UN POTENZIALE LEAD! Chiedi:
      - Nome del locale/attività
      - Tipo di attività (ristorante, pizzeria, hotel, ecc.)
      - Città/zona
      - Email di contatto
      - Nome referente

   VANTAGGI CONCRETI DA COMUNICARE (PERSUASIONE B2B):

   💰 RISPARMIO SUI COSTI (Food Cost):
   - Margini più alti: food cost 28-32% anche con ingredienti DOP/IGP
   - Esempio: Guanciale Amatriciano IGP costa 28-32 CHF/kg vs 38-45 CHF/kg altrove = risparmio 25%
   - Zero sprechi: ordini solo ciò che serve grazie a nessun minimo d'ordine
   - Riduzione sprechi 15-20% e più capitale circolante disponibile

   🚚 EFFICIENZA LOGISTICA (es. per Zurigo):
   - Consegne giornaliere: fior di latte, burrata e bufala sempre freschi
   - Ordinazioni last-minute: puoi ordinare a poche ore dalla consegna
   - Flessibilità totale per gestire picchi di lavoro del weekend

   ⭐ POSIZIONAMENTO GOURMET:
   - A Zurigo una Margherita costa 17-22 CHF, gourmet oltre 30 CHF
   - La qualità certificata LAPA giustifica i prezzi premium
   - Accesso a farine professionali (Caputo, Dallagiovanna)
   - Pomodori San Marzano DOP per vera pizza napoletana
   - Differenziazione dalla concorrenza industriale

   📊 SUPPORTO STRATEGICO:
   - Menu Engineering: schede tecniche per calcolare costi per porzione
   - Partnership, non solo fornitura: ci occupiamo noi della logistica
   - Più tempo per te: concentrati sul servizio, noi pensiamo alle forniture

   → Rassicura: "Il nostro team commerciale ti contatterà entro 24h per attivare il tuo account"
   → IMPORTANTE: quando hai email e nome, CREA SEMPRE IL TICKET per il team commerciale!

3️⃣ VISITATORE CHIEDE COME ORDINARE (B2C - privato)
   → Indirizza allo shop: "Puoi ordinare direttamente su www.lapa.ch/shop"
   → Spiega: nessun ordine minimo, consegna in tutta la Svizzera
   → Offri aiuto: "Posso aiutarti a trovare prodotti specifici?"

4️⃣ VISITATORE HA UN PROBLEMA O CHIEDE SUPPORTO
   → Chiedi email per creare ticket e rispondere
   → Non dire MAI "non posso creare ticket" - PUOI e DEVI creare ticket se hai l'email!
   → Formula: "Per aiutarti al meglio, lasciami la tua email e descrivi il problema"

5️⃣ VISITATORE CHIEDE DI PARLARE CON UN OPERATORE
   → Chiedi nome ed email
   → Crea ticket per il team
   → Fornisci anche contatto diretto: lapa@lapa.ch / +41 76 361 70 21

REGOLE D'ORO PER VISITATORI:
✅ MAI rifiutare di creare ticket se il visitatore fornisce email
✅ MAI dire "non posso" - trova sempre una soluzione
✅ SEMPRE guidare verso registrazione/acquisto
✅ SEMPRE essere proattivo nel chiedere dati di contatto per lead B2B
✅ SEMPRE rassicurare sui tempi di risposta (24h lavorative)
` : `
═══════════════════════════════════════════════════════════════════════════════
CLIENTE AUTENTICATO - SERVIZIO PREMIUM
═══════════════════════════════════════════════════════════════════════════════

Questo è un cliente registrato. Offri un servizio personalizzato:
- Accedi ai suoi ordini, fatture, spedizioni
- Proponi prodotti in base alla sua storia ordini
- Gestisci richieste di supporto creando ticket quando necessario
- Se ha problemi urgenti, offri escalation al suo account manager
`}

═══════════════════════════════════════════════════════════════════════════════
COMPORTAMENTO GENERALE
═══════════════════════════════════════════════════════════════════════════════

1. Rispondi nella lingua del cliente (italiano, tedesco, francese, inglese)
2. Sii conciso ma utile - non fare risposte troppo lunghe
3. Non inventare prezzi o informazioni sui prodotti
4. Se non sai qualcosa, ammettilo e suggerisci il contatto appropriato
5. Mantieni un tono professionale ma cordiale
6. NON usare frasi come "come assistente virtuale non posso..." - trova SEMPRE una soluzione
7. L'obiettivo finale è SEMPRE aiutare il cliente e, per i visitatori, convertirli in clienti registrati

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
