/**
 * CHAT GESTIONALE - API Route
 *
 * Endpoint per comunicare con Claude AI con accesso a strumenti Odoo.
 * Permette query, creazione, aggiornamento di record tramite linguaggio naturale.
 *
 * POST /api/chat-gestionale
 * Body: { message: string, conversationId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getToolDefinitions, processToolCalls } from '@/lib/mcp-tools';

// ============================================================================
// CONSTANTS
// ============================================================================

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;
const MAX_TOOL_ITERATIONS = 10; // Previeni loop infiniti

// Rate limiting in-memory (per produzione usare Redis/DB)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `Sei un assistente AI avanzato per la gestione di Odoo ERP. Hai accesso diretto al database Odoo attraverso una serie di strumenti che ti permettono di:

# CAPACITA'
1. **Interrogare dati** - Cercare e recuperare qualsiasi informazione:
   - Ordini di vendita (sale.order)
   - Fatture (account.move)
   - Prodotti (product.product, product.template)
   - Clienti e Fornitori (res.partner)
   - Picking e movimenti magazzino (stock.picking, stock.move)
   - E qualsiasi altro modello Odoo

2. **Creare record** - Inserire nuovi dati:
   - Nuovi ordini
   - Nuovi clienti
   - Nuove righe ordine
   - Ticket helpdesk
   - ecc.

3. **Aggiornare record** - Modificare dati esistenti:
   - Cambiare stato ordini
   - Aggiornare quantita'
   - Modificare date consegna
   - ecc.

4. **Eseguire azioni** - Chiamare metodi Odoo:
   - Confermare ordini
   - Validare picking
   - Inviare email
   - ecc.

# STRUMENTI DISPONIBILI
- **search_read_model**: Cerca record con filtri e restituisce dati (metodo principale)
- **create_model**: Crea nuovi record
- **write_model**: Aggiorna record esistenti
- **get_model_fields**: Ottiene la struttura dei campi di un modello
- **get_model_relations**: Ottiene le relazioni di un modello
- **call_button**: Esegue azioni button (es: action_confirm)
- **list_models**: Elenca i modelli Odoo disponibili
- **execute_method**: Esegue metodi arbitrari su modelli Odoo

# LINEE GUIDA
1. **Sicurezza**: Mai eseguire operazioni distruttive senza conferma esplicita
2. **Precisione**: Verifica sempre i dati prima di modifiche
3. **Chiarezza**: Spiega cosa stai facendo e perche'
4. **Errori**: Se qualcosa fallisce, spiega il problema in modo chiaro
5. **Limiti**: Per query grandi, usa limit per evitare timeout

# MODELLI ODOO COMUNI
- sale.order: Ordini di vendita
- sale.order.line: Righe ordine vendita
- account.move: Fatture (move_type='out_invoice' per clienti)
- account.move.line: Righe fattura
- res.partner: Clienti, fornitori, contatti
- product.product: Varianti prodotto
- product.template: Template prodotto
- stock.picking: Trasferimenti/picking
- stock.move: Movimenti magazzino
- stock.quant: Giacenze
- purchase.order: Ordini acquisto

# FORMATO RISPOSTE
- Rispondi sempre in italiano
- Usa formattazione chiara con elenchi e tabelle quando appropriato
- Per dati numerici, formatta con separatori migliaia
- Per date, usa formato italiano (GG/MM/AAAA)
- Se recuperi molti dati, riassumi i punti chiave

# ESEMPIO DI INTERAZIONE
**User**: "Mostrami gli ultimi 5 ordini di Mario Rossi"
**Tu**: [Uso search_read_model per trovare partner Mario Rossi]
**Tu**: [Uso search_read_model per trovare ordini del partner]
**Tu**: "Ecco gli ultimi 5 ordini di Mario Rossi:
1. SO2024-001 - 15/01/2024 - EUR 1.250,00 - Confermato
2. SO2024-002 - 22/01/2024 - EUR 890,00 - In consegna
..."

Rispondi in modo professionale, conciso e utile. Sei qui per aiutare l'utente a lavorare meglio con Odoo!`;

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

interface ChatResponse {
  success: boolean;
  message?: string;
  conversationId: string;
  toolsUsed?: string[];
  tokensUsed?: number;
  error?: string;
  timestamp: string;
}

// In-memory conversation store (per produzione usare Redis/DB)
const conversations = new Map<string, ChatMessage[]>();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check rate limit per conversation/IP
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetAt) {
    requestCounts.set(identifier, {
      count: 1,
      resetAt: now + RATE_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Generate unique conversation ID
 */
function generateConversationId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load conversation history
 */
function loadConversation(conversationId: string): ChatMessage[] {
  return conversations.get(conversationId) || [];
}

/**
 * Save message to conversation
 */
