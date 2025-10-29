/**
 * Zod Validation Schemas per Supplier Cadence API
 *
 * Validazione strict per tutti gli input API.
 */

import { z } from 'zod';
import { CadenceType, Weekday } from '@/lib/types/supplier-cadence';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

/**
 * Schema validazione tipo cadenza
 */
export const cadenceTypeSchema = z.nativeEnum(CadenceType, {
  message: 'Tipo cadenza non valido. Usa: fixed_days, weekly, biweekly, monthly',
});

/**
 * Schema validazione giorni settimana
 */
export const weekdaySchema = z.nativeEnum(Weekday, {
  message: 'Giorno settimana non valido. Usa valori 0-6 (Domenica-Sabato)',
});

/**
 * Schema validazione array giorni settimana
 */
export const weekdaysArraySchema = z
  .array(weekdaySchema)
  .min(1, 'Devi selezionare almeno un giorno della settimana')
  .max(7, 'Non puoi selezionare più di 7 giorni')
  .refine(
    (days) => {
      // Check no duplicates
      const uniqueDays = new Set(days);
      return uniqueDays.size === days.length;
    },
    {
      message: 'Non puoi selezionare giorni duplicati',
    }
  );

/**
 * Schema validazione valore cadenza (giorni)
 */
export const cadenceValueSchema = z
  .number()
  .int('Il valore deve essere un numero intero')
  .min(1, 'Il valore minimo è 1 giorno')
  .max(365, 'Il valore massimo è 365 giorni');

/**
 * Schema validazione giorno del mese (per monthly)
 */
export const monthDaySchema = z
  .number()
  .int('Il giorno del mese deve essere un numero intero')
  .min(1, 'Il giorno minimo è 1')
  .max(31, 'Il giorno massimo è 31');

/**
 * Schema validazione data ISO
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve essere in formato YYYY-MM-DD')
  .refine(
    (dateStr) => {
      const date = new Date(dateStr);
      return !isNaN(date.getTime());
    },
    {
      message: 'Data non valida',
    }
  );

// ============================================================================
// CREATE CADENCE REQUEST
// ============================================================================

/**
 * Schema per creare nuova cadenza
 */
export const createCadenceSchema = z
  .object({
    supplier_id: z.number().int().positive('supplier_id deve essere positivo'),
    supplier_name: z.string().min(1, 'supplier_name è obbligatorio').max(255),
    cadence_type: cadenceTypeSchema,
    cadence_value: cadenceValueSchema.nullable().optional(),
    weekdays: weekdaysArraySchema.nullable().optional(),
    next_order_date: isoDateSchema.nullable().optional(),
    average_lead_time_days: z.number().min(0).optional().default(0),
    notes: z.string().max(1000, 'Note troppo lunghe (max 1000 caratteri)').nullable().optional(),
    updated_by: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    // Validazione cross-field: cadence_value e weekdays devono essere consistenti con cadence_type

    switch (data.cadence_type) {
      case CadenceType.FIXED_DAYS:
        if (!data.cadence_value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cadence_value'],
            message: 'cadence_value è obbligatorio per tipo "fixed_days"',
          });
        }
        if (data.weekdays) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['weekdays'],
            message: 'weekdays non è valido per tipo "fixed_days"',
          });
        }
        break;

      case CadenceType.WEEKLY:
      case CadenceType.BIWEEKLY:
        if (!data.weekdays || data.weekdays.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['weekdays'],
            message: `weekdays è obbligatorio per tipo "${data.cadence_type}"`,
          });
        }
        if (data.cadence_value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cadence_value'],
            message: `cadence_value non è valido per tipo "${data.cadence_type}"`,
          });
        }
        break;

      case CadenceType.MONTHLY:
        if (!data.cadence_value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cadence_value'],
            message: 'cadence_value (giorno del mese) è obbligatorio per tipo "monthly"',
          });
        } else if (data.cadence_value < 1 || data.cadence_value > 31) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['cadence_value'],
            message: 'cadence_value per tipo "monthly" deve essere tra 1 e 31',
          });
        }
        if (data.weekdays) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['weekdays'],
            message: 'weekdays non è valido per tipo "monthly"',
          });
        }
        break;
    }
  });

