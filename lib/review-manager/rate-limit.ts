/**
 * Rate Limiting per Review Manager API
 * Previene abusi e protezioni DDoS
 */

interface RateLimitConfig {
  windowMs: number; // Finestra temporale in ms
  maxRequests: number; // Max richieste per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (in produzione usa Redis/Upstash)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configurazioni per diversi endpoint
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Sync operations - limite basso perché sono costose
  sync: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10
  },

  // AI generation - limite medio
  ai: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30
  },

  // Read operations - limite alto
  read: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100
  },

  // Write operations - limite medio
  write: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 50
  },

  // OAuth callbacks - limite basso
  oauth: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 5
  }
};

/**
 * Cleanup periodico delle entry scadute
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup ogni 5 minuti
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Verifica rate limit per un identifier
 * @param identifier Identificatore univoco (es. IP, businessId, userId)
 * @param limitType Tipo di limite da applicare
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = 'read'
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
} {
  const config = RATE_LIMITS[limitType];
  const key = `${limitType}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Se non esiste o è scaduta, crea nuova entry
  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }

  // Incrementa contatore
  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: config.maxRequests
  };
}

/**
 * Middleware Next.js per rate limiting
 * Aggiunge header X-RateLimit-* alla response
 */
export function createRateLimitMiddleware(limitType: keyof typeof RATE_LIMITS = 'read') {
  return function rateLimitMiddleware(request: Request): Response | null {
    // Identifica richiesta per IP (in produzione usa Vercel headers o CF-Connecting-IP)
    const ip = getRequestIP(request);
    const identifier = ip || 'unknown';

    const result = checkRateLimit(identifier, limitType);

    // Se rate limit superato, ritorna 429
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit superato. Riprova più tardi.',
          retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toString(),
            'Retry-After': retryAfter.toString()
          }
        }
      );
    }

    // Rate limit OK - null significa "continua con la request"
    return null;
  };
}

/**
 * Helper per aggiungere header rate limit a una response
 */
export function addRateLimitHeaders(
  response: Response,
  identifier: string,
  limitType: keyof typeof RATE_LIMITS = 'read'
): Response {
  const key = `${limitType}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry) return response;

  const config = RATE_LIMITS[limitType];
  const remaining = Math.max(0, config.maxRequests - entry.count);

  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-RateLimit-Limit', config.maxRequests.toString());
  newHeaders.set('X-RateLimit-Remaining', remaining.toString());
  newHeaders.set('X-RateLimit-Reset', entry.resetAt.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Estrae IP dalla request
 * Supporta Vercel, Cloudflare, e altri proxy
 */
function getRequestIP(request: Request): string | null {
  const headers = request.headers;

  // Vercel
  const vercelIP = headers.get('x-real-ip') || headers.get('x-forwarded-for');
  if (vercelIP) {
    return vercelIP.split(',')[0].trim();
  }

  // Cloudflare
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  // Standard X-Forwarded-For
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return null;
}

/**
 * Reset manuale rate limit per un identifier (admin only)
 */
export function resetRateLimit(identifier: string, limitType?: keyof typeof RATE_LIMITS) {
  if (limitType) {
    const key = `${limitType}:${identifier}`;
    rateLimitStore.delete(key);
  } else {
    // Reset tutti i limiti per questo identifier
    for (const limitType of Object.keys(RATE_LIMITS)) {
      const key = `${limitType}:${identifier}`;
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Ottieni statistiche rate limit (admin/monitoring)
 */
export function getRateLimitStats() {
  const stats = {
    totalKeys: rateLimitStore.size,
    byType: {} as Record<string, number>
  };

  for (const key of Array.from(rateLimitStore.keys())) {
    const type = key.split(':')[0];
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  }

  return stats;
}
