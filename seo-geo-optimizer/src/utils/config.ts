/**
 * Configuration Manager
 * Gestione centralizzata delle configurazioni
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');

// Carica .env
const envPath = resolve(rootDir, '.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

interface ConfigSchema {
  // API Keys
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;

  // Odoo
  ODOO_URL: string;
  ODOO_DB: string;
  ODOO_USERNAME: string;
  ODOO_PASSWORD: string;

  // Website
  WEBSITE_URL: string;
  WEBSITE_NAME: string;

  // RAG
  EMBEDDING_MODEL: string;
  EMBEDDING_DIMENSIONS: number;
  SIMILARITY_THRESHOLD: number;

  // Analysis
  MAX_TOKENS_PER_BLOCK: number;
  MIN_CONTENT_LENGTH: number;
}

const defaults: Partial<ConfigSchema> = {
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,
  SIMILARITY_THRESHOLD: 0.75,
  MAX_TOKENS_PER_BLOCK: 800,
  MIN_CONTENT_LENGTH: 300,
  WEBSITE_NAME: 'LAPA',
};

class Config {
  private values: Map<string, string | number> = new Map();

  constructor() {
    this.loadFromEnv();
  }

  private loadFromEnv() {
    // Carica valori da environment
    for (const [key, value] of Object.entries(process.env)) {
      if (value) {
        this.values.set(key, value);
      }
    }

    // Applica defaults
    for (const [key, value] of Object.entries(defaults)) {
      if (!this.values.has(key) && value !== undefined) {
        this.values.set(key, value);
      }
    }
  }

  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    const value = this.values.get(key);
    if (value === undefined) {
      throw new Error(`Configurazione mancante: ${key}`);
    }
    return value as ConfigSchema[K];
  }

  getOptional<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] | undefined {
    return this.values.get(key) as ConfigSchema[K] | undefined;
  }

  set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]) {
    this.values.set(key, value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  getRootDir(): string {
    return rootDir;
  }

  getDataDir(): string {
    return resolve(rootDir, 'data');
  }

  getEmbeddingsDir(): string {
    return resolve(rootDir, 'data', 'embeddings');
  }

  getReportsDir(): string {
    return resolve(rootDir, 'data', 'reports');
  }

  getCacheDir(): string {
    return resolve(rootDir, 'data', 'cache');
  }

  /**
   * Verifica che tutte le configurazioni richieste siano presenti
   */
  validate(required: (keyof ConfigSchema)[]): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const key of required) {
      if (!this.has(key)) {
        missing.push(key);
      }
    }
    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

export const config = new Config();
