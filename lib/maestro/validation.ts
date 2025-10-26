/**
 * MAESTRO AI - Zod Validation Schemas
 *
 * Input validation per tutte le API routes
 */

import { z } from 'zod';

// Schema per query params GET /api/maestro/avatars
export const getAvatarsQuerySchema = z.object({
  salesperson_id: z.coerce.number().int().positive().optional(),
  health_score_min: z.coerce.number().min(0).max(100).optional(),
  churn_risk_min: z.coerce.number().min(0).max(100).optional(),
  search: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().positive().max(10000).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  sort_by: z.enum(['health_score', 'churn_risk_score', 'total_revenue', 'last_order_date', 'name']).default('churn_risk_score'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// Schema per POST /api/maestro/recommendations/generate
export const generateRecommendationsSchema = z.object({
  salesperson_id: z.number().int().positive(),
  max_recommendations: z.number().int().positive().max(50).default(10),
  focus_on: z.enum(['churn', 'upsell', 'all']).default('all'),
});

// Schema per PATCH /api/maestro/recommendations/[id]
export const updateRecommendationSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'dismissed']),
  outcome: z.enum(['success', 'partial_success', 'failed']).optional(),
  outcome_notes: z.string().max(2000).optional(),
});

// Schema per POST /api/maestro/interactions
export const createInteractionSchema = z.object({
  customer_avatar_id: z.string().uuid(),
  interaction_type: z.enum(['visit', 'call', 'email', 'whatsapp', 'other']),
  outcome: z.enum(['successful', 'unsuccessful', 'neutral', 'follow_up_needed']),
  notes: z.string().max(2000).optional(),
  order_placed: z.boolean().default(false),
  order_value: z.number().nonnegative().optional(),
  odoo_order_id: z.number().int().positive().optional(), // ID ordine Odoo creato (campioni/ordine)
  samples_given: z.array(z.object({
    product_id: z.number().int().positive(),
    product_name: z.string(),
    quantity: z.number().positive(),
  })).optional(),
  next_follow_up_date: z.string().optional(), // Accetta qualsiasi string (date o datetime)
  recommendation_id: z.string().uuid().optional(),
});

// Schema per GET /api/maestro/daily-plan
export const getDailyPlanQuerySchema = z.object({
  salesperson_id: z.coerce.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
});

// ============================================================================
// VEHICLE STOCK VALIDATION SCHEMAS
// ============================================================================

// Schema per GET /api/maestro/vehicle-stock
export const getVehicleStockQuerySchema = z.object({
  salesperson_id: z.coerce.number().int().positive({
    message: 'salesperson_id must be a positive integer'
  })
});

// Schema per singolo prodotto nel transfer
export const transferProductSchema = z.object({
  product_id: z.number().int().positive({
    message: 'product_id must be a positive integer'
  }),
  quantity: z.number().positive({
    message: 'quantity must be a positive number'
  }),
  lot_id: z.number().int().positive().optional()
});

// Schema per POST /api/maestro/vehicle-stock/transfer
// NOTE: salesperson_id is now optional because it's extracted from cookies
export const createTransferSchema = z.object({
  salesperson_id: z.number().int().positive({
    message: 'salesperson_id must be a positive integer'
  }).optional(),  // Made optional - will be overridden by authenticated user ID
  products: z.array(transferProductSchema).min(1, {
    message: 'At least one product is required'
  }).max(100, {
    message: 'Maximum 100 products per transfer'
  }),
  type: z.enum(['reload', 'request_gift'], {
    errorMap: () => ({ message: 'type must be either "reload" or "request_gift"' })
  }),
  notes: z.string().max(500).optional()
});

// Schema per GET /api/maestro/vehicle-stock/history
export const getTransferHistoryQuerySchema = z.object({
  salesperson_id: z.coerce.number().int().positive({
    message: 'salesperson_id must be a positive integer'
  }),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// Helper: Valida e parse con error handling
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, error: messages.join(', ') };
    }
    return { success: false, error: 'Invalid request data' };
  }
}
