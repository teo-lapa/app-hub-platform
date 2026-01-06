/**
 * Odoo MCP Tool Implementations
 * These tools use the existing Odoo client from lib/odoo-client.ts
 */

import { getOdooClient } from '../odoo-client';
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
  OdooRelation,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

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
  if (!modelName.includes('.') && !['base', 'mail'].includes(modelName.split('.')[0])) {
    // Most Odoo models have format: module.model
    // Allow both formats
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

    const client = await getOdooClient();

    const records = await client.searchReadKw(
      input.model_name,
      input.domain || [],
      input.fields || [],
      {
        limit: input.limit || 100,
        offset: input.offset || 0,
        order: input.order,
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

    const client = await getOdooClient();

    // The Odoo client expects an array for create
    const result = await client.create(input.model_name, [input.values]);

    // Result can be a single ID or array of IDs
    const recordId = Array.isArray(result) ? result[0] : result;

    return ok({
      model: input.model_name,
      record_id: recordId,
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

    const client = await getOdooClient();

    const success = await client.write(input.model_name, input.record_ids, input.values);

    return ok({
      model: input.model_name,
      record_ids: input.record_ids,
      success,
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

    const client = await getOdooClient();

    // Use the call method to get fields_get
    const fieldsInfo = await client.call(
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

    const client = await getOdooClient();

    // Get fields info with relation data
    const fieldsInfo = await client.call(
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

    const client = await getOdooClient();

    // Execute the button method on the records
    const result = await client.call(
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
    const client = await getOdooClient();

    // Build domain for ir.model search
    const domain: any[] = [];
    if (input.search) {
      domain.push('|');
      domain.push(['model', 'ilike', input.search]);
      domain.push(['name', 'ilike', input.search]);
    }

    const models = await client.searchReadKw(
      'ir.model',
      domain,
      ['model', 'name', 'info'],
      { limit: 200, order: 'model' }
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

    // Validate record_ids if provided
    if (input.record_ids && input.record_ids.length > 0) {
      const recordIdsError = validateRecordIds(input.record_ids);
      if (recordIdsError) return recordIdsError;
    }

    const client = await getOdooClient();

    // Build args: if record_ids provided, they go first
    const args: any[] = [];
    if (input.record_ids && input.record_ids.length > 0) {
      args.push(input.record_ids);
    }
    if (input.args) {
      args.push(...input.args);
    }

    const result = await client.call(
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
