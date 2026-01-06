/**
 * Claude API Tool Definitions for Odoo MCP Tools
 * These definitions are compatible with Claude's function calling API
 */

import { ClaudeToolDefinition, OdooToolName } from './types';

/**
 * Search and read records from any Odoo model
 */
export const searchReadModelTool: ClaudeToolDefinition = {
  name: OdooToolName.SEARCH_READ_MODEL,
  description: 'Search and read records from any Odoo model. Supports domain filtering, field selection, pagination, and ordering.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'res.partner', 'sale.order', 'product.product')",
      },
      domain: {
        type: 'array',
        description: "Odoo domain filter as an array (e.g., [['state', '=', 'draft'], ['partner_id', '!=', false]]). Use '&' for AND, '|' for OR, '!' for NOT.",
      },
      fields: {
        type: 'array',
        description: "List of field names to retrieve (e.g., ['name', 'email', 'phone']). Use empty array [] to get all fields.",
        items: { type: 'string' },
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of records to return (default: 100)',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'integer',
        description: 'Number of records to skip for pagination (default: 0)',
        minimum: 0,
      },
      order: {
        type: 'string',
        description: "Sort order (e.g., 'name asc', 'create_date desc', 'id')",
      },
    },
    required: ['model_name', 'domain', 'fields'],
  },
};

/**
 * Create new records in any Odoo model
 */
export const createModelTool: ClaudeToolDefinition = {
  name: OdooToolName.CREATE_MODEL,
  description: 'Create a new record in any Odoo model. Returns the ID of the created record.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'res.partner', 'sale.order')",
      },
      values: {
        type: 'object',
        description: "Dictionary of field values for the new record (e.g., {'name': 'John Doe', 'email': 'john@example.com'})",
      },
    },
    required: ['model_name', 'values'],
  },
};

/**
 * Update existing records in any Odoo model
 */
export const writeModelTool: ClaudeToolDefinition = {
  name: OdooToolName.WRITE_MODEL,
  description: 'Update existing records in any Odoo model. Can update multiple records at once.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'res.partner', 'sale.order')",
      },
      record_ids: {
        type: 'array',
        description: 'List of record IDs to update',
        items: { type: 'integer' },
      },
      values: {
        type: 'object',
        description: "Dictionary of field values to update (e.g., {'name': 'Updated Name', 'active': false})",
      },
    },
    required: ['model_name', 'record_ids', 'values'],
  },
};

/**
 * Get field definitions for any Odoo model
 */
export const getModelFieldsTool: ClaudeToolDefinition = {
  name: OdooToolName.GET_MODEL_FIELDS,
  description: 'Get all field definitions for an Odoo model, including field types, labels, required flags, and relation information.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'res.partner', 'sale.order')",
      },
    },
    required: ['model_name'],
  },
};

/**
 * Get relationships for any Odoo model
 */
export const getModelRelationsTool: ClaudeToolDefinition = {
  name: OdooToolName.GET_MODEL_RELATIONS,
  description: 'Get all relationships (many2one, one2many, many2many) for an Odoo model to understand the data structure.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'res.partner', 'sale.order')",
      },
    },
    required: ['model_name'],
  },
};

/**
 * Execute button actions on records
 */
export const callButtonTool: ClaudeToolDefinition = {
  name: OdooToolName.CALL_BUTTON,
  description: "Execute a button action on Odoo records. Button actions typically start with 'action_' or 'button_' (e.g., action_confirm, action_cancel, button_validate).",
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'sale.order', 'stock.picking')",
      },
      record_ids: {
        type: 'array',
        description: 'List of record IDs on which to execute the button action',
        items: { type: 'integer' },
      },
      button_name: {
        type: 'string',
        description: "Name of the button/action method (e.g., 'action_confirm', 'action_cancel', 'button_validate')",
      },
    },
    required: ['model_name', 'record_ids', 'button_name'],
  },
};

/**
 * List available Odoo models
 */
export const listModelsTool: ClaudeToolDefinition = {
  name: OdooToolName.LIST_MODELS,
  description: 'List available Odoo models with optional search filter. Useful for discovering what models exist in the system.',
  input_schema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Search term to filter models by name or description',
      },
      state: {
        type: 'string',
        description: 'Filter modules by installation state',
        enum: ['installed', 'uninstalled', 'to upgrade', 'to remove', 'to install', 'uninstallable'],
      },
    },
  },
};

/**
 * Execute any method on an Odoo model
 */
export const executeMethodTool: ClaudeToolDefinition = {
  name: OdooToolName.EXECUTE_METHOD,
  description: 'Execute any method on an Odoo model. Can be used for instance methods (on specific records) or class methods.',
  input_schema: {
    type: 'object',
    properties: {
      model_name: {
        type: 'string',
        description: "The Odoo model name (e.g., 'sale.order', 'res.partner')",
      },
      method_name: {
        type: 'string',
        description: "Name of the method to execute (e.g., 'action_confirm', 'name_get', 'default_get')",
      },
      record_ids: {
        type: 'array',
        description: 'List of record IDs for instance methods. Omit or pass empty array for class methods.',
        items: { type: 'integer' },
      },
      args: {
        type: 'array',
        description: 'Positional arguments to pass to the method',
      },
      kwargs: {
        type: 'object',
        description: 'Keyword arguments to pass to the method',
      },
    },
    required: ['model_name', 'method_name'],
  },
};

/**
 * All Odoo tool definitions for Claude API
 */
export const odooToolDefinitions: ClaudeToolDefinition[] = [
  searchReadModelTool,
  createModelTool,
  writeModelTool,
  getModelFieldsTool,
  getModelRelationsTool,
  callButtonTool,
  listModelsTool,
  executeMethodTool,
];

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): ClaudeToolDefinition | undefined {
  return odooToolDefinitions.find((tool) => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return odooToolDefinitions.map((tool) => tool.name);
}
