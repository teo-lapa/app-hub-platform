/**
 * Odoo MCP Tool Implementations
 * These tools use the user's Odoo session for proper authentication and audit trail
 */

import { callOdoo, getOdooSession } from '../odoo-auth';
import {
  ToolResult,
  SearchReadModelInput,
  CreateModelInput,
  WriteModelInput,
  GetModelFieldsInput,
  GetModelRelationsInput,
  CallButtonInput,
  ListModelsInput,
  ExecuteMethodInput,
  SearchReadResult,
  CreateResult,
  WriteResult,
  GetModelFieldsResult,
  GetModelRelationsResult,
  CallButtonResult,
  ListModelsResult,
  ExecuteMethodResult,
  OdooModelFields,
} from './types';

// ============================================================================
// Session Context - passed from the API route
// ============================================================================

export interface OdooSessionContext {
  cookies: string;
  uid: number;
  userName?: string;
}

// Global session context for tool execution
let currentSessionContext: OdooSessionContext | null = null;

/**
 * Set the session context for tool execution
 * This should be called before processing tool calls
 */
export function setOdooSessionContext(context: OdooSessionContext | null) {
  currentSessionContext = context;
  console.log('🔐 [MCP-TOOLS] Session context set:', context ? `UID ${context.uid}` : 'null');
}

/**
 * Get the current session context
 */
