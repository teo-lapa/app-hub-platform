/**
 * 🤖 SISTEMA MULTI-AGENTE - Type Definitions
 * Sistema scalabile per gestione automatica delle app
 */

import { Message } from '@anthropic-ai/sdk/resources';

// ============= AGENT TYPES =============

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// ============= APP CONTEXT =============

export interface AppContext {
  appName: string;
  appPath: string;
  description: string;
  category: 'magazzino' | 'vendite' | 'delivery' | 'admin' | 'general';

  // Auto-discovered structure
  structure: {
    pages: string[];
    components: string[];
    apiRoutes: string[];
    types: string[];
  };

  // Dependencies
  dependencies: {
    odoo: string[];  // Modelli Odoo usati (es: stock.picking)
    external: string[];  // Librerie esterne
    internal: string[];  // Altri moduli interni
  };

  // Code patterns
  patterns: {
    stateManagement?: string;  // zustand, redux, context
    dataFetching?: string;     // fetch, SWR, react-query
    styling?: string;          // tailwind, styled-components
    routing?: string;          // next.js pages/app router
  };

  // Capabilities
  capabilities: string[];  // ["CRUD prodotti", "Export PDF", etc]

  // Metadata
  metadata: {
    lastAnalyzed: Date;
    linesOfCode: number;
    complexity: 'low' | 'medium' | 'high';
    maintenanceScore: number;  // 0-100
  };
}

// ============= AGENT DEFINITION =============

export interface AgentDefinition {
  id: string;
  name: string;
  type: 'specialized' | 'orchestrator' | 'utility';
  status: AgentStatus;

  // Context
  appContext?: AppContext;  // Solo per specialized agents

  // Capabilities
  capabilities: AgentCapability[];

  // Configuration
  config: {
    model: string;  // claude-sonnet-4-5-20250929
    maxTokens: number;
    temperature: number;
    tools: string[];  // Lista tool disponibili
  };

  // Stats
  stats: {
    tasksCompleted: number;
    tasksInProgress: number;
    tasksFailed: number;
    averageCompletionTime: number;  // ms
    successRate: number;  // 0-100
    lastActive: Date;
  };

  // Learning
  learningData: {
    successfulPatterns: Pattern[];
    commonErrors: ErrorPattern[];
    improvements: Improvement[];
  };
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  examples: string[];
}

export interface Pattern {
  name: string;
  description: string;
  code: string;
  useCount: number;
  successRate: number;
}

export interface ErrorPattern {
  error: string;
  frequency: number;
  solutions: string[];
}

export interface Improvement {
  date: Date;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

// ============= TASK DEFINITION =============

export interface AgentTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;

  // Request
  request: {
    userMessage: string;
    context?: Record<string, any>;
    files?: string[];  // File paths coinvolti
  };

  // Assignment
  assignedTo?: string;  // Agent ID
  createdBy: 'user' | 'orchestrator' | string;

  // Execution
  startTime?: Date;
  endTime?: Date;
  duration?: number;  // ms

  // Results
  result?: TaskResult;

  // Sub-tasks (per task complessi)
  subtasks?: AgentTask[];
  parentTaskId?: string;

  // Metadata
  metadata: {
    retryCount: number;
    maxRetries: number;
    estimatedDuration?: number;
    tags: string[];
  };
}

export type TaskType =
  | 'bug_fix'
  | 'feature_add'
  | 'refactor'
  | 'documentation'
  | 'testing'
  | 'analysis'
  | 'optimization'
  | 'deployment';

export interface TaskResult {
  success: boolean;
  message: string;

  // Changes made
  changes?: CodeChange[];

  // Artifacts produced
  artifacts?: Artifact[];

  // Logs
  logs: LogEntry[];

  // Metrics
  metrics?: {
    linesAdded: number;
    linesRemoved: number;
    filesModified: number;
    testsPassed?: number;
    testsFailed?: number;
  };
}

export interface CodeChange {
  file: string;
  type: 'created' | 'modified' | 'deleted';
  diff?: string;
  description: string;
}

export interface Artifact {
  type: 'code' | 'documentation' | 'test' | 'config';
  name: string;
  path: string;
  content: string;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

// ============= ORCHESTRATOR =============

export interface OrchestratorState {
  activeAgents: Map<string, AgentDefinition>;
  taskQueue: AgentTask[];
  activeTasks: Map<string, AgentTask>;
  completedTasks: AgentTask[];

  // Routing
  routing: {
    rules: RoutingRule[];
    history: RoutingDecision[];
  };

  // Coordination
  coordination: {
    activeCoordinations: Coordination[];
    completedCoordinations: Coordination[];
  };
}

export interface RoutingRule {
  id: string;
  condition: (task: AgentTask) => boolean;
  targetAgent: string;
  priority: number;
}

export interface RoutingDecision {
  taskId: string;
  selectedAgent: string;
  reason: string;
  confidence: number;
  timestamp: Date;
}

export interface Coordination {
  id: string;
  taskId: string;
  involvedAgents: string[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  plan: CoordinationPlan;
  results: Map<string, TaskResult>;
}

export interface CoordinationPlan {
  steps: CoordinationStep[];
  dependencies: Map<string, string[]>;  // step -> [dependent steps]
}

export interface CoordinationStep {
  id: string;
  agentId: string;
  description: string;
  status: TaskStatus;
  order: number;
}

// ============= KNOWLEDGE BASE =============

export interface KnowledgeBase {
  apps: Map<string, AppContext>;
  codeIndex: CodeIndex;
  bestPractices: BestPractice[];
  commonPatterns: CommonPattern[];
}

export interface CodeIndex {
  files: Map<string, FileInfo>;
  functions: Map<string, FunctionInfo>;
  components: Map<string, ComponentInfo>;
  dependencies: DependencyGraph;
}

export interface FileInfo {
  path: string;
  type: 'component' | 'api' | 'util' | 'type' | 'config';
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  exports: string[];
  lastModified: Date;
}

export interface FunctionInfo {
  name: string;
  file: string;
  signature: string;
  description?: string;
  complexity: number;
  usageCount: number;
}

export interface ComponentInfo {
  name: string;
  file: string;
  type: 'page' | 'component' | 'layout';
  props: PropInfo[];
  dependencies: string[];
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string;
  type: 'file' | 'package' | 'module';
  path: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'dynamic';
}

export interface BestPractice {
  id: string;
  category: string;
  title: string;
  description: string;
  examples: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface CommonPattern {
  id: string;
  name: string;
  description: string;
  code: string;
  usageCount: number;
  tags: string[];
}

// ============= TOOL DEFINITIONS =============

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (input: any) => Promise<any>;
}

export interface CodeAnalyzerInput {
  files: string[];
  analysisType: 'structure' | 'complexity' | 'dependencies' | 'issues';
}

export interface CodeModifierInput {
  file: string;
  operation: 'create' | 'update' | 'delete';
  content?: string;
  patches?: CodePatch[];
}

export interface CodePatch {
  line: number;
  oldContent: string;
  newContent: string;
}

export interface TestRunnerInput {
  testFiles?: string[];
  testPattern?: string;
  coverage?: boolean;
}

// ============= API TYPES =============

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    taskId?: string;
    attachments?: string[];
  };
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  metadata?: {
    agentId: string;
    taskId?: string;
    duration: number;
  };
}

// ============= EXPORTS =============

export type {
  Message as AnthropicMessage
};
