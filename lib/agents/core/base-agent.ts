/**
 * 🤖 BASE AGENT - Classe base per tutti gli agenti
 * Fornisce funzionalità comuni: comunicazione, logging, tool execution
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AgentDefinition,
  AgentTask,
  TaskResult,
  LogEntry,
  AgentTool,
  AppContext,
  CodeChange,
  Artifact
} from '../types/agent-types';

export class BaseAgent {
  protected definition: AgentDefinition;
  protected anthropic: Anthropic;
  protected tools: Map<string, AgentTool>;
  protected conversationHistory: Anthropic.MessageParam[];

  constructor(definition: AgentDefinition) {
    this.definition = definition;
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.tools = new Map();
    this.conversationHistory = [];
  }

  // ============= PUBLIC METHODS =============

  /**
   * Esegue un task assegnato all'agente
   */
  async executeTask(task: AgentTask): Promise<TaskResult> {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    try {
      this.log(logs, 'info', `Starting task ${task.id}: ${task.type}`);

      // Update stats
      this.definition.stats.tasksInProgress++;
      this.definition.status = 'busy';

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(task);

      // Build user message
      const userMessage = this.buildUserMessage(task);

      // Execute with Claude
      const response = await this.executeWithClaude(
        systemPrompt,
        userMessage,
        logs
      );

      // Parse and execute actions
      const result = await this.executeActions(response, task, logs);

      // Update stats on success
      this.definition.stats.tasksCompleted++;
      this.definition.stats.lastActive = new Date();
      this.updateAverageCompletionTime(Date.now() - startTime);

      this.log(logs, 'info', `Task completed successfully in ${Date.now() - startTime}ms`);

      return {
        success: true,
        message: result.message || 'Task completed successfully',
        changes: result.changes,
        artifacts: result.artifacts,
        logs,
        metrics: result.metrics
      };

    } catch (error) {
      this.log(logs, 'error', `Task failed: ${error}`);

      // Update stats on failure
      this.definition.stats.tasksFailed++;

      return {
        success: false,
        message: `Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logs
      };
    } finally {
      this.definition.stats.tasksInProgress--;
      this.definition.status = this.definition.stats.tasksInProgress > 0 ? 'busy' : 'idle';
    }
  }

  /**
   * Ottiene informazioni sull'agente
   */
  getInfo(): AgentDefinition {
    return { ...this.definition };
  }

  /**
   * Registra un nuovo tool
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    if (!this.definition.config.tools.includes(tool.name)) {
      this.definition.config.tools.push(tool.name);
    }
  }

  /**
   * Impara da un task completato con successo
   */
  async learnFromSuccess(task: AgentTask, result: TaskResult): Promise<void> {
    if (result.success && result.changes) {
      // Extract patterns from successful changes
      for (const change of result.changes) {
        // TODO: Implement pattern extraction logic
        this.log([], 'info', `Learning from successful change: ${change.file}`);
      }
    }
  }

  // ============= PROTECTED METHODS =============

  /**
   * Costruisce il system prompt per l'agente
   */
  protected buildSystemPrompt(task: AgentTask): string {
    const basePrompt = `You are ${this.definition.name}, a specialized AI agent.

Your role: ${this.definition.type === 'specialized' ?
  `Specialized agent for the "${this.definition.appContext?.appName}" application` :
  'General orchestration and coordination agent'
}

Capabilities:
${this.definition.capabilities.map(c => `- ${c.name}: ${c.description}`).join('\n')}

${this.definition.appContext ? this.buildAppContextPrompt() : ''}

Available Tools:
${Array.from(this.tools.values()).map(t => `- ${t.name}: ${t.description}`).join('\n')}

Instructions:
1. Analyze the task carefully
2. Use your specialized knowledge of the codebase
3. Use available tools to inspect and modify code
4. Provide clear explanations of your actions
5. Follow best practices and existing code patterns
6. Test your changes when possible
7. Be concise but thorough

Current Task Type: ${task.type}
Priority: ${task.priority}
`;

    return basePrompt;
  }

  /**
   * Costruisce la parte del prompt relativa al contesto dell'app
   */
  protected buildAppContextPrompt(): string {
    if (!this.definition.appContext) return '';

    const ctx = this.definition.appContext;

    return `
Application Context:
- Name: ${ctx.appName}
- Category: ${ctx.category}
- Description: ${ctx.description}

Code Structure:
- Pages: ${ctx.structure.pages.length} files
- Components: ${ctx.structure.components.length} files
- API Routes: ${ctx.structure.apiRoutes.length} files

Dependencies:
- Odoo Models: ${ctx.dependencies.odoo.join(', ') || 'None'}
- External Libraries: ${ctx.dependencies.external.join(', ')}

Patterns Used:
- State Management: ${ctx.patterns.stateManagement || 'Unknown'}
- Data Fetching: ${ctx.patterns.dataFetching || 'Unknown'}
- Styling: ${ctx.patterns.styling || 'Unknown'}

Known Capabilities:
${ctx.capabilities.map(c => `- ${c}`).join('\n')}
`;
  }

  /**
   * Costruisce il messaggio utente per Claude
   */
  protected buildUserMessage(task: AgentTask): string {
    let message = `Task: ${task.request.userMessage}\n\n`;

    if (task.request.context) {
      message += `Additional Context:\n${JSON.stringify(task.request.context, null, 2)}\n\n`;
    }

    if (task.request.files && task.request.files.length > 0) {
      message += `Files Involved:\n${task.request.files.join('\n')}\n\n`;
    }

    message += `Please analyze this task and execute it step by step. Use the available tools to inspect code, make changes, and test your work.`;

    return message;
  }

  /**
   * Esegue la richiesta con Claude
   */
  protected async executeWithClaude(
    systemPrompt: string,
    userMessage: string,
    logs: LogEntry[]
  ): Promise<Anthropic.Message> {
    this.log(logs, 'info', 'Calling Claude API...');

    const messages: Anthropic.MessageParam[] = [
      ...this.conversationHistory,
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await this.anthropic.messages.create({
      model: this.definition.config.model,
      max_tokens: this.definition.config.maxTokens,
      temperature: this.definition.config.temperature,
      system: systemPrompt,
      messages,
      tools: this.buildClaudeTools()
    });

    // Save to history
    this.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.content }
    );

    this.log(logs, 'info', `Claude responded with ${response.content.length} content blocks`);

    return response;
  }

  /**
   * Costruisce i tool per Claude in formato Anthropic
   */
  protected buildClaudeTools(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
  }

  /**
   * Esegue le azioni specificate da Claude
   */
  protected async executeActions(
    response: Anthropic.Message,
    task: AgentTask,
    logs: LogEntry[]
  ): Promise<Partial<TaskResult>> {
    const changes: CodeChange[] = [];
    const artifacts: Artifact[] = [];
    let responseText = '';

    for (const content of response.content) {
      if (content.type === 'text') {
        responseText += content.text;
        this.log(logs, 'info', `Agent response: ${content.text.substring(0, 200)}...`);
      } else if (content.type === 'tool_use') {
        this.log(logs, 'info', `Executing tool: ${content.name}`);

        const tool = this.tools.get(content.name);
        if (tool) {
          try {
            const result = await tool.handler(content.input);
            this.log(logs, 'info', `Tool ${content.name} executed successfully`);

            // Track changes if tool modified code
            if (content.name === 'modify_code' || content.name === 'create_file') {
              changes.push({
                file: (content.input as any).file,
                type: content.name === 'create_file' ? 'created' : 'modified',
                description: `Modified by ${content.name}`
              });
            }
          } catch (error) {
            this.log(logs, 'error', `Tool ${content.name} failed: ${error}`);
          }
        }
      }
    }

    return {
      message: responseText,
      changes,
      artifacts,
      metrics: {
        linesAdded: 0,
        linesRemoved: 0,
        filesModified: changes.length
      }
    };
  }

  /**
   * Aggiorna il tempo medio di completamento
   */
  protected updateAverageCompletionTime(duration: number): void {
    const total = this.definition.stats.tasksCompleted;
    const current = this.definition.stats.averageCompletionTime;

    this.definition.stats.averageCompletionTime =
      (current * (total - 1) + duration) / total;
  }

  /**
   * Logging helper
   */
  protected log(
    logs: LogEntry[],
    level: LogEntry['level'],
    message: string,
    data?: any
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data
    };

    logs.push(entry);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const prefix = `[${this.definition.name}]`;
      switch (level) {
        case 'error':
          console.error(prefix, message, data);
          break;
        case 'warn':
          console.warn(prefix, message, data);
          break;
        case 'debug':
          console.debug(prefix, message, data);
          break;
        default:
          console.log(prefix, message, data);
      }
    }
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Anthropic.MessageParam[] {
    return [...this.conversationHistory];
  }
}
