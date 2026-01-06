/**
 * TypeScript types for Odoo MCP Tools
 * Based on odoo-rpc-mcp reference implementation
 */

// ============================================================================
// Domain Types (Odoo domain filtering)
// ============================================================================

export type OdooDomainOperator =
  | '=' | '!=' | '>' | '>=' | '<' | '<='
  | 'like' | 'ilike' | 'not like' | 'not ilike'
  | 'in' | 'not in'
  | '=like' | '=ilike'
  | 'child_of' | 'parent_of';

export type OdooDomainCondition = [string, OdooDomainOperator, any];
export type OdooDomainLogical = '&' | '|' | '!';
export type OdooDomainElement = OdooDomainCondition | OdooDomainLogical;
export type OdooDomain = OdooDomainElement[];

// ============================================================================
// Field Types
// ============================================================================

export type OdooFieldType =
  | 'char' | 'text' | 'html'
  | 'integer' | 'float' | 'monetary'
  | 'boolean'
  | 'date' | 'datetime'
  | 'binary' | 'image'
  | 'selection'
  | 'many2one' | 'one2many' | 'many2many'
  | 'reference';

export interface OdooFieldInfo {
  type: OdooFieldType;
  string: string;
  help?: string;
  required?: boolean;
  readonly?: boolean;
  store?: boolean;
  sortable?: boolean;
  searchable?: boolean;
  relation?: string;
  relation_field?: string;
  selection?: [string, string][];
  digits?: [number, number];
  default?: any;
}

export interface OdooModelFields {
  [fieldName: string]: OdooFieldInfo;
}

// ============================================================================
// Relation Types
// ============================================================================

export interface OdooRelation {
  field: string;
  model: string;
  string: string;
  required?: boolean;
}

export interface OdooModelRelations {
  model: string;
  many2one: OdooRelation[];
  one2many: OdooRelation[];
  many2many: OdooRelation[];
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface SearchReadModelInput {
  model_name: string;
  domain: OdooDomain;
  fields: string[];
  limit?: number;
  offset?: number;
  order?: string;
}

export interface CreateModelInput {
  model_name: string;
  values: Record<string, any>;
}

export interface WriteModelInput {
  model_name: string;
  record_ids: number[];
  values: Record<string, any>;
}

export interface GetModelFieldsInput {
  model_name: string;
}

export interface GetModelRelationsInput {
  model_name: string;
}

export interface CallButtonInput {
  model_name: string;
  record_ids: number[];
  button_name: string;
}

export interface ListModelsInput {
  search?: string;
  state?: 'installed' | 'uninstalled' | 'to upgrade' | 'to remove' | 'to install' | 'uninstallable';
}

export interface ExecuteMethodInput {
  model_name: string;
  method_name: string;
  record_ids?: number[];
  args?: any[];
  kwargs?: Record<string, any>;
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  error_type?: string;
}

export interface SearchReadResult {
  model: string;
  count: number;
  records: Record<string, any>[];
}

export interface CreateResult {
  model: string;
  record_id: number;
}

export interface WriteResult {
  model: string;
  record_ids: number[];
  success: boolean;
}

export interface GetModelFieldsResult {
  model: string;
  fields: OdooModelFields;
  count: number;
}

export interface GetModelRelationsResult extends OdooModelRelations {}

export interface CallButtonResult {
  model: string;
  record_ids: number[];
  button_name: string;
  action_type?: string;
  action_data?: Record<string, any>;
  success?: boolean;
  message?: string;
}

export interface ListModelsResult {
  count: number;
  models: {
    model: string;
    name: string;
    info?: string;
  }[];
}

export interface ExecuteMethodResult {
  model: string;
  method: string;
  result?: any;
  action_type?: string;
  action_data?: Record<string, any>;
  record_ids?: number[];
  message?: string;
}

// ============================================================================
// Claude API Tool Definition Types
// ============================================================================

export interface ClaudeToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  minimum?: number;
  maximum?: number;
}

export interface ClaudeToolInputSchema {
  type: 'object';
  properties: Record<string, ClaudeToolParameter>;
  required?: string[];
}

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: ClaudeToolInputSchema;
}

// ============================================================================
// Tool Names Enum
// ============================================================================

export enum OdooToolName {
  SEARCH_READ_MODEL = 'search_read_model',
  CREATE_MODEL = 'create_model',
  WRITE_MODEL = 'write_model',
  GET_MODEL_FIELDS = 'get_model_fields',
  GET_MODEL_RELATIONS = 'get_model_relations',
  CALL_BUTTON = 'call_button',
  LIST_MODELS = 'list_models',
  EXECUTE_METHOD = 'execute_method',
}

// Union type of all tool inputs
export type OdooToolInput =
  | { name: OdooToolName.SEARCH_READ_MODEL; input: SearchReadModelInput }
  | { name: OdooToolName.CREATE_MODEL; input: CreateModelInput }
  | { name: OdooToolName.WRITE_MODEL; input: WriteModelInput }
  | { name: OdooToolName.GET_MODEL_FIELDS; input: GetModelFieldsInput }
  | { name: OdooToolName.GET_MODEL_RELATIONS; input: GetModelRelationsInput }
  | { name: OdooToolName.CALL_BUTTON; input: CallButtonInput }
  | { name: OdooToolName.LIST_MODELS; input: ListModelsInput }
  | { name: OdooToolName.EXECUTE_METHOD; input: ExecuteMethodInput };
