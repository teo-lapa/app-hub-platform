/**
 * MAESTRO AGENT CHAT API ENDPOINT
 * POST /api/maestro/agent-chat
 *
 * Handles chat messages from salespeople and routes them through the agent network
 */

import { NextRequest, NextResponse } from 'next/server';
import { OrchestratorAgent } from '@/lib/maestro-agents/core/orchestrator';
import type { AgentTask, AgentChatRequest, AgentChatResponse } from '@/lib/maestro-agents/types';

// Rate limiting: Track requests per salesperson
const requestCounts = new Map<number, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

/**
 * Check rate limit for salesperson
 */
function checkRateLimit(salespersonId: number): boolean {
  const now = Date.now();
  const record = requestCounts.get(salespersonId);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    requestCounts.set(salespersonId, {
      count: 1,
      resetAt: now + RATE_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}

/**
 * POST /api/maestro/agent-chat
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: AgentChatRequest = await request.json();

    // Validate required fields
    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: message is required and must be a string',
          timestamp: new Date().toISOString(),
        } as AgentChatResponse,
        { status: 400 }
      );
    }

    if (!body.salesperson_id || typeof body.salesperson_id !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: salesperson_id is required and must be a number',
          timestamp: new Date().toISOString(),
        } as AgentChatResponse,
        { status: 400 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(body.salesperson_id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Maximum 20 requests per minute.',
          timestamp: new Date().toISOString(),
        } as AgentChatResponse,
        { status: 429 }
      );
    }

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Service configuration error. Please contact support.',
          timestamp: new Date().toISOString(),
        } as AgentChatResponse,
        { status: 500 }
      );
    }

    // Create agent task
    const task: AgentTask = {
      id: body.conversation_id || `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      user_query: body.message.trim(),
      salesperson_id: body.salesperson_id,
      context: body.context || {},
      created_at: new Date(),
    };

    console.log('📨 Agent Chat Request:', {
      task_id: task.id,
      salesperson: task.salesperson_id,
      query: task.user_query.substring(0, 100),
      context: task.context,
    });

    // Execute with orchestrator
    const orchestrator = new OrchestratorAgent();
    const result = await orchestrator.execute(task);

    const duration = Date.now() - startTime;

    console.log('✅ Agent Chat Response:', {
      task_id: task.id,
      success: result.success,
      agents_called: result.agents_called,
      tokens: result.total_tokens_used,
      duration_ms: duration,
    });

    // Build response
    const response: AgentChatResponse = {
      success: result.success,
      data: {
        reply: result.final_response,
        conversation_id: task.id,
        agents_used: result.agents_called,
        suggestions: extractSuggestions(result.final_response),
        tokens_used: result.total_tokens_used,
        duration_ms: duration,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Agent Chat Error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while processing your request',
        timestamp: new Date().toISOString(),
      } as AgentChatResponse,
      { status: 500 }
    );
  }
}

/**
 * Extract suggestions from response (optional feature)
 */
function extractSuggestions(response: string): string[] {
  const suggestions: string[] = [];

  // Look for action items, next steps, recommendations
  const actionPatterns = [
    /(?:Azioni Suggerite|Next Steps|Raccomandazioni):\s*\n((?:[-•\d.]\s*.+\n?)+)/i,
    /(?:Dovresti|Ti suggerisco di|Considera|Prova a)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of actionPatterns) {
    const matches = response.match(pattern);
    if (matches) {
      // Extract individual action items
      const items = matches[0]
        .split('\n')
        .filter(line => /^[-•\d.]/.test(line.trim()))
        .map(line => line.replace(/^[-•\d.]\s*/, '').trim())
        .filter(line => line.length > 0 && line.length < 200);

      suggestions.push(...items);
    }
  }

  // Limit to 5 suggestions
  return suggestions.slice(0, 5);
}

/**
 * GET /api/maestro/agent-chat
 * Health check and agent list
 */
export async function GET(request: NextRequest) {
  try {
    const orchestrator = new OrchestratorAgent();
    const agents = orchestrator.listAgents();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: 'operational',
          agents: agents.map(a => ({
            role: a.role,
            name: a.name,
            description: a.description,
          })),
          rate_limit: {
            requests_per_minute: RATE_LIMIT,
          },
          version: '1.0.0',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Service unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