function saveMessage(conversationId: string, role: 'user' | 'assistant', content: string | Anthropic.ContentBlock[]): void {
  const history = conversations.get(conversationId) || [];
  history.push({ role, content });

  // Keep only last 20 messages to prevent context overflow
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  conversations.set(conversationId, history);
}

// ============================================================================
// API HANDLERS
// ============================================================================

/**
 * POST /api/chat-gestionale
 * Process chat message with Claude and Odoo tools
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: ChatRequest = await request.json();

    // Validate message
    if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Il messaggio e\' obbligatorio',
          conversationId: '',
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 400 }
      );
    }

    const message = body.message.trim();

    // Get or create conversation ID
    const conversationId = body.conversationId || generateConversationId();

    // Rate limiting
    if (!checkRateLimit(conversationId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Troppe richieste. Attendi un minuto prima di riprovare.',
          conversationId,
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 429 }
      );
    }

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[CHAT-GESTIONALE] ANTHROPIC_API_KEY non configurata');
      return NextResponse.json(
        {
          success: false,
          error: 'Configurazione API mancante. Contatta l\'amministratore.',
          conversationId,
          timestamp: new Date().toISOString(),
        } as ChatResponse,
        { status: 500 }
      );
    }

    console.log(`[CHAT-GESTIONALE] Nuova richiesta - Conversazione: ${conversationId}`);
    console.log(`[CHAT-GESTIONALE] Messaggio: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);

    // Initialize Claude client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Load conversation history
    const history = loadConversation(conversationId);

    // Add user message
    saveMessage(conversationId, 'user', message);

    // Get tool definitions for Claude API
    const toolDefinitions = getToolDefinitions();
    const tools: Anthropic.Tool[] = toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
    }));

    // Prepare messages for Claude
    const messages: Anthropic.MessageParam[] = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Tool calling loop
    let currentMessages = [...messages];
    let finalResponse = '';
    let totalTokens = 0;
    const allToolsUsed: string[] = [];
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      console.log(`[CHAT-GESTIONALE] Iterazione ${iterations}`);

      // Call Claude
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: currentMessages,
        tools,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      console.log(`[CHAT-GESTIONALE] Risposta Claude - stop_reason: ${response.stop_reason}, tokens: ${totalTokens}`);

      // Check if we're done
      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((c) => c.type === 'text');
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text;
        }
        break;
      }

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use') as Array<{
          type: 'tool_use';
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>;

        console.log(`[CHAT-GESTIONALE] Claude richiede ${toolUseBlocks.length} tool(s)`);

        // Log tool calls
        for (const toolCall of toolUseBlocks) {
          console.log(`[CHAT-GESTIONALE] Tool: ${toolCall.name}`);
          console.log(`[CHAT-GESTIONALE] Input:`, JSON.stringify(toolCall.input).substring(0, 200));
          allToolsUsed.push(toolCall.name);
        }

        // Execute all tool calls using the mcp-tools library
        const toolResults = await processToolCalls(toolUseBlocks);

        console.log(`[CHAT-GESTIONALE] ${toolResults.length} tool(s) completati`);

        // Convert to Anthropic format
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = toolResults.map((result) => ({
          type: 'tool_result' as const,
          tool_use_id: result.tool_use_id,
          content: result.content,
          is_error: result.is_error,
        }));

        // Add assistant's tool use + results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content,
        });

        currentMessages.push({
          role: 'user',
          content: toolResultBlocks,
        });

        continue;
      }

      // Handle other stop reasons
      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        finalResponse = textContent.text;
      }
      break;
    }

    // Fallback if no response
    if (!finalResponse) {
      finalResponse = 'Mi dispiace, non sono riuscito a elaborare una risposta. Riprova con una richiesta diversa.';
    }

    // Save assistant response
    saveMessage(conversationId, 'assistant', finalResponse);

    const duration = Date.now() - startTime;
    console.log(`[CHAT-GESTIONALE] Risposta generata in ${duration}ms, ${iterations} iterazioni, ${allToolsUsed.length} tool usati`);

    // Return response
    return NextResponse.json(
      {
        success: true,
        message: finalResponse,
        conversationId,
        toolsUsed: Array.from(new Set(allToolsUsed)), // Unique tools
        tokensUsed: totalTokens,
        timestamp: new Date().toISOString(),
      } as ChatResponse,
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CHAT-GESTIONALE] Errore dopo ${duration}ms:`, errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `Errore interno: ${errorMessage}`,
        conversationId: '',
        timestamp: new Date().toISOString(),
      } as ChatResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat-gestionale
 * Health check and info
 */
export async function GET() {
  try {
    const toolDefs = getToolDefinitions();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'operational',
          model: CLAUDE_MODEL,
          tools: toolDefs.map((t) => ({
            name: t.name,
            description: t.description.substring(0, 100),
          })),
          rateLimit: {
            requestsPerMinute: RATE_LIMIT,
          },
          version: '1.0.0',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[CHAT-GESTIONALE] Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Servizio non disponibile',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
