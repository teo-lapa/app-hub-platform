/**
 * Odoo MCP Tools Library
 *
 * A TypeScript library implementing Odoo RPC tools for use with Claude API function calling.
 * Based on the odoo-rpc-mcp reference implementation.
 *
 * @example Basic usage with Claude API
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { getToolDefinitions, processToolCalls } from '@/lib/mcp-tools';
 *
 * const anthropic = new Anthropic();
 *
 * // Create message with tools
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 4096,
 *   tools: getToolDefinitions(),
 *   messages: [{ role: 'user', content: 'List all sale orders' }]
 * });
 *
 * // Process tool calls
 * const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
 * if (toolUseBlocks.length > 0) {
 *   const toolResults = await processToolCalls(toolUseBlocks);
 *   // Continue conversation with tool results...
 * }
 * ```
 *
 * @example Direct tool execution
 * ```typescript
 * import { searchReadModel, createModel, callButton } from '@/lib/mcp-tools';
 *
 * // Search for partners
 * const result = await searchReadModel({
 *   model_name: 'res.partner',
 *   domain: [['is_company', '=', true]],
 *   fields: ['name', 'email', 'phone'],
 *   limit: 10
 * });
 *
 * // Create a new record
 * const newPartner = await createModel({
 *   model_name: 'res.partner',
 *   values: { name: 'New Company', is_company: true }
 * });
 *
 * // Execute button action
 * const confirmed = await callButton({
 *   model_name: 'sale.order',
 *   record_ids: [123],
 *   button_name: 'action_confirm'
 * });
 * ```
 */

// Types
export * from './types';

// Tool Definitions (for Claude API)
export {
  odooToolDefinitions,
  getToolDefinition,
  getToolNames,
  searchReadModelTool,
  createModelTool,
  writeModelTool,
  getModelFieldsTool,
  getModelRelationsTool,
  callButtonTool,
  listModelsTool,
  executeMethodTool,
} from './tool-definitions';

// Tool Implementations (direct usage)
export {
  searchReadModel,
  createModel,
  writeModel,
  getModelFields,
  getModelRelations,
  callButton,
  listModels,
  executeMethod,
  odooTools,
} from './odoo-tools';

// Tool Executor (for Claude API integration)
export {
  OdooToolExecutor,
  getOdooToolExecutor,
  processToolCalls,
  getToolDefinitions,
  executeTool,
  type ToolCall,
  type ToolResultResponse,
} from './tool-executor';
