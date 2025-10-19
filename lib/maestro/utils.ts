/**
 * MAESTRO AI - Utility Types & Helper Functions
 *
 * Advanced TypeScript utility types and type-safe helpers
 */

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties of T readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Make specific keys K of T required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys K of T optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends Array<infer U> ? U : never;

// ============================================================================
// API RESPONSE HELPERS
// ============================================================================

import type { ApiSuccessResponse, ApiErrorResponse } from './types';

/**
 * Type guard to check if response is success
 */
export function isSuccessResponse<T>(
  response: ApiSuccessResponse<T> | ApiErrorResponse
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// ODOO HELPERS
// ============================================================================

/**
 * Extract ID from Odoo Many2one field
 */
export function extractOdooId(field: [number, string] | false): number | null {
  return field ? field[0] : null;
}

/**
 * Extract name from Odoo Many2one field
 */
export function extractOdooName(field: [number, string] | false): string | null {
  return field ? field[1] : null;
}

/**
 * Convert Odoo false to null
 */
export function odooFalseToNull<T>(value: T | false): T | null {
  return value === false ? null : value;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Type guard to check if value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for non-empty array
 */
export function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

// ============================================================================
// NUMBER HELPERS
// ============================================================================

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Round to N decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Safe divide (returns 0 if divisor is 0)
 */
export function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
