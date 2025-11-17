/**
 * Contact Enricher Configuration
 *
 * Gestisce le variabili di ambiente e configurazioni opzionali
 */

export interface ContactEnricherConfig {
  apiKey: string;
  apiBase?: string;
  timeout: number; // milliseconds
  cacheTtl: number; // milliseconds
  cacheMaxSize: number;
  debug: boolean;
  rateLimit: number; // requests per minute
  maxRetries: number;
  retryDelay: number; // milliseconds
  logoTimeout: number;
  logoMaxSize: number; // bytes
  minScoreThreshold: number;
  enableLogoFetch: boolean;
  enableSocialDiscovery: boolean;
}

/**
 * Configuration defaults
 */
const DEFAULT_CONFIG: Omit<ContactEnricherConfig, 'apiKey'> = {
  apiBase: undefined,
  timeout: 120000, // 2 minutes
  cacheTtl: 24 * 60 * 60 * 1000, // 24 hours
  cacheMaxSize: 1000,
  debug: false,
  rateLimit: 30, // requests per minute
  maxRetries: 3,
  retryDelay: 1000,
  logoTimeout: 10000,
  logoMaxSize: 500 * 1024, // 500 KB
  minScoreThreshold: 50,
  enableLogoFetch: true,
  enableSocialDiscovery: true,
};

/**
 * Load configuration from environment variables
 */
export function loadContactEnricherConfig(): ContactEnricherConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return {
    apiKey,
    apiBase: process.env.ANTHROPIC_API_BASE || DEFAULT_CONFIG.apiBase,
    timeout: parseInt(
      process.env.CONTACT_ENRICHER_TIMEOUT || String(DEFAULT_CONFIG.timeout)
    ),
    cacheTtl: parseInt(
      process.env.CONTACT_ENRICHER_CACHE_TTL || String(DEFAULT_CONFIG.cacheTtl)
    ),
    cacheMaxSize: parseInt(
      process.env.CONTACT_ENRICHER_CACHE_MAX_SIZE || String(DEFAULT_CONFIG.cacheMaxSize)
    ),
    debug: process.env.CONTACT_ENRICHER_DEBUG === 'true',
    rateLimit: parseInt(
      process.env.CONTACT_ENRICHER_RATE_LIMIT || String(DEFAULT_CONFIG.rateLimit)
    ),
    maxRetries: parseInt(
      process.env.CONTACT_ENRICHER_MAX_RETRIES || String(DEFAULT_CONFIG.maxRetries)
    ),
    retryDelay: parseInt(
      process.env.CONTACT_ENRICHER_RETRY_DELAY || String(DEFAULT_CONFIG.retryDelay)
    ),
    logoTimeout: parseInt(
      process.env.CONTACT_ENRICHER_LOGO_TIMEOUT || String(DEFAULT_CONFIG.logoTimeout)
    ),
    logoMaxSize: parseInt(
      process.env.CONTACT_ENRICHER_LOGO_MAX_SIZE || String(DEFAULT_CONFIG.logoMaxSize)
    ),
    minScoreThreshold: parseInt(
      process.env.CONTACT_ENRICHER_MIN_SCORE_THRESHOLD ||
        String(DEFAULT_CONFIG.minScoreThreshold)
    ),
    enableLogoFetch: process.env.CONTACT_ENRICHER_ENABLE_LOGO_FETCH !== 'false',
    enableSocialDiscovery:
      process.env.CONTACT_ENRICHER_ENABLE_SOCIAL !== 'false',
  };
}

/**
 * Create config with overrides
 */
export function createContactEnricherConfig(
  overrides?: Partial<ContactEnricherConfig>
): ContactEnricherConfig {
  const baseConfig = loadContactEnricherConfig();
  return { ...baseConfig, ...overrides };
}

/**
 * Validate configuration
 */
export function validateContactEnricherConfig(config: ContactEnricherConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('apiKey is required');
  }

  if (config.timeout < 1000) {
    errors.push('timeout must be at least 1000ms');
  }

  if (config.timeout > 600000) {
    errors.push('timeout must not exceed 600000ms (10 minutes)');
  }

  if (config.cacheTtl < 60000) {
    errors.push('cacheTtl must be at least 60000ms (1 minute)');
  }

  if (config.cacheMaxSize < 10) {
    errors.push('cacheMaxSize must be at least 10');
  }

  if (config.cacheMaxSize > 100000) {
    errors.push('cacheMaxSize must not exceed 100000');
  }

  if (config.rateLimit < 1) {
    errors.push('rateLimit must be at least 1');
  }

  if (config.rateLimit > 1000) {
    errors.push('rateLimit must not exceed 1000 requests per minute');
  }

  if (config.maxRetries < 0) {
    errors.push('maxRetries must be >= 0');
  }

  if (config.maxRetries > 10) {
    errors.push('maxRetries must not exceed 10');
  }

  if (config.retryDelay < 100) {
    errors.push('retryDelay must be at least 100ms');
  }

  if (config.logoMaxSize < 10 * 1024) {
    errors.push('logoMaxSize must be at least 10KB');
  }

  if (config.logoMaxSize > 10 * 1024 * 1024) {
    errors.push('logoMaxSize must not exceed 10MB');
  }

  if (config.minScoreThreshold < 0 || config.minScoreThreshold > 100) {
    errors.push('minScoreThreshold must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration with validation
 */
export function getContactEnricherConfig(): ContactEnricherConfig {
  const config = loadContactEnricherConfig();
  const validation = validateContactEnricherConfig(config);

  if (!validation.valid) {
    const errorMessage = `Invalid Contact Enricher configuration:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`;
    throw new Error(errorMessage);
  }

  return config;
}

/**
 * Log configuration (sanitized)
 */
export function logContactEnricherConfig(config: ContactEnricherConfig): void {
  console.log('Contact Enricher Configuration:');
  console.log(`  API Base: ${config.apiBase || 'default'}`);
  console.log(`  Timeout: ${config.timeout}ms`);
  console.log(`  Cache TTL: ${config.cacheTtl}ms`);
  console.log(`  Cache Max Size: ${config.cacheMaxSize}`);
  console.log(`  Rate Limit: ${config.rateLimit} req/min`);
  console.log(`  Max Retries: ${config.maxRetries}`);
  console.log(`  Retry Delay: ${config.retryDelay}ms`);
  console.log(`  Logo Timeout: ${config.logoTimeout}ms`);
  console.log(`  Logo Max Size: ${(config.logoMaxSize / 1024).toFixed(2)}KB`);
  console.log(`  Min Score Threshold: ${config.minScoreThreshold}`);
  console.log(`  Enable Logo Fetch: ${config.enableLogoFetch}`);
  console.log(`  Enable Social Discovery: ${config.enableSocialDiscovery}`);
  console.log(`  Debug Mode: ${config.debug}`);
  // API Key is NOT logged for security reasons
  console.log(`  API Key: [REDACTED]`);
}

/**
 * Helper: Format bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Helper: Format duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Default singleton config instance
 */
let defaultConfig: ContactEnricherConfig | null = null;

/**
 * Get default config instance
 */
export function getDefaultConfig(): ContactEnricherConfig {
  if (!defaultConfig) {
    defaultConfig = getContactEnricherConfig();

    if (process.env.CONTACT_ENRICHER_DEBUG === 'true') {
      logContactEnricherConfig(defaultConfig);
    }
  }

  return defaultConfig;
}

/**
 * Reset default config
 */
export function resetDefaultConfig(): void {
  defaultConfig = null;
}
