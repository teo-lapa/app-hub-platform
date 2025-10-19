/**
 * MAESTRO AI - Claude Client
 *
 * Client Claude AI con tool calling per assistente vendite intelligente
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@vercel/postgres';
import { MAESTRO_TOOLS, executeToolCall } from './tools';

// ============================================================================
// CONSTANTS
// ============================================================================

const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 5; // Previeni loop infiniti

// System prompt per Maestro AI
const MAESTRO_SYSTEM_PROMPT = `Sei MAESTRO AI, l'assistente vendite intelligente per il team commerciale di LAPA Food.

# IL TUO RUOLO
Aiuti i venditori a gestire i loro clienti in modo proattivo e strategico. Fornisci insights basati su dati reali, suggerisci azioni concrete e aiuti a prioritizzare il lavoro quotidiano.

# CAPACITÀ
- Analizzare health score e churn risk dei clienti
- Suggerire azioni di retention e upsell
- Fornire insights su pattern di acquisto
- Aiutare a pianificare visite e follow-up
- Rispondere a domande su performance e KPI

# STRUMENTI DISPONIBILI
Hai accesso a questi strumenti per recuperare dati:
- get_customer_info: informazioni complete cliente (metriche, scores, prodotti top)
- get_customer_orders: ultimi ordini cliente
- get_salesperson_performance: KPI performance venditore
- search_customers: ricerca clienti per nome o città

# LINEE GUIDA COMUNICAZIONE
- Tono professionale ma amichevole
- Risposte concise e actionable (max 3-4 frasi)
- Usa emoji con moderazione (solo per evidenziare alert: ⚠️🔴✅)
- Fornisci sempre numeri precisi (€, giorni, %)
- Suggerisci azioni concrete e immediate
- Evidenzia priorità (URGENTE, Alta Priorità, etc.)

# ESEMPI DI INTERAZIONE

**User**: "Come sta Ristorante Da Mario?"
**Assistant**: "🔴 SITUAZIONE CRITICA - Ristorante Da Mario
• Health Score: 45/100 (sotto soglia)
• Ultimo ordine: 62 giorni fa
• Revenue trend: -23% vs media

⚠️ AZIONE RICHIESTA: Visita urgente entro 48 ore per evitare churn. Cliente storico con €15.2K annual revenue a rischio."

**User**: "Chi devo visitare oggi?"
**Assistant**: "📋 PRIORITÀ OGGI (3 clienti urgenti):

1. 🔴 Bar Centrale - 75 giorni senza ordini, health 38/100
2. ⚠️ Trattoria Nonna - Churn risk 68%, solito ordine missing
3. ✅ Pizzeria Roma - Upsell opportunity, +€800 potential

Inizia da Bar Centrale stamattina. Vuoi i dettagli di visita?"

# REGOLE IMPORTANTI
- Se non sai rispondere, ammettilo chiaramente
- Non inventare dati: usa sempre i tool per info reali
- Se un cliente non esiste nel DB, dillo esplicitamente
- Quando suggerisci azioni, spiega PERCHÉ (data-driven)
- Limita le risposte a 200-250 parole max

Rispondi sempre in italiano. Sei qui per aiutare i venditori a lavorare meglio!`;

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SendMessageOptions {
  message: string;
  conversationId?: string;
  salespersonId: number;
  salespersonName: string;
  context?: {
    customerId?: number;
    currentPage?: string;
  };
}

interface SendMessageResult {
  reply: string;
  conversationId: string;
  suggestions?: string[];
  data?: {
    customer?: any;
    performance?: any;
  };
  tokensUsed: number;
  toolCalls?: any[];
}

// ============================================================================
// CLAUDE CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Send a message to Claude and get response with tool calling support
 */
