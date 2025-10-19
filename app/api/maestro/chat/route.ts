/**
 * MAESTRO AI CHAT - API Route
 *
 * POST /api/maestro/chat
 *
 * Endpoint principale per chat AI con Claude.
 * Supporta tool calling, conversation history e rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, checkRateLimit } from '@/lib/ai/claude-client';
import type { MaestroChatRequest, MaestroChatResponse } from '@/lib/maestro/types';

// ============================================================================
// POST /api/maestro/chat
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse request body
    const body = await request.json() as MaestroChatRequest;

    console.log('💬 [MAESTRO-CHAT-API] New chat request', {
      salespersonId: body.salespersonId,
      hasConversationId: !!body.conversationId,
      messageLength: body.message?.length,
    });

    // 2. Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error,
          },
        },
        { status: 400 }
      );
    }

    const { message, conversationId, salespersonId, context } = body;

    // 3. Get salesperson info (from session or context)
    // In a real implementation, you'd get this from JWT token or session
    // For now, we'll use a placeholder
    const salespersonName = await getSalespersonName(salespersonId);

    if (!salespersonName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SALESPERSON_NOT_FOUND',
            message: 'Venditore non trovato',
          },
        },
        { status: 404 }
      );
    }

    // 4. Check rate limit
    const rateLimit = await checkRateLimit(salespersonId);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Troppi messaggi. Riprova tra qualche secondo.',
            details: {
              remaining: rateLimit.remaining,
              resetAt: rateLimit.resetAt.toISOString(),
            },
          },
        },
        { status: 429 }
      );
    }

    // 5. Send message to Claude
    const result = await sendMessage({
      message,
      conversationId,
      salespersonId,
      salespersonName,
      context,
    });

    // 6. Prepare response
    const response: MaestroChatResponse = {
      reply: result.reply,
      conversationId: result.conversationId,
      suggestions: result.suggestions,
      data: result.data,
      tokensUsed: result.tokensUsed,
      toolCalls: result.toolCalls,
    };

    const duration = Date.now() - startTime;

    console.log(`✅ [MAESTRO-CHAT-API] Response sent in ${duration}ms`, {
      conversationId: result.conversationId,
      tokensUsed: result.tokensUsed,
      toolCallsCount: result.toolCalls?.length || 0,
    });

    return NextResponse.json(
      {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'X-Rate-Limit-Remaining': rateLimit.remaining.toString(),
          'X-Rate-Limit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    console.error(`❌ [MAESTRO-CHAT-API] Error after ${duration}ms:`, errorMessage);

    // Check for specific error types
    if (errorMessage.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'API_KEY_MISSING',
            message: 'Configurazione AI non disponibile',
          },
        },
        { status: 500 }
      );
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AI_QUOTA_EXCEEDED',
            message: 'Servizio AI temporaneamente non disponibile',
          },
        },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Errore durante elaborazione richiesta',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS (CORS support)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Validate chat request
 */
function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: 'Request body richiesto' };
  }

  if (!body.message || typeof body.message !== 'string') {
    return { valid: false, error: 'Campo "message" richiesto (string)' };
  }

  if (body.message.trim().length === 0) {
    return { valid: false, error: 'Messaggio non può essere vuoto' };
  }

  if (body.message.length > 2000) {
    return { valid: false, error: 'Messaggio troppo lungo (max 2000 caratteri)' };
  }

  if (!body.salespersonId || typeof body.salespersonId !== 'number') {
    return { valid: false, error: 'Campo "salespersonId" richiesto (number)' };
  }

  if (body.conversationId && typeof body.conversationId !== 'string') {
    return { valid: false, error: 'Campo "conversationId" deve essere string' };
  }

  if (body.context) {
    if (body.context.customerId && typeof body.context.customerId !== 'number') {
      return { valid: false, error: 'context.customerId deve essere number' };
    }
    if (body.context.currentPage && typeof body.context.currentPage !== 'string') {
      return { valid: false, error: 'context.currentPage deve essere string' };
    }
  }

  return { valid: true };
}

/**
 * Get salesperson name from ID
 * In production, this should query your user database or Odoo
 */
async function getSalespersonName(salespersonId: number): Promise<string | null> {
  // TODO: Implement real user lookup
  // For now, return a placeholder
  // In production, you would:
  // 1. Query your users table
  // 2. Or query Odoo res.users
  // 3. Or extract from JWT token

  // Placeholder implementation
  const knownSalespeople: Record<number, string> = {
    1: 'Admin User',
    2: 'Mario Rossi',
    3: 'Luca Bianchi',
    4: 'Giuseppe Verdi',
    5: 'Alessandro Neri',
    // Add more as needed
  };

  return knownSalespeople[salespersonId] || `Venditore ${salespersonId}`;
}