export function getOdooSessionContext(): OdooSessionContext | null {
  return currentSessionContext;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get cookies for Odoo calls - uses session context if available
 */
async function getOdooCookies(): Promise<string> {
  if (currentSessionContext?.cookies) {
    console.log('🔐 [MCP-TOOLS] Using user session context');
    return currentSessionContext.cookies;
  }

  // Fallback to system session
  console.log('⚠️ [MCP-TOOLS] No user session, using fallback');
  const { cookies } = await getOdooSession();
  return cookies || '';
}

/**
 * Create a successful result
 */
function ok<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

/**
 * Create an error result
 */
function fail(error: string, errorType: string = 'Error'): ToolResult<never> {
  return { success: false, error, error_type: errorType };
}

/**
 * Validate model name format
 */
function validateModelName(modelName: string): ToolResult<never> | null {
  if (!modelName || typeof modelName !== 'string') {
    return fail('model_name is required and must be a string', 'ValidationError');
  }
  return null;
}

/**
 * Validate record IDs
 */
function validateRecordIds(recordIds: number[], allowEmpty: boolean = false): ToolResult<never> | null {
  if (!Array.isArray(recordIds)) {
    return fail('record_ids must be an array', 'ValidationError');
  }
  if (!allowEmpty && recordIds.length === 0) {
    return fail('record_ids cannot be empty', 'ValidationError');
  }
  for (const id of recordIds) {
    if (typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
      return fail(`Invalid record ID: ${id}. Must be a positive integer.`, 'ValidationError');
    }
  }
  return null;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Search and read records from any Odoo model
 */
export async function searchReadModel(
  input: SearchReadModelInput
): Promise<ToolResult<SearchReadResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    const cookies = await getOdooCookies();

    const records = await callOdoo(
      cookies,
      input.model_name,
      'search_read',
      [input.domain || []],
      {
        fields: input.fields || [],
        limit: input.limit || 100,
        offset: input.offset || 0,
        order: input.order || '',
      }
    );

    return ok({
      model: input.model_name,
      count: records.length,
      records,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to search/read ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * Create a new record in any Odoo model
 */
export async function createModel(
  input: CreateModelInput
): Promise<ToolResult<CreateResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    if (!input.values || typeof input.values !== 'object') {
      return fail('values is required and must be an object', 'ValidationError');
    }

    const cookies = await getOdooCookies();

    // Add user_id if available and not already set (for audit trail)
    const values = { ...input.values };
    if (currentSessionContext?.uid && !values.user_id) {
      // Only set user_id for models that have this field (like sale.order)
      if (['sale.order', 'purchase.order', 'crm.lead', 'helpdesk.ticket'].includes(input.model_name)) {
        values.user_id = currentSessionContext.uid;
      }
    }

    const recordId = await callOdoo(
      cookies,
      input.model_name,
      'create',
      [values],
      {}
    );

    return ok({
      model: input.model_name,
      record_id: Array.isArray(recordId) ? recordId[0] : recordId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to create record in ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * Update existing records in any Odoo model
 */
export async function writeModel(
  input: WriteModelInput
): Promise<ToolResult<WriteResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    const recordIdsError = validateRecordIds(input.record_ids);
    if (recordIdsError) return recordIdsError;

    if (!input.values || typeof input.values !== 'object') {
      return fail('values is required and must be an object', 'ValidationError');
    }

    const cookies = await getOdooCookies();

    const success = await callOdoo(
      cookies,
      input.model_name,
      'write',
      [input.record_ids, input.values],
      {}
    );

    return ok({
      model: input.model_name,
      record_ids: input.record_ids,
      success: success !== false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to update records in ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * Get field definitions for any Odoo model
 */
export async function getModelFields(
  input: GetModelFieldsInput
): Promise<ToolResult<GetModelFieldsResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    const cookies = await getOdooCookies();

    const fieldsInfo = await callOdoo(
      cookies,
      input.model_name,
      'fields_get',
      [],
      { attributes: ['string', 'type', 'help', 'required', 'readonly', 'store', 'relation', 'selection'] }
    );

    return ok({
      model: input.model_name,
      fields: fieldsInfo as OdooModelFields,
      count: Object.keys(fieldsInfo).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to get fields for ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * Get relationships for any Odoo model
 */
export async function getModelRelations(
  input: GetModelRelationsInput
): Promise<ToolResult<GetModelRelationsResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    const cookies = await getOdooCookies();

    const fieldsInfo = await callOdoo(
      cookies,
      input.model_name,
      'fields_get',
      [],
      { attributes: ['string', 'type', 'relation', 'required'] }
    );

    const relations: GetModelRelationsResult = {
      model: input.model_name,
      many2one: [],
      one2many: [],
      many2many: [],
    };

    for (const [fieldName, fieldInfo] of Object.entries(fieldsInfo as Record<string, any>)) {
      if (fieldInfo.type === 'many2one' && fieldInfo.relation) {
        relations.many2one.push({
          field: fieldName,
          model: fieldInfo.relation,
          string: fieldInfo.string || fieldName,
          required: fieldInfo.required || false,
        });
      } else if (fieldInfo.type === 'one2many' && fieldInfo.relation) {
        relations.one2many.push({
          field: fieldName,
          model: fieldInfo.relation,
          string: fieldInfo.string || fieldName,
          required: fieldInfo.required || false,
        });
      } else if (fieldInfo.type === 'many2many' && fieldInfo.relation) {
        relations.many2many.push({
          field: fieldName,
          model: fieldInfo.relation,
          string: fieldInfo.string || fieldName,
          required: fieldInfo.required || false,
        });
      }
    }

    return ok(relations);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to get relations for ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * Execute button actions on records
 */
export async function callButton(
  input: CallButtonInput
): Promise<ToolResult<CallButtonResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    const recordIdsError = validateRecordIds(input.record_ids);
    if (recordIdsError) return recordIdsError;

    if (!input.button_name || typeof input.button_name !== 'string') {
      return fail('button_name is required and must be a string', 'ValidationError');
    }

    const cookies = await getOdooCookies();

    const result = await callOdoo(
      cookies,
      input.model_name,
      input.button_name,
      [input.record_ids],
      {}
    );

    // Process the result based on its type
    const response: CallButtonResult = {
      model: input.model_name,
      record_ids: input.record_ids,
      button_name: input.button_name,
    };

    if (result === null || result === undefined) {
      response.success = true;
      response.message = 'Button executed successfully (no return value)';
    } else if (typeof result === 'boolean') {
      response.success = result;
    } else if (typeof result === 'object' && result.type) {
      // Odoo action response
      response.action_type = result.type;
      response.action_data = result;
    } else {
      response.success = true;
      response.action_data = result;
    }

    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to execute button ${input.button_name} on ${input.model_name}: ${message}`, 'OdooError');
  }
}

/**
 * List available Odoo models
 */
export async function listModels(
  input: ListModelsInput = {}
): Promise<ToolResult<ListModelsResult>> {
  try {
    const cookies = await getOdooCookies();

    const domain: any[] = [];
    if (input.search) {
      domain.push('|');
      domain.push(['model', 'ilike', input.search]);
      domain.push(['name', 'ilike', input.search]);
    }

    const models = await callOdoo(
      cookies,
      'ir.model',
      'search_read',
      [domain],
      { fields: ['model', 'name', 'info'], limit: 200, order: 'model' }
    );

    return ok({
      count: models.length,
      models: models.map((m: any) => ({
        model: m.model,
        name: m.name,
        info: m.info || undefined,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to list models: ${message}`, 'OdooError');
  }
}

/**
 * Execute any method on an Odoo model
 */
export async function executeMethod(
  input: ExecuteMethodInput
): Promise<ToolResult<ExecuteMethodResult>> {
  try {
    const validationError = validateModelName(input.model_name);
    if (validationError) return validationError;

    if (!input.method_name || typeof input.method_name !== 'string') {
      return fail('method_name is required and must be a string', 'ValidationError');
    }

    if (input.record_ids && input.record_ids.length > 0) {
      const recordIdsError = validateRecordIds(input.record_ids);
      if (recordIdsError) return recordIdsError;
    }

    const cookies = await getOdooCookies();

    const args: any[] = [];
    if (input.record_ids && input.record_ids.length > 0) {
      args.push(input.record_ids);
    }
    if (input.args) {
      args.push(...input.args);
    }

    const result = await callOdoo(
      cookies,
      input.model_name,
      input.method_name,
      args,
      input.kwargs || {}
    );

    // Process result
    const response: ExecuteMethodResult = {
      model: input.model_name,
      method: input.method_name,
    };

    if (result === null || result === undefined) {
      response.message = 'Method executed successfully (no return value)';
    } else if (typeof result === 'object' && result.type) {
      // Odoo action response
      response.action_type = result.type;
      response.action_data = result;
    } else if (typeof result === 'object' && result._name && result.ids) {
      // Recordset-like response (won't happen via JSON-RPC, but handle it)
      response.record_ids = result.ids;
    } else {
      response.result = result;
    }

    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`Failed to execute method ${input.method_name} on ${input.model_name}: ${message}`, 'OdooError');
  }
}

// ============================================================================
// Export all tools
// ============================================================================

export const odooTools = {
  searchReadModel,
  createModel,
  writeModel,
  getModelFields,
  getModelRelations,
  callButton,
  listModels,
  executeMethod,
};