export async function sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const {
    message,
    conversationId: existingConversationId,
    salespersonId,
    salespersonName,
    context,
  } = options;

  console.log(`💬 [MAESTRO-CLAUDE] New message from salesperson ${salespersonId}`);

  try {
    // 1. Get or create conversation
    const conversationId = existingConversationId || await createConversation(salespersonId, salespersonName, context);

    // 2. Load conversation history
    const history = await loadConversationHistory(conversationId);

    // 3. Add user message to history
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    // 4. Save user message to DB
    await saveMessage(conversationId, 'user', message);

    // 5. Call Claude with tool support (iterative loop for tool calling)
    let currentMessages = [...messages];
    let finalResponse = '';
    let totalTokens = 0;
    let allToolCalls: any[] = [];
    let iterations = 0;
    let collectedData: any = {};

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      console.log(`🔄 [MAESTRO-CLAUDE] Iteration ${iterations}`);

      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: MAESTRO_SYSTEM_PROMPT,
        messages: currentMessages as any,
        tools: MAESTRO_TOOLS,
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      console.log(`📊 [MAESTRO-CLAUDE] Response - stop_reason: ${response.stop_reason}, tokens: ${totalTokens}`);

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Final response, extract text
        const textContent = response.content.find((c) => c.type === 'text');
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text;
        }
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Claude wants to use tools
        const toolCalls = response.content.filter((c) => c.type === 'tool_use');

        console.log(`🛠️ [MAESTRO-CLAUDE] Claude requesting ${toolCalls.length} tool(s)`);

        // Execute all tool calls
        const toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          if (toolCall.type !== 'tool_use') continue;

          const toolName = toolCall.name;
          const toolInput = toolCall.input as Record<string, any>;

          console.log(`🔧 [MAESTRO-CLAUDE] Executing tool: ${toolName}`);

          // Execute tool
          const result = await executeToolCall(toolName, toolInput);

          // Store data for final response
          if (toolName === 'get_customer_info' && result.customer) {
            collectedData.customer = result.customer;
          }
          if (toolName === 'get_salesperson_performance' && result.performance) {
            collectedData.performance = result.performance;
          }

          // Add tool result
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          });

          allToolCalls.push({
            name: toolName,
            input: toolInput,
            result,
          });
        }

        // Add assistant's tool use + tool results to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content as any,
        } as any);

        currentMessages.push({
          role: 'user',
          content: toolResults,
        } as any);

        // Continue loop to get final response
        continue;
      }

      // If we get here with other stop reason, break
      const textContent = response.content.find((c) => c.type === 'text');
      if (textContent && textContent.type === 'text') {
        finalResponse = textContent.text;
      }
      break;
    }

    if (!finalResponse) {
      finalResponse = 'Mi dispiace, non sono riuscito a elaborare una risposta. Riprova.';
    }

    console.log(`✅ [MAESTRO-CLAUDE] Final response (${totalTokens} tokens, ${iterations} iterations)`);

    // 6. Save assistant message to DB
    await saveMessage(conversationId, 'assistant', finalResponse, {
      model: CLAUDE_MODEL,
      tokens_used: totalTokens,
      tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined,
    });

    // 7. Generate quick action suggestions based on context
    const suggestions = generateSuggestions(finalResponse, collectedData);

    return {
      reply: finalResponse,
      conversationId,
      suggestions,
      data: collectedData,
      tokensUsed: totalTokens,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [MAESTRO-CLAUDE] Error:`, errorMessage);

    throw new Error(`Errore AI: ${errorMessage}`);
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Create new conversation
 */
async function createConversation(
  salespersonId: number,
  salespersonName: string,
  context?: { customerId?: number; currentPage?: string }
): Promise<string> {
  const result = await sql`
    INSERT INTO maestro_conversations (
      salesperson_id,
      salesperson_name,
      current_customer_id,
      current_page,
      started_at,
      last_message_at
    ) VALUES (
      ${salespersonId},
      ${salespersonName},
      ${context?.customerId || null},
      ${context?.currentPage || null},
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  const conversationId = result.rows[0].id;
  console.log(`✅ [MAESTRO-CLAUDE] Created conversation: ${conversationId}`);
  return conversationId;
}

/**
 * Load conversation history from DB
 */
async function loadConversationHistory(conversationId: string): Promise<ChatMessage[]> {
  const result = await sql`
    SELECT role, content
    FROM maestro_chat_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT 20
  `;

  return result.rows.map((row: any) => ({
    role: row.role,
    content: row.content,
  }));
}

/**
 * Save message to DB
 */
async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: {
    model?: string;
    tokens_used?: number;
    tool_calls?: any[];
  }
): Promise<void> {
  await sql`
    INSERT INTO maestro_chat_messages (
      conversation_id,
      role,
      content,
      model,
      tokens_used,
      tool_calls,
      created_at
    ) VALUES (
      ${conversationId},
      ${role},
      ${content},
      ${metadata?.model || null},
      ${metadata?.tokens_used || null},
      ${metadata?.tool_calls ? JSON.stringify(metadata.tool_calls) : null},
      NOW()
    )
  `;
}

