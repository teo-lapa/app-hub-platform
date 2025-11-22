/**
 * ODOO SESSION MANAGER
 *
 * Manages Odoo authentication sessions with:
 * - Automatic session refresh on expiry
 * - Request retry logic with new session
 * - Session caching to avoid redundant auth calls
 * - Proactive session renewal before expiry
 * - Comprehensive error handling and logging
 */

interface OdooSessionData {
  sessionId: string;
  uid: number;
  expiresAt: number;
  createdAt: number;
}

interface OdooCredentials {
  url: string;
  db: string;
  login: string;
  password: string;
}

interface SessionError extends Error {
  code?: string;
  isSessionExpired?: boolean;
}

class OdooSessionManager {
  private currentSession: OdooSessionData | null = null;
  private authPromise: Promise<OdooSessionData> | null = null;
  private readonly SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Odoo default)
  private readonly REFRESH_BEFORE_EXPIRY_MS = 30 * 60 * 1000; // Refresh 30 min before expiry
  private credentials: OdooCredentials;

  constructor(credentials: OdooCredentials) {
    this.credentials = credentials;
  }

  /**
   * Get valid session, creating or refreshing as needed
   */
  async getSession(): Promise<OdooSessionData> {
    // If session exists and is still valid (with buffer for refresh)
    if (this.currentSession && !this.isSessionExpiringSoon(this.currentSession)) {
      console.log('🔄 [SESSION-MANAGER] Using existing valid session');
      return this.currentSession;
    }

    // If session is expiring soon or expired, refresh it
    if (this.currentSession && this.isSessionExpiringSoon(this.currentSession)) {
      console.log('⚠️  [SESSION-MANAGER] Session expiring soon, refreshing...');
    } else {
      console.log('🔑 [SESSION-MANAGER] No valid session, authenticating...');
    }

    // If auth is already in progress, wait for it
    if (this.authPromise) {
      console.log('⏳ [SESSION-MANAGER] Auth in progress, waiting...');
      return this.authPromise;
    }

    // Start new authentication
    this.authPromise = this.authenticate();

    try {
      this.currentSession = await this.authPromise;
      return this.currentSession;
    } finally {
      this.authPromise = null;
    }
  }

  /**
   * Authenticate with Odoo and create new session
   */
  private async authenticate(): Promise<OdooSessionData> {
    const startTime = Date.now();
    console.log(`🔐 [SESSION-MANAGER] Authenticating with Odoo: ${this.credentials.url}`);

    try {
      const response = await fetch(`${this.credentials.url}/web/session/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          params: {
            db: this.credentials.db,
            login: this.credentials.login,
            password: this.credentials.password
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        const error = new Error(data.error.data?.message || data.error.message || 'Authentication failed') as SessionError;
        error.code = 'ODOO_AUTH_ERROR';
        throw error;
      }

      if (!data.result?.uid) {
        throw new Error('No UID received from Odoo');
      }

      // Extract session ID from Set-Cookie header
      const setCookie = response.headers.get('set-cookie');
      const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

      if (!sessionMatch) {
        throw new Error('No session_id in response cookies');
      }

      const sessionData: OdooSessionData = {
        sessionId: sessionMatch[1],
        uid: data.result.uid,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.SESSION_LIFETIME_MS
      };

      const duration = Date.now() - startTime;
      console.log(`✅ [SESSION-MANAGER] Authentication successful! UID: ${sessionData.uid}, Duration: ${duration}ms`);

      return sessionData;

    } catch (error: any) {
      console.error('❌ [SESSION-MANAGER] Authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if session is expiring soon (within refresh buffer)
   */
  private isSessionExpiringSoon(session: OdooSessionData): boolean {
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    return timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY_MS;
  }

  /**
   * Execute an Odoo RPC call with automatic session refresh on expiry
   */
  async callKw<T = any>(
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {},
    maxRetries: number = 1
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const session = await this.getSession();

        console.log(`🔵 [SESSION-MANAGER] RPC Call: ${model}.${method} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const response = await fetch(`${this.credentials.url}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${session.sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model,
              method,
              args,
              kwargs: kwargs || {}
            },
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const data = await response.json();

        if (data.error) {
          const isSessionExpired = this.isSessionExpiredError(data.error);

          if (isSessionExpired) {
            console.warn(`⚠️  [SESSION-MANAGER] Session expired error detected on ${model}.${method}`);

            // Invalidate current session
            this.currentSession = null;

            // If we have retries left, continue to next iteration
            if (attempt < maxRetries) {
              console.log(`🔄 [SESSION-MANAGER] Retrying with new session...`);
              continue;
            }
          }

          const error = new Error(data.error.data?.message || data.error.message || 'Odoo RPC error') as SessionError;
          error.code = data.error.data?.name || 'ODOO_RPC_ERROR';
          error.isSessionExpired = isSessionExpired;
          throw error;
        }

        console.log(`✅ [SESSION-MANAGER] RPC Success: ${model}.${method}`);
        return data.result as T;

      } catch (error: any) {
        lastError = error;

        // If it's a session error and we have retries left, continue
        if (error.isSessionExpired && attempt < maxRetries) {
          continue;
        }

        // Otherwise, throw
        throw error;
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('RPC call failed after retries');
  }

  /**
   * Check if error is a session expiry error
   */
  private isSessionExpiredError(error: any): boolean {
    const errorName = error.data?.name || '';
    const errorMessage = error.data?.message || error.message || '';

    return (
      errorName === 'odoo.http.SessionExpiredException' ||
      errorMessage.toLowerCase().includes('session expired') ||
      errorMessage.toLowerCase().includes('session_expired')
    );
  }

  /**
   * Invalidate current session (useful for logout or manual refresh)
   */
  invalidateSession(): void {
    console.log('🗑️  [SESSION-MANAGER] Session invalidated');
    this.currentSession = null;
  }

  /**
   * Get session info for logging/debugging
   */
  getSessionInfo(): { hasSession: boolean; expiresIn?: number; uid?: number } {
    if (!this.currentSession) {
      return { hasSession: false };
    }

    const expiresIn = Math.max(0, this.currentSession.expiresAt - Date.now());

    return {
      hasSession: true,
      expiresIn,
      uid: this.currentSession.uid
    };
  }
}

/**
 * Factory function to create session manager with credentials from env
 */
export function createOdooSessionManager(): OdooSessionManager {
  // Fallback defaults per staging
  const DEFAULT_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
  const DEFAULT_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900';
  const DEFAULT_LOGIN = 'paul@lapa.ch';
  const DEFAULT_PASSWORD = 'lapa201180';

  const credentials: OdooCredentials = {
    url: process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || DEFAULT_URL,
    db: process.env.ODOO_DB || DEFAULT_DB,
    login: process.env.ODOO_USERNAME || DEFAULT_LOGIN,
    password: process.env.ODOO_PASSWORD || DEFAULT_PASSWORD
  };

  console.log('[SESSION-MANAGER] Using Odoo URL:', credentials.url);

  return new OdooSessionManager(credentials);
}

// Singleton instance for reuse across requests
let sessionManagerInstance: OdooSessionManager | null = null;

/**
 * Get or create the singleton session manager
 */
export function getOdooSessionManager(): OdooSessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = createOdooSessionManager();
  }
  return sessionManagerInstance;
}

export type { OdooSessionData, OdooCredentials, SessionError };
export { OdooSessionManager };