export type CreateCadenceInput = z.infer<typeof createCadenceSchema>;

// ============================================================================
// UPDATE CADENCE REQUEST
// ============================================================================

/**
 * Schema per aggiornare cadenza esistente
 */
export const updateCadenceSchema = z
  .object({
    cadence_type: cadenceTypeSchema.optional(),
    cadence_value: cadenceValueSchema.nullable().optional(),
    weekdays: weekdaysArraySchema.nullable().optional(),
    is_active: z.boolean().optional(),
    next_order_date: isoDateSchema.nullable().optional(),
    last_order_date: isoDateSchema.nullable().optional(),
    average_lead_time_days: z.number().min(0).optional(),
    notes: z.string().max(1000, 'Note troppo lunghe (max 1000 caratteri)').nullable().optional(),
    updated_by: z.string().max(255).optional(),
  })
  .strict() // Non permettere campi extra
  .refine(
    (data) => {
      // Almeno un campo deve essere presente
      return Object.keys(data).length > 0;
    },
    {
      message: 'Devi fornire almeno un campo da aggiornare',
    }
  )
  .superRefine((data, ctx) => {
    // Se viene cambiato cadence_type, valida coerenza con altri campi
    if (data.cadence_type) {
      switch (data.cadence_type) {
        case CadenceType.FIXED_DAYS:
          if (data.cadence_value === undefined || data.cadence_value === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['cadence_value'],
              message: 'Se cambi tipo a "fixed_days", devi fornire cadence_value',
            });
          }
          if (data.weekdays !== undefined && data.weekdays !== null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['weekdays'],
              message: 'weekdays non è compatibile con tipo "fixed_days"',
            });
          }
          break;

        case CadenceType.WEEKLY:
        case CadenceType.BIWEEKLY:
          if (!data.weekdays || data.weekdays.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['weekdays'],
              message: `Se cambi tipo a "${data.cadence_type}", devi fornire weekdays`,
            });
          }
          if (data.cadence_value !== undefined && data.cadence_value !== null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['cadence_value'],
              message: `cadence_value non è compatibile con tipo "${data.cadence_type}"`,
            });
          }
          break;

        case CadenceType.MONTHLY:
          if (data.cadence_value === undefined || data.cadence_value === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['cadence_value'],
              message: 'Se cambi tipo a "monthly", devi fornire cadence_value (giorno mese)',
            });
          } else if (data.cadence_value < 1 || data.cadence_value > 31) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['cadence_value'],
              message: 'Per tipo "monthly", cadence_value deve essere tra 1 e 31',
            });
          }
          if (data.weekdays !== undefined && data.weekdays !== null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['weekdays'],
              message: 'weekdays non è compatibile con tipo "monthly"',
            });
          }
          break;
      }
    }
  });

export type UpdateCadenceInput = z.infer<typeof updateCadenceSchema>;

// ============================================================================
// QUERY FILTERS
// ============================================================================

/**
 * Schema per filtri query list
 */
export const cadenceFiltersSchema = z.object({
  is_active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  cadence_type: cadenceTypeSchema.optional(),
  search: z.string().max(255).optional(),
  status: z.enum(['on_time', 'due_soon', 'overdue', 'inactive']).optional(),
  sort_by: z.enum(['next_order_date', 'supplier_name', 'last_order_date']).optional().default('next_order_date'),
  sort_direction: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type CadenceFilters = z.infer<typeof cadenceFiltersSchema>;

/**
 * Schema per query upcoming orders
 */
export const upcomingOrdersQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 7;
      const num = parseInt(val, 10);
      return isNaN(num) ? 7 : num;
    })
    .pipe(z.number().int().min(1, 'days deve essere almeno 1').max(365, 'days non può superare 365')),
});

export type UpcomingOrdersQuery = z.infer<typeof upcomingOrdersQuerySchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Valida e parse request body in modo sicuro
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: formatZodError(error),
        details: error,
      };
    }
    return {
      success: false,
      error: 'Errore validazione sconosciuto',
      details: error as z.ZodError,
    };
  }
}

/**
 * Formatta errori Zod in modo user-friendly
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return issues.join('; ');
}
