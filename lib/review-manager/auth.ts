/**
 * Authentication & Authorization per Review Manager
 * Gestisce autenticazione e permessi per accesso alle API
 */

import { sql } from '@vercel/postgres';
import crypto from 'crypto';

export interface AuthContext {
  businessId: number;
  businessSlug: string;
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  isAuthenticated: boolean;
}

/**
 * Verifica API key e ritorna contesto business
 * Format: RM_<businessId>_<randomKey>
 */
export async function authenticateApiKey(apiKey: string): Promise<AuthContext | null> {
  try {
    // Parse API key format
    if (!apiKey.startsWith('RM_')) {
      return null;
    }

    const parts = apiKey.split('_');
    if (parts.length !== 3) {
      return null;
    }

    const businessId = parseInt(parts[1]);
    if (isNaN(businessId)) {
      return null;
    }

    // Verifica in database (per ora verifica solo che il business esista)
    // In produzione, salva l'API key hashata in una tabella dedicata
    const result = await sql`
      SELECT id, slug, subscription_plan
      FROM rm_businesses
      WHERE id = ${businessId} AND is_active = true
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const business = result.rows[0];

    return {
      businessId: business.id,
      businessSlug: business.slug,
      subscriptionPlan: business.subscription_plan as 'basic' | 'pro' | 'enterprise',
      isAuthenticated: true
    };
  } catch (error) {
    console.error('Errore autenticazione API key:', error);
    return null;
  }
}

/**
 * Estrae e verifica autenticazione da headers
 * Supporta:
 * - Authorization: Bearer RM_<businessId>_<key>
 * - X-API-Key: RM_<businessId>_<key>
 */
export async function authenticateRequest(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let apiKey: string | null = null;

  // Estrai da Authorization Bearer
  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  }
  // Oppure da X-API-Key
  else if (apiKeyHeader) {
    apiKey = apiKeyHeader;
  }

  if (!apiKey) {
    return null;
  }

  return authenticateApiKey(apiKey);
}

/**
 * Genera una nuova API key per un business
 */
export function generateApiKey(businessId: number): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `RM_${businessId}_${randomPart}`;
}

/**
 * Middleware di autenticazione per Next.js routes
 * Ritorna Response 401 se non autenticato, null se OK
 */
export async function requireAuth(request: Request): Promise<{
  authContext?: AuthContext;
  errorResponse?: Response;
}> {
  const authContext = await authenticateRequest(request);

  if (!authContext) {
    return {
      errorResponse: new Response(
        JSON.stringify({
          success: false,
          error: 'Non autenticato. Fornisci API key valida via header Authorization o X-API-Key'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="Review Manager API"'
          }
        }
      )
    };
  }

  return { authContext };
}

/**
 * Verifica che il business abbia accesso a una feature
 * Basato sul subscription plan
 */
export function checkFeatureAccess(
  authContext: AuthContext,
  feature: 'basic' | 'ai_responses' | 'auto_publish' | 'multi_platform' | 'webhooks' | 'api_access'
): boolean {
  const featureMatrix: Record<string, string[]> = {
    basic: ['basic', 'pro', 'enterprise'],
    ai_responses: ['basic', 'pro', 'enterprise'],
    auto_publish: ['pro', 'enterprise'],
    multi_platform: ['pro', 'enterprise'],
    webhooks: ['enterprise'],
    api_access: ['pro', 'enterprise']
  };

  const allowedPlans = featureMatrix[feature] || [];
  return allowedPlans.includes(authContext.subscriptionPlan);
}

/**
 * Middleware per verificare accesso a una feature
 */
export function requireFeature(
  authContext: AuthContext,
  feature: 'basic' | 'ai_responses' | 'auto_publish' | 'multi_platform' | 'webhooks' | 'api_access'
): Response | null {
  if (!checkFeatureAccess(authContext, feature)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Feature '${feature}' non disponibile nel piano ${authContext.subscriptionPlan}. Upgrade richiesto.`,
        requiredPlan: getMinimumPlanForFeature(feature)
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  return null;
}

/**
 * Helper: ottieni piano minimo richiesto per feature
 */
function getMinimumPlanForFeature(
  feature: 'basic' | 'ai_responses' | 'auto_publish' | 'multi_platform' | 'webhooks' | 'api_access'
): string {
  const featureMinPlan: Record<string, string> = {
    basic: 'basic',
    ai_responses: 'basic',
    auto_publish: 'pro',
    multi_platform: 'pro',
    webhooks: 'enterprise',
    api_access: 'pro'
  };

  return featureMinPlan[feature] || 'pro';
}

/**
 * Verifica ownership del business
 * Assicura che un utente possa accedere solo ai suoi business
 */
export function verifyBusinessOwnership(authContext: AuthContext, requestedBusinessId: number): boolean {
  return authContext.businessId === requestedBusinessId;
}

/**
 * Middleware per verificare ownership
 */
export function requireBusinessOwnership(
  authContext: AuthContext,
  requestedBusinessId: number
): Response | null {
  if (!verifyBusinessOwnership(authContext, requestedBusinessId)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Non hai i permessi per accedere a questo business'
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  return null;
}

/**
 * Crea un contesto auth di test per development
 * NON USARE IN PRODUCTION
 */
export function createTestAuthContext(businessId: number = 1): AuthContext {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('createTestAuthContext non disponibile in production');
  }

  return {
    businessId,
    businessSlug: `test-business-${businessId}`,
    subscriptionPlan: 'enterprise',
    isAuthenticated: true
  };
}
