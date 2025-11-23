/**
 * Review Manager Pro
 * Sistema gestione recensioni multi-piattaforma
 *
 * Esporta tutti i moduli del sistema
 */

// Types
export * from './types';

// Database Service
export * from './db-service';

// AI Service
export * from './ai-service';

// Sync Service
export * from './sync-service';

// Platform Integrations
export * as GooglePlatform from './platforms/google';
export * as InstagramPlatform from './platforms/instagram';
export * as FacebookPlatform from './platforms/facebook';
export * as TikTokPlatform from './platforms/tiktok';
