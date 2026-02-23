/**
 * LAPA AI Chat v2 - Security Layer
 *
 * CORS, rate limiting, input validation, error sanitization
 */

import { kv } from '@vercel/kv';

// ============================================================================
// CORS VALIDATION
// ============================================================================

const ALLOWED_ORIGINS = [
  'https://lapa.ch',
  'https://www.lapa.ch',
  'https://hub.lapa.ch',
  'https://staging.hub.lapa.ch',
];

if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
}

export function validateOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const validOrigin = origin && validateOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': validOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ============================================================================
// RATE LIMITING (Vercel KV sliding window)
// ============================================================================

const RATE_LIMIT = 20;           // requests
const RATE_WINDOW_MS = 60_000;   // per minute

export async function checkRateLimit(sessionId: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:v2:${sessionId}`;

  try {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;

    // Get current count and window start from KV
    const data = await kv.get<{ count: number; windowStart: number }>(key);

    if (!data || data.windowStart < windowStart) {
      // New window
      await kv.set(key, { count: 1, windowStart: now }, { ex: 120 }); // 2 min TTL
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    if (data.count >= RATE_LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    // Increment
    await kv.set(key, { count: data.count + 1, windowStart: data.windowStart }, { ex: 120 });
    return { allowed: true, remaining: RATE_LIMIT - data.count - 1 };

  } catch (error) {
    // If KV fails, allow the request (fail open) but log
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: RATE_LIMIT };
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const MAX_MESSAGE_LENGTH = 2000;

// Patterns that suggest prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /you\s+are\s+now\s+a/i,
  /new\s+instructions?:/i,
  /system\s*:/i,
  /<\|.*\|>/,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /HUMAN:/i,
  /ASSISTANT:/i,
];

export function validateInput(message: string): { valid: boolean; sanitized: string; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, sanitized: '', error: 'Message is required' };
  }

  // Trim
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'Message cannot be empty' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, sanitized: '', error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` };
  }

  // Strip control characters (except newlines and tabs)
  const sanitized = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Check for injection patterns - log but don't block (Claude should handle via system prompt)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`⚠️ Potential injection detected in message: "${sanitized.substring(0, 100)}..."`);
      break;
    }
  }

  return { valid: true, sanitized };
}

// ============================================================================
// ERROR SANITIZATION
// ============================================================================

export function sanitizeError(error: unknown): string {
  // Log the full error server-side
  if (error instanceof Error) {
    console.error('Internal error:', error.message, error.stack);
  } else {
    console.error('Internal error:', error);
  }

  // Return generic message to client
  return 'An internal error occurred while processing your request.';
}

// ============================================================================
// CUSTOMER ACCESS GUARD
// ============================================================================

export function enforceCustomerAccess(requestedCustomerId: number | undefined, sessionCustomerId: number | undefined): void {
  if (!sessionCustomerId) {
    throw new Error('Authentication required for this action');
  }
  if (requestedCustomerId && requestedCustomerId !== sessionCustomerId) {
    console.error(`🚨 SECURITY: Customer ${sessionCustomerId} tried to access data of customer ${requestedCustomerId}`);
    throw new Error('Access denied');
  }
}