// ============================================================================
// SUGGESTIONS GENERATOR
// ============================================================================

/**
 * Generate quick action suggestions based on AI response
 */
function generateSuggestions(response: string, data: any): string[] {
  const suggestions: string[] = [];

  // Check for urgency keywords
  if (response.includes('URGENTE') || response.includes('CRITICA')) {
    suggestions.push('📞 Chiama subito');
    suggestions.push('📅 Pianifica visita oggi');
  }

  // Check for customer data
  if (data.customer) {
    const customer = data.customer;

    if (customer.churn_risk_score >= 60) {
      suggestions.push('🔴 Azione retention');
    }

    if (customer.upsell_potential_score >= 60) {
      suggestions.push('💰 Proponi upsell');
    }

    suggestions.push(`📊 Vedi dettagli ${customer.name}`);
  }

  // Check for performance data
  if (data.performance) {
    suggestions.push('📈 Vedi KPI completi');
    suggestions.push('🎯 Genera piano giornaliero');
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push('❓ Fai un\'altra domanda');
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Check and update rate limit for salesperson
 * Limit: 20 messages per minute
 */
export async function checkRateLimit(salespersonId: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const LIMIT = 20; // messages per minute
  const WINDOW_MS = 60 * 1000; // 1 minute

  try {
    // Get or create rate limit record
    const result = await sql`
      INSERT INTO maestro_chat_rate_limits (
        salesperson_id,
        window_start,
        message_count,
        last_message_at
      ) VALUES (
        ${salespersonId},
        NOW(),
        1,
        NOW()
      )
      ON CONFLICT (salesperson_id) DO UPDATE
      SET
        window_start = CASE
          WHEN maestro_chat_rate_limits.window_start < NOW() - INTERVAL '1 minute'
          THEN NOW()
          ELSE maestro_chat_rate_limits.window_start
        END,
        message_count = CASE
          WHEN maestro_chat_rate_limits.window_start < NOW() - INTERVAL '1 minute'
          THEN 1
          ELSE maestro_chat_rate_limits.message_count + 1
        END,
        last_message_at = NOW(),
        updated_at = NOW()
      RETURNING window_start, message_count
    `;

    const record = result.rows[0] as any;
    const messageCount = record.message_count;
    const windowStart = new Date(record.window_start);
    const resetAt = new Date(windowStart.getTime() + WINDOW_MS);

    const allowed = messageCount <= LIMIT;
    const remaining = Math.max(0, LIMIT - messageCount);

    if (!allowed) {
      console.warn(`⚠️ [MAESTRO-CLAUDE] Rate limit exceeded for salesperson ${salespersonId}`);
    }

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error(`❌ [MAESTRO-CLAUDE] Rate limit check error:`, error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: LIMIT,
      resetAt: new Date(Date.now() + WINDOW_MS),
    };
  }
}
