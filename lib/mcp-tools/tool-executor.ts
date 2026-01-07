/**
 * Tool Executor for Odoo MCP Tools
 * Executes tools based on Claude's function calls
 */

import {
  searchReadModel,
  createModel,
  writeModel,
  getModelFields,
  getModelRelations,
  callButton,
  listModels,
  executeMethod,
} from './odoo-tools';
import { odooToolDefinitions, getToolDefinition } from './tool-definitions';
import {
  OdooToolName,
  ToolResult,
  ClaudeToolDefinition,
  SearchReadModelInput,
  CreateModelInput,
  WriteModelInput,
  GetModelFieldsInput,
  GetModelRelationsInput,
  CallButtonInput,
  ListModelsInput,
  ExecuteMethodInput,
} from './types';

// ============================================================================
// Tool Call Interface (matches Claude API tool_use structure)
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultResponse {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// ============================================================================
// Tool Executor Class
// ============================================================================

export class OdooToolExecutor {
  /**
   * Get all available tool definitions for Claude API
   */
  getToolDefinitions(): ClaudeToolDefinition[] {
    return odooToolDefinitions;
  }

  /**
   * Get a specific tool definition by name
   */
  getToolDefinition(name: string): ClaudeToolDefinition | undefined {
    return getToolDefinition(name);
  }

  /**
   * Check if a tool name is valid
   */
  isValidTool(name: string): boolean {
    return Object.values(OdooToolName).includes(name as OdooToolName);
  }

  /**
   * Execute a single tool call
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResultResponse> {
    const { id, name, input } = toolCall;

    try {
      const result = await this.executeToolInternal(name, input);

      return {
        tool_use_id: id,
        content: JSON.stringify(result, null, 2),
        is_error: !result.success,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        tool_use_id: id,
        content: JSON.stringify({
          success: false,
          error: `Unexpected error executing tool ${name}: ${errorMessage}`,
          error_type: 'ExecutionError',
        }, null, 2),
        is_error: true,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeTools(toolCalls: ToolCall[]): Promise<ToolResultResponse[]> {
    return Promise.all(toolCalls.map((tc) => this.executeTool(tc)));
  }

  /**
   * Execute a tool by name with given input
   * Returns the raw ToolResult without wrapping
   */
  async executeToolInternal(name: string, input: Record<string, any>): Promise<ToolResult<any>> {
    switch (name) {
      case OdooToolName.SEARCH_READ_MODEL:
        return searchReadModel(input as SearchReadModelInput);

      case OdooToolName.CREATE_MODEL:
        return createModel(input as CreateModelInput);

      case OdooToolName.WRITE_MODEL:
        return writeModel(input as WriteModelInput);

      case OdooToolName.GET_MODEL_FIELDS:
        return getModelFields(input as GetModelFieldsInput);

      case OdooToolName.GET_MODEL_RELATIONS:
        return getModelRelations(input as GetModelRelationsInput);

      case OdooToolName.CALL_BUTTON:
        return callButton(input as CallButtonInput);

      case OdooToolName.LIST_MODELS:
        return listModels(input as ListModelsInput);

      case OdooToolName.EXECUTE_METHOD:
        return executeMethod(input as ExecuteMethodInput);

      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
          error_type: 'ValidationError',
        };
    }
  }

  /**
   * Execute a tool and return formatted string response
   * Useful for simple integrations
   */
  async executeToolFormatted(name: string, input: Record<string, any>): Promise<string> {
    const result = await this.executeToolInternal(name, input);

    if (result.success) {
      if (result.data === undefined || result.data === null) {
        return 'Operation completed successfully';
      }
      return typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data, null, 2);
    } else {
      return `${result.error_type || 'Error'}: ${result.error}`;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let executorInstance: OdooToolExecutor | null = null;

/**
 * Get the singleton OdooToolExecutor instance
 */
export function getOdooToolExecutor(): OdooToolExecutor {
  if (!executorInstance) {
    executorInstance = new OdooToolExecutor();
  }
  return executorInstance;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Process Claude API tool_use blocks and return tool results
 *
 * @example
 * // In your Claude API handler:
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   tools: getToolDefinitions(),
 *   messages: [...]
 * });
 *
 * // Process tool calls
 * const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
 * const toolResults = await processToolCalls(toolUseBlocks);
 *
 * // Send results back to Claude
 * messages.push({ role: 'assistant', content: response.content });
 * messages.push({ role: 'user', content: toolResults.map(r => ({
 *   type: 'tool_result',
 *   tool_use_id: r.tool_use_id,
 *   content: r.content,
 *   is_error: r.is_error,
 * })) });
 */
export async function processToolCalls(
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, any> }>
): Promise<ToolResultResponse[]> {
  const executor = getOdooToolExecutor();
  const toolCalls = toolUseBlocks.map((block) => ({
    id: block.id,
    name: block.name,
    input: block.input,
  }));
  return executor.executeTools(toolCalls);
}

/**
 * Get all tool definitions for Claude API
 *
 * @example
 * const tools = getToolDefinitions();
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   tools: tools,
 *   messages: [...]
 * });
 */
export function getToolDefinitions(): ClaudeToolDefinition[] {
  return getOdooToolExecutor().getToolDefinitions();
}

/**
 * Execute a single tool directly by name
 *
 * @example
 * const result = await executeTool('search_read_model', {
 *   model_name: 'res.partner',
 *   domain: [['is_company', '=', true]],
 *   fields: ['name', 'email'],
 *   limit: 10
 * });
 */
export async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<ToolResult<any>> {
  return getOdooToolExecutor().executeToolInternal(name, input);
}
