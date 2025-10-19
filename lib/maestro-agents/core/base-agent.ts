/**
 * BASE AGENT - Abstract class for all agents
 * Provides common functionality: Claude AI integration, tool execution, logging
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Agent,
  AgentRole,
  AgentStatus,
  AgentTask,
  AgentResult,
  AgentTool,
  ToolCall,
} from '../types';

export abstract class BaseAgent implements Agent {
  public role: AgentRole;
  public name: string;
  public description: string;
  public capabilities: string[];
  public tools: AgentTool[];
  public status: AgentStatus = 'idle';

  protected anthropic: Anthropic;
  protected maxIterations: number = 5;

  constructor(
    role: AgentRole,
    name: string,
    description: string,
    capabilities: string[],
    tools: AgentTool[]
  ) {
    this.role = role;
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.tools = tools;

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(`⚠️  [${this.name}] ANTHROPIC_API_KEY not set`);
    }
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = 'busy';

    console.log(`🤖 [${this.name}] Executing task: ${task.user_query}`);

    try {
      const systemPrompt = this.getSystemPrompt();
      const userMessage = this.buildUserMessage(task);

      const { response, toolCalls, tokensUsed } = await this.executeWithClaude(
        systemPrompt,
        userMessage
      );

      this.status = 'idle';
      const duration = Date.now() - startTime;

      console.log(`✅ [${this.name}] Task completed in ${duration}ms`);

      return {
        success: true,
        agent_role: this.role,
        data: response,
        tool_calls: toolCalls,
        tokens_used: tokensUsed,
        duration_ms: duration,
      };
    } catch (error) {
      this.status = 'error';
      const duration = Date.now() - startTime;

      console.error(`❌ [${this.name}] Task failed:`, error);

      return {
        success: false,
        agent_role: this.role,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
      };
    }
  }

  abstract getSystemPrompt(): string;

  // ============================================================================
  // PROTECTED METHODS
  // ============================================================================

  protected buildUserMessage(task: AgentTask): string {
    let message = task.user_query;

    if (task.context && Object.keys(task.context).length > 0) {
      message += '\n\nContext:\n';
      for (const [key, value] of Object.entries(task.context)) {
        message += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }

    return message;
  }

  protected async executeWithClaude(
    systemPrompt: string,
    userMessage: string
  ): Promise<{
    response: any;
    toolCalls: ToolCall[];
    tokensUsed: number;
  }> {
    const toolCalls: ToolCall[] = [];
    let totalTokens = 0;

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ];

    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      console.log(`  🔄 [${this.name}] Claude iteration ${iteration}`);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages,
        tools: this.buildClaudeTools(),
      });

      totalTokens += response.usage.input_tokens + response.usage.output_tokens;

      console.log(
        `  📊 Tokens: ${response.usage.input_tokens} in + ${response.usage.output_tokens} out = ${totalTokens} total`
      );

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Agent finished, extract final response
        const textContent = response.content.find((c) => c.type === 'text');
        return {
          response: textContent && textContent.type === 'text' ? textContent.text : null,
          toolCalls,
          tokensUsed: totalTokens,
        };
      }

      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const toolResults: Anthropic.MessageParam[] = [];

        for (const content of response.content) {
          if (content.type === 'tool_use') {
            const toolStartTime = Date.now();
            const tool = this.tools.find((t) => t.name === content.name);

            console.log(`  🔧 [${this.name}] Calling tool: ${content.name}`);

            if (!tool) {
              console.error(`  ❌ Tool not found: ${content.name}`);
              toolResults.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: JSON.stringify({
                      error: `Tool ${content.name} not found`,
                    }),
                  },
                ],
              });
              continue;
            }

            try {
              const result = await tool.handler(content.input);
              const toolDuration = Date.now() - toolStartTime;

              console.log(`  ✅ Tool ${content.name} completed in ${toolDuration}ms`);

              toolCalls.push({
                tool_name: content.name,
                input: content.input,
                output: result,
                success: true,
                duration_ms: toolDuration,
              });

              toolResults.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: JSON.stringify(result),
                  },
                ],
              });
            } catch (error) {
              const toolDuration = Date.now() - toolStartTime;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              console.error(`  ❌ Tool ${content.name} failed: ${errorMessage}`);

              toolCalls.push({
                tool_name: content.name,
                input: content.input,
                output: null,
                success: false,
                error: errorMessage,
                duration_ms: toolDuration,
              });

              toolResults.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: JSON.stringify({ error: errorMessage }),
                    is_error: true,
                  },
                ],
              });
            }
          }
        }

        // Add assistant response and tool results to messages
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        messages.push(...toolResults);

        // Continue loop for next iteration
        continue;
      }

      // Max tokens or other stop reason
      console.log(`  ⚠️  Stop reason: ${response.stop_reason}`);
      const textContent = response.content.find((c) => c.type === 'text');
      return {
        response: textContent && textContent.type === 'text' ? textContent.text : null,
        toolCalls,
        tokensUsed: totalTokens,
      };
    }

    throw new Error(`Max iterations (${this.maxIterations}) reached`);
  }

  protected buildClaudeTools(): Anthropic.Tool[] {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data);
        break;
      case 'warn':
        console.warn(prefix, message, data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }
}
