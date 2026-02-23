/**
 * LAPA AI Chat v2 - Streaming API Route
 *
 * Single Claude call with tool use + SSE streaming.
 * Replaces the multi-call orchestrator approach.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateOrigin, getCorsHeaders, checkRateLimit, validateInput, sanitizeError } from '@/lib/lapa-agents/v2/security';
import { getToolsForAuth, toolExecutors, type ToolContext } from '@/lib/lapa-agents/v2/tools';
import { STATIC_SYSTEM_PROMPT, buildDynamicPrompt } from '@/lib/lapa-agents/v2/system-prompt';
import { getMemoryService } from '@/lib/lapa-agents/memory/conversation-memory';
import { addMessageToConversation, loadConversation } from '@/lib/lapa-agents/conversation-store';
import { enrichMessageWithAttachments, type Attachment } from '@/lib/lapa-agents/attachment-analyzer';
import { recordRequest } from '@/lib/lapa-agents/stats';

// ============================================================================
// TYPES
// ============================================================================

interface ChatRequest {
  message: string;
  customerType: 'b2b' | 'b2c' | 'anonymous';
  customerId?: number;
  parentId?: number;
  customerName?: string;
  customerEmail?: string;
  sessionId: string;
  language?: string;
  channel?: 'web' | 'whatsapp' | 'api';
  attachments?: Attachment[];
}

// ============================================================================
// LANGUAGE DETECTION (reused from v1)
// ============================================================================

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  const de = /\b(ich|sie|wir|ist|sind|habe|haben|bitte|danke|guten|ja|nein|nicht|bestellung|rechnung|lieferung|produkt)\b|[äöüß]/;
  const fr = /\b(je|vous|nous|est|sont|merci|bonjour|oui|non|commande|facture|livraison|produit)\b|[éèêàâùûç]/;
  const en = /\b(please|thank|hello|order|invoice|delivery|product|would|could|should)\b/;

  const deScore = (lower.match(de) || []).length;
  const frScore = (lower.match(fr) || []).length;
  const enScore = (lower.match(en) || []).length;

  if (deScore === 0 && frScore === 0 && enScore === 0) return 'it';
  if (deScore >= frScore && deScore >= enScore) return 'de';
  if (frScore >= deScore && frScore >= enScore) return 'fr';
  return 'en';
}

// ============================================================================
// CONVERSATION ID (reused from v1)
// ============================================================================

function getConversationId(customerId?: number, parentId?: number, sessionId?: string): string {
  if (parentId) return `customer-${parentId}`;
  if (customerId) return `customer-${customerId}`;
  return sessionId || `anon-${Date.now()}`;
}

// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!validateOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) });
}

// ============================================================================
// POST - Main chat endpoint (streaming)
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 1. Parse request
    const body: ChatRequest = await request.json();
    const {
      customerType = 'anonymous',
      customerId,
      parentId,
      customerName,
      customerEmail,
      sessionId,
      language: requestedLanguage,
      channel = 'web',
      attachments,
    } = body;

    // 2. Input validation
    const { valid, sanitized, error: inputError } = validateInput(body.message);
    if (!valid) {
      return NextResponse.json({ error: inputError }, { status: 400, headers: corsHeaders });
    }

    // 3. Rate limiting
    const rateKey = sessionId || customerId?.toString() || 'unknown';
    const { allowed, remaining } = await checkRateLimit(rateKey);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } }
      );
    }

    // 4. Language detection
    const language = requestedLanguage || detectLanguage(sanitized);

    // 5. Conversation ID
    const conversationId = getConversationId(customerId, parentId, sessionId);

    console.log(`📨 v2 Chat: "${sanitized.substring(0, 80)}..." | ${customerType} | ${conversationId}`);

    // 6. Load conversation history from KV
    let conversationHistory: Anthropic.MessageParam[] = [];
    try {
      const stored = await loadConversation(conversationId);
      if (stored?.messages?.length) {
        conversationHistory = stored.messages
          .slice(-10) // Last 10 messages for context
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        console.log(`📂 History loaded: ${conversationHistory.length} messages`);
      }
    } catch (err) {
      console.warn('Failed to load conversation history:', err);
    }

    // 7. Load customer memory
    let memoryContext = '';
    if (customerId) {
      try {
        const memoryService = getMemoryService();
        const memory = await memoryService.loadMemory(customerId);
        if (memory) {
          memoryContext = memoryService.getContextForAI(memory);
        }
      } catch (err) {
        console.warn('Failed to load memory:', err);
      }
    }

    // 8. Process attachments with Gemini
    let enrichedMessage = sanitized;
    if (attachments?.length) {
      try {
        const result = await enrichMessageWithAttachments(sanitized, attachments);
        enrichedMessage = result.enrichedMessage;
        console.log(`📎 Attachments analyzed (+${enrichedMessage.length - sanitized.length} chars)`);
      } catch (err) {
        console.warn('Attachment analysis failed:', err);
      }
    }

    // 9. Build system prompt
    const dynamicPrompt = buildDynamicPrompt({
      customerId,
      customerName,
      customerType,
      language,
      companyName: undefined, // Will be enriched from memory
      memoryContext,
    });

    // 10. Select tools based on auth level
    const isAuthenticated = !!customerId && (customerType === 'b2b' || customerType === 'b2c');
    const tools = getToolsForAuth(isAuthenticated);

    // 11. Build messages
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      { role: 'user', content: enrichedMessage },
    ];

    // 12. Tool context (server-injected, NOT controlled by Claude)
    const toolCtx: ToolContext = {
      customerId,
      customerType,
      customerName,
      customerEmail,
      language,
      companyId: parentId,
    };

    // 13. API key check
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500, headers: corsHeaders });
    }

    // 14. STREAMING RESPONSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const anthropic = new Anthropic({ apiKey });
        let fullResponse = '';
        let currentMessages = [...messages];
        let iterations = 0;
        const MAX_ITERATIONS = 8; // Safety limit for tool-use loops (increased for multi-search queries)

        try {
          while (iterations < MAX_ITERATIONS) {
            iterations++;

            // Make Claude API call
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 4096,
              temperature: 0.7,
              system: [
                { type: 'text', text: STATIC_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
                { type: 'text', text: dynamicPrompt },
              ],
              tools,
              messages: currentMessages,
            });

            // Process response content blocks
            const textBlocks: string[] = [];
            const toolUseBlocks: Anthropic.ContentBlock[] = [];

            for (const block of response.content) {
              if (block.type === 'text') {
                textBlocks.push(block.text);
                // Stream text to client
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`
                ));
              } else if (block.type === 'tool_use') {
                toolUseBlocks.push(block);
                // Notify client that a tool is being called
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'tool_start', tool: block.name })}\n\n`
                ));
              }
            }

            fullResponse += textBlocks.join('');

            // If no tool calls, we're done
            if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
              break;
            }

            // Execute tools
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              if (block.type !== 'tool_use') continue;

              const executor = toolExecutors[block.name];
              if (!executor) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: 'Unknown tool',
                  is_error: true,
                });
                continue;
              }

              try {
                const result = await executor(block.input, toolCtx);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                });
              } catch (toolError) {
                const errorMsg = toolError instanceof Error ? toolError.message : 'Tool execution failed';
                console.error(`Tool ${block.name} error:`, errorMsg);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: errorMsg,
                  is_error: true,
                });
              }

              // Notify client that tool finished
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_end', tool: block.name })}\n\n`
              ));
            }

            // Continue conversation with tool results
            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ];
          }

          // Send done event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'done', agentId: 'lapa-ai-v2' })}\n\n`
          ));

        } catch (apiError) {
          console.error('Claude API error:', apiError);
          const errorMsg = apiError instanceof Error ? apiError.message : 'AI service error';
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'Sorry, an error occurred. Please try again.' })}\n\n`
          ));
        } finally {
          controller.close();
        }

        // Post-stream: save conversation and memory (fire-and-forget)
        const duration = Date.now() - startTime;
        console.log(`✅ v2 response in ${duration}ms | ${iterations} iteration(s)`);

        // Save to conversation store
        try {
          await addMessageToConversation(conversationId, {
            role: 'user', content: sanitized, timestamp: new Date(), channel,
          }, { customerId, customerName, customerType, parentId });

          if (fullResponse) {
            await addMessageToConversation(conversationId, {
              role: 'assistant', content: fullResponse, timestamp: new Date(), agentId: 'lapa-ai-v2', channel,
            }, { customerId, customerName, customerType, parentId });
          }
        } catch (saveErr) {
          console.warn('Failed to save conversation:', saveErr);
        }

        // Save to memory
        if (customerId) {
          try {
            const memoryService = getMemoryService();
            await memoryService.addMessage(
              customerId, customerName || 'Cliente', customerType, conversationId,
              { role: 'user', content: sanitized, timestamp: new Date().toISOString() },
              parentId
            );
            if (fullResponse) {
              await memoryService.addMessage(
                customerId, customerName || 'Cliente', customerType, conversationId,
                { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), metadata: { agentId: 'lapa-ai-v2' } },
                parentId
              );
            }
          } catch (memErr) {
            console.warn('Failed to save memory:', memErr);
          }
        }

        // Record stats
        recordRequest('lapa-ai-v2', duration, true, conversationId);
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Rate-Limit-Remaining': remaining.toString(),
      },
    });

  } catch (error) {
    console.error('v2 chat error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// GET - Health check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: 'v2-streaming',
    model: 'claude-sonnet-4-6',
    timestamp: new Date().toISOString(),
  });
}
